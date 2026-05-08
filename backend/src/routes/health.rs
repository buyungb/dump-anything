use axum::{extract::State, Json};
use serde_json::{json, Value};

use crate::{error::ApiResult, state::AppState};

pub async fn health(State(state): State<AppState>) -> ApiResult<Json<Value>> {
    let ok = state
        .db
        .run_command(mongodb::bson::doc! { "ping": 1 })
        .await
        .is_ok();
    Ok(Json(json!({
        "status": if ok { "ok" } else { "degraded" },
        "database": state.db.name(),
        "mongo": ok,
    })))
}
