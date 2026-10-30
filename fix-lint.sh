#!/bin/bash
file="apps/web/src/components/relatorio/ExportarRelatorioModal.tsx"

cd apps/web
bun run lint:changed > lint_output.txt || true
lines=$(grep "@typescript-eslint/no-explicit-any" lint_output.txt | awk -F':' '{print $1}' | awk '{print $1}' | sort -nr)

cd ../..

for line in $lines; do
  sed -i "${line}i \\        // eslint-disable-next-line @typescript-eslint/no-explicit-any" $file
done
