# ADR-102: Submissões usam INSERT (não UPSERT como no Decisions)

**Data:** 2026-08-26
**Status:** Aceite (v0.1)
**Decisor:** Willian Jammes
**Contexto de produto:** TIS Smart Form: Intake — Sprint 0

## Contexto

O Decisions faz UPSERT em `(session_id, respondent)` — segunda submissão do mesmo respondente substitui a primeira ([ADR-006](https://github.com/willianjjammes/smartform_decisions_tis/blob/main/docs/adr/006-upsert-session-respondent.md) do Decisions). Faz sentido para decisão: "a decisão actual é a última que tomei".

O Intake não é decisão — é recolha. Se um cliente enviar duas vezes o mesmo cadastro (double-submit acidental, ou re-submit consciente com dados novos), qual é o comportamento correcto?

## Decisão

**INSERT por submit.** Cada submit cria linha nova em `intake_submissions`. Sem UNIQUE em `(session_id, respondent)`. Duas submissões do mesmo respondente → duas linhas.

### D1 — Racional

- Cadastro é evento com timestamp — perder um por substituição descarta auditoria
- Onboarding pode ser processo iterativo — cliente envia versão 1, corrige, envia versão 2; ambas são úteis para o agente
- Prevenção de double-submit acidental fica no frontend (submit disabled durante request, deduplicação por client_ip + 30s window opcional)

### D2 — Duplicados: quem trata?

- Frontend previne double-click (herdado do padrão Sprint 1 F4 do Decisions)
- Backend não deduplica activamente — cada submit gera linha
- Agente que lê via `get_intake_submissions` recebe todas; decide se agrupa por `respondent`, se pega a última, se pega a que tem mais campos preenchidos, etc.

### D3 — Se algum caso pedir UPSERT

Se um formulário específico do Intake necessitar semântica de "última resposta vence" (raro), esse caso é sinal de que o formulário devia ser um Decisions. Migrar para o outro subproduto em vez de bifurcar o comportamento do Intake.

## Alternativas rejeitadas

- **UPSERT como Decisions** — perde auditoria; casos iterativos ficam sem histórico
- **INSERT com deduplicação por hash do payload** — over-engineering; se dois submits têm mesmo payload é double-click, se são diferentes são registos distintos e legítimos
- **INSERT + soft-delete do anterior** — DB fica com lixo escondido; complica queries do agente

## Consequências

- `intake_submissions` pode crescer com submits duplicados — aceitável para POC pessoal; monitorar em Sprint 1
- Agente precisa saber que múltiplas linhas com mesmo `respondent` são possíveis — documentado no PRD §5.4 e no retorno de `get_intake_submissions`
- `get_intake_submissions` ordena por `submitted_at DESC` para o agente ver a mais recente primeiro

## Rastreabilidade

- **Diverge de:** ADR-006 do Decisions (UPSERT)
- **Aplicado em:** SPEC-intake §2 (RF-Intake-03), PRD §6.2
