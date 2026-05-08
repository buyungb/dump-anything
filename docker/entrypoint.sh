#!/bin/sh
set -eu

if [ -z "${MONGODB_URI:-}" ]; then
    echo "[entrypoint] MONGODB_URI is not set; defaulting to mongodb://mongo:27017" >&2
    export MONGODB_URI="mongodb://mongo:27017"
fi

export HOST="${HOST:-127.0.0.1}"
export PORT="${PORT:-3000}"
export DATABASE_NAME="${DATABASE_NAME:-dump_anything}"
export RUST_LOG="${RUST_LOG:-info}"

# ---- HTTP basic auth ------------------------------------------------------
# Auth is enabled when BOTH DASHBOARD_USER and DASHBOARD_PASSWORD (or its
# pre-hashed counterpart DASHBOARD_PASSWORD_HASH) are set. Otherwise the app
# is fully public, matching the original behaviour.
HTPASSWD=/etc/nginx/.htpasswd
AUTH_INCLUDE=/etc/nginx/auth.conf
REALM="${DASHBOARD_REALM:-Dump Anything}"

if [ -n "${DASHBOARD_USER:-}" ] && \
   { [ -n "${DASHBOARD_PASSWORD:-}" ] || [ -n "${DASHBOARD_PASSWORD_HASH:-}" ]; }; then
    if [ -n "${DASHBOARD_PASSWORD_HASH:-}" ]; then
        printf '%s:%s\n' "${DASHBOARD_USER}" "${DASHBOARD_PASSWORD_HASH}" > "${HTPASSWD}"
    else
        # bcrypt (-B) is preferred and supported by nginx 1.0.3+.
        # `-c` creates/truncates so each container start is deterministic.
        htpasswd -B -b -c "${HTPASSWD}" "${DASHBOARD_USER}" "${DASHBOARD_PASSWORD}" >/dev/null
    fi
    chmod 640 "${HTPASSWD}"
    chown root:www-data "${HTPASSWD}" 2>/dev/null || true
    cat > "${AUTH_INCLUDE}" <<EOF
auth_basic "${REALM}";
auth_basic_user_file ${HTPASSWD};
EOF
    echo "[entrypoint] basic auth ENABLED (user='${DASHBOARD_USER}' realm='${REALM}')"
else
    : > "${AUTH_INCLUDE}"
    echo "[entrypoint] basic auth DISABLED (set DASHBOARD_USER + DASHBOARD_PASSWORD to enable)"
fi
# ---------------------------------------------------------------------------

echo "[entrypoint] starting dump-anything-api on ${HOST}:${PORT} (db=${DATABASE_NAME})"
/usr/local/bin/dump-anything-api &
api_pid=$!

cleanup() {
    echo "[entrypoint] shutting down (api pid=${api_pid})"
    kill "${api_pid}" 2>/dev/null || true
    nginx -s quit 2>/dev/null || true
    wait "${api_pid}" 2>/dev/null || true
}
trap cleanup TERM INT

# Wait for the API health endpoint before starting nginx so the first request
# from a load balancer is never served against a not-yet-ready backend.
i=0
until curl -fsS "http://${HOST}:${PORT}/health" >/dev/null 2>&1; do
    i=$((i + 1))
    if [ "$i" -gt 60 ]; then
        echo "[entrypoint] api failed to become ready within 60s" >&2
        kill "${api_pid}" 2>/dev/null || true
        exit 1
    fi
    if ! kill -0 "${api_pid}" 2>/dev/null; then
        echo "[entrypoint] api process exited before becoming ready" >&2
        exit 1
    fi
    sleep 1
done

echo "[entrypoint] api is healthy; starting nginx on :8080"
nginx -g 'daemon off;' &
nginx_pid=$!

# Poll both children; exit as soon as either dies (POSIX sh, no `wait -n`).
status=0
while true; do
    if ! kill -0 "${api_pid}" 2>/dev/null; then
        wait "${api_pid}" 2>/dev/null || status=$?
        echo "[entrypoint] api process exited (status=${status})" >&2
        break
    fi
    if ! kill -0 "${nginx_pid}" 2>/dev/null; then
        wait "${nginx_pid}" 2>/dev/null || status=$?
        echo "[entrypoint] nginx process exited (status=${status})" >&2
        break
    fi
    sleep 1
done
cleanup
exit "${status}"
