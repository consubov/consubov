# Contrato do sistema atual

## Regra central

A reorganização não é uma reescrita funcional.

O comportamento e o visual atuais são a referência inicial.

## O que deve ser preservado

Sempre que já estiver funcionando no estado anterior à refatoração:

- navegação;
- autenticação;
- telas e layouts;
- responsividade;
- operações com Supabase;
- cache;
- modo offline;
- sincronização;
- PDFs;
- QR Code;
- dashboards;
- regras de domínio;
- feedback visual de operações.

A lista não substitui testes: qualquer comportamento funcional existente também faz parte do contrato.

## Funcionalidades incompletas

Se uma tela/fluxo já existe visualmente, mas o backend ou regra ainda não funciona:

- preservar o frontend;
- não inventar regra de negócio;
- não apagar o fluxo;
- registrar a pendência;
- implementar posteriormente por PRD específico.

## Refatoração segura

Antes de mover ou dividir código:

1. identificar comportamento atual;
2. preservar interface pública do módulo sempre que possível;
3. mover em passos pequenos;
4. validar depois de cada etapa;
5. não misturar refatoração estrutural com novas features.

## Exceções

Mudanças de comportamento ou visual só podem ocorrer quando forem objetivo explícito de um PRD.
