#!/usr/bin/env bash
set -euo pipefail
export NODE_PATH="$(node -e '
const fs = require("fs");
const path = require("path");
const root = process.cwd();
const bunDir = path.join(root, "node_modules", ".bun");
const paths = [path.join(root, "node_modules")];
if (fs.existsSync(bunDir)) {
  for (const entry of fs.readdirSync(bunDir)) {
    const nm = path.join(bunDir, entry, "node_modules");
    if (fs.existsSync(nm)) paths.push(nm);
  }
}
console.log(paths.join(path.delimiter));
')"
exec node "$@"