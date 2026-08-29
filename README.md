# TIS Smart Form: Intake

Servidor **MCP** da TIS Tech Angola que permite ao Claude gerar formulários de **recolha complexa de informação** com validação rica, condicionais, repeaters — entregar link partilhável — e ler as submissões estruturadas de volta.

Subproduto da família **TIS Smart Form** ([`smartform_platform_tis`](https://github.com/willianjjammes/smartform_platform_tis)). Irmãos: [Decisions](https://github.com/willianjjammes/smartform_decisions_tis), [Docs](https://github.com/willianjjammes/smartform_docs_tis).

**Estado:** Sprint 0 iniciado 2026-08-26 — desenho pronto, implementação por arrancar.

## O que permite fazer

- Cadastros (fornecedor, cliente, parceiro) com validação de campos, condicionais, repeaters para múltiplos contactos
- Onboarding com secções agrupadas
- Ficha de suporte com campos condicionais por severidade
- Discovery técnico denso (>10 perguntas de contexto factual — quando Decisions ficaria longo demais)
- Inscrição em evento com sessões multi-select + termos aceites

## Diferença face aos irmãos

| Aspecto | Decisions | **Intake** | Docs |
|---|---|---|---|
| Valor | Decisão + racional | **Campos estruturados** | Ficheiros |
| Schema | R1–R11 | **Sub-set FormKit** | Slots de ficheiro |
| Frontend | Vanilla ~39 KB | **Vue+FormKit ~200 KB** | Vue+FormKit+dropzone |
| Submissão | UPSERT | **INSERT** | INSERT |

## Arquitectura

Herda da família ([PLATFORM-SPEC](https://github.com/willianjjammes/smartform_platform_tis/blob/main/docs/PLATFORM-SPEC.md)) com frontend Vue+FormKit+Vite. Ver `docs/PRD-intake-v0.1.md` §4.

## Documentação

| Ficheiro | Papel |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Regras específicas + estado do Sprint 0 |
| [`docs/PRD-intake-v0.1.md`](./docs/PRD-intake-v0.1.md) | PRD inicial (16 secções) |
| [`specs/SPEC-intake-v0.1.md`](./specs/SPEC-intake-v0.1.md) | SDD inicial |
| [`docs/adr/`](./docs/adr/) | 5 ADRs específicos (100-104) |

## Setup (para colaborar)

Sprint 0 ainda por arrancar. Setup planeado:

```bash
git clone <repo> smartform_intake_tis && cd smartform_intake_tis

# Frontend Vite+Vue+FormKit (a criar em Sprint 0)
cd frontend && npm create vite@latest . -- --template vue-ts
cd frontend && npm install @formkit/vue @formkit/themes
npm run dev
```

## Segurança

Ver `docs/PRD-intake-v0.1.md` §9 + ADRs 024, 025, 030 da família + ADRs 101 (whitelist FormKit) e 104 (build pipeline).

---

**Versão:** v0.1 (Sprint 0 — 2026-08-26)
**Autor:** Willian Jammes — TIS Tech Angola
**Licença:** interna TIS
