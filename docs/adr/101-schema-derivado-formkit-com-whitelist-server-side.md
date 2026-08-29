# ADR-101: Schema Intake é sub-set restrito do FormKit schema com whitelist server-side

**Data:** 2026-08-26
**Status:** Aceite (v0.1)
**Decisor:** Willian Jammes
**Contexto de produto:** TIS Smart Form: Intake — Sprint 0

## Contexto

FormKit schema é JSON-serializável e poderoso — suporta expressões, conditionals, dynamic options, loops, referências entre campos. **Poder demasiado é vulnerabilidade:** um schema com expressão pesada pode fazer DoS no browser do respondente; um regex `matches` mal formado pode causar ReDoS; um `if` conditional recursivo pode congelar a UI.

O Claude gera o schema. Se o Claude gerar algo perigoso (por acidente ou porque foi manipulado por prompt injection), precisamos que o server rejeite antes de persistir.

## Decisão

O worker `[WORKER] Intake Create Form` valida no Code node que o schema:

### D1 — Só `$formkit` types whitelisted

Aceita: `text`, `email`, `number`, `textarea`, `select`, `checkbox`, `radio`, `group`, `repeater`, `date`, `time`, `password`, `submit`, `tel`, `url`.

Rejeita: `script`, `file` (Sprint 2 — depende do Docs), `hidden` sem racional documentado, qualquer type custom não da lista.

### D2 — Só `validation` rules whitelisted

Aceita: `required`, `email`, `number`, `length`, `min`, `max`, `matches`, `accepted`, `required_when`, `contains_alpha`, `contains_alphanumeric`, `date_after`, `date_before`.

Rejeita: rules custom não da lista (o cliente FormKit até renderizaria mas o server nunca aceitaria o schema).

### D3 — `if` conditionals limitados

Aceita apenas padrões: `$get(<field>).value === LITERAL` e `$get(<field>).value !== LITERAL`.

Rejeita: operações lógicas encadeadas (`&&`, `||`), funções custom, expressões aritméticas.

Racional: cobre 95% dos casos práticos (mostrar campo se dropdown for X, esconder se checkbox for false) sem abrir superfície para DoS.

### D4 — `repeater` com limites duros

- `min` ≥ 1
- `max` ≤ 20

Rejeita repeaters sem `max` ou com `max > 20`. Evita payloads gigantes.

### D5 — `matches` regex length

Regex em `matches` ≤ 200 chars. Cobre padrões práticos (telefone Angola, NIF, código postal) sem espaço para ReDoS.

### D6 — Depth de nesting

`group` dentro de `group` permitido; `repeater` dentro de `repeater` **não** permitido. Nested repeater cria explosão combinatorial de payload.

### D7 — Erros pt-PT

Rejeição devolve `{erro: "Schema Intake inválido: <detalhe específico>", status_http: 422}` em pt-PT com acentos ([ADR-030](https://github.com/willianjjammes/smartform_platform_tis/blob/main/docs/adr/030-seguranca-payload-webhooks-publicos.md) da família).

## Alternativas rejeitadas

- **Aceitar FormKit schema completo** — vulnerabilidade a DoS via expressões, ReDoS via matches, payload gigante via repeater sem max
- **Escrever schema próprio (não-FormKit)** — perde-se o valor de reutilizar o renderer FormKit; teríamos de escrever renderer custom
- **Validação client-side apenas** — trivial de contornar; server tem de ser autoridade
- **Blacklist do que é perigoso** — inversa da regra: whitelist do que é permitido é mais defensável ("apenas isto passa" > "isto e mais o que descobrirmos")

## Consequências

- Perde-se ~10% do que FormKit faz nativamente — casos edge que o Claude pode querer gerar. Aceitável.
- Whitelist precisa evoluir com casos reais — Sprint 1+ adicionará entradas conforme necessidade
- Rejeição server-side é feedback loop para o Claude — se rejeitou, o Claude pode ler mensagem e re-tentar com sub-set válido
- Documentação para o Claude (skill futura) inclui esta whitelist para orientar geração

## Rastreabilidade

- **Depende de:** ADR-100 (Vue+FormKit stack)
- **Herda:** ADR-030 (i18n pt-PT + mensagens de erro estruturadas)
- **Aplicado em:** SPEC-intake §2 (RF-Intake-02), PRD §5.2
