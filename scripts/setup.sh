#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPOSITORY_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22 or newer is required." >&2
  exit 1
fi

if ! command -v git >/dev/null 2>&1 || ! git --version >/dev/null 2>&1; then
  echo "Git is required. Install it using your organization's approved package manager, then rerun this script." >&2
  exit 1
fi

python_probe='import sys; assert sys.version_info >= (3, 10), sys.version; print(sys.version.split()[0])'
python_version=""
if [[ -n "${HARNESS_TEST_PYTHON:-}" ]]; then
  if ! python_version="$("$HARNESS_TEST_PYTHON" -c "$python_probe" 2>/dev/null)"; then
    echo "HARNESS_TEST_PYTHON must name a working Python 3.10+ executable; no fallback or automatic upgrade was used." >&2
    exit 1
  fi
else
  for python_command in python python3; do
    if command -v "$python_command" >/dev/null 2>&1 && python_version="$("$python_command" -c "$python_probe" 2>/dev/null)"; then
      break
    fi
    python_version=""
  done
  if [[ -z "$python_version" ]] && command -v py >/dev/null 2>&1; then
    python_version="$(py -3 -c "$python_probe" 2>/dev/null)" || python_version=""
  fi
  if [[ -z "$python_version" ]]; then
    echo "Python 3.10+ is required for generated contract tests. Install/select it using your organization's approved package manager or HARNESS_TEST_PYTHON; this script does not upgrade Python. The Databricks Runtime version is a separate choice." >&2
    exit 1
  fi
fi
echo "Python inventory: $python_version (local contract tests)"

if ! command -v databricks >/dev/null 2>&1; then
  echo "Databricks CLI 1.x is required. Install it, then rerun this script." >&2
  exit 1
fi

node -e 'const [major] = process.versions.node.split(".").map(Number); if (major < 22) process.exit(1)' || {
  echo "Node.js 22 or newer is required; found $(node --version)." >&2
  exit 1
}

databricks_version="$(databricks --version 2>&1)"
node -e 'const m=process.argv[1].match(/(\d+)\.(\d+)\.(\d+)/);if(!m||Number(m[1])!==1||Number(m[2])<6)process.exit(1)' "$databricks_version" || {
  echo "Databricks CLI >=1.6.0 and <2.0.0 is required; found $databricks_version." >&2
  exit 1
}

node "$REPOSITORY_ROOT/tools/harness.mjs" setup "$@"
