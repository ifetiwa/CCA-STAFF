"""Gunicorn configuration for the CCA Biodata Django app.

Loaded via ``gunicorn -c /opt/biodata/deploy/gunicorn.conf.py biodata_system.wsgi``.
Supervisor (see supervisor-biodata.conf) supplies the command line and
restart policy — this file only declares HOW Gunicorn behaves once running.
"""
import multiprocessing
import os

# --- Bind --------------------------------------------------------------------
# Nginx proxies to this UNIX socket. Permissions are set by Supervisor (umask)
# so the socket is reachable by www-data.
bind = "unix:/run/gunicorn/biodata.sock"
umask = 0o007

# --- Workers -----------------------------------------------------------------
# 4 sync workers is the documented requirement. The (2*cpu)+1 heuristic is
# left as a comment in case the box gets bigger later.
workers = int(os.environ.get("GUNICORN_WORKERS", "4"))
# workers = (multiprocessing.cpu_count() * 2) + 1
worker_class = "sync"
threads = 1

# Recycle workers periodically to bound memory growth (Pillow/ReportLab leaks
# are rare but cheap to guard against).
max_requests = 1000
max_requests_jitter = 100

timeout = int(os.environ.get("GUNICORN_TIMEOUT", "60"))
graceful_timeout = 30
keepalive = 5

# --- Logging -----------------------------------------------------------------
# Stdout/stderr are captured by Supervisor and routed to /var/log/biodata/*.log
accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = (
    '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(L)ss'
)

# --- Process hygiene ---------------------------------------------------------
proc_name = "biodata-gunicorn"
preload_app = True   # cuts memory by sharing the loaded app across forks
forwarded_allow_ips = "127.0.0.1"
