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
  form_config: { submit_label?: string; success_message?: string } | null
  created_at: string
  // schema é o objecto FormKit sub-set completo
  schema: {
    schema_version: number
    title: string
    subtitle?: string
    category?: string
    schema: unknown[]
    form_config?: { submit_label?: string; success_message?: string }
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

export function buildMetadata(): Record<string, unknown> {
  return {
    user_agent: navigator.userAgent,
    language: navigator.language,
    screen: `${window.screen.width}x${window.screen.height}`,
    referrer: document.referrer || null,
    submitted_from: 'intake.tisapp.ai',
  }
}
