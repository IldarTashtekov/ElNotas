#!/usr/bin/env bash
# Lanza checks.mjs con la Node de `.nvmrc`, no con la que traiga el PATH de la
# sesión: Claude Code hereda el PATH de cuando se abrió, y puede ser una Node
# vieja o ya desinstalada. Sin nvm, la `node` que haya.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 1
if [ -x "$HOME/.nvm/nvm-exec" ]; then
  exec "$HOME/.nvm/nvm-exec" node .claude/hooks/checks.mjs "$@"
fi
exec node .claude/hooks/checks.mjs "$@"
