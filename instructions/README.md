# Instruções para agentes

Esta pasta contém trabalho temporário e executável para agentes IA.

## Estrutura

```text
instructions/
├── README.md
├── active/
│   ├── PRD-xxx-*.md
│   └── HANDOFF-xxx-*.md
└── templates/
    ├── PRD-template.md
    └── HANDOFF-template.md
```

## Regras

1. Um PRD define **o que** deve ser feito e os critérios de aceite.
2. Um handoff define **como continuar**, estado atual, decisões, riscos e validações.
3. O agente deve ler a documentação permanente antes de alterar código.
4. Não ampliar escopo sem atualizar o PRD.
5. Não alterar visual ou comportamento fora do escopo.
6. Não remover funcionalidade existente para simplificar a implementação.
7. Não inventar regra de negócio ausente.
8. Ao concluir, atualizar documentação permanente relevante.
9. Após aceite, apagar PRD e handoff concluídos de `active/`.
10. O histórico do Git é suficiente para consultar trabalhos concluídos.

## Ordem obrigatória de leitura

1. `AGENTS.md`
2. `docs/README.md`
3. PRD ativo
4. handoff correspondente
5. arquivos do módulo afetado
