# FASE 6 — capabilities Web e GPS da Conferência (lote local)

## Contrato implementado

- `detectBrowserCapabilities` consulta somente presenca de APIs (contexto seguro, GPS, camera, IndexedDB, BarcodeDetector), **sem solicitar permissao**. Presenca nao garante permissao ou hardware.
- `browserLocationProvider` implementa `LocationProvider` por Web Geolocation em contexto seguro, conservando `timeout: 4000` e `maximumAge: 60000`, com deadline independente.
- Coordenadas NaN, infinitas ou fora dos intervalos sao descartadas. Accuracy e timestamp sao metadados opcionais, nao persistidos na auditoria legada.
- Na leitura de QR da Conferencia, a auditoria e disparada sem `await`; sucesso valida as coordenadas, erro/negacao/ausencia/timeout grava null. O helper chama a tentativa de auditoria uma unica vez por leitura. Callbacks tardios nao inserem novamente.
- O codigo legado ja chamava Supabase para a auditoria. Esta alteracao preserva esse caminho existente, sem conectar a nova API a qualquer banco remoto.

## Matriz de verificacao

| Cenario | Regra |
|---|---|
| Contexto inseguro/API ausente/getter bloqueado | fallback nulo sem travar QR |
| Permissao negada/excecao sincrona | fallback nulo |
| Coordenada valida | latitude/longitude retornadas |
| Coordenada impossivel, NaN/Infinity | fallback nulo |
| Metadados invalidos | omitidos |
| Timeout independente/callback tardio | sem duplicidade |
| Capability detection | sem prompt e sem invocar hardware |
| Erro ao inserir auditoria | QR nao bloqueado |
| QR fisico/Chrome/WebKit dispositivo real | **pendente** de homologacao |

## Evidencias e limites

Em ambiente isolado no executor, os cenarios foram reproduzidos com 7 falhas esperadas (RED), corrigidos ate 12/12 testes Node PASS (GREEN). O TypeScript de provider/contrato/helper passou em verificacao estrita isolada. **Isso nao substitui Vitest, check integral, E2E Chromium/WebKit, Lighthouse ou QR fisico no Codespace.** Nao declarar FASE 6 aprovada ate esses gates serem executados. Testes versionados: `BrowserLocationProvider.test.ts` e `conferenciaGeoAudit.test.ts`; `ConferenciaPage.tsx` esta ligada ao adapter.
