# T07 — dispositivos emulados, acessibilidade e métricas observadas

Execução local sobre o App construído, autenticado pela API de laboratório e com os módulos reais em iframe opaco. Este relatório registra verificações automatizadas; não concede homologação independente ou autorização de produção.

## Identidade da execução

- Checkout: `C:/Users/MATEUS/.codex/worktrees/a3ec/consubov/next-platform`.
- HEAD: `25a4d8ad2ad4fae7c3a4f77e4912394801c81154`; árvore **dirty**, preservada. O HEAD sozinho não identifica as alterações verificadas.
- Fingerprint completo de fontes, incluindo arquivos não rastreados: `ffa55773ff6884c331b5423f91631d505888fe3dfebd28cf1ee790c30bf0eed8`.
- Matriz: [result.json](../../.qa/runs/t07-devices-ynAKVk/result.json), [output.log](../../.qa/runs/t07-devices-ynAKVk/output.log).
- Suplemento de contraste: [result.json](../../.qa/runs/t07-visible-contrast-5TsDwe/result.json), [output.log](../../.qa/runs/t07-visible-contrast-5TsDwe/output.log).
- Artefatos congelados: `.qa/tmp/f23-final-artifacts-FZZqON`; inventário de hashes no suplemento e em `.qa/runs/f23-final-WqkvBC/artifact-inventory.json`.
- `sourceUnchanged=true` na matriz e no suplemento; `artifactsUnchanged=true` no suplemento.
- axe-core **4.13.0**, já instalado no checkout canônico, consultado sem instalação ou escrita nesse checkout. SHA-256 do motor: `c24f097bd2f451d4f933e8bc7d8d539f8672a2ebcb5cc9f9f3eec8ca9470a0c1`. O recibo preserva o caminho exato.

## Cobertura e resultados

Chromium e WebKit executaram os quatro perfis — Capataz, Gerente, Escritório e Fábrica — nas dimensões desktop **1366×900**, mobile **390×844** e tablet **820×1180**. São **24 casos de emulação**, cada um com perfil persistente isolado, login real e escolha explícita de contexto quando apresentada. Os servidores usaram `createProductionHandler`, portas locais efêmeras e API com fixtures sintéticas; o servidor existente na porta 5187 não foi utilizado.

| Verificação | Resultado observado |
| --- | --- |
| Autenticação, módulo saudável e execução | PASS nos 24 casos |
| Console, exceções, requests falhos e HTTP de erro | PASS nos 24 casos; nenhum erro admitido por allowlist |
| Tab real no shell e módulo | PASS de alcance básico nos 24 casos; oito passos registrados por documento |
| Overflow horizontal do documento | PASS no shell, iframe inicial e 120 visitas a abas |
| Nomes de controles, alt de imagens, títulos de iframe e IDs duplicados | PASS no shell, iframe inicial e 120 visitas a abas |
| axe no shell e iframe inicial | 48 verificações PASS; zero violações |
| axe em cada aba realmente navegada | 120 verificações PASS; zero violações |
| Geometria bruta mínima de 24 px | Seis flags `FAIL` preservadas: checkbox nativo da aba QR do Capataz, 13×13 px no Chromium e 12×12 px no WebKit |
| Aparelho físico, instalação no sistema operacional e leitor de tela | NAO_EXECUTADO |
| Aceite independente e produção | NAO_EXECUTADO / NO_GO |

As seis flags de geometria não são uma certificação de falha WCAG: o checkbox está dentro de um `label` clicável, e as exceções por espaçamento/área efetiva exigem revisão própria. O recibo mantém os valores brutos, sem convertê-los em PASS. A lista de controles abaixo de 44 px também permanece como orientação de revisão.

Os 24 registros `frame-tested` incompletos do documento externo decorrem do iframe opaco: cada documento interno foi auditado diretamente, com a política CSP original preservada. Quatro registros de contraste incompleto na visão mobile do Gerente correspondiam às colunas 4/5 fora da área horizontal visível. O suplemento resolveu especificamente esses casos.

## Contraste das colunas inicialmente fora da área visível

O suplemento criou dois novos contextos mobile, Chromium e WebKit, autenticou o Gerente pela API real do laboratório e abriu o mesmo módulo congelado. O contêiner real `role=region` foi rolado até a direita. Os retângulos dos seis alvos das colunas 4/5 foram afirmados inteiramente visíveis e sem recorte dentro do viewport e do contêiner.

Foram verificadas 12 razões no total, seis por motor. Em ambos os motores, axe executou a regra de contraste somente nesses alvos, com **zero violações e zero incompletos**. As razões calculadas a partir de foreground e background efetivos foram **7,578; 7,578; 21,000; 5,016; 21,000; 5,016**, todas acima de 4,5:1. O recibo preserva texto, coordenadas, estilos computados, camadas de fundo e resultado bruto do axe. Nenhuma alteração de produção ou CSP foi necessária.

## Métricas observadas

| Motor | Login até módulo saudável | Clique em aba até seleção + dois frames | Soma `ResourceTiming.transferSize` do shell | Soma `encodedBodySize` do shell |
| --- | --- | --- | --- | --- |
| Chromium | 932–960 ms | 71–141 ms | 417245–418443 bytes | 415445–416643 bytes |
| WebKit | 1938–2501 ms | 126–226 ms | 448077–449275 bytes | 445677–446875 bytes |

São observações de execução local, sem limitação artificial de CPU/rede, SLA ou pontuação inventada. A duração de navegação entre abas foi registrada antes do scan axe. Os recursos internos do iframe usam URLs `data:` oriundas de bytes previamente verificados no cache; `transferSize=0` nesse documento não prova ausência de download. Cada recibo conserva entradas individuais de navegação/recursos, bytes, durações e marcas de login/prontidão.

## Correções verificadas e limites

A auditoria anterior `.qa/runs/t07-devices-DRHuMH` detectou contraste insuficiente nas abas, zoom desabilitado, problemas de landmarks/headings, região de tabela sem foco, selects sem ligação com seus rótulos e IDs repetidos em formulários. Esses resultados históricos continuam preservados como FAIL. A execução `ynAKVk` verificou as correções posteriores, incluindo IDs únicos de `Input` com `React.useId`, preservação de IDs explícitos, indicação padrão de foco, associação dos dez selects aos rótulos existentes e hierarquia dos títulos.

A matriz principal T07 não cobre os ensaios negativos de dados, atualização ou conta compartilhada realizados pelos demais executores. O consolidado amplo `.qa/runs/f23-final-WqkvBC/result.json` registrou falhas em jornadas T03, portanto este relatório não o transforma em aprovação geral. Sua interpretação deve respeitar o fingerprint e o escopo de cada recibo. As correções dos testes/fixtures do consolidado e sua reverificação continuam separadas deste resultado. Homologação física e avaliação independente permanecem pendentes.
