# Arquivo histórico — não executar kits desta pasta

A reorganização de 2026-10-09 separou estado atual, critérios detalhados e registros históricos sem reescrever commits.

- `CONSUBOV_CHECKLIST_MESTRE_antes_auditoria_2026-10-09.md`: cópia integral, sem alterações, do checklist no commit `8d23d8b513580720f57cb53c646c801c850f02eb`; blob `1250edb3d0a9f7d3de342a5705275d6c0dc94025`. Os requisitos detalhados das fases continuam vinculantes. Seus rótulos históricos de progresso NÃO prevalecem sobre o painel atual.
- `ROADMAP_IMPORTADO_2026-10-09.md`: cópia integral do roadmap antigo da raiz; blob `ea585eea7ee9c049f24db880a37a7c0923c2ebc7`. O PRD ativo continua em `instructions/active/`.
- `CONSUBOV_GO_TASK_QA_LOCAL.zip`: kit histórico, preservado pelo blob original `d01b29fc753beabd437e646f81a9094f1163cf9b`. NÃO reinstalar sobre o código atual.

A pasta temporária `.work-go-task/`, o log `output.txt` e `test-results/.last-run.json` foram retirados da árvore ativa. Permanecem no histórico do commit de origem acima; a árvore original de `.work-go-task/` é `38c7f5d248443421a59d1c17f0029f42a266fa92`. Nenhum código da aplicação, banco de dados ou histórico de branch foi apagado por essa limpeza.

Usar somente `Taskfile.yml` e `.vscode/tasks.json` da raiz para execução. Ler `CONSUBOV_HANDOFF_CONTINUIDADE.md` e `CONSUBOV_CHECKLIST_MESTRE.md` para o estado operacional atual.
