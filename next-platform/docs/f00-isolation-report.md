# Relatório Formal de Isolamento Estrito da Infraestrutura — FASE 00

```yaml
receipt_id: QA-F23-NEXT-00-16b93499-ISOLATION
task_id: F23-ISOLATED-NEXT
milestone: FASE 00 (Preflight, Git, Ownership, Inventário & Isolamento)
owner_executor: worker_f00_1
parent_orchestrator: orchestrator_1 (b2eadbf9-3ffa-4dba-8e72-e572550df398)
environment: local_isolated_read_only
worktree_path: d:\MATEUS\Documentos\GitHub\consubov-worktrees\f23-isolated-next-platform
branch: feat/platform/f23-isolated-next-platform
base_sha: 16b934996f11335b230dc9bca9631a8892c70204
executed_at: 2026-11-04T20:53:00Z
suite: Q0_ISOLATION_AUDIT
allowlist_target: "next-platform/**"
diff_outside_allowlist: 0
network_egress: 0
production_gate: RELEASE_PROIBIDO_NO_GO
verdict: PASS_ISOLATION_CONFIRMED
```

---

## 1. Topologia Física da Worktree Externa

Para eliminar qualquer possibilidade de vazamento de arquivos untracked para o repositório principal e evitar poluição do `.gitignore` versionado na raiz:
- A worktree foi criada em diretório externo dedicado:  
  `d:\MATEUS\Documentos\GitHub\consubov-worktrees\f23-isolated-next-platform`
- Comando utilizado:  
  `git worktree add -b feat/platform/f23-isolated-next-platform d:\MATEUS\Documentos\GitHub\consubov-worktrees\f23-isolated-next-platform 16b934996f11335b230dc9bca9631a8892c70204`
- Listagem confirmada via `git worktree list`:
  ```text
  D:/MATEUS/Documentos/GitHub/consubov                             16b93499 [main]
  D:/MATEUS/Documentos/GitHub/consubov-worktrees/f23-isolated-next-platform  16b93499 [feat/platform/f23-isolated-next-platform]
  ```

---

## 2. Comprovação de Não-Contaminação da Raiz

Auditoria cruzada imediata executada no repositório raiz:
```powershell
Set-Location "d:\MATEUS\Documentos\GitHub\consubov"
git status --short --branch
# Retorno observado: ## main...origin/main
git diff --name-status
# Retorno observado: vazio (0 arquivos)
```
- **Taxa de mutação de código na raiz:** 0 arquivos, 0 bytes.
- **Taxa de mutação de commits na main:** 0 commits.
- **Contagem de stashes na raiz:** 11 preservados.

---

## 3. Confinamento Estrito em `next-platform/**`

- Todo e qualquer arquivo da nova plataforma reside exclusivamente sob a pasta `next-platform/` na worktree.
- Nenhum arquivo foi adicionado ou modificado na raiz da worktree fora de `next-platform/`.
- A allowlist do Gate Q0 é mantida com política de falha fechada (*Fail-Closed*): qualquer alteração detectada fora de `next-platform/**` invalida imediatamente os testes e interrompe o trabalho.

---

## 4. Barreira Anti-Egress & Política de Dados Locais Sintéticos

1. **Anti-Egress de Rede:**
   - Proibição absoluta de chamadas HTTP externas a `*.supabase.co`, `*.vercel.app`, `*.consubov.com.br`, `*.cloudflare.com`.
   - Toda comunicação de rede nos testes de laboratório é roteada exclusivamente para o Mock Server local Bun (`http://127.0.0.1:port/api/v1`).
2. **Dados e Usuários Sintéticos (LGPD):**
   - Proibido o uso de CPFs reais, nomes de fazendas reais, telefones ou credenciais de produção.
   - Utilização exclusiva de fixtures sintéticas definidas em `packages/testing/`.
3. **Ausência de Segredos de Produção:**
   - Nenhum arquivo `.env` de produção é copiado ou consumido na nova plataforma.

---

## 5. Matriz de Conformidade com Critérios ISO-001 a ISO-010

| Critério | Descrição | Status F00 | Evidência Objetiva |
| :--- | :--- | :--- | :--- |
| **ISO-001** | Hashes de arquivos legados, configs raiz e releases permanecem intocados; zero endpoints remotos chamados | **PASS** | `git diff --stat 16b93499` confirma zero arquivos alterados fora de `next-platform/**`. |
| **ISO-002** | Roteamento shell por papel | Mapeado M00 | Estrutura de pastas `apps/fazenda/shell` criada. |
| **ISO-003** | Tela segura 403 para vínculo inválido | Mapeado M00 | Estrutura de `packages/auth-client` criada. |
| **ISO-004** | Seleção consciente de múltiplos papéis | Mapeado M00 | Estrutura de `packages/auth-client` criada. |
| **ISO-005** | Build independente por módulo | Mapeado M00 | Pastas segregadas por módulo em `apps/fazenda/*`. |
| **ISO-006** | Rollback atômico em 404 | Mapeado M00 | Estrutura de `packages/module-release` criada. |
| **ISO-007** | Persistência durável de fotos e outbox offline | Mapeado M00 | Estrutura de `apps/fazenda/capataz` criada. |
| **ISO-008** | Segregação absoluta entre ADM e Fazendas | **PASS** | `apps/admin-global` isolado fisicamente de `apps/fazenda`. |
| **ISO-009** | Contratos compartilhados versionados | Mapeado M00 | Estrutura de `packages/contracts` criada. |
| **ISO-010** | Verificação final do laboratório sem merge na main | **PASS** | Branch `feat/platform/f23-isolated-next-platform` isolada; zero merge/push. |

---

## 6. Conclusão de Isolamento

**Status Oficial:** **PRODUÇÃO PERMANECE NO-GO / AMBIENTE 100% ISOLADO LOCALMENTE.**  
O ambiente da worktree cumpre todas as exigências de isolamento físico, anti-egress e confinamento de diretório.
