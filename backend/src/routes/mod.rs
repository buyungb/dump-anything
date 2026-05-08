use axum::{
    http::{header, HeaderName, HeaderValue, Method},
    middleware,
    routing::{delete, get, post},
    Router,
};
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};

use crate::{auth, state::AppState};

mod collections;
mod documents;
mod health;
mod keys;

pub fn router(state: AppState) -> Router {
    let api = Router::new()
        .route("/collections", get(collections::list))
        .route("/collections/{name}", delete(collections::drop))
        .route(
            "/collections/{name}/documents",
            post(documents::insert).get(documents::list),
        )
        .route(
            "/collections/{name}/documents/{id}",
            get(documents::get_one).delete(documents::delete_one),
        )
        .route("/keys", get(keys::list).post(keys::create))
        .route("/keys/{id}", delete(keys::revoke))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_api_key,
        ));

    Router::new()
        .route("/health", get(health::health))
        .nest("/api", api)
        .layer(cors_layer())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

fn cors_layer() -> CorsLayer {
    let origins = std::env::var("CORS_ORIGINS").unwrap_or_else(|_| "*".to_string());
    let allow_origin = if origins.trim() == "*" {
        AllowOrigin::any()
    } else {
        let list: Vec<HeaderValue> = origins
            .split(',')
            .filter_map(|s| s.trim().parse::<HeaderValue>().ok())
            .collect();
        AllowOrigin::list(list)
    };

    CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::DELETE, Method::OPTIONS])
        .allow_headers([
            header::CONTENT_TYPE,
            header::AUTHORIZATION,
            HeaderName::from_static("x-api-key"),
        ])
        .allow_origin(allow_origin)
}
