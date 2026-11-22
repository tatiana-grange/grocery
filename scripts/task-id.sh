#!/usr/bin/env bash
# Print a sortable time identifier used to prefix task files and task folders.
# Usage:
#   scripts/task-id.sh                       -> 20260803-1445
#   scripts/task-id.sh my-intention          -> 20260803-1445-my-intention
set -euo pipefail

id="$(date +%Y%m%d-%H%M)"

if [ $# -gt 0 ]; then
  slug="$(printf '%s' "$*" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//; s/-$//')"
  printf '%s-%s\n' "$id" "$slug"
else
  printf '%s\n' "$id"
fi
