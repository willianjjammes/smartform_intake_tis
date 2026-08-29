# SPEC — TIS Smart Form: Intake

**Versão:** v0.1
**Data:** 2026-08-26
**Autor:** Willian Jammes — TIS Tech Angola
**Status:** Draft — arranca implementação Sprint 0
**PRD de origem:** [`../docs/PRD-intake-v0.1.md`](../docs/PRD-intake-v0.1.md)

Este SPEC cobre o específico do Intake. Arquitectura partilhada em [PLATFORM-SPEC](https://github.com/willianjjammes/smartform_platform_tis/blob/main/docs/PLATFORM-SPEC.md).

---

## 1. Endpoints específicos

| Endpoint | Método | Consumidor |
|---|---|---|
| `https://willianjammes.app.n8n.cloud/mcp/mcp-intake` | HTTP MCP | Agente IA |
| `https://willianjammes.app.n8n.cloud/webhook/intake-schema` | GET | Frontend |
| `https://willianjammes.app.n8n.cloud/webhook/intake-submit` | POST | Frontend |
| `https://intake.tisapp.ai/?formkey=xxx` | GET | Respondente |

## 2. Requisitos Funcionais

**RF-Intake-01:** MCP Server + 6 tools + 2 webhooks conforme PRD §8.

**RF-Intake-02:** Schema Intake é sub-set restrito do FormKit schema. Validado no `[WORKER] Intake Create Form` — rejeita se usa `$formkit` types fora da whitelist ou expressões condicionais complexas. Ver ADR-101.

**RF-Intake-03:** Submissão faz **INSERT** por submit (não UPSERT como no Decisions). Ver ADR-102.

**RF-Intake-04:** Frontend renderiza `<FormKitSchema>` do FormKit oficial com sub-set validado.

**RF-Intake-05:** Sanitize + caps do ADR-030 da família aplicados a `respondent`, campos custom, textareas.

## 3. Requisitos Não-Funcionais

Herdados da família. Específicos:

**RNF-Intake-01:** Bundle frontend ≤ 250 KB gzipped (Vite tree-shakes FormKit).

**RNF-Intake-02:** Validação FormKit sub-set (ADR-101) rejeita expressões perigosas antes de persistir schema.

**RNF-Intake-03:** `repeater` limitado a `max ≤ 20`; regex `matches` ≤ 200 chars.

**RNF-Intake-04:** CSP pode precisar de emenda para `unsafe-inline` no `style-src` — a confirmar em Sprint 0 empiricamente. Se sim, emenda ao ADR-025 restrita a `intake.tisapp.ai`.

## 4. Modelo de dados

Ver PRD §6. Tabelas `intake_forms` + `intake_submissions`. Sem UNIQUE em `(session_id, respondent)` — cada submit cria linha (ADR-102).

DDL em `supabase/schema.sql`.

## 5. Critérios de Aceitação

| # | Critério | Validação |
|---|---|---|
| CA-01 | `create_intake_form` valida schema e retorna URL | Chamada Claude; INSERT; URL retornada |
| CA-02 | Schema com `$formkit: script` é rejeitado | POST → 422 pt-PT |
| CA-03 | Schema com `repeater max: 50` é rejeitado | POST → 422 pt-PT |
| CA-04 | Frontend renderiza exemplo de cadastro fornecedor | Teste manual |
| CA-05 | Condicional `if: $get(entidade.tipo).value === PJ` funciona | Preencher cliente PS vs PJ; ver campo alvará |
| CA-06 | Repeater "contactos" com min:1 max:5 | Adicionar 6 → botão desactiva; remover para 1 → botão remove desactiva |
| CA-07 | Submit grava linha em `intake_submissions` | SELECT após submit |
| CA-08 | Segundo submit do mesmo respondent NÃO faz UPSERT | 2 submits → 2 linhas distintas em `intake_submissions` |
| CA-09 | `get_intake_submissions` devolve array | Chamada Claude após 2 submits → 2 elementos |
| CA-10 | CSP + HSTS activos em `intake.tisapp.ai` | `curl -I` mostra headers |

## 6. Rastreabilidade

- **ADRs de família:** 011, 015, 016, 018, 020, 021, 022, 023, 024, 025 (potencial emenda), 028, 029, 030
- **ADRs específicos:** 100-104
- **PRD:** `../docs/PRD-intake-v0.1.md`

---

**Última revisão:** 2026-08-26 (v0.1)
