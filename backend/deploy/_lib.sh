# shellcheck shell=bash
# Common bootstrap sourced by every deploy/*.sh script.
# Loads env.deploy.sh, enforces strict mode, defines log/die helpers.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/env.deploy.sh"

if [[ ! -f "${ENV_FILE}" ]]; then
    echo "ERROR: ${ENV_FILE} not found." >&2
    echo "       Copy env.deploy.sh.example to env.deploy.sh and edit it first." >&2
    exit 1
fi

# shellcheck disable=SC1090
source "${ENV_FILE}"

log()  { printf '\033[1;32m[+]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

require_root() {
    [[ $EUID -eq 0 ]] || die "This script must be run with sudo."
}

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}
