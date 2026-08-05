# Dump Anything

A small, fast Rust API that accepts arbitrary JSON into MongoDB and a modern dashboard for exploring it. Collections are created automatically on first write — point any source at the API, give it a name, and the data is queryable seconds later.

```
┌────────────┐   REST JSON   ┌───────────────┐   BSON   ┌────────────┐
│ Dashboard  │ ────────────▶ │  Rust / Axum  │ ───────▶ │  MongoDB   │
│ React + TS │               │  dump-anything│          │  any data  │
└────────────┘               └───────────────┘          └────────────┘
```

## Stack

- **API**: Rust, [Axum](https://github.com/tokio-rs/axum), Tokio, official [`mongodb`](https://docs.rs/mongodb) driver.
- **Database**: MongoDB 7 (via Docker Compose).
- **Web**: Vite + React 19 + TypeScript, Tailwind, TanStack Query, [`@uiw/react-json-view`](https://github.com/uiwjs/react-json-view).
- **API docs**: [Zudoku](https://zudoku.dev) (OpenAPI 3.1, served at `/docs/`).

## Project layout

- [`backend/`](backend/) — Axum service exposing `/api/...` and `/health`.
- [`web/`](web/) — Vite/React dashboard.
- [`docs/`](docs/) — Zudoku source for the API documentation site (`/docs/`).
- [`Dockerfile`](Dockerfile) + [`docker/`](docker/) — combined production image (nginx + API + docs).
- [`docker-compose.yml`](docker-compose.yml) — Mongo + the combined app for one-command runs.

## Run with Docker (fastest path)

The published image bundles both the API and the dashboard behind nginx on port `8080`. It is built for `linux/amd64` and `linux/arm64`.

```bash
# Start Mongo + app together (auto-pulls latest image)
docker compose up -d

# Need a different host port? Override APP_PORT:
APP_PORT=18080 docker compose up -d

# Or run the prebuilt image standalone, against your own Mongo
docker run --rm -p 8080:8080 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017 \
  buyungbahari/dump-anything:latest
```

Then open <http://localhost:8080>. The dashboard lives at `/`, the API at `/api/...`, and the **Zudoku-powered API docs at `/docs/`**.

Available tags:

- `buyungbahari/dump-anything:latest` — current build
- `buyungbahari/dump-anything:0.4.6` — topbar reorder: `Dump JSON` then `Sign out`
- `buyungbahari/dump-anything:0.4.5` — sidebar status pill simplified to **online / offline**
- `buyungbahari/dump-anything:0.4.4` — responsive dashboard (mobile sidebar drawer, compact topbar)
- `buyungbahari/dump-anything:0.4.3` — JSON viewer color palette retuned for the dashboard theme
- `buyungbahari/dump-anything:0.4.2` — basic auth dropped from `/api/*` (API key is the only gate)
- `buyungbahari/dump-anything:0.4.1` — `BOOTSTRAP_API_KEY` reconciled on every startup
- `buyungbahari/dump-anything:0.4.0` — Zudoku API documentation site at `/docs/`
- `buyungbahari/dump-anything:0.3.0` — mandatory API key auth + dashboard key manager
- `buyungbahari/dump-anything:0.2.0` — optional HTTP basic auth
- `buyungbahari/dump-anything:0.1.0` — initial release

### API documentation site

The image also bundles a [Zudoku](https://zudoku.dev) developer portal at `/docs/` — a polished OpenAPI 3.1 reference with searchable navigation, schema explorer, and an interactive playground for every endpoint. It's compiled into static HTML/JS at build time, served by the same nginx, and is **always public** (no API key, no basic auth) so you can drop the URL into a Slack channel without provisioning a key first.

- Source: [`docs/`](docs/) — Zudoku project + OpenAPI spec at [`docs/apis/openapi.yaml`](docs/apis/openapi.yaml).
- Pages: introduction, quickstart, authentication, ingest guide, filtering guide.
- The dashboard topbar has an **API docs** button that opens it in a new tab.
- To edit locally: `cd docs && npm install && npm run dev` (requires Node ≥ 22.12).

### API keys (required)

Every `/api/...` request must carry a valid API key. Each key is created as
either Bearer (the default) or Basic and must use the matching
`Authorization` scheme. `X-API-Key` and the `api_key` query parameter work
with either type. `/health` stays public.

- The very first time the server starts against an empty database it auto-generates a **bootstrap** key and prints it once to the logs:

  ```
  [WARN] =================== BOOTSTRAP API KEY ===================
  [WARN] source: auto-generated
  [WARN] key:    da_<32 hex chars>
  ```

  Grab it with `docker compose logs app | grep "key:"`.

- Open the dashboard, paste the bootstrap key when prompted, then create labelled keys (`from-laptop`, `ci-runner`, …) from the **API keys** button in the topbar. Revoking the bootstrap key once your labelled keys exist is recommended.

- For unattended deployments, set `BOOTSTRAP_API_KEY` to a value of your choice; it is used verbatim if the database has no active keys yet.

  ```bash
  docker run -e BOOTSTRAP_API_KEY="da_$(openssl rand -hex 16)" ...
  ```

Programmatic use:

```bash
curl -H "X-API-Key: da_..." http://localhost:8080/api/collections
curl -H "Authorization: Bearer da_..." http://localhost:8080/api/collections
curl -H "Authorization: Basic da_..." http://localhost:8080/api/collections
curl "http://localhost:8080/api/collections?api_key=da_..."
```

The Bearer/Basic type is selected when creating the key. In Basic mode, the
generated key itself follows `Basic`; it is not a username/password pair.
Use the query form only for clients that cannot set headers. The bundled
nginx access log and Rust request trace omit query strings, but nginx error
logs, upstream proxies, and monitoring systems may still record the original
URL and must be configured to redact `api_key` values.
Storage: keys live in a hidden `_api_keys` collection, hashed with SHA-256.
The plaintext is shown exactly once (on creation); the dashboard displays
only the prefix afterwards. Revoke writes a `revoked_at` timestamp; revoked
keys are rejected immediately.

### Protect the dashboard with basic auth

Set credentials in a `.env` next to `docker-compose.yml` (the `.env.example` shows the keys):

```bash
cp .env.example .env
# edit .env: DASHBOARD_USER=admin, DASHBOARD_PASSWORD=...
docker compose up -d
```

Or pass them inline when using `docker run`:

```bash
docker run --rm -p 8080:8080 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017 \
  -e DASHBOARD_USER=admin \
  -e DASHBOARD_PASSWORD='choose-something-strong' \
  -e DASHBOARD_REALM='Dump Anything' \
  buyungbahari/dump-anything:latest
```

Behaviour (≥ `0.4.2`):

| Path                                  | Basic auth (when `DASHBOARD_*` set) | API key |
| ------------------------------------- | ----------------------------------- | ------- |
| `/` (dashboard SPA + assets)          | required                            | enforced by the SPA after login |
| `/api/*`                              | **not** required                    | required (header, query, or assigned Bearer/Basic scheme) |
| `/docs/*`                             | not required                        | not required |
| `/health`                             | not required                        | not required |

Why `/api/*` is exempt from basic auth: the Rust API already gates every request with a per-consumer, hashed, revocable API key — basic auth on top would just force machine clients (curl, CI, mobile, webhooks) to carry two credentials with no real security gain. The dashboard SPA still goes through basic auth because that's a human-facing surface.

Other notes:

- When either `DASHBOARD_USER` or `DASHBOARD_PASSWORD` is empty/unset the dashboard is fully public (the API key alone gates `/api/*`).
- `GET /health` is always reachable without credentials so orchestrator probes (compose, k8s, load balancers) keep working.
- Pre-hashed credentials are also accepted via `DASHBOARD_PASSWORD_HASH` (any value `htpasswd -nbB` would emit) — useful when you do not want a plaintext password in your environment.

> **Upgrading from `≤ 0.4.1`**: those versions also gated `/api/*` with basic auth. After pulling `:latest` (≥ `0.4.2`), `curl` against `/api/*` no longer needs `-u user:pass` — only `-H "X-API-Key: da_..."`. The dashboard UI itself still requires basic auth as before.

### Updating to a new release

Compose is configured with `pull_policy: always`, so every `docker compose up` checks Docker Hub for a newer image and recreates the container only when the digest actually changes. To pull explicitly without bouncing anything:

```bash
docker compose pull          # fetch new images
docker compose up -d         # recreate only what changed
```

### Production deploys

Use [`.env.production.example`](.env.production.example) as the starting point for a production environment file (basic auth, fixed bootstrap key, hardening checklist):

```bash
cp .env.production.example .env.production
# edit .env.production: strong DASHBOARD_PASSWORD, real BOOTSTRAP_API_KEY, …
docker compose --env-file .env.production up -d
```

Compose only auto-loads `.env`; production-style files (`.env.production`, `.env.staging`, etc.) need the explicit `--env-file` flag. They are gitignored so the real secrets never enter the repository.

### Deploy on Dokploy

[Dokploy](https://dokploy.com) bundles its own Traefik, so containers must **not** bind to host ports — Dokploy's UI itself runs on `:3000` and `:80/443`, which is what causes the classic _"Bind for 0.0.0.0:3000 failed: port is already allocated"_ error when you reuse the regular compose file as-is.

Use the dedicated [`docker-compose.dokploy.yml`](docker-compose.dokploy.yml) instead — it strips every `ports:` mapping, parameterises the image tag, and only `expose:`s `:8080` internally so Traefik can target it.

Steps in the Dokploy dashboard:

1. **Create** → **Compose** service.
2. Point it at this repository (or paste the contents of `docker-compose.dokploy.yml` into the editor).
3. **Environment** panel — paste from `.env.production.example` and fill in the secrets. The variables Dokploy needs are: `APP_IMAGE_TAG`, `DASHBOARD_USER`, `DASHBOARD_PASSWORD`, `DASHBOARD_REALM`, `BOOTSTRAP_API_KEY`.
4. **Domains** → add a domain, set **service = `app`**, **container port = `8080`**. Dokploy injects the right Traefik labels automatically and provisions a TLS cert via Let's Encrypt.
5. Deploy. The dashboard ends up at `https://your-domain/`, the API at `https://your-domain/api/...`, and the docs at `https://your-domain/docs/`.

#### Troubleshooting Dokploy

**`Bind for 0.0.0.0:3000 failed: port is already allocated`**
Dokploy's own UI listens on `:3000`. The standard `docker-compose.yml` publishes a host port and collides — use `docker-compose.dokploy.yml` instead, which doesn't expose any host ports.

**`failed to lookup address information: Temporary failure in name resolution` for `mongo:27017`**
The `app` container cannot resolve the `mongo` service. Three things to check, in order:

1. **Mongo is running and healthy.** In the Dokploy UI open the stack and confirm both services are green. If `mongo` is restarting, click into it and read the logs — the most common cause is volume permissions on the host. Recreate the volume in **Volumes** if needed.
2. **Both services are on the same network.** The supplied `docker-compose.dokploy.yml` declares an explicit `app-net` bridge that both services join — DON'T remove that block. If you customised the file, make sure both services have `networks: [app-net]` (or share whatever network you replaced it with).
3. **You're not pointing at managed Mongo while keeping the bundled service.** If you set `MONGODB_URI=mongodb+srv://…` to use Atlas, also remove the `mongo` service block from the compose file — otherwise `depends_on` will block startup waiting for a service the app never actually talks to.

**The container restarts in a tight loop.**
That's `restart: unless-stopped` doing its job after the API exits on a fatal config error. Check `docker compose logs app` for the actual error (typical culprits: malformed `MONGODB_URI`, a `BOOTSTRAP_API_KEY` that doesn't start with `da_`, missing `DASHBOARD_PASSWORD` while `DASHBOARD_USER` is set).

### Data persistence

Mongo's data lives in a named volume `dump-anything-mongo-data`. It is **decoupled** from the application container: every image update, container recreation, `docker compose down`, or `docker compose up` keeps the database intact.

| Command                       | Mongo data |
| ----------------------------- | ---------- |
| `docker compose pull / up`    | preserved  |
| `docker compose restart`      | preserved  |
| `docker compose down`         | preserved  |
| `docker compose down -v`      | **deleted** |
| `docker volume rm <name>`     | **deleted** |

To back up the volume:

```bash
docker run --rm -v dump-anything-mongo-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/mongo-$(date +%F).tgz -C /data .
```

## Quick start (from source)

Three terminals (or use a process manager of your choice):

```bash
# 1. MongoDB
docker compose up -d mongo

# 2. Rust API
cd backend
cp .env.example .env       # tweak if needed
cargo run                  # binds 0.0.0.0:3000

# 3. Dashboard
cd web
cp .env.example .env       # default points at http://localhost:3000
npm install
npm run dev                # opens http://localhost:5173
```

Open http://localhost:5173, click **Dump JSON**, give it a collection name, and paste any JSON payload. The collection appears in the sidebar instantly and rows show up in the table view.

## Configuration

### Backend (`backend/.env`)

| Variable             | Default                       | Notes                                                                 |
| -------------------- | ----------------------------- | --------------------------------------------------------------------- |
| `MONGODB_URI`        | `mongodb://localhost:27017`   | Standard Mongo connection string.                                     |
| `DATABASE_NAME`      | `dump_anything`               | One database holds every dynamic collection.                          |
| `HOST`               | `0.0.0.0`                     | Bind address.                                                         |
| `PORT`               | `3000`                        | HTTP port.                                                            |
| `CORS_ORIGINS`       | `*`                           | Comma-separated list, or `*` for any.                                 |
| `RUST_LOG`           | `info,dump_anything_api=debug`| Standard `tracing-subscriber` filter.                                 |
| `BOOTSTRAP_API_KEY`  | _unset_                       | If set and DB has no active keys, persist this verbatim as the seed.  |

### Web (`web/.env`)

| Variable        | Default        | Notes                                                                |
| --------------- | -------------- | -------------------------------------------------------------------- |
| `VITE_API_URL`  | `""` (relative)| Origin of the Rust API. Leave empty when served by nginx in the bundled image; set to `http://localhost:3000` for split local dev. |

## API reference

The full interactive reference (with a "Try it" panel for every endpoint) lives at **`/docs/api`** in the running container — see [API documentation site](#api-documentation-site) above. The condensed list below mirrors it for quick scanning.

All endpoints return JSON. Errors have shape `{ "error": "<code>", "message": "<text>" }`.

Every `/api/...` endpoint requires an API key. Examples below omit the header
for brevity — add `-H "X-API-Key: da_..."`, use `?api_key=da_...`, or use
the Bearer/Basic `Authorization` scheme assigned to the key.

### `GET /health`

Pings Mongo and reports status. **No auth required.**

### `GET /api/keys`

```json
{ "keys": [{ "id": "...", "label": "ci-runner", "prefix": "da_abcdef",
             "auth_type": "bearer",
             "created_at": "...", "last_used_at": "...", "revoked_at": null }] }
```

### `POST /api/keys`

Body `{ "label": "ci-runner", "auth_type": "basic" }`. `auth_type` defaults
to `bearer` when omitted. Returns the plaintext key once:

```json
{ "key": "da_<32 hex>", "id": "...", "label": "ci-runner", "prefix": "...", ... }
```

### `DELETE /api/keys/{id}`

Marks the key as revoked. Subsequent requests using it return 401.

### `GET /api/collections`

```json
{ "collections": [{ "name": "events", "count": 42 }] }
```

### `DELETE /api/collections/{name}`

Drops the collection.

### `POST /api/collections/{name}/documents`

Body: a JSON object **or** an array of objects. The server adds an `_ingestedAt` timestamp to each document if you do not provide one.

```bash
curl -X POST http://localhost:3000/api/collections/events/documents \
  -H 'content-type: application/json' \
  -d '{"user":"alice","event":"signup","tags":["beta"]}'
# => {"inserted":1,"ids":["69f8..."]}

curl -X POST http://localhost:3000/api/collections/events/documents \
  -H 'content-type: application/json' \
  -d '[{"user":"bob"},{"user":"carol"}]'
```

### `GET /api/collections/{name}/documents`

Query parameters:

- `limit` — default `50`, max `500`.
- `skip` — default `0`.
- `sort` — comma-separated field list. Prefix with `-` for descending. Default `-_id`.
- `q` — optional MongoDB filter, encoded as JSON. Example: `q={"user":"alice"}`.

```json
{
  "items": [...],
  "total": 3,
  "limit": 50,
  "skip": 0
}
```

### `GET /api/collections/{name}/documents/{id}`

Fetch one document by its `_id` (hex ObjectId).

### `DELETE /api/collections/{name}/documents/{id}`

Delete one document.

## Building & publishing the Docker image

The repo ships a multi-stage [`Dockerfile`](Dockerfile) that builds the Rust binary, the Vite dashboard, and the Zudoku docs site, and packages them with nginx in a single ~150 MB Debian-slim image.

```bash
# Local single-arch build (uses the host arch, fast)
docker build -t dump-anything:dev .

# Multi-arch publish to Docker Hub
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t buyungbahari/dump-anything:latest \
  -t buyungbahari/dump-anything:<version> \
  --push .
```

Inside the container:

- nginx listens on `:8080`, serves the dashboard SPA at `/`, the static Zudoku site at `/docs/`, and reverse-proxies `/api/*` and `/health` to the API on `127.0.0.1:3000`.
- The entrypoint launches `dump-anything-api`, waits for `/health`, then starts nginx; either process dying takes the container down so the orchestrator can restart it.
- If `DASHBOARD_USER` + `DASHBOARD_PASSWORD` are set, the entrypoint writes `/etc/nginx/.htpasswd` (bcrypt) and an include file that turns on basic auth for the dashboard and API. `/docs/*` and `/health` always stay public.

## Production notes

- The API is stateless; scale horizontally behind any load balancer.
- For single-origin deployments, the bundled image is the simplest path. Otherwise build the dashboard (`npm run build` in `web/`) and serve `web/dist` from your CDN or reverse proxy, and set `CORS_ORIGINS` on the API.
- This MVP assumes a trusted network. Before exposing it publicly, add authentication (API key header or OIDC), rate limiting, and a collection name allowlist — all of which slot in cleanly as Tower middleware on top of the existing router.
