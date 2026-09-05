<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { FormKitSchema } from '@formkit/vue'
import { getNode, type FormKitNode } from '@formkit/core'
import {
  buildMetadata,
  fetchDraft,
  fetchSchema,
  generateResumeToken,
  saveDraft,
  submitForm,
  type IntakeSchemaResponse,
} from './api'
// Logo TIS oficial inline (SVG ?raw) — mesmo asset/abordagem do Decisions: sem fetch externo, CSP-safe
import tisLogo from './assets/tis-logo.svg?raw'

type ViewState = 'loading' | 'ready' | 'submitted' | 'error'

// Nó do schema FormKit tal como o server o entrega (sub-set whitelisted, ADR-101)
interface SchemaNode {
  $formkit?: string
  name?: string
  label?: string
  validation?: unknown
  children?: SchemaNode[]
}

const state = ref<ViewState>('loading')
const errorMessage = ref('')
const successMessage = ref('')
const schemaData = ref<IntakeSchemaResponse | null>(null)
const respondent = ref('')

// Modelo reactivo do FormKit — populado à medida que o utilizador preenche
const formModel = ref<Record<string, unknown>>({})

const params = new URLSearchParams(window.location.search)
const formkey = params.get('formkey') || ''

// --- Drafts (S-1.5): guardar-e-retomar ---
const resumeToken = ref('')
const draftNotice = ref('')
const saveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const lastSavedAt = ref('')
const showResumePanel = ref(false)
const copied = ref(false)

// --- Wizard (S-1.5): um passo por grupo, navegação livre ---
const activeStep = ref(0)
const visitedSteps = ref(new Set<number>([0]))
const pendingMessage = ref('')
const submitting = ref(false)

const schemaFields = computed(() => (schemaData.value ? schemaData.value.schema.schema : []))
const submitLabel = computed(() => schemaData.value?.form_config?.submit_label || 'Enviar')

// layout: wizard | single | auto (auto = wizard quando >1 grupo E >15 campos)
const layoutSetting = computed(
  () => schemaData.value?.form_config?.layout ?? schemaData.value?.schema?.form_config?.layout ?? 'auto'
)

function countInputs(nodes: unknown[]): number {
  let n = 0
  for (const raw of nodes) {
    const node = raw as SchemaNode
    if (!node || typeof node !== 'object') continue
    if (node.$formkit && node.$formkit !== 'group' && node.$formkit !== 'hidden') n++
    if (Array.isArray(node.children)) n += countInputs(node.children)
  }
  return n
}

const allTopLevelGroups = computed(() => {
  const nodes = schemaFields.value as SchemaNode[]
  return nodes.length > 1 && nodes.every((n) => n && typeof n === 'object' && n.$formkit === 'group' && !!n.name)
})

const isWizard = computed(() => {
  if (!schemaData.value) return false
  if (layoutSetting.value === 'single') return false
  if (!allTopLevelGroups.value) return false
  if (layoutSetting.value === 'wizard') return true
  return countInputs(schemaFields.value) > 15
})

const wizardGroups = computed<SchemaNode[]>(() => (isWizard.value ? (schemaFields.value as SchemaNode[]) : []))

function cleanLabel(label: string): string {
  return label.replace(/^\s*\d+[.)]\s*/, '').split('—')[0].trim()
}

// --- estado das tabs: completa / incompleta / por visitar ---
function isRequired(node: SchemaNode): boolean {
  const v = node.validation
  if (typeof v === 'string') return v.split('|').some((r) => r.trim().startsWith('required'))
  if (Array.isArray(v)) return v.some((r) => (Array.isArray(r) ? r[0] === 'required' : r === 'required'))
  return false
}

function isFilled(v: unknown): boolean {
  if (v === undefined || v === null) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (typeof v === 'boolean') return v
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.values(v as object).some(isFilled)
  return true
}

function stepStatus(g: SchemaNode, i: number): 'complete' | 'incomplete' | 'unvisited' {
  const data = (formModel.value[g.name ?? ''] ?? {}) as Record<string, unknown>
  const kids = (g.children ?? []).filter((c) => c && c.$formkit && c.$formkit !== 'hidden' && c.name)
  const required = kids.filter(isRequired)
  const filled = required.filter((k) => isFilled(data[k.name as string]))
  if (required.length > 0 && filled.length === required.length) return 'complete'
  if (required.length === 0) return visitedSteps.value.has(i) ? 'complete' : 'unvisited'
  if (filled.length > 0 || visitedSteps.value.has(i)) return 'incomplete'
  return 'unvisited'
}

