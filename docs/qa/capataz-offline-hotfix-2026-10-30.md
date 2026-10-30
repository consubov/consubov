# CONSUBOV Fazendas — capataz offline: hotfix candidato (30/10/2026)

**APP_ID:** `consubov-fazendas-app`. **Base comprovada:** deployment Vercel de produção `dpl_CZCHZ5oaTZeHpUF3kCL4YTU95kSM`, commit `384a5c43f6b7490e29a79dcef3b26cb40f943642`, `APP_VERSION=2.0.0`. **Status:** candidato local, não publicado.

## Mudanças de escopo

1. `offlineDb`: salgas, observações, fechamentos e pesagens exigem transação IndexedDB concluída + verificação de chave antes de declarar persistência; falhas de quota/IDB propagam erro. A contagem de salgas/observações pendentes usa índices `countFromIndex`, sem copiar imagens base64 a cada consulta.
2. `CapatazDashboard`: carrega cache local já no primeiro render apto, deixando busca remota em segundo plano. Início de salga deixa de aguardar a rede. Troca de retiro faz leitura prévia do novo retiro e ativação em transação atômica, sem apagar o retiro anterior em caso de falha. Salva somente após ACK local; caso contrário mantém formulário aberto para tentar novamente. Ignora respostas remotas obsoletas durante a troca.
3. `SalgaForm`/`ObservacaoModal`: aguardam `onSave` assíncrono antes de confirmar, bloqueiam submissões repetidas durante a gravação e deixam campos/fotos na tela após falha.
4. `fotoSalgaQueue`: pagina leitura de salgas com foto (limite de memória), copia poucas fotos por ciclo, evita decodificação quando a página está oculta e lê somente poucos blobs elegíveis por envio.
5. `backupMirror`: evita gerar string JSON gigante com fotos em base64 antes de decidir removê-las do espelho limitado de `localStorage`. Os originais permanecem em IndexedDB.
6. Pede persistência local via `navigator.storage.persist()` quando o navegador permitir; permissão não é garantida.

## Fora do escopo

- Não altera RLS, Supabase, SQL, autenticação, Service Worker, manifest, arquivos dos outros agentes, API, secrets ou versões.
- Não muda regra de negócio existente: trocar de retiro ainda requer conexão; não implementa armazenamento simultâneo de todos os retiros offline, a ser coordenado em F13.
- Não afirma resolver encerramento pelo sistema operacional (sem crash log/aparelho físico), nem substitui persistência garantida por storage do sistema.

## QA executado no candidato local

- `node --test apps/web/scripts/qa/check-capataz-offline.mjs`: casos de confirmação de escrita, falha de quota, leitura de chave, quatro tipos de gravação, contagem indexada, paginação de fotos, ativação atômica e rollback, backup pequeno/grande. Script usa `typescript` instalado no workspace.
- `tsc --noEmit --strict` isolado para `offlineDb.ts` com shim local de `idb` (não corresponde ao typecheck de todo o monorepo).
- Parser TypeScript dos componentes/hooks modificados, `git diff --check`, aplicação de patch em checkout local isolado.

## QA obrigatório antes de integrar/publicar

- `bun install --frozen-lockfile`, `bun run --cwd apps/web typecheck`, `bun run --cwd apps/web build`, `bun run --cwd apps/web test`, lint dos arquivos afetados e gates PWA no **mesmo SHA**.
- Android Chrome e iOS Safari instalados: abrir cache offline, registrar salga/observação com foto, fechar e reabrir, permissão storage negada, quota excedida, sessão expirada, trocar retiro com rede lenta/falha, salvar/repetir, reconectar, sincronizar sem duplicatas, verificar imagens no Storage.
- Isolamento de contas/tenant no mesmo aparelho, identidade da PWA, atualização/rollback sem apagar IndexedDB, fila de fotos e histórico. Reconciliar com owners F13/LQA/PWA-79.

**Rollback:** nenhuma migração de schema IndexedDB é incluída; para reverter UI, restaurar commit `384a5c43` na implantação mediante aprovação, preservando dados locais. Não limpar cache, IndexedDB, localStorage ou fila de campo.

