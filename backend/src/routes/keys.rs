use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::{
    auth::{self, ApiKeyView},
    error::{ApiError, ApiResult},
    state::AppState,
};

#[derive(Serialize)]
pub struct ListResponse {
    pub keys: Vec<ApiKeyView>,
}

pub async fn list(State(state): State<AppState>) -> ApiResult<Json<ListResponse>> {
    let keys = auth::list_keys(&state).await?;
    Ok(Json(ListResponse { keys }))
}

#[derive(Deserialize)]
pub struct CreateRequest {
    pub label: Option<String>,
}

#[derive(Serialize)]
pub struct CreateResponse {
    /// The plaintext key. Shown ONCE; clients must save it now.
    pub key: String,
    /// The metadata-only view of the newly inserted record.
    #[serde(flatten)]
    pub view: ApiKeyView,
}

pub async fn create(
    State(state): State<AppState>,
    Json(body): Json<CreateRequest>,
) -> ApiResult<Json<CreateResponse>> {
    let label = body
        .label
        .as_deref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .unwrap_or("dashboard")
        .to_string();
    if label.len() > 80 {
        return Err(ApiError::InvalidBody(
            "label must be 80 characters or fewer".into(),
        ));
    }
    let plain = auth::generate_key();
    let record = auth::insert_key(&state, &plain, &label).await?;
    Ok(Json(CreateResponse {
        key: plain,
        view: record.into(),
    }))
}

#[derive(Serialize)]
pub struct RevokeResponse {
    pub revoked: bool,
    pub id: String,
}

pub async fn revoke(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<RevokeResponse>> {
    let oid = auth::parse_object_id(&id)?;
    let revoked = auth::revoke_key(&state, &oid).await?;
    if !revoked {
        return Err(ApiError::NotFound);
    }
    Ok(Json(RevokeResponse {
        revoked: true,
        id: oid.to_hex(),
    }))
}
