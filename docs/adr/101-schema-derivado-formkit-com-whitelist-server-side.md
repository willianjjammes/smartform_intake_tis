# ADR-101: Schema Intake é sub-set restrito do FormKit schema com whitelist server-side

**Data:** 2026-08-26
**Última revisão:** 2026-08-29 (v0.2 — remove `repeater` e `if` da whitelist)
**Status:** Aceite (v0.2)
**Decisor:** Willian Jammes
**Contexto de produto:** TIS Smart Form: Intake — Sprint 0 a 2

## Contexto

FormKit schema é JSON-serializável e poderoso — suporta expressões, conditionals, dynamic options, loops, referências entre campos. **Poder demasiado é vulnerabilidade:** um schema com expressão pesada pode fazer DoS no browser do respondente; um regex `matches` mal formado pode causar ReDoS; um `if` conditional recursivo pode congelar a UI.

O Claude gera o schema. Se o Claude gerar algo perigoso (por acidente ou porque foi manipulado por prompt injection), precisamos que o server rejeite antes de persistir.

Sprint 2 acrescentou uma restrição operacional: com a licence FormKit Pro (fk-6774fdff0c), o `repeater` e o `if` **não renderizam** sob CSP restritiva (ADR-025 da família) — o FormKit devolve warning `[FormKit]: Enterprise license required for restrictive CSP` e desactiva estas features. Testes empíricos com CSP progressivamente mais permissiva (removendo `frame-ancestors`, `object-src`) confirmaram que o gate é de licence, não de directriz CSP específica. Ver **Rastreabilidade — testes empíricos**.

## Decisão

O worker `[WORKER] Intake Create Form` valida no Code node que o schema:

### D1 — Só `$formkit` types whitelisted (v0.2)

Aceita: `text`, `email`, `number`, `textarea`, `select`, `checkbox`, `radio`, `group`, `date`, `time`.

**Rejeita:** `repeater` (v0.2, ver D3), `password`, `file`, `hidden`, `script`, qualquer type custom não da lista.

### D2 — Só `validation` rules whitelisted

Aceita: `required`, `email`, `number`, `length`, `min`, `max`, `matches`, `accepted`, `contains_alpha`, `contains_alphanumeric`.

**Rejeita:** `required_when` (parsing ambíguo — não passou nos testes de Sprint 2), rules custom não da lista, `date_after`/`date_before` sem D4-teste.

### D3 — `if` conditionals rejeitados (v0.2)

Cláusula `if` no node é **rejeitada** pelo server desde v0.2. Motivo: FormKit sem Enterprise não renderiza expressões condicionais sob CSP restritiva — o campo apareceria no schema mas nunca renderizaria no browser, criando divergência silenciosa entre backend e frontend.

**Workaround imediato:**
- Mostrar sempre todos os campos (simplifica, dá menos noise que se pensa)
- Criar formulários separados para cada branch (`intake-fornecedor-PS` e `intake-fornecedor-PJ`)
- Aceitar campo opcional com hint no `help` ("preencher só se aplicável")

**Se um cliente insistir em `if` no futuro:** ver "Opções de evolução — desbloquear conditional" abaixo.

### D4 — `repeater` rejeitado (v0.2)

O `repeater` (adicionar/remover N items dinamicamente) é **rejeitado** pelo server desde v0.2. Motivo: é feature Pro do FormKit que não renderiza sob CSP restritiva sem licence Enterprise — o schema seria aceite pelo backend mas a UI mostraria "deactivated" no browser.

**Workaround imediato:**
- Grupos fixos numerados: `contacto_1`, `contacto_2`, `contacto_3` (limite hard-coded)
- Aceitar UX menos elegante mas funcional
- Documentar no `help` que "preencher só os contactos aplicáveis, deixar os outros vazios"

**Se um cliente insistir em multi-item dinâmico:** ver "Opções de evolução — desbloquear repeater" abaixo.

### D5 — `matches` regex length

Regex em `matches` ≤ 200 chars. Cobre padrões práticos (telefone Angola, NIF, código postal) sem espaço para ReDoS.

### D6 — Depth de nesting

`group` dentro de `group` permitido, com limite lógico de 5 níveis (nunca hit em prática).

### D7 — Erros pt-PT

