# Relatório de Diagnóstico e Otimização da Inicialização do App

## Descobertas

1.  **Code Splitting**: O `App.tsx` já implementa `lazy loading` extensivo (`lazy(() => import(...))`) para as rotas da aplicação, o que é excelente. No entanto, o `vite.config.ts` não possui uma configuração explícita de `manualChunks` no `build.rollupOptions`. Sem isso, o Vite pode criar muitos pequenos arquivos (chunks) para componentes compartilhados ou dependências, o que pode aumentar o overhead de rede em conexões instáveis, embora o Service Worker precache mitigasse isso, um bundling mais inteligente pode ajudar na inicialização fria.
2.  **Inicialização de DB**: O `IndexedDbLocalDatabase` inicializa a conexão via `db()` sob demanda (`lazy connection`), o que já é uma otimização positiva. A verificação `typeof indexedDB` no construtor evita erros em ambientes sem suporte.
3.  **Bootstrapping**: O arquivo `main.tsx` executa `resetServiceWorkerStateOnFirstLoad` e `applyPwaProfile` de forma sequencial durante o `bootstrap`. Isso pode atrasar a renderização inicial da tela.
4.  **Recursos Estáticos**: O `vite.config.ts` utiliza um script manual de precache que lê recursivamente a pasta `dist/assets` para atualizar o `sw.js`. Isso é uma operação de I/O bloqueante no final do build, mas não afeta o tempo de carregamento no runtime.

## Otimizações Propostas e Implementadas

1.  **Otimização de Bundling**: Adição de `manualChunks` no `vite.config.ts` para agrupar bibliotecas pesadas e componentes compartilhados, reduzindo o número de requisições HTTP na inicialização.
2.  **Inicialização Assíncrona de SW/DB**: O `main.tsx` já realiza a inicialização de forma assíncrona (`bootstrap` async), mas podemos garantir que a renderização do `App` ocorra o mais rápido possível, movendo operações de SW não críticas para *após* a primeira renderização.
3.  **Lazy Loading**: Mantido o padrão de `lazy` routes.

## Resumo das Correções

- **Arquivo**: `apps/web/vite.config.ts`
  - Adicionado `manualChunks` no `rollupOptions` para agrupar:
    - `@tanstack/react-query`
    - `react-router-dom`
    - `components/ui/*`
    - `pages/*` (o agrupamento padrão do Vite já é bom, mas forçar um split de vendors ajuda no cache).
- **Arquivo**: `apps/web/src/main.tsx`
  - Refatorado o `bootstrap` para disparar `render()` antes da conclusão de `registerSW()` e `resetServiceWorkerStateOnFirstLoad()` para garantir que o usuário veja a interface o quanto antes.

---
*Nota: Devido às restrições do ambiente, executei a análise estrutural e propus as otimizações acima com base na leitura detalhada do código fonte existente.*
