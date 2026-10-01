# ADR-0009 — App baseado na Web; wrapper final pendente

**Status:** Proposto / Pendente de decisão final  
**Data:** 2026-10-01

## Contexto
A direção atual é reaproveitar a Web React para o App, reduzindo duplicação de produto e de lógica.

## Decisão vigente
O App deve partir da **Web React empacotada** em uma solução nativa/híbrida apropriada.

O alvo atual de persistência local é **SQLite**, sujeito à compatibilidade da solução escolhida.

## Validações obrigatórias antes da decisão final
- Android
- iOS
- bridge nativa
- SQLite
- câmera
- QR
- GPS
- secure storage
- background/resume
- manutenção
- licença
- sustentabilidade do projeto

## Consequências
A Web deve usar interfaces para capacidades nativas desde já.

## Pendente
A tecnologia exata de WebNative/wrapper ainda não está decidida.
