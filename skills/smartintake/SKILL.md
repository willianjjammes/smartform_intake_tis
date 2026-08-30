---
name: smartintake
description: Use esta skill sempre que o utilizador pedir ao Claude para criar, partilhar, listar, inspeccionar ou ler respostas de um formulário de INTAKE (cadastro / onboarding / captura de dados estruturados de terceiros) através da plataforma TIS Smart Form: Intake (MCP server `SmartFormIntake` — n8n cloud + Supabase, frontend Vue+FormKit em https://intake.tisapp.ai). Esta é a plataforma que permite ao Claude gerar um schema FormKit sub-set mid-conversation, entregar ao utilizador um link partilhável por capability URL (`?formkey=<uuid>`), e mais tarde ler as submissões estruturadas (INSERT-only, não UPSERT). Triggers em PT incluem "cria um formulário de cadastro", "quero um form de onboarding de fornecedor", "gera um intake para os candidatos", "lê as respostas do formulário de cadastro", "quantos fornecedores se cadastraram", "quais os formulários intake que criei"; em EN "create an intake form", "onboarding form for suppliers", "list my intake forms", "read intake submissions". NÃO usar para: (a) formulários de DECISÃO com sugestão do Claude e semântica `suggestion_accepted` — usar skill `formmcp`; (b) pedidos de DOCUMENTOS (PDFs, imagens, contratos) do respondente para extracção pelo Docling — usar skill `smartdocs`; (c) Google Forms, Typeform, Notion databases, ou qualquer outro form-builder externo.
---

# TIS Smart Form: Intake — Guia de uso do MCP `SmartFormIntake`

Esta skill ensina o Claude a operar o **3.º subproduto** da família TIS Smart Form: **Intake**. Os outros dois têm skills próprias e responsabilidades distintas:

| Subproduto | Skill | MCP server | Finalidade |
|---|---|---|---|
| **Decisions** | `formmcp` | `FormQuestions` | O Claude propõe uma sugestão por pergunta, o respondente aceita/edita. Semântica `suggestion_accepted`. |
| **Docs** | `smartdocs` | `SmartFormDocs` | O Claude pede documentos ao respondente. Extracção via Docling → Markdown estruturado. |
| **Intake** (esta) | `smartintake` | `SmartFormIntake` | O Claude cria um formulário para captura de dados estruturados de terceiros (cadastro, onboarding). Sem sugestão, sem documentos — apenas campos FormKit. |

Se estiver em dúvida entre `smartintake` e `formmcp`: **Intake** é para **cadastros e onboardings** (fornecedor, candidato, cliente, aluno) preenchidos por muitos respondentes; **Decisions** é para **decisões** onde o Claude tem opinião prévia e o respondente valida uma por uma.

---

## Contrato do schema — FormKit sub-set (ADR-101 v0.2)

O Intake usa um **sub-set restrito do FormKit**. Isto é uma escolha deliberada: mantém o frontend Vue+FormKit compatível sem obrigar o utilizador a comprar FormKit Enterprise, e permite validação server-side determinística (rejeição 422 com mensagem clara em caso de violação).

### Tipos `$formkit` permitidos (10)

`text`, `email`, `number`, `textarea`, `select`, `checkbox`, `radio`, `group`, `date`, `time`

### Regras de validação permitidas (10)

`required`, `email`, `number`, `length`, `min`, `max`, `matches`, `accepted`, `contains_alpha`, `contains_alphanumeric`

### NÃO suportado em v0.1 (rejeitado com 422)

- **`repeater`** — listas dinâmicas de múltiplos itens (ex.: array de sócios, array de dependentes). Requer FormKit Enterprise. **Workaround**: crie N campos numerados fixos (sócio_1, sócio_2, sócio_3), ou peça ao respondente para preencher o formulário várias vezes (uma submissão por item).
- **`if` conditional** — expressões condicionais no schema (ex.: mostrar campo Y só se X=true). Requer FormKit Enterprise. **Workaround**: mostre sempre todos os campos e marque os condicionais como opcionais no `help` text, ou parta em 2 formulários encadeados.

Sempre que o utilizador pedir um destes, avise-o do workaround **antes** de chamar `create_intake_form` — caso contrário perde-se um round-trip com erro 422.

### Sempre chamar `get_intake_example` primeiro

Antes de escrever o primeiro schema num tópico novo, chame `get_intake_example` para ver o formato canónico (cadastro de fornecedor com groups, text, email, number, date, select, radio, checkbox). Adapte-o ao caso concreto respeitando o whitelist. Não invente estrutura do zero.

---

## Tool inventory (7 tools)

### 1. `ping` — health check

Verifica se o MCP + Supabase estão reachable. Use quando desconfiar que o MCP não está a responder. Parâmetro opcional `note` (echoed no retorno).

### 2. `get_intake_example` — schema template

Devolve um schema FormKit sub-set completo (cadastro de fornecedor com ~15 campos, groups, todos os tipos permitidos). **Chame sempre antes de escrever o primeiro `create_intake_form` num tópico novo**. Sem parâmetros.

### 3. `create_intake_form` — criar formulário

Cria um formulário Intake e devolve o **capability URL** partilhável (`https://intake.tisapp.ai/?formkey=<uuid>`).

Parâmetro obrigatório:
- `schema` — **JSON STRING** (não objecto!) contendo o schema FormKit sub-set completo. Estrutura de topo esperada:
  ```json
  {
    "title": "Cadastro de fornecedor",
    "subtitle": "Preencha para iniciarmos o processo de homologação",
    "category": "onboarding-fornecedor",
    "is_test": false,
    "respondent_required": false,
    "schema_version": 1,
    "form_config": { "submit_button_label": "Enviar cadastro" },
    "schema": [ /* array de nós FormKit sub-set */ ]
  }
  ```

Defaults (diferem de `formmcp`!):
- `is_test: false` é o **default** (em Decisions é `true`). Assuma sempre real a não ser que o utilizador diga explicitamente "teste".
- `respondent_required: false` é o **default**. Em cadastros anónimos ou onde o email já vem dentro do schema como campo, mantenha `false`.

Retorno em sucesso: `{ok: true, id, session_id, title, url}` — sempre partilhe `url` ao utilizador, não o `id`/`session_id` raw.

Retorno em erro de whitelist: `{ok: false, error: "ADR-101 v0.2 violada: <detail>", status_http: 422}` — corrija o schema baseado em `<detail>` e retente. Não peça ao utilizador para arranjar; a responsabilidade é sua.

### 4. `get_intake_form` — metadata + schema (Sprint 0 SKELETON — 501)

Devolve o `intake_forms` row completo pelo `session_id`: title, subtitle, category, schema_version, is_test, respondent_required, form_config, created_at, created_by, schema completo e a `url` reconstruída. **NÃO** inclui submissões (usar `get_intake_submissions`).

**Sprint 0**: skeleton returns 501. Implementação real na Sprint 1.

### 5. `get_intake_status` — estado leve (Sprint 0 SKELETON — 501)

Devolve apenas: existe? total_submissions? last_submission_at? Muito mais barato que `get_intake_submissions`. Use para "quantas respostas tem o form X" sem trazer o payload todo. **Sprint 0**: skeleton returns 501.

### 6. `get_intake_submissions` — form + todas as submissões (Sprint 0 SKELETON — 501)

Devolve o form + array de submissões ordenadas por `submitted_at DESC`. Cada submissão preserva a estrutura de `group` do schema em `form_data`. Não há campos de enriquecimento como no Decisions (não existe `suggestion_accepted`, o Intake não tem sugestão prévia). **Sprint 0**: skeleton returns 501.

### 7. `list_intake_forms` — discovery (NOVA, Sprint 0)

Lista `intake_forms` com filtros opcionais e paginação. Use quando o utilizador pedir "quais formulários criei", "meus onboardings", "listar intakes".

Parâmetros opcionais:
- `limit` (1-100, default 20), `offset` (default 0)
- `category` (string, exact match)
- `is_test` (bool — `true` só teste, `false` só reais, omitir = ambos)
- `created_by` (string — email/id)
- `created_after` (ISO timestamp — ex.: `2026-08-01T00:00:00Z`)
- `include_stats` (bool — se `true`, adiciona `submissions_count` e `last_submission_at` por formulário via query separada em `intake_submissions`; custa 1 SELECT extra sobre toda a tabela, use com moderação)

Retorno: `{ok, total_matching, returned, limit, offset, include_stats, forms:[{id, session_id, title, subtitle, category, schema_version, is_test, respondent_required, created_by, created_at, url, submissions_count?, last_submission_at?}]}`.

**Nota**: `total_matching` é aproximado (limitado ao SELECT interno de 100). Para paginar acima disso, refine filtros.

---

## Padrões de fluxo

### A. Criar um formulário novo

1. **Descubra a intenção**: cadastro? onboarding? qual entidade? quem preenche?
2. Se for a 1.ª vez no tópico: chame `get_intake_example` para ver template.
3. Confirme se algum requisito exige **repeater** ou **if conditional** — se sim, negoceie workaround com o utilizador **antes** de chamar `create_intake_form` (evita 422).
4. Chame `create_intake_form` com schema JSON stringify-ado.
5. Se 422 → leia `error`, corrija o schema, retente. Não peça ajuda ao utilizador para debugging de whitelist.
6. Em sucesso: partilhe **apenas** o `url` (`https://intake.tisapp.ai/?formkey=<uuid>`) e um resumo humano do que criou. Não exponha `id`/`session_id` raw a menos que o utilizador peça.

### B. Consumir respostas

- "Quantas respostas tem o form X?" → `get_intake_status` (mais barato).
- "Mostra-me as respostas do form X" → `get_intake_submissions`.
- "Quantos formulários intake criei este mês?" → `list_intake_forms` com `created_after` e `include_stats: true`.

### C. Discovery

- "Lista os meus formulários intake" → `list_intake_forms`.
- "Quais os intakes reais (sem testes)?" → `list_intake_forms` com `is_test: false`.
- "Quais os intakes de categoria 'onboarding-fornecedor' com respostas nos últimos 7 dias?" → `list_intake_forms` com `category` e `include_stats: true`, depois filtre client-side por `last_submission_at`.

### D. Debug / health

- Chamadas a devolver erro esquisito → `ping` primeiro para isolar problema (MCP vs Supabase vs schema).

---

## Diferenças relevantes vs `formmcp` (Decisions)

Não confunda — os dois têm APIs parecidas mas semânticas diferentes:

| Aspecto | `formmcp` (Decisions) | `smartintake` (Intake) |
|---|---|---|
| Semântica | Claude sugere → respondente valida | Respondente preenche do zero |
| Enriquecimento por resposta | `suggestion_accepted` | Nenhum |
| Default de `is_test` | `true` | **`false`** |
| Persistência de submissões | UPSERT (última resposta vence) | **INSERT** (todas as respostas mantidas — ADR-102) |
| Schema | Perguntas com sugestão do Claude | FormKit sub-set puro |
| Frontend | https://forms.tisapp.ai | https://intake.tisapp.ai |

Se o utilizador quiser um "formulário para clientes decidirem X com sugestão minha" → é `formmcp`, não `smartintake`.

---

## Diferenças relevantes vs `smartdocs` (Docs)

| Aspecto | `smartdocs` (Docs) | `smartintake` (Intake) |
|---|---|---|
| Input do respondente | Ficheiros (PDF, JPG, DOCX) | Campos preenchidos |
| Processamento | Docling → Markdown estruturado | Nenhum (form_data é o output) |
| Storage | MinIO VPS + Docling extraction | Apenas Postgres |
| Tools de leitura | `get_docs_submissions`, `get_docs_download_manifest` | `get_intake_submissions` |
| Companion download | `/smartdocsdownload` | N/A (dados já são JSON) |

Se o utilizador quiser "que o cliente envie o BI e o contrato" → é `smartdocs`, não `smartintake`.

---

## Políticas de dados

- **Persistência**: submissões `intake_submissions` são **INSERT-only** (ADR-102). Cada envio cria nova row — o respondente pode reenviar e ambas ficam guardadas. Isto é diferente de Decisions onde é UPSERT.
- **`is_test: true`**: futura purga automática 30 dias (Sprint 3+). Use para experiências.
- **`is_test: false`**: retenção indefinida até tool `purge_intake_form` (Sprint 3+).
- **Capability URL**: quem tiver a URL `?formkey=<uuid>` submete. Não há auth server-side em Sprint 0. Trate a URL como semi-secreta.
- **CORS**: o endpoint `/webhook/intake-schema` e `/webhook/intake-submit` respondem a qualquer origem (frontend está em domain diferente). Documentado nas ADRs.

---

## Erros comuns a evitar

1. **Passar `schema` como objecto em vez de JSON string** em `create_intake_form` → o MCP rejeita. Faça `JSON.stringify(...)`.
2. **Usar `repeater` ou `if` no schema** → 422 imediato. Consulte "NÃO suportado" acima.
3. **Assumir `is_test: true` por defeito** (hábito herdado de Decisions) → em Intake o default é `false`. Formulários de teste vão para produção sem o flag.
4. **Chamar `get_intake_submissions` só para contar** → prefira `get_intake_status`, é ordem de magnitude mais barato.
5. **Expor `id` ou `session_id` raw** ao utilizador humano → partilhe `url`. O `session_id` é para logs e para o `get_intake_*`.
6. **Confundir `formkey` (UUID em query string do frontend) com `session_id` (slug legível para tools MCP)** — o frontend usa `formkey` = `id` da row `intake_forms`; as tools MCP usam `session_id` = slug tipo `onboarding-fornecedor-abc123`.

---

## Referências (Intake repo)

- **PRD**: `docs/PRD-intake-v0.1.md`
- **SPEC**: `specs/SPEC-intake-v0.1.md`
- **ADRs relevantes**: 100 (Vue+FormKit), 101 (schema derivado FormKit + whitelist), 102 (INSERT vs UPSERT), 103 (tabelas), 104 (Vite build pipeline)
- **CLAUDE.md**: mapa rápido do repo
