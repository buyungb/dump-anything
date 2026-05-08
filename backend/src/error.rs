use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("invalid collection name: {0}")]
    InvalidCollectionName(String),
    #[error("invalid id: {0}")]
    InvalidId(String),
    #[error("invalid json body: {0}")]
    InvalidBody(String),
    #[error("not found")]
    NotFound,
    #[error("missing or invalid api key")]
    #[allow(dead_code)]
    Unauthorized,
    #[error("mongo: {0}")]
    Mongo(#[from] mongodb::error::Error),
    #[error("bson: {0}")]
    Bson(#[from] mongodb::bson::ser::Error),
    #[error("internal: {0}")]
    Internal(#[from] anyhow::Error),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code) = match &self {
            ApiError::InvalidCollectionName(_) => (StatusCode::BAD_REQUEST, "invalid_collection"),
            ApiError::InvalidId(_) => (StatusCode::BAD_REQUEST, "invalid_id"),
            ApiError::InvalidBody(_) => (StatusCode::BAD_REQUEST, "invalid_body"),
            ApiError::NotFound => (StatusCode::NOT_FOUND, "not_found"),
            ApiError::Unauthorized => (StatusCode::UNAUTHORIZED, "unauthorized"),
            ApiError::Mongo(_) => (StatusCode::INTERNAL_SERVER_ERROR, "mongo_error"),
            ApiError::Bson(_) => (StatusCode::BAD_REQUEST, "bson_error"),
            ApiError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal_error"),
        };

        if status.is_server_error() {
            tracing::error!(error = %self, "request failed");
        } else {
            tracing::debug!(error = %self, "request rejected");
        }

        let body = Json(json!({
            "error": code,
            "message": self.to_string(),
        }));
        (status, body).into_response()
    }
}

pub type ApiResult<T> = Result<T, ApiError>;
