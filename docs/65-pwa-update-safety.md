# PWA — Atualização sem interrupção nem perda offline

**Auditoria:** 2026-10-09. **Status:** código reforçado + Node regressões; Chromium/WebKit, versão legada real e piloto pendentes.

## Regra crítica de atualização

O botão `Atualizar app` **não pode** apagar CacheStorage nem desregistrar o SW quando o usuário depende de navegação offline. A implementação foi corrigida em `apps/web/src/lib/swRegistration.ts`: `forceRefresh` tenta localizar atualização por SW; se houver worker waiting, usa `applyPendingUpdateNow` e espera que a nova versão assuma o controle. Sem worker novo, recarrega normalmente o shell instalado, sem purge. Se existe operação crítica ativa, aguarda seu término.

O banner `UpdateBanner` também usa o fluxo `applyUpdate` mesmo que a divergência seja apenas em `version.json`; encontrar versão publicada nova **não** significa que o bundle foi baixado e validado, portanto não faz mais `location.replace` direto sem trabalhador ativo.

## QA existente

- `sw-registration-integrity.test.cjs` cobre fluxos de refresh offline, ausência de purge, atualização waiting e bloqueio de operação crítica. **10 testes locais Node PASS**.
- `apps/web/pwa-fixtures/upgrade.spec.ts` agora simula **seis bases IndexedDB legadas por nome** e compara chaves de fila, pesagem, mutações, sessões, fotos Blob, ArrayBuffer, PDF e três chaves localStorage antes/depois da atualização SW offline no mesmo origin.
- **Sem execução Playwright neste ambiente:** a fixture precisa rodar em `task qa:pwa:upgrade-fixture` no VS Code. É **sintética**, não a versão real antiga da PWA: não serve de aprovação da FASE 6.
- Medir quota CacheStorage/IndexedDB no browser WebKit, interrupção de instalação, SW waiting no background, perda de energia e recuperação. Acesso real a clientes/produção e deploy proibidos sem autorização.

## Aceite pendente

A nova PWA deve ocupar o **mesmo app instalado**, mesma origem/identidade, manter todos os registros/arquivos offline e permitir atualização por clique sem perder trabalho em andamento. Testes físicos Android/iPhone e campo rural são gate da pré-produção, não bloqueio para desenvolver novos módulos locais.
