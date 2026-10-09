#!/usr/bin/env bash
set -euo pipefail
script_name="${1:-}"
if [[ -z "$script_name" ]]; then
  echo '[ERRO] Indique o nome do script do package.json.' >&2
  exit 2
fi
node - "$script_name" <<'NODE'
const fs = require('node:fs');
const name = process.argv[2];
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!Object.prototype.hasOwnProperty.call(pkg.scripts ?? {}, name)) {
  console.error(`[BLOQUEADO] Script ${name} inexistente. Implementar o gate real; nao considerar a fase aprovada.`);
  process.exit(2);
}
NODE
exec bun run "$script_name"
