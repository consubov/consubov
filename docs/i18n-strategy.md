# Estratégia de Internacionalização (i18n) - Consubov

Data: Outubro de 2026
Local de Referência do Vault: `D:\MATEUS\Documentos\GitHub\Obsidian\Vault\02-PROJECTS\CONSUBOV`

## Diretrizes Globais
1. **Suporte Bilíngue Obrigatório**: Toda a aplicação Consubov (plataforma SaaS, site institucional, app de campo, relatórios, modais, navegação e relatórios de visita técnica) deve suportar nativamente **Português do Brasil (pt-BR)** e **Inglês Americano (en-US)**.
2. **Seletor de Idioma com Bandeiras**: Disponibiliza componente dedicado com as bandeiras do Brasil e dos Estados Unidos, permitindo alternância instantânea com persistência local e suporte a gramática e convenções regionais de cada país.
3. **Padrão de Qualidade e Revisão**: As traduções seguem rigor gramatical e terminologia técnica pecuária apropriada para cada mercado.
4. **Governança**: Este requisito é definitivo para todas as frentes de evolução e novas entregas do ecossistema Consubov.

## 2026-11-02 — Integração incremental do idioma no App (candidato em QA)

- O Site mantém o idioma em `consubov:site-language`; o App usa `consubov:app-language`, sem enviar dados de idioma ao backend.
- O Provider React oferece tradução para autenticação, autorização e alguns controles básicos; o usuário alterna com as bandeiras 🇧🇷/🇺🇸 no App. Strings desconhecidas não alteram dados ou identificadores e mantêm a chave original.
- **Cobertura parcial**: dashboards, módulos especializados, avisos dinâmicos, PDFs e outros fluxos precisam de tradução revisada e QA próprios. Não anunciar a aplicação completa como bilíngue.
- Sem alterações em IndexedDB, RLS, autenticação do servidor, sincronização ou serviço de atualização.
- Gate local realizado no candidato: typecheck e 70 arquivos Vitest aprovados, Vite build e orçamento bruto/gzip aprovados. QA E2E/PWA em dispositivos reais e regressões Node/Task pendentes por `node` indisponível no runner VPS; não liberar release até concluir.
- A constante `APP_VERSION` continua sob o gate de release do Catálogo 17; não incrementá-la ao preparar/mergear o candidato sem verificação de versão publicada.


## 2026-11-02 — Regras para novas interfaces e relatórios

Todo novo texto **da interface** ou dos **PDFs** deve ter representação revisada em `pt-BR` e `en-US` antes de aprovação. Prefira `t()` com chave semântica para React; os geradores de PDF devem receber `locale` explicitamente e traduzir títulos/colunas/legendas sem traduzir dados do produtor, identificadores de animais, campos de payload nem códigos técnicos. A suíte `AppLanguage.test.tsx` exige chaves e valores correspondentes nos dois idiomas.

**Escopo atual da PR #163:** somente a infraestrutura i18n, a troca de idioma e cópia de login/autorização. **Ainda não existe gate de cobertura para todas as telas/PDFs**; novas entregas devem adotar i18n até que um gate universal seja implementado e validado. Não declarar 100% de cobertura em inglês com este patch. O Site mantém estado separado.

### QA e orçamento

A nova interface cria um pequeno acréscimo legítimo ao bundle. O rebaseline do `scripts/web-bundle-budget.json` foi medido na mesma VPS com a `main` 9acf4e57 (8.753.242 raw/2.753.897 gzip bytes) e candidato PR163 (8.756.008 raw/2.755.542 gzip bytes). Limites ajustados ao tamanho observado +500 bytes; maior asset inalterado. CI deve revalidar no HEAD exato. Nenhuma alteração em Service Worker, filas ou migração.


### 2026-11-02 — Reconciliacao da main v2.0.38

A base `main` avancou durante o QA para `566816aa` (APP_VERSION `2.0.38`). Medicao VPS CI-mode da nova base: **8.754.577 raw / 2.753.891 gzip**. A PR #163 sobre essa base (CI SHA `f2df3803`) mediu **8.757.343 raw / 2.755.397 gzip**. A funcionalidade aumentou **2.766 raw / 1.506 gzip** sobre a base. O teto **apenas raw** passa a `8.757.843` (candidato + 500); gzip `2.756.042` e maior asset `2.849.003` permanecem iguais. Reexecutar CI no novo SHA; este rebaseline nao autoriza release. A traducao interna/PDF e o gate universal de textos ainda estao pendentes.

## 2026-11-02 — I18N-002: troca de idioma em telas operacionais e seletor no topo

- O seletor do App passou a integrar uma barra **sticky no topo**, acima dos cabeçalhos e sem obstruir ações de sair/atualizar; mantém separação de `consubov:site-language` e `consubov:app-language` e suporte a safe-area.
- React `useTranslation()` foi conectado às rotas comuns de admin (sidebar e dashboard), consultor, escritório, pesador, pecuarista, SyncVet e GerenteDashboard; os meses do `MonthScroller` respeitam a preferência do App. Dados da API, nomes de fazendas, usuários, identificadores e valores financeiros não são traduzidos.
- As chaves adicionais são pares `pt-BR/en-US` e o teste específico verifica correspondência, mudança imediata, reversão e persistência da preferência. Há prova E2E local em navegador para login, barra no topo mobile e tela administrativa autenticada.
- **Cobertura ainda parcial**: páginas internas que não consomem `useTranslation`, formulários detalhados, modais e todos os geradores de PDF continuam aguardando i18n. **Não anunciar a aplicação integralmente traduzida.** Não usar tradução implícita de dados operacionais, nem criar serviços externos de tradução.
- Novo código de interface e PDF deve incluir as duas traduções revisadas antes do aceite; o gate universal que exige i18n de todos os arquivos ainda não existe e deve ser implementado em tarefa própria.
- Medições controladas na VPS (mesmo runner e `GITHUB_ACTIONS=true`, 339 arquivos): main `c175efed` raw **8.757.492** / gzip **2.755.347**; candidato I18N-002 raw **8.767.165** / gzip **2.758.114**; delta final **+9.673/+2.767**. Tetos raw/gzip = **8.767.665 / 2.759.084** (raw final +500; gzip maior medida observada +500); maior asset continua **2.849.003**. Repetir CI na árvore/commit definitivo. Isso não autoriza release, deploy, migrações ou mudanças no SW.

QA de regressão adicional: componentes administrativos renderizados fora do Provider mantêm cópia pt-BR por fallback (sem expor chaves de tradução). E2E simula sessão local sem rede remota e comprova que o menu administrativo e a tela Overview alternam dinamicamente.
