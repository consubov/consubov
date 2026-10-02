# Contratos de autenticação, autorização e tenancy

## Objetivo

Definir fronteiras de segurança antes de conectar qualquer provedor de identidade ou persistência.

## Localização

```text
apps/api/src/modules/identity-tenancy/
├── index.ts                    # API pública do módulo
├── domain/
│   ├── authorization.ts
│   ├── errors.ts
│   ├── identity.ts
│   ├── index.ts
│   ├── ports.ts
│   └── identity-tenancy.test.ts
└── adapters/                   # dublês de teste, sem provider real
```

`identity-tenancy` é o primeiro módulo físico do monólito modular da API (FASE 2.1 do PRD-ARC-02) e é quem possui `TenantId`, `PrincipalId` e `PermissionScope`. Os demais módulos consomem esses tipos pela API pública do módulo, nunca por arquivo interno.

O caminho anterior `apps/api/src/security/` não existe mais. A pasta `src/security/` foi movida para dentro do módulo sem alteração de semântica: os mesmos tipos, a mesma ordem de verificação tenant antes de escopo, os mesmos códigos de falha e os mesmos testes.

Como esses contratos ainda são usados somente pela API, eles permanecem em `apps/api`. Um pacote compartilhado só deve ser criado quando houver consumidor real fora da API.

Relacionado: a fazenda não é o tenant. `farms` não carrega `TenantId` porque `fazendas` não tem coluna de tenant e o mapeamento entre tenant e fazenda não tem prova no legado — ver `docs/02-arquitetura.md`.

## Contexto autenticado

O contrato exige:

- `requestId`;
- `tenantId`;
- principal com tipo `user` ou `integration`;
- lista de escopos.

A criação do contexto não autentica ninguém. Ela recebe uma identidade que já deverá ter sido verificada por um adapter futuro.

## Escopos

Escopos usam formato namespaced:

```text
recurso:acao
```

Exemplos documentados anteriormente continuam válidos, como `fazendas:read` e `pesagens:write`, mas esta fase não fixa um catálogo completo.

## Isolamento por tenant

A autorização sempre verifica tenant antes de escopos.

Consequência: possuir um escopo amplo não autoriza acesso a recurso de outro tenant.

Falhas possíveis nesta fase:

- `TENANT_MISMATCH`;
- `MISSING_SCOPE`.

As mensagens não incluem o identificador do tenant alvo.

## Portas

`IdentityVerifierPort` é uma fronteira para adapters futuros.

Ele admite credenciais de usuário do tipo bearer e credenciais próprias de integração do tipo API key, sem definir implementação. Isso permite cumprir a regra de não reutilizar senha de usuário para sistemas externos.

Nenhum adapter de Supabase, JWT, banco ou API key real faz parte desta fase.

## Validação

O Pull Request #12 passou no CI com:

- lint/typecheck da API;
- build do monorepo;
- smoke HTTP da API foundation;
- 13/13 testes da API, incluindo 7 testes de segurança;
- 36/36 testes existentes do web.

Nenhum arquivo funcional de `apps/web` foi alterado.
