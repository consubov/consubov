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
