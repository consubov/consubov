# Análise de Ciclo de Vida PWA e Service Worker (Apps/Web)

## Resumo
A implementação atual de PWA no Consubov (baseada em `apps/web/public/sw.js` e `apps/web/src/lib/swRegistration.ts`) utiliza uma estratégia robusta de **"Atualização Consentida pelo Usuário"** para evitar interrupção de operações críticas (ex: lançamento de dados pelo capataz). O comportamento é estruturado para desktop (standalone) e mobile, priorizando a estabilidade do shell offline.

## Achados e Severidade

| Componente | Achado | Severidade | Impacto |
| :--- | :--- | :--- | :--- |
| **Ciclo de Atualização** | Atualização explícita via `SKIP_WAITING` com barreira de operações críticas. | Baixa (Positivo) | Garante que o app não atualize enquanto dados não sincronizados estiverem pendentes. |
| **Cache Shell** | Cache explícito e versionado (`consubov-shell-...`) que previne o uso de assets de build incompatíveis. | Baixa (Positivo) | Evita a "quebra" da UI ao atualizar enquanto o usuário usa a versão antiga. |
| **Bloqueio de Cache** | Falta de estratégia de expiração granular para ativos não hasheados fora da shell. | Média | Pode levar a comportamentos inconsistentes se novos ativos forem adicionados sem hash. |
| **Conexão** | `networkFirstWithFallback` com timeout de 2.5s. | Média | Em redes intermitentes, o usuário pode perceber um atraso antes do fallback para o cache. |
| **Desktop Standalone** | Redirecionamento forçado para `/baixar` em navegadores. | Baixa (Positivo) | Garante que a experiência do usuário seja contida no modo standalone. |

## Observações Críticas
1.  **Proteção de Dados:** A estratégia de `SKIP_WAITING` só é disparada após o esvaziamento das filas de operações críticas (`hasCriticalOperations`), o que protege a integridade dos dados locais (IndexedDB).
2.  **Consistência em Desktop:** Em modo `standalone` no Windows/Mac, o Service Worker mantém a integridade do estado da UI, evitando recargas desnecessárias em `controllerchange` que poderiam limpar o cache de tela em memória (`screenCache`).
3.  **Atualização Pendente:** Notificações de atualização funcionam como disparadores de ação para o usuário, respeitando a premissa de não interromper o fluxo de trabalho do capataz/consultor sem consentimento.

## Recomendações
- **Monitoramento:** Adicionar telemetria de erro de cache no `sw.js` (atualmente o `catch` ignora falhas).
- **Consistência:** Verificar se todos os ativos estáticos possuem hash de produção; ativos sem hash estão sujeitos a cache agressivo do navegador.
