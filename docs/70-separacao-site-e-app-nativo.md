# 70 — Separação entre Site Institucional e App Nativo (Subdomínio + Acesso Exclusivo pelo Ícone)

## Adendo 29/10/2026 — CTA de instalacao do site (aprovado pelo responsavel)

- Em `consubov.com.br/baixar`, o clique no botao `Baixar e Instalar App CONSUBOV` navega diretamente, na mesma aba, para `https://app.consubov.com.br/baixar`. O site nao instala a PWA institucional e nao depende de `navigator.install` (API experimental entre origens).
- O APP fornece seu proprio botao `Instalar App CONSUBOV 2.0`; somente na origem `app.consubov.com.br` o evento `beforeinstallprompt` pode oferecer a confirmacao nativa. A navegacao NAO transfere a ativacao do usuario para forcar esse popup: se necessario, clicar no botao do APP ou no icone de instalar do Chrome na origem do APP.
- Preservar manifestos/identidade da PWA, SW, IndexedDB, filas offline, release do APP 2.0.0 e o fluxo Relatto. Este adendo substitui a regra anterior de tentar popup cross-origin pelo botao do site.


**Data:** 2026-10-20
**Status:** Regra Arquitetural Ativa e Obrigatória para Humanos e Agentes de IA

---

## 1. Contexto e Decisão de Produto

Para garantir melhor organização, segurança de superfície e experiência 100% idêntica a um aplicativo nativo nos dispositivos dos usuários, o ecossistema **Consubov** (incluindo **Relatto**, **Mais Arrobas** e **SyncVet**) separa estritamente o **Site Institucional (Landing Pages)** do **App**:

1. **Separação em Domínio Principal vs. Subdomínio (Builds Separados):**
   - **Site Institucional (`consubov.com.br` — build `@consubov/web` modo `site` / `bun run build:site`):** Hospeda exclusivamente as páginas públicas institucionais (`/` Consubov e `/relatto`), sem expor rotas autenticadas na mesma origem.
   - **App (`app.consubov.com.br` — build `@consubov/web` modo `app` / `bun run build`):** Hospeda o aplicativo operacional, a página instaladora (`/baixar`) e o Service Worker offline-first.
2. **Substituição de `"Entrar"` por `"Baixar App"` nas Landing Pages:**
   - Tanto na Landing Page principal (`/`) quanto na página do Relatto (`/relatto`), o botão de ação no cabeçalho é **"Baixar App"** (nunca `"Entrar"`).
   - Ao clicar em **"Baixar App"**, o usuário é levado para a página dedicada de instalação (`/baixar` ou `${VITE_APP_URL}/baixar`, e `/baixar?app=relatto` a partir do Relatto).
3. **Proibição Terminológica (`"PWA"` → `"App"`):**
   - **Nunca** utilizar a sigla `"PWA"`, `"Progressive Web App"` ou `"versão web"` na interface, nos botões, nos textos de ajuda ou nas instruções de instalação visíveis ao usuário.
   - Toda comunicação com o usuário deve se referir ao produto exclusivamente como **"App"** ou **"Aplicativo"** (ex.: *"Baixar App"*, *"Instalar Aplicativo Consubov"*, *"Abra o App pelo ícone na tela inicial do seu aparelho"*).
4. **Acesso Exclusivo pelo Ícone Instalado no Dispositivo (`standalone`):**
   - O usuário **não** utiliza o aplicativo dentro de uma aba comum do navegador.
   - Quando o subdomínio do App (`app.*` ou modo `VITE_SURFACE_MODE=app`) é aberto em uma aba comum do navegador (fora do modo `display-mode: standalone` / `navigator.standalone`), qualquer tentativa de acessar `/`, `/login` ou rotas internas redireciona automaticamente para `/baixar`, exibindo a tela de download/instalação do App.
   - Quando o usuário toca no **ícone do App instalado no dispositivo** (`display-mode: standalone`, `fullscreen`, `minimal-ui`, `navigator.standalone === true` ou `android-app://`), o App abre diretamente no sistema (`/app` → `/login` ou painel do perfil autenticado), sem jamais exibir a Landing Page e sem barra de navegador.

---

## 2. Arquitetura Técnica e Fluxo de Instalação

### 2.1. Modos de Superfície e Detecção de Hostname (`apps/web/src/lib/appSurface.ts`)

O módulo `appSurface.ts` centraliza as regras de superfície e instalação:

