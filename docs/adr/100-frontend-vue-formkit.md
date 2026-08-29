# ADR-100: Frontend Vue 3 + FormKit + Vite (inverte ADR-004 do Decisions)

**Data:** 2026-08-26
**Status:** Aceite (v0.1)
**Decisor:** Willian Jammes
**Contexto de produto:** TIS Smart Form: Intake — Sprint 0

## Contexto

O Decisions adoptou vanilla HTML/CSS/JS single-file (ADR-004 do Decisions) e rejeitou FormKit (ADR-007 do Decisions). O Intake tem requisitos diferentes que invertem o cálculo:

- Precisa de inputs complexos (repeaters com drag-drop, condicionais, autocomplete, dropdowns dinâmicos, validação declarativa) — o que o vanilla é fraco a construir
- **Não** tem UI diferenciadora custom (o Decisions tem card "Análise TIS" com racional/disclosure/badges — o Intake não)
- FormKit resolve exactamente onde o vanilla é fraco e onde não há valor em reinventar

## Decisão

Adoptar **Vue 3 + FormKit (open-source) + Vite** como stack de frontend. Build produz SPA que é servida via nginx no VPS_Docker atrás de Traefik.

### D1 — Vue, não React

Vue é a stack canónica do FormKit (SPA mais integrada); React tem suporte mas com menos elegância. Sem razão para trazer React apenas para o Intake se Vue faz o mesmo trabalho.

### D2 — FormKit open-source, não Pro no Sprint 0

Pro tem features avançadas (mask, datepicker rico) mas também potencial telemetria (herança de análise em ADR-007 do Decisions). Sprint 0 cobre 90% dos requisitos com open-source. Pro entra em Sprint 2+ apenas se surgir cliente com requisito específico.

### D3 — Vite, não Webpack/Rollup diretos

Vite é a escolha default do ecossistema Vue 3 actual — dev server rápido, build optimizado, tree-shakes FormKit e Vue automaticamente. Sem razão para introduzir Webpack.

## Alternativas rejeitadas

- **Vanilla single-file (como Decisions)** — 300-500 linhas de JS para replicar repeater + condicional + validação; frágil cross-browser
- **React + Formik** — sem vantagem sobre Vue+FormKit para este caso; introduz 2ª framework na família
- **Alpine.js + HTMX** — leve, mas pobre em inputs complexos; teríamos de construir repeater à mão
- **FormKit Pro no Sprint 0** — over-buy para POC pessoal; adiar

## Consequências

- Bundle ~200-250 KB gzipped em produção
- Deploy diferente do Decisions (`npm run build` + rsync do `dist/` em vez de rsync directo do HTML)
- Curva de aprendizagem para quem trabalha só no Decisions
- Componente `<FormKitSchema>` faz o trabalho pesado de render
- Se surgir 3º subproduto que também usa Vue+FormKit (**já surgiu — Docs**), extrair theme/config para package `smartform-frontend-shared`

## Rastreabilidade

- **Inverte:** ADR-004 do Decisions (frontend vanilla) e ADR-007 do Decisions (FormKit rejeitado)
- **Precede:** ADR-101 (whitelist do FormKit schema), ADR-104 (Vite build pipeline)
- **Reusado por:** ADR-200 do Docs (mesma stack Vue+FormKit+Vite)
