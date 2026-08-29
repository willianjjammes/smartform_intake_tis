# CLAUDE.md — TIS Smart Form: Intake

Subproduto da família **TIS Smart Form**. Ver [`PLATFORM-CLAUDE.md`](https://github.com/willianjjammes/smartform_platform_tis/blob/main/PLATFORM-CLAUDE.md) para regras que atravessam os três subprodutos.

## O que é este subproduto

Formulários de **recolha complexa de informação** com validação rica, condicionais, repeaters. Optimizado para cadastros, onboarding, discovery técnico denso.

**Estado:** Sprint 0 iniciado 2026-08-26. Docs prontos, implementação por arrancar.

## Ordem de leitura

1. `PLATFORM-CLAUDE.md` do repo de plataforma
2. Este documento
3. `docs/PRD-intake-v0.1.md`
4. `docs/adr/` (100-104)

## Regras específicas

1. **Schema é sub-set restrito do FormKit** ([ADR-101](./docs/adr/101-schema-derivado-formkit-com-whitelist-server-side.md)) — nunca aceitar `$formkit` types fora da whitelist do Code node, nunca deixar expressões complexas em `if`, sempre limitar `repeater max` e `matches` regex length.

2. **Submissão faz INSERT, não UPSERT** ([ADR-102](./docs/adr/102-submissoes-insert-nao-upsert.md)) — cada submit é registo novo. Se o mesmo respondente enviar duas vezes, ficam duas linhas. Se o negócio precisar de "última resposta vence" para algum formulário, esse formulário é para o **Decisions**, não para o Intake.

3. **Frontend usa Vue+FormKit+Vite** ([ADR-100](./docs/adr/100-frontend-vue-formkit.md)) — inverte deliberadamente ADR-004 do Decisions. Custo de build aceite pelo valor de UX rica.

4. **CSP pode precisar de emenda** ([ADR-025](https://github.com/willianjjammes/smartform_platform_tis/blob/main/docs/adr/025-csp-hsts-frontend.md) da família) — se FormKit precisar de `unsafe-inline` no `style-src`, emenda restrita a `intake.tisapp.ai`. Confirmar empiricamente em Sprint 0.

## Comandos-chave

```bash
cd frontend && npm install && npm run dev
cd frontend && npm run build
rsync -avz frontend/dist/ root@72.62.4.27:/opt/forms-intake/html/
psql "$SUPABASE_URL" -f supabase/schema.sql
```

## Estado do Sprint 0

- [ ] `supabase/schema.sql` aplicado (`intake_forms`, `intake_submissions`)
- [ ] Workflow `[POC] SmartForm Intake` criado
- [ ] 6 workers MCP + 2 workers webhook
- [ ] Frontend Vite+Vue+FormKit
- [ ] Deploy em `intake.tisapp.ai`
- [ ] Confirmar/emendar CSP para FormKit styles
- [ ] Teste E2E: criar cadastro fornecedor → preencher → ler

## Numeração de ADR

- **ADRs de família:** ver `smartform_platform_tis/docs/adr/`
- **ADRs específicos:** dedicada a partir de 100. Actualmente 100-104. **Próximo livre: ADR-105.**

## Contribuir

Emenda a ADR de plataforma exige review no repo de plataforma. Novo ADR específico do Intake fica aqui (105+).
