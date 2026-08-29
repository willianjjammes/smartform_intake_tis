# ADR-103: Tabelas `intake_forms` e `intake_submissions`

**Data:** 2026-08-26
**Status:** Aceite (v0.1)
**Decisor:** Willian Jammes
**Contexto de produto:** TIS Smart Form: Intake — Sprint 0

## Contexto

O Intake precisa de tabelas dedicadas. Opções:

1. Reutilizar `questionnaires` + `responses` do Decisions com discriminador
2. Novas tabelas `intake_forms` + `intake_submissions` no mesmo projecto Supabase

## Decisão

Novas tabelas `intake_forms` + `intake_submissions` no mesmo projecto `FormMCP`. Ver PRD §6 para colunas.

Racional:

- Schema jsonb do Decisions tem estrutura R1–R11; schema jsonb do Intake tem estrutura FormKit sub-set — diferentes o suficiente para justificar tabelas separadas
- `responses` do Decisions tem `respondent NOT NULL` (com emenda v2.3 para nullable); `intake_submissions` tem `respondent NULLABLE` sem UNIQUE — semânticas distintas
- Consultas do agente ficam mais claras (`SELECT * FROM intake_submissions WHERE ...`) vs. joins com discriminador
- Custo negligível (2 tabelas extra no mesmo projecto Supabase — mesmo billing)

### Colunas específicas do Intake

Ver PRD §6.1 (`intake_forms`) e §6.2 (`intake_submissions`). Notas:

- `intake_forms.respondent_required` default `false` (contrastando com Decisions que default `true` na v2.3) — cadastros/onboardings frequentemente pedem identificação, mas não é regra
- `intake_submissions.form_data` guarda estrutura respeitando o schema (groups como sub-objects, repeaters como arrays) — reutilizável directamente pelo Claude sem processamento adicional

## Alternativas rejeitadas

- **Reutilizar tabelas do Decisions com discriminador `subproduct: 'decisions' | 'intake'`** — força SELECTs com WHERE em todo lado; complica índices; corrompe semântica R1-R11 quando aplicado a Intake
- **Projecto Supabase separado** — over-engineering; billing distinto sem benefício; migração de dados cruzados complexa
- **Schema `public.intake.*` (Postgres schemas)** — Supabase suporta mas Node Supabase do n8n complica; convenção da família é public schema

## Consequências

- Two new tables no projecto `FormMCP`
- DDL em `supabase/schema.sql` do repo
- Migrations futuras (add coluna) são individuais por tabela — sem risco de acoplar Decisions e Intake
- Cross-cutting queries (ex.: "quantos formulários total nos dois subprodutos") requerem UNION explícito — aceitável

## Rastreabilidade

- **Depende de:** ADR-020 (Supabase via node n8n — mesma credencial)
- **Aplicado em:** PRD §6, SPEC-intake §4
