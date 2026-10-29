# Checklist de Implantação: Site Institucional vs. App Nativo (CONSUBOV)

Este documento define os requisitos técnicos de infraestrutura e deployment para garantir a separação entre o Site Institucional (`consubov.com.br`) e o App Nativo (`app.consubov.com.br`).

## 1. Estrutura de Builds e Domínios

| Artefato | Domínio/Endpoint | Build Command | Destino |
| :--- | :--- | :--- | :--- |
| **Site Institucional** | `consubov.com.br` | `bun run build:site` | `apps/web/dist-site` |
| **App Nativo** | `app.consubov.com.br` | `bun run build` | `apps/web/dist` |

## 2. Regras de Servidor (Vercel / Cloudflare)

### A. Site Institucional (`consubov.com.br`)
O site hospeda apenas as landing pages públicas.
- **Cache-Control:**
  - `*.html`: `no-cache, no-store, must-revalidate` (para sempre servir a versão mais recente).
  - `/assets/*`: `public, max-age=31536000, immutable` (fingerprinted assets).
- **Redirecionamentos:**
  - Não deve haver redirecionamento de rotas de sistema (`/app`, `/login`, etc.) para o próprio site. Estas rotas devem ser inexistentes ou encaminhar via link para o App.
  - O cabeçalho de CTAs deve ser unicamente **"Baixar App"**.

### B. App Nativo (`app.consubov.com.br`)
- **Regras de Rewrites (Vercel `vercel.json`):**
  - **Obrigatório:** `{"source": "/(.*)", "destination": "/index.html"}` (Single Page Application).
- **Segurança de Superfície (Redirects):**
  - Todo acesso à `/` ou rotas internas em aba comum do navegador (via UA ou `display-mode` não standalone) deve ser redirecionado para `/baixar` se o App ainda não estiver instalado.
- **Cache-Control (Service Worker):**
  - `/sw.js`: `no-cache` (ou `max-age=0, must-revalidate`) — **Crítico:** nunca cachear o Service Worker em nível de CDN/Edge, pois ele é responsável pela estratégia offline-first.

## 3. Checklist de QA para Deployment (Produção)

- [ ] **Terminologia:** Garantir que o termo "PWA" inexista em todo o front-end e comunicações. Usar "App" ou "Aplicativo".
- [ ] **CTAs de Cabeçalho:** Landing Pages (`/`, `/relatto`) exibem apenas "Baixar App".
- [ ] **Modo Standalone:**
  - Usuário instalado (icon) acessa `/` e é redirecionado instantaneamente para `/login` (via `StandaloneAppGuard`).
  - Usuário em navegador acessa `/` (subdomínio app) e é redirecionado para `/baixar`.
- [ ] **Instalação:** A página `/baixar` oculta botão de instalação se `isAppInstalledOnDevice()` for `true`.
- [ ] **Offline:** `sw.js` precache está sendo gerado e injetado corretamente (verificado via `inject-sw-build-timestamp` no `vite.config.ts`).

## 4. Estratégia de Cache e Headers

- **Service Worker:** `Cache-Control: no-cache, no-store`
- **Manifest:** `Cache-Control: no-cache` (deve ser sempre verificado).
- **Assets:** `Cache-Control: public, max-age=31536000, immutable`
