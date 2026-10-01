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

1. merge em `main`;
2. remover a branch temporária;
3. manter apenas branches que ainda tenham trabalho ativo.

## Reorganização atual

Branch de trabalho:

```text
refactor/monorepo
```

Ela deve ser integrada à `main` somente após:

- build válido;
- testes relevantes aprovados;
- aplicação visualmente preservada;
- fluxos funcionais preservados;
- Supabase funcionando;
- offline/sincronização preservados quando afetados;
- documentação atualizada.

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
