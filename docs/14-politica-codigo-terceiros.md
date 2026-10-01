# CONSUBOV — Política de Código Open Source e Terceiros

> **Fase:** 0.4 — Governança  
> **Versão:** 1.0  
> **Data:** 2026-10-01  
> **Status:** VIGENTE após inclusão no repositório  
> **Objetivo:** permitir reutilização segura e rastreável de bibliotecas, componentes e código de terceiros sem comprometer segurança, licenciamento, manutenção, tenancy, offline ou continuidade tecnológica.

---

# 1. Princípio geral

O CONSUBOV pode reutilizar bibliotecas, componentes e código open source quando isso reduzir retrabalho e não introduzir risco desproporcional.

A regra é:

- reutilizar com origem conhecida;
- validar licença;
- validar manutenção;
- validar segurança;
- adaptar às regras do CONSUBOV;
- testar internamente;
- manter rastreabilidade;
- evitar lock-in e forks desnecessários.

> **Não copiar código de terceiros sem origem rastreável.**

---

# 2. Formas de uso permitidas

Código de terceiros pode entrar no projeto de três formas:

## 2.1 Dependência de pacote

Exemplo:

```text
npm/bun package
```

Preferir esta forma quando:

- o projeto é mantido;
- a API pública é estável;
- a licença é compatível;
- copiar código criaria manutenção desnecessária.

## 2.2 Código adaptado/copied source

Permitido quando houver motivo concreto, por exemplo:

- pequena implementação necessária;
- projeto original não oferece pacote utilizável;
- dependência inteira seria excessiva;
- é necessário adaptar profundamente.

Nesse caso, registrar obrigatoriamente:

- origem;
- URL/repositório;
- versão/tag/commit;
- arquivos ou trechos adaptados;
- licença;
- atribuição exigida;
- motivo da cópia.

## 2.3 Fork

Criar fork somente quando:

- upstream não atende requisito essencial;
- patch não pode ser enviado/aceito upstream em tempo útil;
- dependência é estratégica;
- existe capacidade real de manter o fork.

Todo fork deve ter owner e estratégia de atualização/reconciliação com upstream.

---

# 3. Licenças

## 3.1 Baixo atrito

Licenças normalmente mais simples para avaliação inicial:

- MIT;
- BSD-2-Clause;
- BSD-3-Clause;
- ISC;
- Apache-2.0.

Mesmo nesses casos:

- preservar avisos obrigatórios;
- registrar a licença;
- verificar dependências transitivas relevantes.

## 3.2 Revisão obrigatória

Exigem revisão específica antes do uso:

- MPL;
- LGPL;
- GPL;
- AGPL;
- SSPL;
- Business Source License;
- Commons Clause;
- licenças não padronizadas;
- código sem arquivo/licença explícita;
- projetos com termos comerciais adicionais.

Nenhum desses deve ser adotado automaticamente.

## 3.3 Sem licença identificável

Se não houver licença explícita:

> **Não copiar nem incorporar o código.**

Abrir `[PENDENTE]` para validação.

---

# 4. Registro obrigatório de terceiros

Manter inventário em:

```text
docs/THIRD_PARTY_COMPONENTS.md
```

Para cada componente relevante registrar:

```text
Nome:
Tipo: dependência | código adaptado | fork | asset
Origem:
Repositório/URL:
Versão/Tag/Commit:
Licença:
Uso no CONSUBOV:
Owner:
Dependência direta ou transitiva:
Dados acessados:
Risco de segurança:
Estratégia de atualização:
Estratégia de substituição:
Atribuição obrigatória:
Observações:
```

---

# 5. Segurança

Antes de adicionar dependência ou código externo, verificar:

- reputação do projeto;
- atividade/manutenção recente;
- vulnerabilidades conhecidas;
- dependências transitivas;
- scripts de instalação;
- acesso a filesystem/rede;
- permissões;
- uso de secrets;
- telemetria;
- chamadas externas;
- possibilidade de typosquatting/pacote falso.

Nunca copiar de outro projeto:

- `.env`;
- tokens;
- chaves;
- secrets;
- endpoints privados;
- credenciais;
- IDs de produção;
- certificados;
- configurações internas sensíveis.

---

# 6. Compatibilidade com a arquitetura CONSUBOV

Código reutilizado deve respeitar:

- Bun + TypeScript;
- React/Vite quando aplicável;
- monólito modular;
- API-first;
- ports/adapters;
- tenancy;
- RBAC;
- auditoria;
- offline quando aplicável;
- idempotência;
- conflito por domínio;
- OpenAPI/Swagger;
- ausência de acoplamento indevido ao Supabase/provider.

Código externo nunca pode bypassar:

- autorização;
- tenant isolation;
- validação server-side;
- auditabilidade.

---

# 7. Regras para código de sync/offline reutilizado

É permitido reaproveitar:

