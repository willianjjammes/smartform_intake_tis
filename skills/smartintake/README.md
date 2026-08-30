# `smartintake` skill

Skill que ensina o Claude Cowork a operar o MCP server `SmartFormIntake` (TIS Smart Form: Intake), o **3.º subproduto** da família TIS Smart Form.

## Contexto — família de skills

| Subproduto | Skill | MCP server | Repo |
|---|---|---|---|
| Decisions | `formmcp` | `FormQuestions` | `smartform_tis` |
| Docs | `smartdocs` (+ `smartdocsdownload`) | `SmartFormDocs` | `smartform_docs_tis` |
| **Intake** | **`smartintake`** | **`SmartFormIntake`** | **`smartform_intake_tis` (este)** |

O `SKILL.md` explica **quando usar cada uma** e como não as confundir.

## Conteúdo do `SKILL.md`

- Tabela comparativa dos 3 subprodutos
- Contrato do schema FormKit sub-set (ADR-101 v0.2)
  - 10 tipos permitidos (text, email, number, textarea, select, checkbox, radio, group, date, time)
  - 10 regras de validação permitidas
  - Não suportado: `repeater`, `if` conditional (workarounds documentados)
- **7 tools MCP** cobertas:
  - `ping` (health)
  - `get_intake_example` (template)
  - `create_intake_form` (criar)
  - `get_intake_form` (Sprint 0 skeleton — 501)
  - `get_intake_status` (Sprint 0 skeleton — 501)
  - `get_intake_submissions` (Sprint 0 skeleton — 501)
  - `list_intake_forms` (**novo — Sprint 0**, discovery com filtros e paginação)
- Padrões de fluxo A-D (criar, consumir, discovery, debug)
- Diferenças relevantes vs `formmcp` (Decisions) e vs `smartdocs` (Docs)
- Políticas de dados (INSERT-only, capability URL, retenção)
- Erros comuns a evitar

## Instalação

A skill é proposta ao user via `propose_skills` durante uma sessão Cowork. O user aprova em UI e ela fica disponível como `/smartintake` (ou é auto-triggered pelas expressões descritas na descrição).

O ficheiro `SKILL.md` neste directório é a **fonte de verdade** — quando a skill for actualizada em produção, este ficheiro deve ser sincronizado.

## Referências (repo)

- **PRD**: `docs/PRD-intake-v0.1.md`
- **SPEC**: `specs/SPEC-intake-v0.1.md`
- **ADRs**: 100 (Vue+FormKit), 101 (schema derivado FormKit + whitelist), 102 (INSERT vs UPSERT), 103 (tabelas), 104 (Vite build pipeline)
- **CLAUDE.md**: mapa rápido do repo
- **Worker n8n do `list_intake_forms`**: workflow ID `5Igh2LQpyHA5f1GO`
- **Router MCP [POC] SmartForm Intake**: workflow ID `gsBJJtkP6EYWhWMY` (7 tools registadas)
