#!/usr/bin/env bash

# Carregar caminhos essenciais no Git Bash para Windows
# Localizar Bun
if ! command -v bun >/dev/null 2>&1; then
  if [ -d "$HOME/.bun/bin" ]; then
    export PATH="$HOME/.bun/bin:$PATH"
  elif [ -d "/c/Users/MATEUS/.bun/bin" ]; then
    export PATH="/c/Users/MATEUS/.bun/bin:$PATH"
  fi
  if ! command -v bun >/dev/null 2>&1 && command -v where.exe >/dev/null 2>&1; then
    W_BUN=$(where.exe bun 2>/dev/null | tr -d '\r' | head -n 1 || true)
    if [ -n "$W_BUN" ]; then
      BUN_DIR=$(dirname "$W_BUN")
      if command -v cygpath >/dev/null 2>&1; then
        BUN_DIR=$(cygpath -u "$BUN_DIR" | tr -d '\r')
      fi
      export PATH="$BUN_DIR:$PATH"
    fi
  fi
fi

# Localizar Node
if ! command -v node >/dev/null 2>&1; then
  if command -v where.exe >/dev/null 2>&1; then
    W_NODE=$(where.exe node 2>/dev/null | tr -d '\r' | head -n 1 || true)
    if [ -n "$W_NODE" ]; then
      NODE_DIR=$(dirname "$W_NODE")
      if command -v cygpath >/dev/null 2>&1; then
        NODE_DIR=$(cygpath -u "$NODE_DIR" | tr -d '\r')
      fi
      export PATH="$NODE_DIR:$PATH"
    fi
  fi
fi

# Localizar Task
if ! command -v task >/dev/null 2>&1; then
  if [ -d "$HOME/scoop/shims" ]; then
    export PATH="$HOME/scoop/shims:$PATH"
  elif [ -d "/c/Users/MATEUS/scoop/shims" ]; then
    export PATH="/c/Users/MATEUS/scoop/shims:$PATH"
  fi
  if ! command -v task >/dev/null 2>&1 && command -v where.exe >/dev/null 2>&1; then
    W_TASK=$(where.exe task 2>/dev/null | tr -d '\r' | head -n 1 || true)
    if [ -n "$W_TASK" ]; then
      TASK_DIR=$(dirname "$W_TASK")
      if command -v cygpath >/dev/null 2>&1; then
        TASK_DIR=$(cygpath -u "$TASK_DIR" | tr -d '\r')
      fi
      export PATH="$TASK_DIR:$PATH"
    fi
  fi
fi
