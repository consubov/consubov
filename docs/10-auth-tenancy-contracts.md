# Contratos de autenticação, autorização e tenancy

## Objetivo

Definir fronteiras de segurança antes de conectar qualquer provedor de identidade ou persistência.

## Localização

```text
apps/api/src/security/
├── authorization.ts
├── errors.ts
├── identity.ts
├── ports.ts
└── security.test.ts
```

Como esses contratos ainda são usados somente pela API, eles permanecem em `apps/api`. Um pacote compartilhado só deve ser criado quando houver consumidor real fora da API.

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
