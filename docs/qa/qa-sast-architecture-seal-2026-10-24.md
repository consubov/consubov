# CONSUBOV — Auditoria do seal de arquivos da arquitetura (24/10/2026)

## Escopo, evidência e origem
- Escopo exclusivo: `apps/api/eslint.config.js`, hashes das duas exceções **condicionadas ao conteúdo** de `security/detect-non-literal-fs-filename`; **nenhuma rotina de negócio, autenticação, storage remoto, database ou rotas HTTP foi alterada**.
- Revisão baseada no SHA `aed2e0ef20ed856efe7d8316bc1b6ffef0afeb30` da `main`.
- [Security #176](https://github.com/consubov/consubov/actions/runs/40086550938) falhava com **19 warnings**, todos nas rotinas de infraestrutura de verificação estática: `src/architecture/layer-rules.ts` (6) e `src/architecture/layer-rules.test.ts` (13), sem apontar `app.ts` ou `routes.ts`.

## Origem da falha
A configuração já contém `auditedArchitectureFile(file, expectedHash)`, que exige arquivo regular, não symlink, caminho canônico, `size <= 64 KiB`, abertura `O_RDONLY | O_NOFOLLOW`, comparação `dev/ino` e SHA-256 dos bytes antes de ativar exceção **somente naquele arquivo específico**. Os hashes armazenados não correspondiam aos arquivos atuais, portanto a regra seguia sinalizando os casos auditados (comportamento fail-closed).

| Arquivo | SHA-256 anterior no seal | SHA-256 do conteúdo vigente |
|---|---|---|
| `apps/api/src/architecture/layer-rules.ts` | `17a05c2a9f243e96765f6d1d7ff6ddfa39a3ea24583b517ab4cf476f4cbd950a` | `51c32d28a954ba816852842c5029fcab0196720d4f3a18cb3f562f91b544cfdc` |
| `apps/api/src/architecture/layer-rules.test.ts` | `4d61f38d0f3590bc990d5d68426c4042cc341ee2bd523eb73292a38bd31b799c` | `37e742b60f4adb1e7ee7e822c9a8a96bd668f517fc60416fbd5390485c254caa` |

**Cálculo:** SHA-256 sobre texto integral UTF-8 retornado pela API do GitHub, com verificação do algoritmo nos vetores padrão vazio e `abc`. É necessário validar em execução Bun real no runner porque conteúdo obtido via API e bytes do checkout podem diferir em quebras de linha.

## Revisão de segurança dos dois arquivos (não elimina todo risco)
- `collectSourceFiles(root)`: `resolve(root)`, recusa root/link simbólico e diretórios/junções ligadas, verifica `realpath` e contenção do diretório, impõe limite de 1 MiB por arquivo TypeScript, `O_NOFOLLOW` e checagem de metadados `dev/ino` antes da leitura.
- `layer-rules.test.ts`: cria dados apenas em um diretório de fixtures do repositório com `mkdtempSync`, valida cenários de symlink/junction, extensão ignorada e arquivo grande; `rmSync` remove exclusivamente o caminho temporário alocado.
- Em inspeção dos arquivos `apps/api/src/app.ts` e `routes.ts`, não foi encontrada chamada ao coletor; isso **não prova** ausência de todo uso indireto em outros módulos.
- **Não é exceção geral:** o restante da API continua sob SAST e qualquer mudança futura no conteúdo dos dois arquivos reativa os warnings até revisão explícita de novos hashes.

## Fora do escopo
- Dependências Web/Vite/DOMPurify: [PR #61](https://github.com/consubov/consubov/pull/61), separado.
- Zod 3.25.76: permanece vulnerável até migração compatível / mitigação testada.
- Fluxos de PWA/login e instalação: [PR #60](https://github.com/consubov/consubov/pull/60), separado.
- Relatto/veterinário, Supabase remoto, RLS, domínio, usuários e produção intocados.

## Critérios objetivos de QA
- [ ] `bunx eslint . --max-warnings=0` executado em `apps/api` e aprovado no SHA deste PR.
- [ ] `bun run check`, E2E e API smoke aprovados no mesmo SHA, sem inferir da base.
- [ ] Confirmar `bun audit --audit-level=high` como gate separado; este PR não pretende corrigir Zod.
- [ ] Teste negativo do mecanismo: alteração de apenas um byte em um dos arquivos selados deve reativar alerta (somente fixture/execução isolada, sem modificar as fontes definitivas).
- [ ] Handoff, Checklist, Notion e Obsidian reconciliados com evidências por SHA.

## Reversão e proibições
Reverter unicamente o commit do seal em branch; hashes históricos restaurariam os avisos de segurança em vez de desabilitar o scanner global. **Proibido** editar `main`, fazer merge/deploy, executar migrations/RLS ou tocar dados de produção sem gate e autorização expressa. GitHub Actions padrão em repositório público, sem novos serviços pagos.