function goToStep(i: number) {
  if (i < 0 || i >= wizardGroups.value.length || i === activeStep.value) return
  visitedSteps.value.add(activeStep.value)
  visitedSteps.value.add(i)
  activeStep.value = i
  pendingMessage.value = ''
  // guardar ao mudar de secção (spec S-1.5)
  flushSave()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// --- autosave debounced (12s) + flush ao mudar de tab / esconder página ---
let saveTimer: number | undefined
let lastSavedJson = ''

function snapshot(): string {
  return JSON.stringify({ f: formModel.value, r: respondent.value })
}

function hasAnyContent(): boolean {
  return isFilled(formModel.value) || respondent.value.trim() !== ''
}

function scheduleSave() {
  if (state.value !== 'ready') return
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void doSave(), 12000)
}

function flushSave(keepalive = false) {
  if (saveTimer) {
    window.clearTimeout(saveTimer)
    saveTimer = undefined
  }
  void doSave(keepalive)
}

// Saves são SERIALIZADOS: um POST de cada vez, sempre com o modelo mais recente.
// Sem isto, dois flushes rápidos (ex.: duas mudanças de tab seguidas) podem chegar
// ao servidor fora de ordem e o payload antigo sobrepor o novo (bug apanhado em teste 05/09).
let saveInFlight: Promise<void> | null = null

async function doSave(keepalive = false): Promise<boolean> {
  // espera por qualquer save em curso — depois re-avalia com o snapshot ACTUAL
  while (saveInFlight) {
    try {
      await saveInFlight
    } catch {
      /* o erro já foi tratado por quem lançou */
    }
  }
  if (state.value !== 'ready' || !schemaData.value) return false
  if (!hasAnyContent()) return false
  const snap = snapshot()
  if (snap === lastSavedJson) return true
  if (!resumeToken.value) {
    resumeToken.value = generateResumeToken()
    syncUrlToken()
  }
  saveState.value = 'saving'
  const post = saveDraft(
    {
      formkey,
      resume_token: resumeToken.value,
      form_data: formModel.value,
      respondent: respondent.value.trim() || null,
      current_step: wizardGroups.value[activeStep.value]?.name ?? null,
    },
    keepalive
  )
  saveInFlight = post.then(
    () => undefined,
    () => undefined
  )
  try {
    await post
    lastSavedJson = snap
    lastSavedAt.value = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    saveState.value = 'saved'
    return true
  } catch {
    saveState.value = 'error'
    return false
  } finally {
    saveInFlight = null
  }
}

const resumeLink = computed(
  () =>
    `${window.location.origin}${window.location.pathname}?formkey=${encodeURIComponent(formkey)}&r=${encodeURIComponent(resumeToken.value)}`
)

function syncUrlToken() {
  if (!resumeToken.value) return
  const url = new URL(window.location.href)
  url.searchParams.set('r', resumeToken.value)
  window.history.replaceState(null, '', url.toString())
}

async function onSaveForLater() {
  if (saveTimer) {
    window.clearTimeout(saveTimer)
    saveTimer = undefined
  }
  if (!hasAnyContent()) {
    errorMessage.value = 'Preenche pelo menos um campo antes de guardar o rascunho.'
    return
  }
  errorMessage.value = ''
  const ok = await doSave()
  if (ok) showResumePanel.value = true
  else errorMessage.value = 'Não foi possível guardar o rascunho. Volta a tentar em segundos.'
}

async function copyResumeLink() {
  try {
    await navigator.clipboard.writeText(resumeLink.value)
    copied.value = true
    window.setTimeout(() => (copied.value = false), 2000)
  } catch {
    /* clipboard indisponível — o input readonly é seleccionável */
  }
}

watch([formModel, respondent], () => scheduleSave(), { deep: true })

function onVisibilityChange() {
  if (
    document.visibilityState === 'hidden' &&
    state.value === 'ready' &&
    hasAnyContent() &&
    snapshot() !== lastSavedJson
  ) {
    flushSave(true)
  }
}

onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  if (!formkey) {
    state.value = 'error'
    errorMessage.value = 'Falta o parâmetro formkey no URL. Este link parece incompleto.'
    return
  }
  try {
    const data = await fetchSchema(formkey)
    schemaData.value = data
    document.title = data.title + ' — TIS Smart Form'

    // Retoma de rascunho (?r=<token>) — hidrata ANTES de mostrar o formulário
    const rParam = params.get('r') || ''
    let pendingStep: string | null = null
    if (rParam) {
      const draft = await fetchDraft(rParam).catch(() => null)
      if (draft?.ok && !draft.consumed && draft.form_id === formkey) {
        formModel.value = (draft.form_data ?? {}) as Record<string, unknown>
        respondent.value = (draft.respondent as string) || ''
        resumeToken.value = rParam
        pendingStep = (draft.current_step as string) || null
        lastSavedJson = snapshot()
        if (draft.updated_at)
          lastSavedAt.value = new Date(draft.updated_at).toLocaleTimeString('pt-PT', {
            hour: '2-digit',
            minute: '2-digit',
          })
        draftNotice.value = 'Rascunho retomado — continua onde ficaste.'
      } else if (draft?.ok && draft.consumed) {
        draftNotice.value = 'Este rascunho já foi submetido. Um novo preenchimento começa do zero.'
      } else {
        draftNotice.value = 'O rascunho deste link já não existe (expirou ou foi removido). Começas do zero.'
      }
    }

    state.value = 'ready'

    // Repor a secção activa no wizard + marcar secções com conteúdo como visitadas
    if (isWizard.value) {
      wizardGroups.value.forEach((g, i) => {
        if (isFilled(formModel.value[g.name ?? ''])) visitedSteps.value.add(i)
      })
      if (pendingStep) {
        const idx = wizardGroups.value.findIndex((g) => g.name === pendingStep)
        if (idx >= 0) {
          activeStep.value = idx
          visitedSteps.value.add(idx)
        }
      }
    }
  } catch (e) {
    state.value = 'error'
    errorMessage.value = (e as Error).message || 'Não foi possível carregar o formulário.'
  }
})

onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisibilityChange))

// --- submissão final: validação bloqueante só aqui (navegação é sempre livre) ---
function triggerSubmit() {
  getNode('intake-form')?.submit()
}

function onSubmitInvalid(node: FormKitNode) {
  const bad: string[] = []
  let firstIdx = -1
  if (isWizard.value) {
    wizardGroups.value.forEach((g, i) => {
      visitedSteps.value.add(i)
      const gnode = (node.children as FormKitNode[]).find((c) => c.name === g.name)
      const invalid = gnode?.context ? gnode.context.state.valid === false : stepStatus(g, i) !== 'complete'
      if (invalid) {
        bad.push(cleanLabel(g.label ?? g.name ?? `Secção ${i + 1}`))
        if (firstIdx < 0) firstIdx = i
      }
    })
  }
  if (bad.length > 0) {
    pendingMessage.value = `Faltam campos obrigatórios (ou com valores inválidos) nas secções: ${bad.join(' · ')}.`
    if (firstIdx >= 0 && firstIdx !== activeStep.value) activeStep.value = firstIdx
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    pendingMessage.value = 'Há campos obrigatórios por preencher ou com valores inválidos.'
  }
}

