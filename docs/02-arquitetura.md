# Arquitetura

## Estrutura atual

O Consubov está organizado como monorepositório com dois workspaces executáveis e sem packages compartilhados.

```text
consubov/
├── apps/
│   ├── web/        # aplicação React/Vite existente
│   └── api/        # API Bun local, stateless e sem persistência
├── supabase/       # artefatos existentes; sem execução remota nesta fase
├── docs/
├── instructions/
├── package.json
├── bun.lock
└── turbo.json
```

Não existe `packages/` atualmente. Configurações específicas permanecem com o app que as utiliza, e um package só deve nascer quando houver reutilização real por mais de um workspace.

A migração progressiva de acesso a dados do web está pausada. O web continua com o comportamento e as integrações existentes; a API não está conectada ao Supabase/PostgreSQL.

## Arquitetura futura

A direção aprovada é evoluir o backend como **monólito modular**. A árvore abaixo representa possibilidades futuras, não diretórios que devam ser criados antecipadamente.

```text
consubov/
├── apps/
│   ├── web/
│   └── api/
├── packages/              # somente packages com múltiplos consumidores reais
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

### Organização futura do monólito modular

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

## Fluxo futuro desejado

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
