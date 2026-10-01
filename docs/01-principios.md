# Princípios de evolução

## Objetivo

Evoluir o Consubov sem perder o que já existe e funciona.

## Regras obrigatórias

1. Preservar o visual atual durante a reorganização.
2. Preservar fluxos e comportamentos que já funcionam.
3. Uma regressão em funcionalidade existente é defeito, mesmo que a nova arquitetura esteja "mais limpa".
4. Funcionalidades existentes que ainda não funcionam podem permanecer somente com o frontend até receberem um PRD próprio.
5. Não reconstruir telas ou regras apenas por preferência técnica.
6. Refatorar de forma incremental e reversível.
7. Separar UI, regra de negócio, acesso a dados e integrações.
8. Favorecer código pequeno, legível, testável e com responsabilidade única.
9. Comentar decisões, limitações e regras de domínio; evitar comentários que apenas repetem o código.
10. Toda mudança estrutural deve deixar o projeto mais fácil de entender para um desenvolvedor novo.

## Prioridade

```text
Preservar comportamento
        ↓
Organizar arquitetura
        ↓
Reduzir acoplamento
        ↓
Criar API e contratos
        ↓
Adicionar novas funcionalidades
```

## Não objetivo da primeira fase

- redesenhar a aplicação;
- trocar fluxos funcionais;
- reescrever regras de negócio sem necessidade;
- criar microserviços prematuramente;
- implementar funcionalidades novas enquanto a fundação ainda estiver sendo reorganizada.
