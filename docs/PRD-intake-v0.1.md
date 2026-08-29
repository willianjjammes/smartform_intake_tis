# PRD — TIS Smart Form: Intake

| Campo | Valor |
|---|---|
| **Produto** | TIS Smart Form: Intake — formulários de recolha complexa mediados por agentes de IA |
| **Subproduto de** | TIS Smart Form (família) — ver `smartform_platform_tis` |
| **Versão do documento** | v0.1 (Sprint 0 — desenho inicial) |
| **Data** | 2026-08-26 |
| **Autor** | Willian Jammes (TIS), co-autoria Claude |
| **Status** | Draft — pronto para arrancar implementação |
| **Repositório** | `smartform_intake_tis` |
| **Irmão** | TIS Smart Form: Decisions (`smartform_decisions_tis`) — divergência intencional em schema, frontend e semântica de submissão |

> Este é o PRD inicial do subproduto Intake. O PRD de família ([PLATFORM-PRD](https://github.com/willianjjammes/smartform_platform_tis/blob/main/docs/PLATFORM-PRD.md)) cobre a arquitectura partilhada; este documento cobre apenas o que é específico do Intake.

---

## 1. Visão

Permitir que um agente de IA (Claude ou outro) **gere formulários estruturados de recolha complexa de informação**, entregue um link partilhável, e leia as submissões estruturadas de volta — sem sair do chat.

Fluxo canónico:

```
1. Consultor conversa com Claude sobre uma necessidade de recolha
   (cadastro de fornecedores, onboarding, ficha de suporte, discovery técnico denso)
2. Claude gera schema Intake compatível com FormKit (inputs, validação, condicionais,
   repeaters, uploads opcionais) via tool MCP create_intake_form
3. Claude devolve URL → cliente/colaborador preenche no browser
4. Claude lê as submissões via tool MCP get_intake_submissions e processa
```

### 1.1 Diferença face ao Decisions (irmão)

Ambos são MCP-native, servem-se do mesmo runtime (n8n + Supabase + Traefik), respeitam os mesmos ADRs de família. Divergem em três eixos:

| Eixo | Decisions | Intake |
|---|---|---|
| **Semântica** | Decisão estruturada com sugestão + racional | Recolha de informação factual/estruturada |
| **Schema** | R1–R11 (suggestion, options, recommended_option) | Sub-set do FormKit schema (inputs, validation, conditionals, repeaters) |
| **Frontend** | Vanilla HTML/CSS/JS ~39 KB single-file | Vue 3 + FormKit + Vite build ~200 KB |
| **Submissão** | UPSERT por (session_id, respondent) — última resposta vence | INSERT por submissão — cada submit é registo novo |
| **Métrica-chave** | `suggestion_accepted` | Taxa de conclusão + validade dos dados |
| **UC primário** | Checkpoint pré-materialização, discovery consultivo | Cadastro, onboarding, discovery técnico denso |

### 1.2 Tese estratégica (herdada da família)

"Não competimos em UX de formulário genérico — competimos no pipeline agentic." Aplicada ao Intake: não replicamos features de Typeform/Jotform em UX ou variedade de inputs. Diferencial é que o Claude *gera* o schema Intake dentro da conversa a partir do que sabe do contexto do consultor/cliente, e depois *lê* as submissões com semântica útil para o próximo passo. FormKit resolve a parte "UX rica" sem custo de reinvenção; o Claude resolve a parte agentic.

---

## 2. Objectivos e não-objectivos

### 2.1 Objectivos (Sprint 0)

1. Claude cria formulário Intake via tool MCP e recebe URL partilhável
2. Respondente preenche no browser sem login, com validação client-side rica (FormKit) + server-side (Code node n8n)
3. Claude lê submissões via tool MCP com estrutura tabular pronta para análise
4. Reutilizar TODO o padrão da família — mesmo n8n, mesmo Supabase, mesmo Traefik, mesmos ADRs de segurança/i18n
5. Divergir deliberadamente onde o produto é diferente — Vue+FormKit no frontend, sub-set restrito do FormKit schema no server, INSERT em vez de UPSERT

### 2.2 Não-objectivos (explícitos)

- **Não** oferecer editor visual de formulários — o editor é a conversa com o Claude ([ADR-011](https://github.com/willianjjammes/smartform_platform_tis/blob/main/docs/adr/011-servidor-nunca-chama-llm.md) — servidor nunca chama LLM)
- **Não** suportar todo o FormKit — apenas sub-set restrito com whitelist server-side (evita DoS via expressões pesadas)
- **Não** replicar semântica de decisão do Decisions — sem `suggestion`, sem `recommended_option`, sem `suggestion_accepted`. Se um formulário quer semântica de decisão, é caso para o Decisions
- **Não** adoptar FormKit Pro no Sprint 0 (open-source cobre 90% do que precisamos; Pro só se surgir cliente que exija feature específica)

---

## 3. Utilizadores e casos de uso

### 3.1 Personas

Herdadas do PLATFORM-PRD (agente IA, consultor TIS, cliente externo). Especificidades do Intake:

- **Cliente externo** habitualmente é o próprio que preenche o formulário (self-serve cadastro), não terceiro que o consultor envia como no Decisions
- **Colaborador interno TIS** aparece como respondente em cenários de onboarding, ficha de projecto, cadastro de fornecedor

### 3.2 Casos de uso

**UC-Intake-1 (primário):** Cadastro de fornecedor/cliente/parceiro.
Consultor pede a Claude para gerar formulário de onboarding — Claude produz schema com secções ("Dados da entidade", "Contactos", "Documentos", "Contrato"), inputs mistos (text, email, phone, select para país, textarea, repeater para múltiplos contactos), validação (email válido, telefone com pattern angolano, NIF numérico), condicionais (se `tipo_entidade === "PJ"` mostra `numero_alvara`). Envia link, cliente preenche em 10-15 min, Claude lê estrutura e cria entrada no CRM.

**UC-Intake-2 (secundário):** Discovery técnico denso (>10 perguntas de contexto factual).
Quando o Decisions ficaria demasiado longo (>10 decisões), consultor bifurca — decisões estratégicas para o Decisions, recolha de contexto factual (volumes, sistemas actuais, integrações, prazos) para o Intake.

**UC-Intake-3 (secundário):** Ficha de suporte / incidente.
Utilizador reporta problema; formulário Intake capta: contexto (produto, versão, ambiente), reprodução (passos), evidência (screenshot/log via upload), severidade percebida (select), impacto (textarea). Claude processa, cria ticket no sistema, responde ao utilizador.

**UC-Intake-4 (secundário):** Inscrição em evento / formação.
Formulário com dados pessoais + sessões escolhidas (multi-select) + refeições especiais (textarea condicional se `refeicoes === "restricoes"`) + termos aceites (checkbox required).

---

## 4. Arquitectura

Herdada da família. Ver [PLATFORM-SPEC.md](https://github.com/willianjjammes/smartform_platform_tis/blob/main/docs/PLATFORM-SPEC.md) para diagramas de alto nível e endpoints. Especificidades do Intake:

### 4.1 Componentes por responsabilidade

| Componente | Papel | Onde vive |
|---|---|---|
| **MCP Server** | 1 workflow n8n `[POC] SmartForm Intake` com `mcpTrigger v2` + `bearerAuth` | n8n cloud |
| **Worker MCP Ping** | Health check | n8n cloud |
| **Worker MCP Get Example** | Devolve schema Intake exemplo (pronto para o Claude adaptar) | n8n cloud |
| **Worker MCP Create Intake Form** | Valida sub-set FormKit + persiste + devolve URL | n8n cloud |
| **Worker MCP Get Intake Form** | Metadata + schema de um formulário existente | n8n cloud |
| **Worker MCP Get Intake Status** | Existe? Quantas submissões? Última quando? | n8n cloud |
| **Worker MCP Get Intake Submissions** | Todas as submissões enriquecidas com metadata | n8n cloud |
| **Worker Webhook Schema** | `GET /webhook/intake-schema?formkey=xxx` | n8n cloud |
| **Worker Webhook Submit** | `POST /webhook/intake-submit` — valida FormKit sub-set + sanitize + caps + INSERT | n8n cloud |
| **Frontend Vue+FormKit** | SPA Vite build, container nginx serve, sub-domínio `intake.tisapp.ai` | Hostinger VPS_Docker |
| **Persistência** | Supabase Postgres — tabelas `intake_forms` + `intake_submissions` | Supabase cloud |

### 4.2 Endpoints (planeados)

Ver PLATFORM-SPEC §3 para a tabela completa incluindo os endpoints do Intake. Sub-domínio face pública: `intake.tisapp.ai`.

---

## 5. Schema do formulário Intake

Baseado num sub-set restrito do **FormKit schema** (JSON-serializável), validado server-side por whitelist. Ver [ADR-101](./adr/101-schema-derivado-formkit-com-whitelist-server-side.md) para o racional de restrição.

### 5.1 Exemplo canónico (cadastro de fornecedor)

```json
{
  "schema_version": 1,
  "title": "Cadastro de fornecedor",
  "subtitle": "Preenche em ~10 minutos. Todos os campos marcados são obrigatórios.",
  "category": "ONBOARDING — FORNECEDOR",
  "is_test": false,
  "respondent_required": false,
  "form_config": {
    "submit_label": "Enviar cadastro",
    "success_message": "Cadastro recebido. A equipa TIS entra em contacto em ~2 dias úteis."
  },
  "schema": [
    {
      "$formkit": "group",
      "name": "entidade",
      "label": "Dados da entidade",
      "children": [
        {
          "$formkit": "text",
          "name": "nome",
          "label": "Nome/Razão social",
          "validation": "required|length:3,200",
          "validation-visibility": "blur"
        },
        {
          "$formkit": "select",
          "name": "tipo",
          "label": "Tipo de entidade",
          "options": [
            { "label": "Pessoa singular", "value": "PS" },
            { "label": "Pessoa jurídica", "value": "PJ" }
          ],
          "validation": "required"
        },
        {
          "$formkit": "text",
          "name": "numero_alvara",
          "label": "Número de alvará",
          "if": "$get(entidade.tipo).value === PJ",
          "validation": "required_when|entidade.tipo:PJ",
          "help": "Obrigatório para pessoa jurídica"
        },
        {
          "$formkit": "text",
          "name": "nif",
          "label": "NIF",
          "validation": "required|number|length:9,10",
          "help": "9 ou 10 dígitos"
        }
      ]
    },
    {
      "$formkit": "repeater",
      "name": "contactos",
      "label": "Contactos",
      "min": 1,
      "max": 5,
      "children": [
        {
          "$formkit": "text",
          "name": "nome",
          "label": "Nome",
          "validation": "required"
        },
        {
          "$formkit": "email",
          "name": "email",
          "label": "Email",
          "validation": "required|email"
        },
        {
          "$formkit": "text",
          "name": "telefone",
          "label": "Telefone",
          "validation": "required|matches:/^\\+244[0-9]{9}$/",
          "help": "Formato +244XXXXXXXXX"
        }
      ]
    },
    {
      "$formkit": "checkbox",
      "name": "aceita_termos",
      "label": "Aceito os termos gerais TIS e a política de privacidade",
      "validation": "accepted"
    }
  ]
}
```

### 5.2 Whitelist server-side de expressões FormKit

O Code node do `[WORKER] Intake Create Form` valida que o schema:

- Só usa `$formkit` types da lista permitida (`text`, `email`, `number`, `textarea`, `select`, `checkbox`, `radio`, `group`, `repeater`, `date`, `time`)
- Só usa `validation` rules whitelisted (`required`, `email`, `number`, `length`, `min`, `max`, `matches`, `accepted`, `required_when`, `contains_alpha`, `contains_alphanumeric`)
- `if` conditionals apenas com `$get(...).value === LITERAL` ou `$get(...).value !== LITERAL` — sem operações lógicas complexas, sem funções custom
- `repeater` tem `min` ≥ 1 e `max` ≤ 20 (previne DoS por payload grande)
- `matches` regex tem tamanho máximo 200 chars (previne ReDoS)

Se falhar validação → `{erro: "Schema Intake inválido: <detalhe>", status_http: 422}`.

### 5.3 Payload de submissão

```json
{
  "session_id": "onboarding-fornecedor-1787747000000-abcdef",
  "submitted_at": "2026-08-26T14:30:00.000Z",
  "form_data": {
    "entidade": {
      "nome": "ACME Angola Lda",
      "tipo": "PJ",
      "numero_alvara": "12345/2020",
      "nif": "5417234567"
    },
    "contactos": [
      { "nome": "Ana Silva", "email": "ana@acme.ao", "telefone": "+244923456789" },
      { "nome": "João Souza", "email": "joao@acme.ao", "telefone": "+244912345678" }
    ],
    "aceita_termos": true
  },
  "is_test": false,
  "metadata": {
    "user_agent": "...",
    "language": "pt-PT",
    "screen": "390x844",
    "context": "onboarding-vendors-q3"
  }
}
```

Regras:

- `session_id` obrigatório e existe em `intake_forms`
- `form_data` respeita estrutura declarada no schema (nested groups como sub-objects, repeaters como arrays)
- Todos os campos com `validation: required` presentes e não-vazios
- Todos os campos passam pelo sanitize server-side (ADR-030 de família)
- Caps por campo aplicados (ADR-030); campos custom com `maxlength` no schema respeitados
- `submitted_at` ISO 8601 UTC (ADR-016)

Se validar → INSERT em `intake_submissions` (uma linha por submissão — ADR-102). Devolve `{ok: true, submission_id, created_at}`.

### 5.4 Retorno de `get_intake_submissions`

```json
{
  "form": {
    "session_id": "onboarding-fornecedor-...",
    "title": "Cadastro de fornecedor",
    "category": "ONBOARDING — FORNECEDOR",
    "schema_version": 1,
    "created_at": "2026-08-26T10:00:00.000Z",
    "schema": { "...": "full FormKit schema" }
  },
  "submissions": [
    {
      "id": "01991b64-...",
      "submitted_at": "2026-08-26T14:30:00.000Z",
      "form_data": { "...": "same shape as submit" },
      "metadata": { "...": "..." }
    }
  ],
  "total_submissions": 1
}
```

**Sem** campos derivados de "aceitação" (que só existem no Decisions). Estrutura é a dos dados factuais.

---

## 6. Modelo de dados

Duas tabelas dedicadas no Supabase (projecto `FormMCP` partilhado com o Decisions — separadas por prefixo).

### 6.1 `intake_forms`

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | Capability formkey |
| `session_id` | `text UNIQUE NOT NULL` | Slug legível |
| `title` | `text NOT NULL` | |
| `schema` | `jsonb NOT NULL` | Schema FormKit completo |
| `schema_version` | `int NOT NULL default 1` | ADR-015 |
| `category` | `text` | |
| `is_test` | `boolean NOT NULL default false` | |
| `respondent_required` | `boolean NOT NULL default false` | Similar ao Decisions v2.3, mas default é `false` no Intake |
| `created_by` | `text` | Sprint 1 |
| `created_at` | `timestamptz default now()` | UTC |

### 6.2 `intake_submissions`

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `session_id` | `text NOT NULL` | FK lógica para `intake_forms.session_id` |
| `form_data` | `jsonb NOT NULL` | Estrutura respeitando o schema |
| `raw_payload` | `jsonb` | Body completo do POST (auditoria) |
| `metadata` | `jsonb` | UA, language, screen, context |
| `client_ip` | `text` | `cf-connecting-ip` |
| `is_test` | `boolean NOT NULL default false` | |
| `submitted_at` | `timestamptz` | UTC |
| `created_at` | `timestamptz default now()` | UTC |

**Sem** UNIQUE constraint em `(session_id, respondent)` — no Intake, cada submit cria linha nova ([ADR-102](./adr/102-submissoes-insert-nao-upsert.md)).

RLS: desabilitada (padrão TIS; defesa por webhook + capability + CORS + CSP, herdada da família).

Ver [ADR-103](./adr/103-tabelas-intake-forms-submissions.md) para racional do modelo de dados.

---

## 7. Frontend

Vue 3 + FormKit + Vite build. Ver [ADR-100](./adr/100-frontend-vue-formkit.md) para racional de escolha vs. vanilla single-file.

### 7.1 Estrutura

```
frontend/
├── package.json
├── vite.config.ts
├── index.html
├── src/
│   ├── main.ts                    (bootstrap)
│   ├── App.vue                    (root, fetches schema + renderiza FormKitSchema)
│   ├── formkit.config.ts          (config FormKit — theme, i18n pt-PT)
│   ├── api.ts                     (fetch schema + POST submit)
│   ├── theme.css                  (paleta "ops room" TIS + IBM Plex Sans/Mono)
│   └── assets/
│       └── tis-logo.svg           (inline no header)
└── ...
```

Bundle esperado: ~180-220 KB gzipped em produção. Vite tree-shakes FormKit e Vue.

### 7.2 Fluxo do respondente

1. `GET https://intake.tisapp.ai/?formkey=xxx` → Vue app inicia
2. `App.vue` faz `fetch(SCHEMA_URL + '?formkey=xxx')` → recebe schema JSON
3. `<FormKitSchema>` renderiza o formulário — validação client-side ao vivo
4. Utilizador preenche; ao submeter, `<FormKit type="form">` compila `form_data` estruturado
5. `POST https://willianjammes.app.n8n.cloud/webhook/intake-submit` → recebe `{ok, submission_id}` ou `{erro, status_http}`
6. Ecrã de sucesso com `success_message` do schema ou mensagem de erro pt-PT do backend

### 7.3 Identidade visual

Herda a paleta "ops room" TIS já usada no Decisions: `--navy: #0C1524`, `--paper: #F5F6F3`, verde acento, âmbar validação. Logo TIS inline SVG no header. Tipografia IBM Plex Sans + Mono.

### 7.4 CSP e Intake

FormKit renderiza inputs com estilos que às vezes usam `style` attribute inline. Se a CSP restritiva de família ([ADR-025](https://github.com/willianjjammes/smartform_platform_tis/blob/main/docs/adr/025-csp-hsts-frontend.md)) rejeitar, dois caminhos:

- Configurar Vite/FormKit para gerar CSS separado (preferível — mantém CSP intacta)
- Se impossível, emenda ao ADR-025 para permitir `'unsafe-inline'` em `style-src` **apenas para `intake.tisapp.ai`** (aceitar risco documentado)

A confirmar em Sprint 0 empiricamente.

---

## 8. Tools MCP (planeadas)

| Tool | Função | Worker |
|---|---|---|
| `ping` | Health check | `[WORKER] Intake Ping` |
| `get_intake_example` | Devolve schema exemplo (cadastro fornecedor simplificado) | `[WORKER] Intake Get Example` |
| `create_intake_form` | Recebe JSON, valida whitelist FormKit sub-set, INSERT `intake_forms`, devolve URL | `[WORKER] Intake Create Form` |
| `get_intake_form` | Devolve metadata + schema | `[WORKER] Intake Get Form` |
| `get_intake_status` | Estado leve: existe? quantas submissões? | `[WORKER] Intake Get Status` |
| `get_intake_submissions` | Formulário + array de submissões | `[WORKER] Intake Get Submissions` |

**6 tools MCP + 2 webhooks** — simétrico ao Decisions.

---

## 9. Segurança

Herdada da família ([PLATFORM-SPEC §4](https://github.com/willianjjammes/smartform_platform_tis/blob/main/docs/PLATFORM-SPEC.md)): CORS restritivo, CSP + HSTS via Traefik, sanitize + caps + i18n backend (ADR-030). Especificidades do Intake:

- **Sub-set restrito do FormKit schema** — server-side rejeita expressões perigosas (ADR-101)
- **`repeater` com `max ≤ 20`** — previne payloads gigantes
- **Regex em `matches`** ≤ 200 chars — previne ReDoS
- **Caps por campo custom** — schema pode declarar `maxlength` por input mas nunca > 10000 chars

---

## 10. Roadmap

### Sprint 0 — POC pessoal (a arrancar)

- [ ] Aplicar schema Supabase (`intake_forms`, `intake_submissions`)
- [ ] Criar workflow `[POC] SmartForm Intake` no n8n com `mcpTrigger v2 + bearerAuth`
- [ ] Criar 6 workers MCP + 2 workers webhook
- [ ] Bootstrap Vue+FormKit+Vite no `frontend/`
- [ ] Aplicar theme "ops room" TIS + logo inline
- [ ] Deploy do frontend em `intake.tisapp.ai` (container nginx serve do build Vite)
- [ ] Sub-domínio `intake.tisapp.ai` configurado no Traefik + Let's Encrypt
- [ ] Teste E2E: criar formulário via Claude → preencher no browser → ler submissão via Claude
- [ ] Exports JSON dos workflows commitados em `workflows/`

### Sprint 1 — Interno TIS

- Cabeçalho contextual do formulário (`created_by`)
- CORS restritivo aos webhooks
- CSP + HSTS aplicados (emenda ADR-025 se necessário)
- Bearer partilhado com equipa TIS

### Sprint 2 — Clientes externos

- Uploads (FormKit Pro se necessário — decisão a fazer com dados)
- Password por formulário → JWT curto
- Rate limit Cloudflare
- Expiração e limite de submissões configuráveis

### Backlog

- Multi-página com progress bar (FormKit `<FormKitMultiStep>`)
- Notificações webhook a URL configurável ao submeter (Zapier-like)
- Templates de schema pré-prontos (biblioteca)

---

## 11. Métricas de sucesso

| Métrica | Alvo Sprint 0 | Como medir |
|---|---|---|
| Fluxo E2E funcional | 100% sem intervenção manual | Teste real com formulário próprio |
| Taxa de conclusão de submissão | ≥ 70% (respondentes que iniciam vs. submetem) | Log analytics leve no frontend |
| Tempo agente→URL | < 30 s | Log dos workflows n8n |
| Perda de submissões | 0 | `raw_payload` + reconciliação manual |
| Aceitação de FormKit pela equipa TIS | Feedback qualitativo em 2 casos reais | Conversa interna |

---

## 12. Riscos

Riscos transversais herdados de [PLATFORM-PRD §7](https://github.com/willianjjammes/smartform_platform_tis/blob/main/docs/PLATFORM-PRD.md). Riscos específicos do Intake:

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Superfície de segurança do FormKit expressions | Média | Alto | Whitelist server-side estrita (ADR-101). Rejeitar tudo o que não estiver na lista. Limitar profundidade de conditionals e repeaters |
| Bundle size ~200 KB penaliza 3G | Baixa | Médio | Route-level splitting; medir tempo de render real em Angola antes de queixar |
| Vendor lock em FormKit | Alta | Médio | Schema é JSON e é nosso — sair significaria reescrever renderer, não perder formato dos dados. Estimativa de saída: 1 semana de trabalho para Vue-puro renderer |
| FormKit Pro exigido por cliente sensível | Média | Baixo | Adiar decisão; adoptar só se surgir cliente concreto. Verificar política de telemetria antes de comprar |
| CSP restritiva rejeitar estilos FormKit | Média | Médio | Confirmar em Sprint 0 empiricamente; ter plano de emenda ADR-025 se necessário |

---

## 13. Registo de decisões (ADRs)

### ADRs de família (herdados de `smartform_platform_tis`)

Ver [PLATFORM-CLAUDE.md](https://github.com/willianjjammes/smartform_platform_tis/blob/main/PLATFORM-CLAUDE.md) para lista completa. Os 13 ADRs de família aplicam-se sem alteração — nomeadamente ADR-011 (servidor nunca chama LLM), ADR-015 (`schema_version`), ADR-016 (UTC), ADR-018 (n8n MCP), ADR-020 (Supabase node), ADR-021 (1 server + N workers), ADR-022 (naming EN), ADR-023 (nginx+Traefik), ADR-024 (CORS), ADR-025 (CSP+HSTS — com possível emenda no Sprint 0), ADR-028 (naming schema), ADR-029 (estrutura docs), ADR-030 (sanitize+caps).

### ADRs específicos do Intake

| ID | Título |
|---|---|
| [ADR-100](./adr/100-frontend-vue-formkit.md) | Frontend Vue 3 + FormKit + Vite (inverte ADR-004 do Decisions) |
| [ADR-101](./adr/101-schema-derivado-formkit-com-whitelist-server-side.md) | Schema Intake é sub-set restrito do FormKit schema com whitelist server-side |
| [ADR-102](./adr/102-submissoes-insert-nao-upsert.md) | Submissões usam INSERT (não UPSERT como no Decisions) |
| [ADR-103](./adr/103-tabelas-intake-forms-submissions.md) | Tabelas `intake_forms` e `intake_submissions` — modelo de dados dedicado |
| [ADR-104](./adr/104-vite-build-pipeline.md) | Vite como build pipeline + deploy do build para VPS |

Próximo número livre: **ADR-105**.

---

## 14. Questões em aberto

| # | Questão | Default assumido |
|---|---|---|
| Q1 | FormKit CSP `unsafe-inline` obrigatório? | A confirmar empiricamente em Sprint 0; se sim, emenda ADR-025 restrita a `intake.tisapp.ai` |
| Q2 | Uploads no Sprint 0? | Não — adiar para Sprint 2 quando surgir caso real (FormKit Pro pode ser necessário) |
| Q3 | Multi-step forms no Sprint 0? | Não — single-page é suficiente para UCs identificados; `<FormKitMultiStep>` em Sprint 2 |
| Q4 | Bilingue (EN, FR)? | Não em v0.1; roadmap conjunto de família (Q2) |
| Q5 | Notificação a URL webhook ao submeter? | Backlog; caso real activa decisão |

---

## 15. Anexos

- **A1 — Referências:** Decisions em produção (`smartform_decisions_tis`), PLATFORM-PRD (`smartform_platform_tis`), FormKit docs oficiais em https://formkit.com
- **A2 — POC alvo:** cadastro de fornecedor com 3 secções (entidade + contactos repeater + termos) — próximo teste E2E do Sprint 0

---

## 16. Changelog

### v0.1 (2026-08-26)

- PRD inicial escrito em execução da Fase 2 do ADR-029
- 16 secções seguindo template validado no Decisions v2.3
- 5 ADRs específicos definidos (100-104)
- Schema exemplo cobrindo group + repeater + conditional + validation
- Modelo de dados definido (`intake_forms`, `intake_submissions`)
- Roadmap Sprint 0 mapeado