- **`getSurfaceMode()`**:
  - Retorna `"site"` quando compilado com `VITE_SURFACE_MODE=site` (`bun run build:site`).
  - Retorna `"app"` quando compilado com `VITE_SURFACE_MODE=app` ou quando acessado via subdomínio `app.*` (ex.: `app.consubov.com.br`, `app.localhost`) ou com parâmetro de verificação `?surface=app`.
  - Retorna `"unified"` em `localhost` / `127.0.0.1` padrão durante desenvolvimento e execução das suítes de QA locais, permitindo testar tanto `/`, `/relatto` e `/baixar` quanto as rotas autenticadas na mesma porta local (`:8080`).
- **`isStandaloneApp()`**:
  - Detecta se o aplicativo foi aberto a partir do ícone instalado no dispositivo:
    - `window.matchMedia("(display-mode: standalone)").matches`
    - `window.matchMedia("(display-mode: fullscreen)").matches`
    - `window.matchMedia("(display-mode: minimal-ui)").matches`
    - `window.navigator.standalone === true` (iOS Safari Home Screen)
    - `document.referrer.startsWith("android-app://")` (Android TWA)
    - `sessionStorage.getItem("consubov:standalone-session") === "1"` (persistência na sessão após lançamento pelo ícone ou `?standalone=1`).
- **`getDownloadAppHref(appId)`**:
  - Se `VITE_APP_URL` estiver definido (ex.: `https://app.consubov.com.br` no build do Site), retorna `${VITE_APP_URL}/baixar` (ou `${VITE_APP_URL}/baixar?app=relatto`).
  - Caso contrário, retorna `/baixar` (ou `/baixar?app=relatto`).

### 2.2. Guarda de Execução (`StandaloneAppGuard`)

- **Quando aberto pelo ícone instalado (`isStandaloneApp() === true`):**
  - Acessar `/` ou `/baixar` redireciona imediatamente para `/app` (ou `/consultor` quando o perfil instalado é `relatto`), caindo direto na tela de Login ou no painel do usuário logado.
- **Quando aberto no navegador comum (`isStandaloneApp() === false`):**
  - Se a superfície ativa for `"site"` (`consubov.com.br`): rotas do sistema (`/login`, `/app`, `/admin`, etc.) redirecionam para a página de download do subdomínio do App (`getDownloadAppHref()`).
  - Se a superfície ativa for `"app"` (`app.consubov.com.br` / `app.localhost` / `?surface=app`): qualquer acesso fora de `/baixar` redireciona para `/baixar`, exigindo que o usuário instale e abra o App pelo ícone no dispositivo.

### 2.3. Builds Separados no Monorepo

- **Build do App (`apps/web/dist`):**
  - Comando: `bun run --cwd apps/web build` (ou `bun run build:web`)
  - Contém Service Worker offline-first (`sw.js`), precache completo de assets, `manifest.json` (`display: "standalone"`) e guarda `StandaloneAppGuard`.
- **Build do Site (`apps/web/dist-site`):**
  - Comando: `bun run --cwd apps/web build:site` (ou `bun run build:site` na raiz)
  - Configurado via `apps/web/vite.site.config.ts` (`VITE_SURFACE_MODE=site`), gerando o artefato estático independente em `apps/web/dist-site` para deploy no domínio institucional principal.

---

## 3. Regras Obrigatórias para Agentes de IA

1. **Não reintroduzir botão `"Entrar"` nas Landing Pages (`/` e `/relatto`):** O CTA de cabeçalho nas Landing Pages deve permanecer **"Baixar App"** apontando para `getDownloadAppHref()`.
2. **Não usar o termo `"PWA"` na UI:** Qualquer texto visível ao usuário deve usar **"App"** ou **"Aplicativo"**.
3. **Preservar identidade do `manifest.json`:** Não alterar `id: "/"`, `scope: "/"`, `start_url: "/"` e `display: "standalone"` em `apps/web/public/manifest.json`, pois o gate `scripts/qa/check-pwa-build.mjs` exige identidade estável para atualização in-place sem perda de dados offline. O redirecionamento de `/` para `/app` em modo `standalone` é feito em runtime pelo `index.html` e pelo `StandaloneAppGuard`.
4. **Bloqueio de instalação duplicada (`isAppInstalledOnDevice` / `detectInstalledAppAsync`):** A página `/baixar` identifica automaticamente se o App (`consubov` ou `relatto`) já foi instalado no dispositivo (via `localStorage`, cookie de longa duração, `navigator.getInstalledRelatedApps()` e abertura em modo `standalone`) e oculta o botão de instalação, exibindo o aviso de que o App já está instalado e deve ser aberto pelo ícone na tela inicial do aparelho.
5. **Não quebrar o orçamento de bundle (`check:bundle-budget`) nem os testes E2E da FASE 5:** Qualquer alteração em `LandingPage.tsx`, `BaixarAppPage.tsx` ou `App.tsx` deve manter `bun run check:bundle-budget` e a matriz de QA 13/13 em `PASS`.

