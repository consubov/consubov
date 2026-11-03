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

## 2026-11-03 — I18N-003: cobertura de textos internos e PDF principal

- A tela administrativa **Fazendas**, sua edição, detalhes, retiros e pastos usam traduções explícitas por chave do App (`apps/web/src/lib/translations.ts`), inclusive toasts, confirmações e ARIA. Dados de clientes e valores persistidos nunca são traduzidos. Categorias e sexo são traduzidos **somente na exibição**, mantendo os valores do banco inalterados.
- O texto JSX **estático de 185 componentes/páginas internas** passou por um codemod baseado no parser TypeScript e foi conectado ao catálogo `apps/web/src/lib/staticUiEnglish.json` (~1.623 frases). `LocalizedText` usa um Fragment e não cria novos elementos DOM, preservando foco/layout. A conversão não altera expressões, valores do usuário, nomes de propriedades, atributos, URLs nem payloads. Exclui site público, login, componentes-base e geradores de PDF.
- A suíte `StaticUiEnglish.test.tsx` impede novas strings JSX não catalogadas nos caminhos cobertos, preserva uma lista explícita de 84 termos já ingleses, unidades técnicas e marcas em `staticUiUnchangedAllowlist.json`. **O gate não cobre automaticamente placeholders/atributos, toast dinâmico, mensagens originadas de servidor, componentes-base nem todos os outros PDFs**: para esses casos, manter revisão manual obrigatória e testes por tela.
- O relatório principal de fazenda (`RelatorioPDF`) recebe o idioma diretamente do modal, traduz títulos, colunas e legendas por `translatePdfLabel` e mantém dados operacionais. A renderização PDF com dados sintéticos vazios passou para pt-BR e en-US. **Geradores de outros relatórios e todos os textos dinâmicos de PDF ainda exigem auditoria.**
- A implementação aqui é incremental; **não declarar o produto 100% traduzido** sem inspeção visual por perfil, validação linguística dos termos restantes e QA ponta a ponta de todos os fluxos.
- Base de trabalho: main `d99f60d4` versão 2.0.40. Medições de build no mesmo VPS/Bun/CI-mode: base `raw=8.770.760/gzip=2.759.655`, candidato antes do commit `raw=8.913.813/gzip=2.796.097`, 339 JS/CSS assets. Gasto esperado da adição de ~1.623 traduções e 2.6 mil referências estáticas (+143.053 bruto/+36.442 gzip). Rebaseline controlado do budget somente após fechar arquivo SHA e revalidar CI; o gate de maior asset não pode ser relaxado sem medição e autorização. Nenhuma publicação ou mudança no PWA, Supabase, Vercel, RLS ou APIs é autorizada por esse registro.

### 2026-11-03 — I18N-003 rebase de catalogo UI sobre main 2.0.43

- A partir da base `main 5e18ca9d`, foram aplicadas as traduções estáticas das páginas/elementos internos, incluindo Fazendas (títulos, tabela, criar/editar, toasts e campos) e o relatório principal em PDF.
- O catálogo `staticUiEnglish.json` contém 1.623 pares PT/EN; `LocalizedText` usa contexto React do App e preserva valores que vêm do usuário/banco. Teste de lint estrutural cobre JSX estático e novas chaves do catálogo, **não** todos os atributos, textos derivados de API, strings calculadas nem demais geradores PDF.
- Medição no mesmo runner CI-mode (339 assets): main raw **8.775.281**, gzip **2.760.698**; candidato raw **8.918.334**, gzip **2.797.386**. Delta real **+143.053 raw/+36.688 gzip**; orçamento após implementação raw **8.918.834**/gzip **2.797.886** (candidato +500), largest-asset **2.849.003** preservado. A main já excedia o antigo raw budget por 158 bytes. **Sem relaxamento cego:** obrigatório revalidar no SHA do PR com CI.
- Escopo restante: tradução manual de texto dinâmico, mensagens de componentes de terceiros e geradores PDF adicionais, além de testes autenticados de perfis com dados reais (estes testes usam fixtures locais). Não declarar o sistema 100% inglês. Zero alterações em banco, SW/IndexedDB, backend ou deploy.
