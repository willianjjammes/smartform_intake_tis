-- TIS Smart Form: Intake — schema inicial Sprint 0
-- ADR-103: tabelas dedicadas intake_forms + intake_submissions no mesmo projecto FormMCP
-- ADR-102: submissoes faz INSERT, nao UPSERT (sem UNIQUE composto)
-- ADR-101: schema jsonb valida sub-set FormKit server-side (worker), nao Postgres
--
-- Aplicado em: 2026-08-29 via mcp Supabase (migration `intake_forms_and_submissions`)
-- Projecto: FormMCP (etzblmrzehskdmeoyxvv)

-- =========================================================================
-- Tabela: intake_forms
-- Cada linha e um formulario Intake gerado por um agente MCP.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.intake_forms (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            text NOT NULL UNIQUE,
  title                 text NOT NULL,
  subtitle              text,
  schema                jsonb NOT NULL,
  schema_version        int NOT NULL DEFAULT 1,
  category              text,
  is_test               boolean NOT NULL DEFAULT false,
  respondent_required   boolean NOT NULL DEFAULT false,
  form_config           jsonb,
  created_by            text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.intake_forms IS 'TIS Smart Form: Intake - formularios gerados por agentes MCP. Sub-set restrito do FormKit schema. Ver PRD-intake-v0.1 secao 6.1 e ADR-103.';
COMMENT ON COLUMN public.intake_forms.session_id IS 'Capability slug legivel (ex. onboarding-fornecedor-1787747-abc). UNIQUE para lookup pelo webhook.';
COMMENT ON COLUMN public.intake_forms.schema IS 'FormKit schema JSON (sub-set whitelist). Validado pelo [WORKER] Intake Create Form via Code node.';
COMMENT ON COLUMN public.intake_forms.respondent_required IS 'Se true, submit obriga campo respondent (default false no Intake, diferente do Decisions v2.3 que default true).';
COMMENT ON COLUMN public.intake_forms.form_config IS 'Config UI (submit_label, success_message, etc.) separada do schema por clareza.';
COMMENT ON COLUMN public.intake_forms.is_test IS 'Default false (contrastando com Decisions default true) - Intake e primariamente producao.';

CREATE INDEX IF NOT EXISTS idx_intake_forms_category ON public.intake_forms(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intake_forms_is_test ON public.intake_forms(is_test) WHERE is_test = false;
CREATE INDEX IF NOT EXISTS idx_intake_forms_created_at ON public.intake_forms(created_at DESC);

-- =========================================================================
-- Tabela: intake_submissions
-- Cada linha e uma submissao. INSERT-only (nao UPSERT) - ADR-102.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.intake_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    text NOT NULL,
  respondent    text,
  form_data     jsonb NOT NULL,
  raw_payload   jsonb,
  metadata      jsonb,
  client_ip     text,
  is_test       boolean NOT NULL DEFAULT false,
  submitted_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.intake_submissions IS 'TIS Smart Form: Intake - submissoes. INSERT-only, sem UNIQUE (session_id, respondent) - cada submit e registo novo. Ver ADR-102.';
COMMENT ON COLUMN public.intake_submissions.session_id IS 'FK logica (nao enforced) para intake_forms.session_id. Validada pelo webhook.';
COMMENT ON COLUMN public.intake_submissions.respondent IS 'Nullable. Presente apenas se intake_forms.respondent_required=true no form correspondente.';
COMMENT ON COLUMN public.intake_submissions.form_data IS 'Dados estruturados respeitando o schema FormKit (nested groups como sub-objects, repeaters como arrays).';
COMMENT ON COLUMN public.intake_submissions.raw_payload IS 'Body completo do POST (auditoria + debug de casos raros).';
COMMENT ON COLUMN public.intake_submissions.metadata IS 'user_agent, language, screen, context - passado pelo frontend.';
COMMENT ON COLUMN public.intake_submissions.client_ip IS 'Header cf-connecting-ip. Para rate-limit e forensic.';

CREATE INDEX IF NOT EXISTS idx_intake_submissions_session_id ON public.intake_submissions(session_id);
CREATE INDEX IF NOT EXISTS idx_intake_submissions_submitted_at ON public.intake_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_intake_submissions_created_at ON public.intake_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intake_submissions_is_test ON public.intake_submissions(is_test) WHERE is_test = false;

-- =========================================================================
-- RLS: mantido desabilitado (padrao TIS herdado do Decisions - defesa em
-- profundidade via webhook validation + capability JWT + CORS + CSP).
-- Ver PRD-intake-v0.1 secao 6 e ADRs de familia 020, 024, 025.
-- =========================================================================
