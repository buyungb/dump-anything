use axum::{
    extract::{Path, State},
    Json,
};
use once_cell::sync::Lazy;
use regex::Regex;
use serde::Serialize;

use crate::{
    auth,
    error::{ApiError, ApiResult},
    state::AppState,
};

static NAME_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^[A-Za-z][A-Za-z0-9_.\-]{0,119}$").unwrap());

pub fn validate_name(name: &str) -> ApiResult<()> {
    if name.starts_with("system.") || auth::is_reserved_collection(name) || !NAME_RE.is_match(name)
    {
        return Err(ApiError::InvalidCollectionName(name.to_string()));
    }
    Ok(())
}

#[derive(Serialize)]
pub struct CollectionInfo {
    pub name: String,
    pub count: u64,
}

#[derive(Serialize)]
pub struct ListResponse {
    pub collections: Vec<CollectionInfo>,
}

pub async fn list(State(state): State<AppState>) -> ApiResult<Json<ListResponse>> {
    let names = state.db.list_collection_names().await?;
    let mut collections = Vec::with_capacity(names.len());
    for name in names {
        if name.starts_with("system.") || auth::is_reserved_collection(&name) {
            continue;
        }
        let count = state
            .db
            .collection::<mongodb::bson::Document>(&name)
            .estimated_document_count()
            .await
            .unwrap_or(0);
        collections.push(CollectionInfo { name, count });
    }
    collections.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(Json(ListResponse { collections }))
}

#[derive(Serialize)]
pub struct DropResponse {
    pub dropped: bool,
    pub name: String,
}

pub async fn drop(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> ApiResult<Json<DropResponse>> {
    validate_name(&name)?;
    let existing = state.db.list_collection_names().await?;
    if !existing.contains(&name) {
        return Err(ApiError::NotFound);
    }
    state
        .db
        .collection::<mongodb::bson::Document>(&name)
        .drop()
        .await?;
    Ok(Json(DropResponse {
        dropped: true,
        name,
    }))
}
