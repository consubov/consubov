# 70 — Separação entre Site Institucional e App Nativo (Subdomínio + Acesso Web ou Instalado)

**Data:** 2026-10-20
**Status:** Revisado em 2026-10-29: acesso ao App no navegador permitido; instalação opcional

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
4. **Acesso Web permitido e instalação opcional (2026-10-29):**
   - `https://app.consubov.com.br/login` abre o login em aba normal, sem instalação.
   - No App (`app.*`), rotas de login e áreas autenticadas não são desviadas para `/baixar` por ausência de `standalone`. Autenticação e autorização continuam obrigatórias.
   - O ícone instalado preserva a navegação `/app`/`/consultor`, a mesma origem e os dados offline existentes.
   - **Não criar botões "Entrar", "Abrir App" ou "Abrir no App"** nas Landing Pages nem no instalador. O acesso web é feito digitando o endereço; o botão para enviar o formulário de login permanece.

---

## 2. Arquitetura Técnica e Fluxo de Instalação

### 2.1. Modos de Superfície e Detecção de Hostname (`apps/web/src/lib/appSurface.ts`)

O módulo `appSurface.ts` centraliza as regras de superfície e instalação:

- **`getSurfaceMode()`**:
  - Retorna `"site"` quando compilado com `VITE_SURFACE_MODE=site` (`bun run build:site`).
  - Retorna `"app"` quando compilado com `VITE_SURFACE_MODE=app` ou quando acessado via subdomínio `app.*` (ex.: `app.consubov.com.br`, `app.localhost`) ou com parâmetro de verificação `?surface=app`.
  - Em produção, o modo fixo do build prevalece sobre `?surface=`, preservando o isolamento do site institucional.
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
  - Se a superfície ativa for `"app"`: `/login`, recuperação de senha e rotas privadas são acessíveis no navegador; autenticação e perfil continuam exigidos.

### 2.3. Builds Separados no Monorepo

- **Build do App (`apps/web/dist`):**
  - Comando: `bun run --cwd apps/web build` (ou `bun run build:web`)
  - Contém Service Worker offline-first (`sw.js`), precache completo de assets, `manifest.json` (`display: "standalone"`) e guarda `StandaloneAppGuard`.
- **Build do Site (`apps/web/dist-site`):**
  - Comando: `bun run --cwd apps/web build:site` (ou `bun run build:site` na raiz)
  - Configurado via `apps/web/vite.site.config.ts` (`VITE_SURFACE_MODE=site`), gerando o artefato estático independente em `apps/web/dist-site` para deploy no domínio institucional principal.

---

## 3. Regras Obrigatórias para Agentes de IA

1. **Não inserir botões `"Entrar"`, `"Abrir App"`, `"Abrir no App"` ou `"Já concluí a instalação — Ir para Login"` no Site ou no instalador:** manter somente a ação de instalação e os controles necessários ao próprio instalador. Acesso web digitando `https://app.consubov.com.br/login`. O botão normal de envio do formulário de Login permanece. Nunca simular instalação com clique manual.
2. **Não usar o termo `"PWA"` na UI:** Qualquer texto visível ao usuário deve usar **"App"** ou **"Aplicativo"**.
3. **Preservar identidade do `manifest.json`:** Não alterar `id: "/"`, `scope: "/"`, `start_url: "/"` e `display: "standalone"` em `apps/web/public/manifest.json`, pois o gate `scripts/qa/check-pwa-build.mjs` exige identidade estável para atualização in-place sem perda de dados offline. O redirecionamento de `/` para `/app` em modo `standalone` é feito em runtime pelo `index.html` e pelo `StandaloneAppGuard`.
4. **Bloqueio de instalação duplicada (`isAppInstalledOnDevice` / `detectInstalledAppAsync`):** A página `/baixar` mantém as verificações existentes (armazenamento local, cookie, `getInstalledRelatedApps()` e modo `standalone`) para impedir duplicidade. O aviso pode recomendar o ícone para uso offline, **mas nunca deve afirmar que o navegador está proibido**. Não criar um botão que declare a instalação concluída e defina `markAppInstalled()` sem confirmação do navegador; o login deve permanecer acessível por URL.
5. **Não quebrar o orçamento de bundle (`check:bundle-budget`) nem os testes E2E da FASE 5:** Qualquer alteração em `LandingPage.tsx`, `BaixarAppPage.tsx` ou `App.tsx` deve manter `bun run check:bundle-budget` e a matriz de QA 13/13 em `PASS`.

