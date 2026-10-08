#!/usr/bin/env bash
# Installs a packed tarball into an empty directory as users do, and runs it with the node on PATH
# (CI runs it on the oldest and the newest Node the package supports).
#
#   scripts/try-package.sh <tarball>
set -euo pipefail

tarball=$1
dir=$(mktemp -d)

node --version
npm install --prefix "$dir" --no-audit --no-fund "$tarball"
"$dir/node_modules/.bin/forecall-mcp" --version
"$dir/node_modules/.bin/forecall-mcp" --help > /dev/null
# Without a key it stops with 2 and says so, before reaching the network.
if FORECALL_API_KEY= "$dir/node_modules/.bin/forecall-mcp" < /dev/null 2> "$dir/stderr"; then
  echo "expected forecall-mcp to refuse to start without FORECALL_API_KEY" >&2
  exit 1
fi
grep -q "FORECALL_API_KEY" "$dir/stderr"
