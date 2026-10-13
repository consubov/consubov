# FASES 8-9 - Ensaio local de reconciliacao e restauracao

## Escopo

`scripts/qa/local-snapshot-rehearsal.mjs` compara fixtures JSON por tenant, entidade, ID e hash do payload. Tambem copia uma fixture para um arquivo novo, sincroniza a escrita e verifica novamente os bytes e os registros. Nao abre conexao de banco, nao exporta o legado e nao executa SQL, migrations, rede, deploy ou limpeza de dados.

O formato `consubov-local-fixture-v1` e exclusivo deste ensaio; nao define schema de dominio. A flag `fixture: true` e uma declaracao do fornecedor do arquivo, nao uma verificacao de anonimizao. Usar somente dados ficticios. O resultado sempre informa `productionReady: false`.

## Contrato

A raiz exige `format`, `fixture`, `tenantId` e `rows`. Cada linha exige `tenantId`, `entity`, `id`, `payload`. Campos nao modelados sao recusados: proprietario, tombstone ou metadado nao podem desaparecer silenciosamente da comparacao. IDs sao comparados no namespace tenant/entidade, sem remapeamento automatico. O payload aceita somente JSON finito, aciclico, com profundidade limitada; Blob/ArrayBuffer exigem seus testes de IndexedDB separados.

Nao aceitar evidencia vazia, IDs duplicados, tenant divergente, formato desconhecido ou UTF-8 invalido. A leitura recusa URLs, shares de rede e symlinks, exige arquivo regular e limita a entrada a 8 MiB. Esse limite protege a ferramenta, nao e regra de negocio.

O relatorio publica contagens e hashes, nunca os valores operacionais ou IDs. Contagens iguais nao bastam: registros substituidos, ausentes, extras ou alterados produzem FAIL.

## Execucao

```bash
task qa:preprod:rehearsal
node scripts/qa/local-snapshot-rehearsal.mjs reconcile .qa/source.json .qa/target.json
node scripts/qa/local-snapshot-rehearsal.mjs restore .qa/source.json .qa/new-restored.json
```

`restore` exige destino inexistente. Nunca sobrescreve o arquivo anterior, mesmo com symlink. Fonte invalida nao cria destino. Uma copia interrompida permanece para inspecao; nao existe reparo ou exclusao automatica. Exit 0 = ensaio PASS; 1 = divergencia; 2 = entrada/I/O invalido. O operador deve investigar falha antes de escolher outro destino.

## Evidencia e limites

26/26 testes Node executados no Codespace, incluindo leitura/escrita real de arquivos temporarios, hashes, erros de CLI, isolamento e preservacao do destino. `qa:regressions` inclui a suite. Resultado: `.qa/runs/20261012T145853Z-local-rehearsal-651534fb6a7e-61573/result.json`, exit 0, checkout dirty.

Isto entrega uma parte independente do preparo das FASES 8/9. Nao comprova migracao das seis bases PWA, rollback PostgreSQL, saldos criticos, backup operacional, RTO/RPO, autenticacao nem prontidao de producao. Esses aceites continuam no Checklist Mestre. Nenhum gate de pre-producao foi afrouxado.
