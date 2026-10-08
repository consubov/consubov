#!/usr/bin/env bash
set -euo pipefail
if (($# < 1)); then echo '[ERRO] Indique o script do package.json.' >&2; exit 2; fi
script_name="$1"
node - "$script_name" <<'NODE'
const fs = require('node:fs');
const name = process.argv[2];
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!Object.prototype.hasOwnProperty.call(pkg.scripts ?? {}, name)) {
  console.error('[BLOQUEADO] Script ' + name + ' inexistente: implementar e executar teste local antes de aprovar fase.');
  process.exit(2);
}
NODE
exec bun run "$script_name"
