// API helpers para os webhooks do TIS Smart Form: Intake
// Endpoints em n8n cloud (ver ADR-018/024)

const N8N_BASE = 'https://willianjammes.app.n8n.cloud'

export interface IntakeSchemaResponse {
  ok: boolean
  session_id: string
  title: string
  subtitle: string | null
  schema_version: number
  category: string | null
  is_test: boolean
  respondent_required: boolean
  form_config: { submit_label?: string; success_message?: string; layout?: 'wizard' | 'single' | 'auto' } | null
  created_at: string
  // schema é o objecto FormKit sub-set completo
  schema: {
    schema_version: number
    title: string
    subtitle?: string
    category?: string
    schema: unknown[]
    form_config?: { submit_label?: string; success_message?: string; layout?: 'wizard' | 'single' | 'auto' }
  }
}

export interface IntakeSchemaError {
  ok: false
  error: string
  message?: string
}

export interface IntakeSubmitResponse {
  ok: boolean
  submission_id?: string
  created_at?: string
  error?: string
  status_http?: number
}

export async function fetchSchema(formkey: string): Promise<IntakeSchemaResponse> {
  const url = `${N8N_BASE}/webhook/intake-schema?formkey=${encodeURIComponent(formkey)}`
  const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as IntakeSchemaError
    throw new Error(body.message || body.error || `Erro ${res.status} ao carregar formulário`)
  }
  return (await res.json()) as IntakeSchemaResponse
}

export interface SubmitPayload {
  formkey: string
  respondent: string | null
  form_data: Record<string, unknown>
  metadata: Record<string, unknown>
  submitted_at: string
}

export async function submitForm(payload: SubmitPayload): Promise<IntakeSubmitResponse> {
  const url = `${N8N_BASE}/webhook/intake-submit`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = (await res.json().catch(() => ({}))) as IntakeSubmitResponse
  if (!res.ok) {
    throw new Error(body.error || `Erro ${res.status} ao submeter`)
  }
  return body
}

// ---------------------------------------------------------------------------
// Drafts (S-1.5): guardar-e-retomar via /webhook/intake-draft
// resume_token é uma capability própria gerada no cliente (ADR: distinta do formkey)
// ---------------------------------------------------------------------------

export interface DraftSavePayload {
  formkey: string
  resume_token: string
  form_data: Record<string, unknown>
  respondent?: string | null
  current_step?: string | null
  consumed?: boolean
  saved_at?: string
}

export interface DraftSaveResponse {
  ok: boolean
  resume_token?: string
  saved_at?: string
  error?: string
  status_http?: number
}

export interface DraftGetResponse {
  ok: boolean
  status_http?: number
  resume_token?: string
  form_id?: string
  form_data?: Record<string, unknown>
  respondent?: string | null
  current_step?: string | null
  updated_at?: string
  consumed?: boolean
  error?: string
}

export function generateResumeToken(): string {
  // 32 chars do alfabeto [A-Za-z0-9_-] via crypto — cumpre ^[A-Za-z0-9_-]{16,64}$
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let token = ''
  for (let i = 0; i < bytes.length; i++) token += alphabet[bytes[i] % alphabet.length]
  return token
}

export async function saveDraft(payload: DraftSavePayload, keepalive = false): Promise<DraftSaveResponse> {
  const url = `${N8N_BASE}/webhook/intake-draft`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ saved_at: new Date().toISOString(), ...payload }),
    keepalive,
  })
  const body = (await res.json().catch(() => ({}))) as DraftSaveResponse
  if (!res.ok) {
    throw new Error(body.error || `Erro ${res.status} ao guardar rascunho`)
  }
  return body
}

export async function fetchDraft(resumeToken: string): Promise<DraftGetResponse> {
  const url = `${N8N_BASE}/webhook/intake-draft?r=${encodeURIComponent(resumeToken)}`
  const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } })
  const body = (await res.json().catch(() => ({}))) as DraftGetResponse
  // 404/422 não são fatais — o caller decide (recomeça de formulário vazio)
  return { ...body, status_http: body.status_http ?? res.status }
}

export function buildMetadata(): Record<string, unknown> {
  return {
    user_agent: navigator.userAgent,
    language: navigator.language,
    screen: `${window.screen.width}x${window.screen.height}`,
    referrer: document.referrer || null,
    submitted_from: 'intake.tisapp.ai',
  }
}
