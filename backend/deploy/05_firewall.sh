#!/usr/bin/env bash
# 05 — UFW: deny inbound by default; allow 22/80/443 only from the court LAN.
#      PostgreSQL (5432) and the Gunicorn socket are never exposed.

# shellcheck source=_lib.sh
source "$(dirname "$0")/_lib.sh"
require_root
require_cmd ufw

log "Resetting UFW to a known baseline"
ufw --force reset

ufw default deny incoming
ufw default allow outgoing

# Block ICMP echo ingress if you don't want the box to ping back.  Most
# courts want it for diagnostics, so we leave it on.
# ufw deny proto icmp

for cidr in "${COURT_LAN_CIDRS[@]}"; do
    log "Allowing SSH/HTTP/HTTPS from ${cidr}"
    ufw allow from "${cidr}" to any port 22  proto tcp comment "ssh from court LAN"
    ufw allow from "${cidr}" to any port 80  proto tcp comment "http from court LAN"
    ufw allow from "${cidr}" to any port 443 proto tcp comment "https from court LAN"
done

# Explicitly deny common externally-reachable services so a misconfiguration
# can't open them silently.
ufw deny 5432/tcp comment "postgres — local only"
ufw deny 25/tcp   comment "smtp — relay outbound only"

log "Enabling UFW (non-interactive)"
ufw --force enable
ufw status verbose
