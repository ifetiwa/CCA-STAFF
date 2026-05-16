#!/usr/bin/env bash
# 04 — generate a self-signed TLS certificate for ${DOMAIN}.
#      Stored under /etc/ssl/biodata. Valid for ${TLS_DAYS} days.
#
# Browsers will show a warning until you trust the cert (or your internal CA)
# on each client machine.

# shellcheck source=_lib.sh
source "$(dirname "$0")/_lib.sh"
require_root
require_cmd openssl

install -d -m 0755 "${TLS_DIR}"

if [[ -f "${TLS_CERT}" && -f "${TLS_KEY}" ]]; then
    if openssl x509 -in "${TLS_CERT}" -checkend 0 -noout >/dev/null 2>&1; then
        log "Existing cert at ${TLS_CERT} is still valid — leaving it alone."
        log "Use --force to regenerate."
        [[ "${1:-}" != "--force" ]] && exit 0
    fi
fi

log "Generating 2048-bit RSA key + self-signed cert for ${DOMAIN}"

# San extensions: cover the domain itself + a localhost fallback so the cert
# doesn't trip when poked from the server itself.
SAN_CONF=$(mktemp)
cat > "${SAN_CONF}" <<EOF
[req]
default_bits       = 2048
prompt             = no
default_md         = sha256
distinguished_name = dn
req_extensions     = req_ext

[dn]
C  = NG
ST = FCT
L  = Abuja
O  = Customary Court of Appeal
OU = IT
CN = ${DOMAIN}

[req_ext]
subjectAltName = @alt
keyUsage       = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[alt]
DNS.1 = ${DOMAIN}
DNS.2 = localhost
IP.1  = 127.0.0.1
EOF

openssl req -x509 -nodes -newkey rsa:2048 \
    -days "${TLS_DAYS}" \
    -keyout "${TLS_KEY}" \
    -out    "${TLS_CERT}" \
    -config "${SAN_CONF}" \
    -extensions req_ext

rm -f "${SAN_CONF}"

chmod 0600 "${TLS_KEY}"
chmod 0644 "${TLS_CERT}"
chown root:root "${TLS_KEY}" "${TLS_CERT}"

# DH parameters for forward secrecy. Re-used by nginx-biodata.conf.
DH_PARAMS="${TLS_DIR}/dhparam.pem"
if [[ ! -f "${DH_PARAMS}" ]]; then
    log "Generating Diffie-Hellman parameters (this takes a couple of minutes)"
    openssl dhparam -out "${DH_PARAMS}" 2048
    chmod 0644 "${DH_PARAMS}"
fi

log "Certificate written to ${TLS_CERT}"
openssl x509 -in "${TLS_CERT}" -noout -subject -issuer -dates
log "Distribute ${TLS_CERT} to client machines and add it to their trust stores"
log "to avoid the browser warning."
