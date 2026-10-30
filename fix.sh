#!/bin/bash
file="apps/web/src/components/relatorio/ExportarRelatorioModal.tsx"
sed -i 's/const ocupacaoProdutoByPasto: Record<string, string> = {};/let ocupacaoProdutoByPasto: Record<string, string> = {};/' $file
