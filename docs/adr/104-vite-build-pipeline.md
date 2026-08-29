# ADR-104: Vite como build pipeline + deploy do build para VPS

**Data:** 2026-08-26
**Status:** Aceite (v0.1)
**Decisor:** Willian Jammes
**Contexto de produto:** TIS Smart Form: Intake — Sprint 0

## Contexto

Adoptar Vue+FormKit (ADR-100) implica build step. O Decisions não tinha (single-file HTML rsync directo). Precisamos definir como o build acontece e como o `dist/` chega ao VPS.

## Decisão

### D1 — Vite

Build tool: **Vite** (defaults do Vue 3). Config em `frontend/vite.config.ts`.

Racional: Vite é o default do ecossistema Vue 3 actual — dev server fast, HMR fluido, build minificado com tree-shake automática do FormKit e Vue. Sem razão para escolher Webpack ou Rollup directos.

### D2 — Estrutura de output

```
frontend/dist/
├── index.html                     (< 5 KB, referencia bundles)
├── assets/
│   ├── index-<hash>.js            (bundle principal, ~200 KB gzipped)
│   ├── index-<hash>.css           (CSS extraído, ~30 KB gzipped)
│   └── tis-logo-<hash>.svg
```

Vite gera hashes para cache-busting automático.

### D3 — Deploy

Sprint 0: **rsync manual** do `frontend/dist/` para o VPS após `npm run build`:

```bash
cd frontend
npm run build
rsync -avz --delete dist/ root@72.62.4.27:/opt/forms-intake/html/
```

Container nginx no VPS_Docker aponta para `/opt/forms-intake/html/`.

Sprint 1 introduz GitHub Actions com deploy automático em push para main (ou tag `v*`).

### D4 — CSP e Vite

Vite inline-a algumas coisas (preload scripts) que podem colidir com CSP restritiva ([ADR-025](https://github.com/willianjjammes/smartform_platform_tis/blob/main/docs/adr/025-csp-hsts-frontend.md) da família).

Estratégia:

- Configurar Vite para gerar `<link rel="modulepreload">` explícitos (não inline)
- Se ainda assim CSP falhar em Sprint 0, propor emenda restrita a `intake.tisapp.ai` para permitir `'unsafe-inline'` em `style-src` **e nada mais** (script-src continua restritivo)
- Documentar decisão em emenda ao ADR-025

### D5 — Sem SSR

Sprint 0 usa SPA client-side rendering. SSR (com Nuxt) fica no backlog — potencialmente útil para SEO se produto for exposto externamente, mas irrelevante para POC pessoal e formulários com capability URL.

## Alternativas rejeitadas

- **Webpack** — mais lento, mais complexo, sem benefício para este projecto
- **Snowpack/Parcel** — mais raros no ecossistema Vue; menor comunidade
- **Vite SSR / Nuxt** — over-engineering para Sprint 0
- **Bundle CDN direto (sem build)** — perde tree-shake, bundle ~500 KB em vez de ~200 KB; sem cache-busting bom

## Consequências

- Sprint 0 tem novo passo operacional (`npm run build && rsync`) vs. o Decisions (rsync directo)
- Container VPS separado para o Intake (`forms-intake` nginx bind-mount `/opt/forms-intake/html/`)
- CSP pode precisar de emenda — a confirmar
- CI/CD entra Sprint 1

## Rastreabilidade

- **Depende de:** ADR-100 (Vue+FormKit stack), ADR-023 da família (nginx+Traefik)
- **Interage com:** ADR-025 da família (CSP — possível emenda)