Rejeição devolve `{ok: false, error: "ADR-101 v0.2 violada: <detalhe específico>", status_http: 422}` em pt-PT com acentos. Mensagens de rejeição de `repeater` e `if` incluem workaround inline para facilitar iteração do agente.

## Opções de evolução (quando D3/D4 blockearem)

### Opção 2 — Componentes Vue puros (recomendado)

Escrever `<TisRepeater>` e `<TisConditional>` como componentes Vue standalone, fora do FormKit, integrados com o `formModel` reactive.

- **Custo:** 4-6h dev (uma vez)
- **Vantagem:** Zero custo licence, controlo total de UX/CSP, funciona com CSP mais restritiva ainda que a actual
- **Trigger:** Quando aparecer o 1º cliente que peça multi-item ou conditional numa demo real

### Opção 3 — FormKit Enterprise

Licence anual (~USD 499-999 por projecto ou unlimited).

- **Custo:** Financeiro recorrente
- **Vantagem:** Zero código; todas as features Pro/Enterprise funcionam out-of-box
- **Trigger:** Quando o Intake tiver 3+ clientes em produção OR precisar de suporte comercial FormKit; ou quando o TCO de manter Opção 2 exceder a licence

**Trade-off:** Opção 2 é preferível para POC-a-produto (baixo compromisso, alto controlo). Opção 3 é preferível para produto maduro com receita a justificar o custo.

## Alternativas rejeitadas

- **Aceitar FormKit schema completo** — vulnerabilidade a DoS via expressões, ReDoS via matches, payload gigante via repeater sem max
- **Escrever schema próprio (não-FormKit)** — perde-se o valor de reutilizar o renderer FormKit; teríamos de escrever renderer custom para toda a stack
- **Validação client-side apenas** — trivial de contornar; server tem de ser autoridade
- **Blacklist do que é perigoso** — inversa da regra: whitelist do que é permitido é mais defensável ("apenas isto passa" > "isto e mais o que descobrirmos")
- **Relaxar CSP para incluir modo FormKit "non-restrictive"** — testado empiricamente em 2026-08-29 removendo `frame-ancestors 'none'` e `object-src 'none'`; console continua a mostrar warning Enterprise + features continuam desactivadas. Gate é binário e licence-based, não CSP-based.

## Consequências

- Perde-se ~10-15% do que FormKit faz nativamente — casos que envolvam multi-item ou conditional. Aceitável para v0.1 (85-90% dos formulários intake reais não precisam).
- Whitelist evolui com casos reais — Sprint 3+ pode adicionar entradas conforme necessidade e/ou desbloqueio via Opção 2/3.
- Rejeição server-side é feedback loop para o Claude — se rejeitou, o Claude pode ler mensagem (que inclui workaround) e re-tentar com sub-set válido.
- Get Example worker (`get_intake_example` tool) foi actualizado em v0.2 para exemplo sem `repeater`/`if` — o agente vê o padrão suportado.

## Rastreabilidade

### Testes empíricos (2026-08-29, Sprint 2)

- Form ID `e5879c0e-84bb-4c98-9152-cc1bf55f88b0` (session `stress-test-all-field-types-1787975247995-uqfaxm`): schema com `repeater equipa` (min 1, max 5) + `if: "$get(prioridade).value === 'alta'"` no campo `justificacao_urgencia`.
- CSP baseline (com `frame-ancestors 'none'` + `object-src 'none'` + `default-src 'self'` + `script-src 'self' 'unsafe-inline' 'unsafe-eval'`): repeater mostra "deactivated", `if` não renderiza, warning `Enterprise license required for restrictive CSP` no console.
- CSP relaxada (removendo `frame-ancestors` e `object-src`): comportamento idêntico. Warning persiste.
- Conclusão: gate é licence-based, não CSP-based. Documentado em "Alternativas rejeitadas".

### Vínculos

- **Depende de:** ADR-100 (Vue+FormKit stack)
- **Herda:** ADR-030 (i18n pt-PT + mensagens de erro estruturadas), ADR-025 (CSP + HSTS)
- **Aplicado em:** SPEC-intake §2 (RF-Intake-02), PRD §5.2 (whitelist), Get Example worker (código do exemplo)
- **Substituído por:** Opção 2 (custom Vue components) OU Opção 3 (FormKit Enterprise) quando cliente pedir feature bloqueada