async function onSubmit(data: Record<string, unknown>) {
  if (!schemaData.value) return
  const respondentRequired = schemaData.value.respondent_required
  const respondentClean = respondent.value.trim()
  // Guard-rail: server-side também valida, mas apanhamos aqui para UX imediata
  if (respondentRequired && !respondentClean) {
    errorMessage.value = 'O nome do respondente é obrigatório neste formulário.'
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  errorMessage.value = ''
  pendingMessage.value = ''
  submitting.value = true
  try {
    await submitForm({
      formkey,
      respondent: respondentClean || null,
      form_data: data,
      metadata: buildMetadata(),
      submitted_at: new Date().toISOString(),
    })
    // Rascunho marcado como consumido: nunca conta como submissão (é o submit que conta)
    if (saveTimer) {
      window.clearTimeout(saveTimer)
      saveTimer = undefined
    }
    if (resumeToken.value) {
      void saveDraft({
        formkey,
        resume_token: resumeToken.value,
        form_data: data,
        respondent: respondentClean || null,
        consumed: true,
      }).catch(() => {})
    }
    successMessage.value = schemaData.value.form_config?.success_message || 'Submissão recebida. Obrigado.'
    state.value = 'submitted'
  } catch (e) {
    errorMessage.value = (e as Error).message || 'Erro a submeter. Volta a tentar em segundos.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="tis-header">
    <span class="tis-brand" role="img" aria-label="TIS" v-html="tisLogo"></span>
    <span v-if="schemaData?.is_test" class="tis-tag tis-tag-test">TESTE</span>
    <span v-else class="tis-tag">INTAKE</span>
  </div>

  <div v-if="state === 'loading'" class="tis-card tis-state">
    <div class="tis-loading"></div>
    <h2>A carregar formulário…</h2>
  </div>

  <div v-else-if="state === 'error'" class="tis-card tis-state tis-state-error">
    <h2>Não foi possível carregar</h2>
    <p>{{ errorMessage }}</p>
  </div>

  <div v-else-if="state === 'submitted'" class="tis-card tis-state tis-state-success">
    <h2>✓ Recebido</h2>
    <p>{{ successMessage }}</p>
  </div>

  <div v-else-if="state === 'ready' && schemaData" class="tis-card">
    <span v-if="schemaData.category" class="tis-category">{{ schemaData.category }}</span>
    <h1 class="tis-title">{{ schemaData.title }}</h1>
    <p v-if="schemaData.subtitle" class="tis-subtitle">{{ schemaData.subtitle }}</p>

    <div v-if="draftNotice" class="tis-draft-notice">{{ draftNotice }}</div>

    <!-- Campo respondent SÓ aparece quando o schema declara respondent_required=true.
         Se o agente MCP quiser um respondente opcional, adiciona um campo normal ao schema. -->
    <div v-if="schemaData.respondent_required" class="tis-respondent">
      <FormKit
        v-model="respondent"
        type="text"
        name="respondent"
        label="Quem responde?"
        help="Obrigatório para identificar a submissão."
        validation="required|length:2,200"
        :validation-messages="{ required: 'O nome do respondente é obrigatório.', length: 'Nome entre 2 e 200 caracteres.' }"
      />
    </div>

    <template v-if="isWizard">
      <nav class="tis-tabs" role="tablist" aria-label="Secções do formulário">
        <button
          v-for="(g, i) in wizardGroups"
          :key="g.name ?? i"
          type="button"
          role="tab"
          class="tis-tab"
          :class="[`tis-tab-${stepStatus(g, i)}`, { 'tis-tab-active': i === activeStep }]"
          :aria-selected="i === activeStep"
          :title="g.label ?? ''"
          @click="goToStep(i)"
        >
          <span class="tis-tab-num">
            <template v-if="stepStatus(g, i) === 'complete'">✓</template>
            <template v-else>{{ i + 1 }}</template>
          </span>
          <span class="tis-tab-label">{{ cleanLabel(g.label ?? g.name ?? '') }}</span>
        </button>
      </nav>
      <div class="tis-progress-row">
        <span class="tis-progress-text">Secção {{ activeStep + 1 }} de {{ wizardGroups.length }}</span>
        <div class="tis-progress-bar">
          <div class="tis-progress-fill" :style="{ width: ((activeStep + 1) / wizardGroups.length) * 100 + '%' }"></div>
        </div>
      </div>
    </template>

    <FormKit
      id="intake-form"
      type="form"
      v-model="formModel"
      :actions="!isWizard"
      :submit-label="submitLabel"
      :submit-attrs="{ 'data-testid': 'intake-submit' }"
      @submit="onSubmit"
      @submit-invalid="onSubmitInvalid"
    >
      <!-- Wizard: todos os grupos ficam montados (valores preservados); só o activo é visível -->
      <template v-if="isWizard">
        <div v-for="(g, i) in wizardGroups" :key="g.name ?? i" v-show="i === activeStep" class="tis-step">
          <FormKitSchema :schema="[g] as any" />
        </div>
      </template>
      <FormKitSchema v-else :schema="schemaFields as any" />
    </FormKit>

    <div v-if="isWizard" class="tis-wizard-footer">
      <button type="button" class="tis-btn tis-btn-ghost" :disabled="activeStep === 0" @click="goToStep(activeStep - 1)">
        ← Anterior
      </button>
      <button
        v-if="activeStep < wizardGroups.length - 1"
        type="button"
        class="tis-btn tis-btn-primary"
        @click="goToStep(activeStep + 1)"
      >
        Seguinte →
      </button>
      <button
        v-else
        type="button"
        class="tis-btn tis-btn-primary"
        data-testid="intake-submit"
        :disabled="submitting"
        @click="triggerSubmit"
      >
        {{ submitting ? 'A enviar…' : submitLabel }}
      </button>
    </div>

    <p v-if="pendingMessage" class="tis-pending">{{ pendingMessage }}</p>
    <p v-if="errorMessage" class="formkit-message" style="margin-top: 12px;">{{ errorMessage }}</p>

    <div class="tis-savebar">
      <button type="button" class="tis-save-later" @click="onSaveForLater">Guardar e continuar depois</button>
      <span v-if="saveState === 'saving'" class="tis-save-status">A guardar…</span>
      <span v-else-if="lastSavedAt" class="tis-save-status">Rascunho guardado às {{ lastSavedAt }}</span>
      <span v-else-if="saveState === 'error'" class="tis-save-status tis-save-error">Falha ao guardar o rascunho</span>
    </div>

    <div v-if="showResumePanel" class="tis-resume-panel">
      <p>Guarda este link — permite retomar o preenchimento mais tarde, neste ou noutro dispositivo:</p>
      <div class="tis-resume-row">
        <input
          class="tis-resume-input"
          readonly
          :value="resumeLink"
          @focus="($event.target as HTMLInputElement).select()"
        />
        <button type="button" class="tis-btn tis-btn-primary" @click="copyResumeLink">
          {{ copied ? 'Copiado ✓' : 'Copiar' }}
        </button>
      </div>
    </div>
  </div>
</template>
