# Fluxo de desenvolvimento

## Branches

`main` é a branch oficial e deve representar o estado pronto para produção.

Mudanças relevantes são feitas em branches temporárias:

```text
feat/...
fix/...
refactor/...
chore/...
```

Após validação:

1. abrir Pull Request para `main`;
2. aguardar o CI;
3. revisar o diff e os critérios do PRD;
4. fazer merge em `main`;
5. remover a branch temporária.

## GitHub Free em repositório privado

O projeto usa o fluxo de Pull Request + GitHub Actions como controle operacional.

No plano GitHub Free, proteções/rulesets de branch não são aplicáveis a este repositório privado. Por isso, a disciplina de não alterar `main` diretamente é uma regra de projeto e deve ser respeitada por pessoas e agentes.

O workflow de CI roda em Pull Requests para `main` e pode ser disparado manualmente. Execuções concorrentes do mesmo PR são canceladas para reduzir consumo dos minutos incluídos.

## Codespaces

O ambiente recomendado para trabalho remoto é o GitHub Codespaces usando `.devcontainer/devcontainer.json`.

Regras:

- usar maquina de 2 cores quando suficiente;
- parar o Codespace quando não estiver em uso;
- não gravar secrets no repositório;
- não conectar Supabase remoto ou Vercel sem PRD/autorizaçao especifica;
- trabalhar sempre em branch temporária.

## PRDs e handoffs

Trabalho de agentes IA deve partir de `instructions/active/`.

Antes de executar:

1. ler `AGENTS.md`;
2. ler `docs/README.md`;
3. ler `instructions/README.md`;
4. ler o PRD ativo;
5. ler o handoff correspondente.

Depois de concluir:

1. registrar validações no handoff;
2. mover conhecimento permanente para `docs/`;
3. aguardar aceite;
4. apagar PRD e handoff concluídos de `instructions/active/`.

Não arquivar PRDs concluídos dentro do repositório sem necessidade: o histórico já existe no Git.
