# Runbook de Release de Produção - Consubov (v1.155)

Este documento descreve os passos operacionais para realizar o deploy em produção do sistema Consubov (Site Institucional e App), garantindo a integridade dos segredos e a segurança do ambiente.

## 1. Pré-requisitos de Segurança
- **Proibição de Credenciais Administrativas:** É terminantemente proibido incluir `SUPABASE_SERVICE_ROLE_KEY` ou qualquer chave privada em arquivos de configuração públicos, variáveis de ambiente do Frontend ou no código-fonte dos Apps.
- **Auditoria de Secrets:** Antes de qualquer release, verifique se não houve regressão na persistência de credenciais administrativas no banco de dados (especialmente na tabela `app_secrets`).

## 2. Matriz de Variáveis de Ambiente (Produção)

| Variável | Contexto | Descrição |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Web/App | URL pública do projeto Supabase de produção. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Web/App | Chave pública (`anon`) do projeto Supabase. |
| `VITE_VAPID_PUBLIC_KEY` | Web/App | Chave pública para notificações Push. |
| `VITE_API_BASE_URL` | Web/App | URL de produção da API (deve ser validada antes da publicação). |

## 3. Passo a Passo do Release

### A. Preparação da Branch
1. Certifique-se de que a branch `main` esteja com a árvore limpa.
2. Sincronize com o repositório remoto: `git fetch origin && git pull --ff-only`.

### B. Validação Local
1. Execute o QA local: `task doctor` seguido dos gates da fase atual.
2. Certifique-se de que `bun run check:dist-secrets` passe sem erros no diretório de build.
3. Verifique os logs de build em busca de avisos de segurança.

### C. Deploy (Vercel)
1. **Projeto Consubov App (`app.*`):** Aponte para o ambiente de produção na Vercel. Configure apenas as variáveis mencionadas na Matriz (Seção 2). Não adicione `SUPABASE_SERVICE_ROLE_KEY` nas variáveis de ambiente da Vercel.
2. **Projeto Site Institucional:** Aponte para o ambiente de produção na Vercel (dist-site).

### D. Pós-Deploy
1. Verifique o status da API em produção: `curl https://api.consubov.com.br/api/v1/health` (ajuste a URL conforme o domínio real).
2. Teste o acesso ao App em modo `standalone` (instalado na tela inicial do dispositivo).

## 4. Gestão de Riscos
- Em caso de vazamento acidental de chave administrativa, acione imediatamente a rotação no Painel do Supabase e invalide a sessão de todos os tokens JWT.
- Qualquer dúvida sobre a configuração, consulte `CONSUBOV_CHECKLIST_MESTRE.md` antes de prosseguir.
