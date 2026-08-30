# TIS Smart Form: Intake

Servidor **MCP** da TIS Tech Angola que permite ao Claude gerar formulários de **recolha complexa de informação** com validação rica, condicionais, repeaters — entregar link partilhável — e ler as submissões estruturadas de volta.

Subproduto da família **TIS Smart Form** ([`smartform_platform_tis`](https://github.com/willianjjammes/smartform_platform_tis)). Irmãos: [Decisions](https://github.com/willianjjammes/smartform_decisions_tis), [Docs](https://github.com/willianjjammes/smartform_docs_tis).

**Estado:** Sprint 0 quase pronto (2026-08-30). Postgres schema aplicado, MCP com 7 tools registadas, 2 webhooks públicos, frontend Vue+FormKit+Vite scaffolded, `deploy.sh` funcional, skill Cowork `smartintake` publicada. Falta: teste E2E completo + implementação real de 3 skeletons (Sprint 1).

## O que permite fazer

- Cadastros (fornecedor, cliente, parceiro) com validação de campos e secções agrupadas (`group`)
- Onboarding com secções agrupadas
- Ficha de suporte com campos categorizados por severidade
- Discovery técnico denso (>10 perguntas de contexto factual — quando Decisions ficaria longo demais)
- Inscrição em evento com sessões multi-select + termos aceites

> **Nota v0.1 (ADR-101 v0.2):** `repeater` e `if` conditional requerem FormKit Enterprise e são rejeitados 422 no server. Workarounds documentados na skill `smartintake` (campos numerados fixos, ou formulários encadeados). Reagendados para v0.2 se a licença Enterprise for adquirida.

## Diferença face aos irmãos

| Aspecto | Decisions | **Intake** | Docs |
|---|---|---|---|
| Valor | Decisão + racional | **Campos estruturados** | Ficheiros |
| Schema | R1–R11 | **Sub-set FormKit** | Slots de ficheiro |
| Frontend | Vanilla ~39 KB | **Vue+FormKit ~200 KB** | Vue+FormKit+dropzone |
| Submissão | UPSERT | **INSERT** | INSERT |
| Skill Cowork | `formmcp` | **`smartintake`** | `smartdocs` + `smartdocsdownload` |

## Arquitectura

Herda da família ([PLATFORM-SPEC](https://github.com/willianjjammes/smartform_platform_tis/blob/main/docs/PLATFORM-SPEC.md)) com frontend Vue+FormKit+Vite. Ver `docs/PRD-intake-v0.1.md` §4 e §17 (execução Sprint 0).

## Documentação

| Ficheiro | Papel |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Regras específicas + estado do Sprint 0 + mapa das 7 tools MCP com IDs |
| [`docs/PRD-intake-v0.1.md`](./docs/PRD-intake-v0.1.md) | PRD inicial (16 secções) + §17 addendum Sprint 0 |
| [`specs/SPEC-intake-v0.1.md`](./specs/SPEC-intake-v0.1.md) | SDD inicial + Apêndice A com deltas de execução |
| [`docs/adr/`](./docs/adr/) | 5 ADRs específicos (100-104) |
| [`skills/smartintake/`](./skills/smartintake/) | Skill Cowork que ensina Claude a usar o MCP |
| [`frontend/`](./frontend/) | Vue+FormKit+Vite (ADR-100/104) |
| [`deploy.sh`](./deploy.sh) | Build + git push + ssh VPS + health check |

## Setup

```bash
git clone <repo> smartform_intake_tis && cd smartform_intake_tis

# Frontend Vite+Vue+FormKit
cd frontend && npm install
npm run dev   # abre http://localhost:5173/?formkey=<uuid>

# Build de produção
npm run build   # gera frontend/dist/

# Deploy completo (build + git + ssh VPS + health check)
../deploy.sh "descrição do que mudou"
```

## Endpoints (produção)

- **MCP** (bearerAuth): `https://willianjammes.app.n8n.cloud/mcp/mcp-intake`
- **Schema fetch** (frontend → n8n): `GET https://willianjammes.app.n8n.cloud/webhook/intake-schema?formkey=<uuid>`
- **Submit** (frontend → n8n): `POST https://willianjammes.app.n8n.cloud/webhook/intake-submit`
- **Frontend**: `https://intake.tisapp.ai/?formkey=<uuid>`

## Segurança

Ver `docs/PRD-intake-v0.1.md` §9 + ADRs 024, 025, 030 da família + ADRs 101 (whitelist FormKit) e 104 (build pipeline).

---

**Versão:** v0.1 (Sprint 0 — 2026-08-30)
**Autor:** Willian Jammes — TIS Tech Angola
**Licença:** interna TIS
