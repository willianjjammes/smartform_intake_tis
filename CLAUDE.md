# CLAUDE.md — TIS Smart Form: Intake

Subproduto da família **TIS Smart Form**. Ver [`PLATFORM-CLAUDE.md`](https://github.com/willianjjammes/smartform_platform_tis/blob/main/PLATFORM-CLAUDE.md) para regras que atravessam os três subprodutos.

## O que é este subproduto

Formulários de **recolha complexa de informação** com validação rica, condicionais, repeaters. Optimizado para cadastros, onboarding, discovery técnico denso.

**Estado:** Sprint 0 fechado; **S-1 e S-1.5 fechados 2026-09-05**. MCP com 7 tools reais em produção. Frontend live com **wizard por tabs + guardar-e-retomar** (drafts com `resume_token`).

## Ordem de leitura

1. `PLATFORM-CLAUDE.md` do repo de plataforma
2. Este documento
3. `docs/PRD-intake-v0.1.md`
4. `docs/adr/` (100-104)
5. `skills/smartintake/SKILL.md` — como o Claude Cowork deve usar o MCP

## Regras específicas

1. **Schema é sub-set restrito do FormKit** ([ADR-101](./docs/adr/101-schema-derivado-formkit-com-whitelist-server-side.md)) — nunca aceitar `$formkit` types fora da whitelist do Code node, nunca deixar expressões complexas em `if`, sempre limitar `repeater max` e `matches` regex length. Em v0.1 `repeater` e `if` conditional são **rejeitados 422** (requerem FormKit Enterprise) — usar workarounds documentados na skill `smartintake`.

2. **Submissão faz INSERT, não UPSERT** ([ADR-102](./docs/adr/102-submissoes-insert-nao-upsert.md)) — cada submit é registo novo. Se o mesmo respondente enviar duas vezes, ficam duas linhas. Se o negócio precisar de "última resposta vence" para algum formulário, esse formulário é para o **Decisions**, não para o Intake.

3. **Frontend usa Vue+FormKit+Vite** ([ADR-100](./docs/adr/100-frontend-vue-formkit.md)) — inverte deliberadamente ADR-004 do Decisions. Custo de build aceite pelo valor de UX rica.

4. **CSP pode precisar de emenda** ([ADR-025](https://github.com/willianjjammes/smartform_platform_tis/blob/main/docs/adr/025-csp-hsts-frontend.md) da família) — se FormKit precisar de `unsafe-inline` no `style-src`, emenda restrita a `intake.tisapp.ai`. Confirmar empiricamente em Sprint 0.

## MCP `SmartFormIntake` — 7 tools em produção

Router `[POC] SmartForm Intake` (workflow n8n `gsBJJtkP6EYWhWMY`), 7 tools registadas:

| # | Tool | Worker workflow ID | Estado |
|---|---|---|---|
| 1 | `ping` | `9bgwqgW96824keFW` | real |
| 2 | `get_intake_example` | `drUbrHr40bv5Dswf` | real |
| 3 | `create_intake_form` | `W4CbyW3turAzisBa` | real |
| 4 | `get_intake_form` | `mvglJBOkVkBcFlVO` | real (S-1: já estava implementada; descrição stale «501» corrigida 2026-09-05) |
| 5 | `get_intake_status` | `lGpq5FlLg0jFUqI2` | real (idem) |
| 6 | `get_intake_submissions` | `BbcIabaBhdD3k8vV` | real (idem) |
| 7 | `list_intake_forms` | `5Igh2LQpyHA5f1GO` | **real (add-on 2026-08-30)** |

Adicionalmente, 3 workers webhook públicos (não são tools MCP):
- `GET /webhook/intake-schema?formkey=<uuid>` (worker `lL5jCLL9ziu6gXWT`) — devolve schema para o frontend renderizar
- `POST /webhook/intake-submit` (worker `Sht2ODdZwsddIfG4`) — recebe submissões do frontend
- `POST|GET /webhook/intake-draft` (worker `pm6MrCbmEt7Q1QfL`, S-1.5) — POST faz upsert do rascunho por `resume_token` (aceita `consumed:true` no submit); GET `?r=<token>` hidrata. Tabela `intake_drafts` (purga 30d; draft NUNCA conta como submissão)

## Wizard + guardar-e-retomar (S-1.5, 2026-09-05)

- `form_config.layout: wizard|single|auto` (por omissão `auto`: >1 grupo E >15 campos → wizard; um passo por grupo top-level)
- Tabs com estado (✓ completa / âmbar incompleta / neutra por visitar), progresso «Secção X de N», **navegação livre** — validação bloqueante só no submit final, que lista as secções pendentes e salta para a primeira
- Autosave debounced 12s + flush ao mudar de tab e ao esconder a página; botão «Guardar e continuar depois» mostra link de retoma `?formkey=…&r=<resume_token>` (token de 32 chars gerado no cliente)
- Após submit ok o rascunho é marcado `consumed` — reabrir o link avisa e começa do zero

## Skill Cowork associada

- **`smartintake`** — ensina o Claude Cowork a usar as 7 tools MCP com decision framework claro vs `formmcp`/`smartdocs`. Fonte de verdade em `skills/smartintake/SKILL.md`.

## Comandos-chave

```bash
cd frontend && npm install && npm run dev
cd frontend && npm run build
rsync -avz frontend/dist/ root@72.62.4.27:/opt/forms-intake/html/
psql "$SUPABASE_URL" -f supabase/schema.sql
```

## Estado do Sprint 0

- [x] `supabase/schema.sql` aplicado (`intake_forms`, `intake_submissions`)
- [x] Workflow `[POC] SmartForm Intake` criado com 7 tools MCP
- [x] 7 workers MCP + 2 workers webhook
- [x] Skill Cowork `smartintake` publicada
- [x] Frontend Vite+Vue+FormKit (live; logo TIS oficial no header desde 2026-08-31 — SVG `src/assets/tis-logo.svg` via `?raw`, padrão da família)
- [x] Deploy em `intake.tisapp.ai` (`./deploy.sh`: build → commit dist → push → VPS git pull)
- [x] CSP confirmada para FormKit styles
- [x] Teste E2E: criar cadastro fornecedor → preencher → ler
- [x] S-1 (2026-09-05): as 3 tools de leitura **já estavam implementadas** — corrigidas apenas as descrições stale «SKELETON 501» no router + publicado
- [x] S-1 (2026-09-05): cache headers nginx no `forms-intake` (`/docker/forms-intake/default.conf` montado no compose; HTML no-cache + `/assets/` immutable, padrão Docs/Voice)
- [x] S-1.5 (2026-09-05): tabela `intake_drafts` + worker `[WORKER] Intake Webhook Draft` + wizard/autosave/retoma no frontend; E2E verificado no formulário AEBRAN (só drafts, limpos no fim)

## Numeração de ADR

- **ADRs de família:** ver `smartform_platform_tis/docs/adr/`
- **ADRs específicos:** dedicada a partir de 100. Actualmente 100-104. **Próximo livre: ADR-105.**

## Contribuir

Emenda a ADR de plataforma exige review no repo de plataforma. Novo ADR específico do Intake fica aqui (105+).
