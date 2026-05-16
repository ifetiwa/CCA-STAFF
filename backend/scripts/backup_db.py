"""Encrypted daily PostgreSQL backup.

Runs ``pg_dump`` (custom format, compressed) and encrypts the dump with
Fernet (AES-128-CBC + HMAC-SHA256, authenticated). The encrypted file is
written to ``BACKUP_DIR`` and old backups beyond ``RETENTION_DAYS`` are
removed.

Configuration is read from environment variables / the project's .env file
via python-decouple (so the same DB credentials Django uses are reused):

    DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT
    BACKUP_DIR              default: <BASE_DIR>/backups
    BACKUP_RETENTION_DAYS   default: 14
    BACKUP_ENCRYPTION_KEY   required — base64 urlsafe 32-byte Fernet key
    PG_DUMP_PATH            default: pg_dump (must be on PATH)

To generate a fresh key:

    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

Store the key OUT-OF-BAND (not in the same repository, not on the backed-up
host). Without the key the encrypted dumps are useless to both attackers
and operators — losing it means losing the backups.

To decrypt later:

    python backup_db.py --decrypt path/to/dump.pgdump.enc -o restored.pgdump
    pg_restore -d <target_db> restored.pgdump

Schedule on Windows (daily 02:00):

    schtasks /Create /SC DAILY /TN "CCA-Backup" /TR ^
      "python C:\\path\\to\\backend\\scripts\\backup_db.py" /ST 02:00

Schedule on Linux/macOS via cron:

    0 2 * * * /usr/bin/python3 /path/to/backend/scripts/backup_db.py
"""
from __future__ import annotations

import argparse
import datetime as dt
import os
import shutil
import subprocess
import sys
from pathlib import Path

# Allow running the script directly (without manage.py / Django context).
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

try:
    from decouple import Config, RepositoryEnv, config as _decouple_config
    _ENV_FILE = BASE_DIR / ".env"
    if _ENV_FILE.exists():
        cfg = Config(RepositoryEnv(str(_ENV_FILE)))
    else:
        cfg = _decouple_config
except Exception:  # pragma: no cover — fall back to plain os.environ
    cfg = None


def _get(name: str, default=None, required: bool = False):
    if cfg is not None:
        try:
            return cfg(name, default=default) if not required else cfg(name)
        except Exception:
            if required:
                raise
    val = os.environ.get(name, default)
    if required and val in (None, ""):
        raise RuntimeError(f"Missing required environment variable: {name}")
    return val


try:
    from cryptography.fernet import Fernet
except ImportError:
    print(
        "ERROR: The 'cryptography' package is required. Install with:\n"
        "    pip install cryptography",
        file=sys.stderr,
    )
    sys.exit(2)


def _resolve_backup_dir() -> Path:
    raw = _get("BACKUP_DIR", default=str(BASE_DIR / "backups"))
    path = Path(raw).expanduser().resolve()
    path.mkdir(parents=True, exist_ok=True)
    # Best-effort: restrict permissions on POSIX. On Windows ACLs are
    # managed via icacls — operators should do this once at provisioning.
    try:
        os.chmod(path, 0o700)
    except OSError:
        pass
    return path


def _fernet() -> Fernet:
    key = _get("BACKUP_ENCRYPTION_KEY", required=True)
    if isinstance(key, str):
        key = key.encode()
    return Fernet(key)


def _run_pg_dump(out_path: Path) -> None:
    env = os.environ.copy()
    env["PGPASSWORD"] = str(_get("DB_PASSWORD", required=True))
    pg_dump = _get("PG_DUMP_PATH", default="pg_dump")
    cmd = [
        pg_dump,
        "--host", str(_get("DB_HOST", default="localhost")),
        "--port", str(_get("DB_PORT", default="5432")),
        "--username", str(_get("DB_USER", required=True)),
        "--format=custom",
        "--compress=6",
        "--no-password",
        "--file", str(out_path),
        str(_get("DB_NAME", required=True)),
    ]
    subprocess.run(cmd, env=env, check=True)


def _encrypt_file(plain_path: Path, enc_path: Path) -> None:
    fernet = _fernet()
    data = plain_path.read_bytes()
    enc_path.write_bytes(fernet.encrypt(data))


def _decrypt_file(enc_path: Path, plain_path: Path) -> None:
    fernet = _fernet()
    data = enc_path.read_bytes()
    plain_path.write_bytes(fernet.decrypt(data))


def _prune(backup_dir: Path, retention_days: int) -> int:
    cutoff = dt.datetime.now() - dt.timedelta(days=retention_days)
    removed = 0
    for entry in backup_dir.glob("*.pgdump.enc"):
        try:
            mtime = dt.datetime.fromtimestamp(entry.stat().st_mtime)
        except OSError:
            continue
        if mtime < cutoff:
            try:
                entry.unlink()
                removed += 1
            except OSError:
                pass
    return removed


def run_backup() -> Path:
    backup_dir = _resolve_backup_dir()
    retention = int(_get("BACKUP_RETENTION_DAYS", default=14))
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    db_name = str(_get("DB_NAME", required=True))
    plain = backup_dir / f"{db_name}-{stamp}.pgdump"
    enc = backup_dir / f"{db_name}-{stamp}.pgdump.enc"

    print(f"[{stamp}] Dumping {db_name} → {plain.name}")
    _run_pg_dump(plain)
    print(f"[{stamp}] Encrypting → {enc.name}")
    _encrypt_file(plain, enc)
    try:
        plain.unlink()
    except OSError:
        pass

    removed = _prune(backup_dir, retention)
    print(
        f"[{stamp}] OK. backup={enc} size={enc.stat().st_size} bytes "
        f"retention_days={retention} pruned={removed}"
    )
    return enc


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--decrypt", metavar="PATH",
        help="Decrypt an existing .enc file instead of running a backup.",
    )
    parser.add_argument(
        "-o", "--output", metavar="PATH",
        help="Output path for --decrypt (default: strips .enc suffix).",
    )
    args = parser.parse_args()

    if args.decrypt:
        src = Path(args.decrypt).resolve()
        if not src.is_file():
            print(f"ERROR: {src} not found", file=sys.stderr)
            return 2
        out = Path(args.output).resolve() if args.output else src.with_suffix("")
        _decrypt_file(src, out)
        print(f"Decrypted → {out}")
        return 0

    if not shutil.which(_get("PG_DUMP_PATH", default="pg_dump")):
        print(
            "ERROR: pg_dump not found on PATH. Set PG_DUMP_PATH in your "
            "environment to its absolute location (e.g. "
            r"C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe).",
            file=sys.stderr,
        )
        return 2

    try:
        run_backup()
    except subprocess.CalledProcessError as exc:
        print(f"ERROR: pg_dump failed with exit code {exc.returncode}", file=sys.stderr)
        return exc.returncode
    return 0


if __name__ == "__main__":
    sys.exit(main())
