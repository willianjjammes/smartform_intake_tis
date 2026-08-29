# ADRs — TIS Smart Form: Intake

ADRs específicos do subproduto Intake. Numeração dedicada a partir de **100** (evita colisão com plataforma sequencial).

Ver `smartform_platform_tis/docs/adr/` para os 14 ADRs de família que também se aplicam ao Intake.

## Índice

| # | Título |
|---|---|
| [ADR-100](./100-frontend-vue-formkit.md) | Frontend Vue 3 + FormKit + Vite (inverte ADR-004 do Decisions) |
| [ADR-101](./101-schema-derivado-formkit-com-whitelist-server-side.md) | Schema Intake é sub-set restrito do FormKit schema com whitelist server-side |
| [ADR-102](./102-submissoes-insert-nao-upsert.md) | Submissões usam INSERT (não UPSERT como no Decisions) |
| [ADR-103](./103-tabelas-intake-forms-submissions.md) | Tabelas `intake_forms` e `intake_submissions` — modelo dedicado |
| [ADR-104](./104-vite-build-pipeline.md) | Vite como build pipeline + deploy para VPS |

**Próximo número livre: ADR-105.**
