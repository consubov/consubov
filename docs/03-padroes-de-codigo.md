# Padrões de código

## Objetivo

Qualquer desenvolvedor deve conseguir localizar uma funcionalidade, entender sua responsabilidade e alterá-la sem precisar compreender o sistema inteiro.

## Arquivos

- um arquivo deve ter uma responsabilidade principal;
- componentes grandes devem ser quebrados por responsabilidade, não apenas por tamanho;
- funções devem executar uma tarefa clara;
- evitar arquivos "god object", dashboards gigantes e componentes com regra de negócio misturada à renderização;
- arquivos excepcionalmente grandes devem ter justificativa clara.

### Referência prática

Não é uma regra rígida, mas é um sinal de revisão:

- componente acima de ~250 linhas;
- função acima de ~50 linhas;
- múltiplas regras de domínio no mesmo componente;
- consultas de banco repetidas em várias telas.

## Nomenclatura

Preferir nomes que expressem intenção.

```ts
// evitar
fn()
data2
obj

// preferir
calculateExpectedConsumption()
pendingWeighings
currentFarm
```

## Comentários

Comentar **por quê**, não o que a linha faz.

```ts
// Ruim: incrementa contador
counter++;

// Bom: mantém pendências visíveis até a confirmação do servidor
// para não indicar perda do lançamento durante operação offline.
```

## Estrutura por funcionalidade

```text
feature/
├── components/
├── hooks/
├── services/
├── repositories/
├── schemas/
├── types/
└── tests/
```

Nem toda feature precisa de todas as pastas. Criar apenas quando houver responsabilidade real.

## Regras de domínio

- não duplicar regras importantes em telas diferentes;
- cálculos de negócio devem ser reutilizáveis e testáveis;
- acesso ao Supabase/PostgreSQL deve ser encapsulado progressivamente;
- validação de entrada deve ocorrer em fronteiras da aplicação;
- efeitos colaterais devem ser explícitos;
- erros devem ter contexto útil para diagnóstico.

## Testes

Toda refatoração estrutural deve priorizar:

1. testes existentes continuando verdes;
2. testes de regressão para comportamentos críticos;
3. testes de autorização/tenant para acesso a dados;
4. testes de sincronização/offline quando o fluxo for afetado.