## Revisão adicional para preview de homologação (30/10)

- **Conflito de escopo corrigido:** troca de retiro bloqueada quando existem salgas ou fechamento mensal pendente. A verificação usa `countFromIndex` / leitura estrita e, se o IndexedDB falhar, não permite a troca. Não limpa fila nem fotos.
- **Envio com fail-closed:** cada salga é confrontada com os pastos do retiro selecionado antes de chamar `sync_capataz_lancamento`. Registros antigos sem pasto correspondente continuam pendentes, nunca enviados com fazenda incorreta.
- **Retenção offline:** histórico sincronizado de outro retiro continua gravado, mas a lista da tela de salgas mostra somente os registros dos pastos do retiro atual. O resumo local carrega metadados via cursor, sem trazer todas as fotos base64 para a memória; os originais persistem no IndexedDB.
- **Bootstrap remoto limitado:** recupera até 350 lançamentos recentes para o cache local durante a inicialização e grava os ausentes em lotes de até 4. Os lançamentos históricos remotos não são apagados; dados locais antigos não são removidos. Recuperar histórico integral para visualização histórica exige paginação dedicada (F13).
- **Sincronização silenciosa:** leituras de atualização ocorrem ao entrar/reentrar no app ou recuperar a conexão, com janela mínima de 45 segundos e apenas quando visível. **Não envia automaticamente** lançamentos, fotos, observações ou fechamentos, mantendo o comando manual de campo e o comando forçado explícito do gerente. Ocorre sem bloquear o formulário.
- **QA isolado adicional:** 15/15 testes Node PASS, 6/6 arquivos TypeScript/TSX com AST válido, typecheck isolado do `offlineDb` PASS. Estes testes não provam comportamento real de dispositivos/usuários.

### Revisão de carregamento nos outros perfis

- `useAuth`: detecção da função percorre até nove consultas sequenciais. Há cache de função local, mas o bootstrap online ainda aguarda validação remota; otimização exige validação de precedência de funções, revogação de acesso e isolamento entre contas.
- `AdminDashboard`: já usa `head: true`, `count: exact`, AbortSignal/timeout e estado de erro. Não deve substituir erro do banco por contagem em cache sem indicador de obsolescência.
- `useGerenteData`: realtime pode disparar mais de uma atualização e GMD/RPC esteve sob investigação P0 pelo owner F12. **Não alterar hook, GMD, RLS, RPC, grants ou contratos de perfil nesta PR**; seguir a frente existente F12/PR76, evitando trabalho concorrente.
- Cache persistente abrangente para Admin/Gerente/Consultor exige chave de usuário/tenant/fazenda + expiração + invalidação após logout/troca de papel, testes cross-tenant e política de retenção. **Não está implementado neste hotfix.**

### Gates e teste do usuário no preview

1. Abrir o link de preview na mesma versão 2.0.0; entrar com usuário capataz e confirmar pastos/ciclos atualizados.
2. Com dados já baixados, desativar a internet; registrar uma salga (com foto), fechar o app e reabrir. Registro deve permanecer pendente com foto, sem toast falso de sucesso.
3. Com pendência, tentar trocar de retiro: sistema deve bloquear, sem eliminar fotos ou histórico. Após sincronização manual e rede, deve permitir troca e carregar o novo retiro.
4. Simular armazenamento cheio/IDB indisponível: erro claro e formulário/foto preservados para nova tentativa.
5. Conectar novamente: dados de consulta são atualizados silenciosamente. Registros do campo só são enviados quando o usuário toca em Sincronizar ou quando gerente dispara comando autorizado.
6. Verificar isolamento de conta e tenant e integração de PWA/Service Worker em Android Chrome e iOS Safari; não limpar cache/IndexedDB durante teste.

**Release:** somente PREVIEW isolado autorizado pelo usuário para testes. Produção continua apontando para o deploy anterior. Merge, SQL remoto, migração e troca de alias não fazem parte desta entrega.
