<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { FormKitSchema } from '@formkit/vue'
import { buildMetadata, fetchSchema, submitForm, type IntakeSchemaResponse } from './api'

type ViewState = 'loading' | 'ready' | 'submitted' | 'error'

const state = ref<ViewState>('loading')
const errorMessage = ref<string>('')
const successMessage = ref<string>('')
const schemaData = ref<IntakeSchemaResponse | null>(null)
const respondent = ref<string>('')

// Modelo reactivo do FormKit — populado à medida que o utilizador preenche
const formModel = ref<Record<string, unknown>>({})

const params = new URLSearchParams(window.location.search)
const formkey = params.get('formkey') || ''

const schemaFields = computed(() => (schemaData.value ? schemaData.value.schema.schema : []))
const submitLabel = computed(() => schemaData.value?.form_config?.submit_label || 'Enviar')

onMounted(async () => {
  if (!formkey) {
    state.value = 'error'
    errorMessage.value = 'Falta o parâmetro formkey no URL. Este link parece incompleto.'
    return
  }
  try {
    const data = await fetchSchema(formkey)
    schemaData.value = data
    state.value = 'ready'
    document.title = data.title + ' — TIS Smart Form'
  } catch (e) {
    state.value = 'error'
    errorMessage.value = (e as Error).message || 'Não foi possível carregar o formulário.'
  }
})

async function onSubmit(data: Record<string, unknown>) {
  if (!schemaData.value) return
  const respondentRequired = schemaData.value.respondent_required
  const respondentClean = respondent.value.trim()
  if (respondentRequired && !respondentClean) {
    errorMessage.value = 'O nome do respondente é obrigatório neste formulário.'
    return
  }
  try {
    await submitForm({
      formkey,
      respondent: respondentClean || null,
      form_data: data,
      metadata: buildMetadata(),
      submitted_at: new Date().toISOString(),
    })
    successMessage.value = schemaData.value.form_config?.success_message || 'Submissão recebida. Obrigado.'
    state.value = 'submitted'
  } catch (e) {
    errorMessage.value = (e as Error).message || 'Erro a submeter. Volta a tentar em segundos.'
  }
}
</script>

<template>
  <div class="tis-header">
    <span class="tis-logo">TIS Smart Form</span>
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

    <div v-if="schemaData.respondent_required || true" class="tis-respondent">
      <FormKit
        v-model="respondent"
        type="text"
        name="respondent"
        :label="schemaData.respondent_required ? 'Quem responde? *' : 'Quem responde? (opcional)'"
        :help="schemaData.respondent_required ? 'Obrigatório para identificar a submissão.' : 'Opcional. Se preferires responder anonimamente, deixa em branco.'"
      />
    </div>

    <FormKit
      type="form"
      :submit-label="submitLabel"
      :submit-attrs="{ 'data-testid': 'intake-submit' }"
      @submit="onSubmit"
      v-model="formModel"
    >
      <FormKitSchema :schema="schemaFields as any" />
    </FormKit>

    <p v-if="errorMessage" class="formkit-message" style="margin-top: 12px;">{{ errorMessage }}</p>
  </div>
</template>