- SQLite helpers;
- filas locais;
- retry/backoff;
- conectividade;
- serialização;
- abstrações de storage;
- utilitários de QR/GPS.

Não copiar genericamente um Sync Engine completo e tratá-lo como regra do produto.

O CONSUBOV precisa controlar:

- command_id;
- tenant_id;
- device_id;
- idempotency_key;
- base_version;
- cursor/checkpoint;
- conflito por agregado;
- regras de estoque;
- transferências;
- pesagens;
- anexos;
- auditoria.

Essas regras pertencem ao CONSUBOV.

---

# 8. Testes obrigatórios

Código adaptado ou forkado deve possuir testes próprios no repositório.

No mínimo, quando aplicável:

- comportamento esperado;
- erro;
- edge cases;
- tenant isolation;
- autorização;
- retry;
- idempotência;
- offline;
- compatibilidade com upgrade.

Não considerar "testado pelo projeto original" como substituto dos testes do CONSUBOV.

---

# 9. Dependências de produção

Antes de adicionar uma dependência de produção, registrar:

- problema concreto;
- por que solução existente não basta;
- tamanho/impacto;
- licença;
- manutenção;
- segurança;
- compatibilidade com Bun;
- compatibilidade com browser/App quando aplicável;
- impacto offline;
- estratégia de atualização;
- estratégia de substituição.

Evitar dependência para algo trivial que possa ser implementado com poucas linhas claras e testáveis.

---

# 10. Dependências transitivas

Dependência direta aprovada não significa aprovação irrestrita de toda cadeia.

Para componentes críticos, revisar:

- dependências transitivas relevantes;
- pacotes abandonados;
- pacotes com permissões incomuns;
- install scripts;
- vulnerabilidades críticas/altas.

Lockfile deve permanecer versionado.

---

# 11. Atualização e manutenção

Toda dependência relevante deve ter estratégia de atualização.

Quando atualizar:

- ler changelog;
- identificar breaking changes;
- revisar licença se mudou;
- rodar testes;
- revisar bundle/runtime;
- revisar segurança.

Não atualizar dependência crítica automaticamente sem validação proporcional ao risco.

---

# 12. Remoção e substituição

Componentes externos devem ser substituíveis sempre que possível.

Para dependências estratégicas, documentar:

- onde são usadas;
- adapter/port correspondente;
- impacto de remoção;
- alternativa provável.

Evitar espalhar SDK de provider por múltiplos módulos.

---

# 13. Código gerado por IA

Código sugerido/gerado por IA deve ser tratado como código não confiável até revisão.

Obrigatório:

- revisar lógica;
- revisar segurança;
- revisar dependências sugeridas;
- verificar se trechos copiados de fonte externa têm origem/licença identificável quando houver indício;
- adicionar testes;
- adaptar às regras do projeto.

Não inserir automaticamente snippet externo de procedência incerta.

---

# 14. Assets, ícones, imagens e fontes

Também são terceiros e precisam de licença apropriada.

Registrar quando aplicável:

- origem;
- licença;
- atribuição;
- restrição de uso comercial;
- permissão para modificação/distribuição.

Não versionar fonte, imagem ou asset de origem incerta.

---

# 15. Checklist antes de adicionar terceiro

```text
[ ] Problema concreto identificado
[ ] Origem conhecida
[ ] Projeto/repositório correto
[ ] Versão/tag/commit registrada
[ ] Licença identificada
[ ] Licença revisada
[ ] Manutenção verificada
[ ] Segurança revisada
[ ] Dependências transitivas relevantes revisadas
[ ] Sem secrets/configs externos copiados
[ ] Compatível com arquitetura CONSUBOV
[ ] Tenant/RBAC preservados
[ ] Offline avaliado quando aplicável
[ ] Testes próprios adicionados
[ ] Inventário de terceiros atualizado
[ ] Atribuições preservadas
[ ] Estratégia de atualização definida
[ ] Estratégia de substituição definida quando relevante
[ ] Documentação atualizada
```

---

# 16. Critério de conclusão da Fase 0.4

A Fase 0.4 estará concluída quando:

- [ ] esta política estiver no repositório;
- [ ] licença for obrigatória antes de copiar código;
- [ ] origem/tag/commit forem obrigatórios para código adaptado;
- [ ] atribuição obrigatória estiver definida;
- [ ] GPL/AGPL e similares exigirem revisão especial;
- [ ] código sem licença identificável for bloqueado;
- [ ] testes próprios forem obrigatórios;
- [ ] secrets/configs externos forem proibidos;
- [ ] inventário de terceiros existir;
- [ ] estratégia de atualização/substituição estiver definida.

---

# 17. Local recomendado

Adicionar:

```text
docs/14-politica-codigo-terceiros.md
```

Criar também:

```text
docs/THIRD_PARTY_COMPONENTS.md
```

Depois atualizar:

```text
docs/README.md
README.md
```

quando necessário para listar a política.
