# syntax=docker/dockerfile:1.7

# ==========================================================================
# Stage 1 - build the Vite/React web bundle
# ==========================================================================
FROM --platform=$BUILDPLATFORM node:20-alpine AS web-builder
WORKDIR /web

COPY web/package.json web/package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY web/ ./

ARG VITE_API_URL=/
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build


# ==========================================================================
# Stage 1b - build the Zudoku-powered API documentation site
# ==========================================================================
FROM --platform=$BUILDPLATFORM node:22-alpine AS docs-builder
WORKDIR /docs

COPY docs/package.json docs/package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY docs/ ./
RUN npm run build


# ==========================================================================
# Stage 2 - build the Rust API binary
# ==========================================================================
FROM rust:1-slim-bookworm AS api-builder
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        pkg-config \
        libssl-dev \
        ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Pre-cache dependencies so source-only changes do not invalidate the layer
COPY backend/Cargo.toml backend/Cargo.lock ./
RUN mkdir src \
 && echo 'fn main() { println!("placeholder"); }' > src/main.rs \
 && cargo build --release \
 && rm -rf src target/release/deps/dump_anything*

COPY backend/src ./src
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target,id=dump-anything-target-${TARGETARCH} \
    cargo build --release \
 && cp target/release/dump-anything-api /usr/local/bin/dump-anything-api


# ==========================================================================
# Stage 3 - runtime: nginx serving web + reverse-proxying to the API
# ==========================================================================
FROM debian:bookworm-slim AS runtime

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        nginx \
        ca-certificates \
        tini \
        curl \
        apache2-utils \
 && rm -rf /var/lib/apt/lists/*

COPY --from=web-builder /web/dist /usr/share/nginx/html
# Zudoku is configured with `basePath: "/docs"` and emits the site under
# `dist/docs/`. We mount that subdirectory directly at /usr/share/nginx/html/docs.
COPY --from=docs-builder /docs/dist/docs /usr/share/nginx/html/docs
COPY --from=api-builder /usr/local/bin/dump-anything-api /usr/local/bin/dump-anything-api
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
 && mkdir -p /var/log/nginx /var/lib/nginx /run

ENV HOST=127.0.0.1 \
    PORT=3000 \
    RUST_LOG=info \
    DATABASE_NAME=dump_anything

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8080/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
