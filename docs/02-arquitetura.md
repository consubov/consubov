# Arquitetura

## Estratégia

O Consubov será organizado como **monorepositório** e o backend evoluirá como **monólito modular**.

### Monorepositório

Organiza aplicações e pacotes relacionados em um único repositório.

```text
consubov/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── domain/
│   ├── database/
│   ├── auth/
│   ├── contracts/
│   ├── integrations/
│   ├── observability/
│   └── ui/
├── supabase/
├── docs/
└── instructions/
```

### Monólito modular

O backend é uma única aplicação implantável, porém dividido por domínios com fronteiras explícitas.

```text
apps/api/
├── auth/
├── tenants/
├── fazendas/
├── retiros/
├── pastos/
├── pecuarista/
├── pesagens/
├── estoque/
├── nutricao/
├── fabrica/
├── visitas/
└── integrations/
```

## Fluxo desejado

```text
Web / Mobile / Sistemas externos
              │
              ▼
             API
              │
      ┌───────┼─────────┐
      ▼       ▼         ▼
   Domain    Auth   Integrations
      │
      ▼
   Database
      │
      ▼
 Supabase / PostgreSQL
```

## Escalabilidade

A arquitetura deve permitir:

- API stateless;
- múltiplas instâncias da API;
- processamento assíncrono para tarefas pesadas;
- isolamento por tenant;
- contratos de API versionados;
- filas e workers quando necessário;
- observabilidade;
- extração futura de módulos para serviços independentes sem reescrever o domínio.

## Regra de dependência

A UI não deve concentrar regra de negócio.

Fluxo preferencial:

```text
Component
  ↓
Hook / Controller
  ↓
Use case / Service
  ↓
Repository
  ↓
Database
```

Dependências devem apontar para dentro do domínio, evitando acoplamento entre módulos.
