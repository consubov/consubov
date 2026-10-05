# FASE 3.5–3.6 — Persistência local de teste e configuração

## Estado

A FASE 3 prepara contratos e dublês locais **sem conectar a nova API ao Supabase/PostgreSQL remoto** e sem criar infraestrutura de deploy.

## 3.5 — Ports e adapters locais

### Evidência já existente

A API já possui ports/repositories por domínio e dublês em memória suficientes para provar o padrão sem criar uma camada genérica nova. Exemplos atuais:

- `apps/api/src/modules/farms/domain/ports.ts` + `apps/api/src/modules/farms/infrastructure/FakeFarmRepository.ts`;
- `apps/api/src/modules/identity-tenancy/domain/ports.ts` + `apps/api/src/modules/identity-tenancy/adapters/fakes.ts`;
- ports específicos nos módulos `files`, `reporting`, `weighing`, `feed-mill` e demais módulos materializados na FASE 2;
- `apps/api/src/shared/ports/ClockPort.ts`, `IdGeneratorPort.ts`, `FeatureFlagPort.ts`, `EventPublisherPort.ts`, `JobQueuePort.ts` como contratos de apoio já existentes.

### Decisão desta fase

Não criar fake/repository apenas para “preencher arquitetura”. Um adapter de memória novo só deve nascer quando existir um caso de uso/teste real que consuma o port.

Consequências:

- nenhum adapter remoto foi criado;
- nenhuma migration/schema remoto foi executado;
- nenhum SDK Supabase foi adicionado à nova API;
- nenhum banco local adicional foi introduzido porque os testes atuais conseguem operar com dublês em memória;
- a futura persistência PostgreSQL deve continuar atrás dos ports/repositories existentes.

### Isolamento tenant

Nem todo domínio é comprovadamente tenant-scoped no modelo atual. Exemplo: a documentação de arquitetura registra explicitamente que `Farm` não é sinônimo de tenant. Portanto, testes de isolamento tenant só são obrigatórios para ports que materializam `TenantExecutionContext`; não se deve inventar `tenantId` em entidades que ainda não têm essa evidência.

## 3.6 — Configuração e feature flags

### Ambiente

Configuração técnica continua simples e explícita:

- API: `PORT`, com validação no bootstrap;
- Web legado: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_VAPID_PUBLIC_KEY` quando aplicável;
- Web -> API local: `VITE_API_BASE_URL`, com default reversível `http://127.0.0.1:3000` para desenvolvimento local.

Nenhuma variável cliente pode conter segredo administrativo.

### Tenant e módulos futuros

`FeatureFlagPort` já existe como contrato de extensão. Nesta fase ele **não** ganha provider remoto, painel administrativo ou regra de negócio inventada porque não existe consumidor runtime comprovado que justifique isso.

Quando houver consumidor real, a resolução deverá ser adicionada de forma explícita e testável, sem forks de código por cliente. Ausência de configuração não pode habilitar comportamento privilegiado por acidente.

## Anti-overengineering

São rejeitados nesta fase:

- adapters fake sem consumidor/teste real;
- nomes de método que não implementem exatamente o port declarado;
- “feature flag platform” externa;
- configuração remota;
- banco local novo apenas para testes que já funcionam com memória;
- qualquer conexão da nova API ao Supabase remoto;
- Vercel/deploy/migration/rotação de secrets.

## Gate de aceite

- [ ] `bun run check` verde no branch/PR da FASE 3;
- [ ] testes do HTTP client/guardrail verdes;
- [ ] CI/Security Scan verdes;
- [ ] nenhum artefato temporário/cache/test output versionado;
- [ ] nenhuma dependência remota nova;
- [ ] documentação e Checklist Mestre reconciliados com o estado realmente mergeado.

Data da revisão: 2026-10-04.
