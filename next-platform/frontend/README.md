# F23 — referências técnicas do laboratório

Implementação em `next-platform/**`, sem rebranding ou alteração do legado. O requisito ativo é `F23-CORRECOES-ARQUITETURA-ALINHADA-20261105`, fornecido pelo responsável no arquivo externo. Não há novo PRD concorrente.

- `audit/`: paridade observada e limites de segurança.
- `prd/`: referência à decisão ativa, sem duplicar a especificação operacional.
- `contracts/`: fronteiras de protocolo, auth e dados.
- `tasks/`, `checklists/`, `handoff/`: execução/evidência local exigida pelo PRD, com aprovação independente separada.
- `configs/`: parâmetros de build e QA do laboratório.
- `templates/`: campos mínimos para recibos reproduzíveis.
- `inspirations/`: N/A, pois a tarefa não modifica a identidade visual.

A arquitetura durável e o runbook estão em `../docs/f23-runtime-local.md`. Evidência gerada reside em `.qa/runs/**`; o resumo técnico final é `qa/reports/f23-final-local.md`. Resultados históricos não aprovam a revisão atual. Checklist/Handoff da raiz e Notion precisam de conciliação pelo responsável, sem edição fora do escopo desta implementação.
