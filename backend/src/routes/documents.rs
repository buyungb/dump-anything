use axum::{
    extract::{Path, Query, State},
    Json,
};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::bson::{doc, oid::ObjectId, Bson, DateTime as BsonDateTime, Document};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::{
    error::{ApiError, ApiResult},
    routes::collections::validate_name,
    state::AppState,
};

const DEFAULT_LIMIT: i64 = 50;
const MAX_LIMIT: i64 = 500;
const INGEST_FIELD: &str = "_ingestedAt";

#[derive(Deserialize)]
pub struct ListQuery {
    #[serde(default)]
    pub limit: Option<i64>,
    #[serde(default)]
    pub skip: Option<u64>,
    /// Optional Mongo extended-JSON filter (passed through as-is).
    #[serde(default)]
    pub q: Option<String>,
    /// Sort field; defaults to `_id`. Prefix with `-` for descending.
    #[serde(default)]
    pub sort: Option<String>,
}

#[derive(Serialize)]
pub struct InsertResponse {
    pub inserted: usize,
    pub ids: Vec<String>,
}

#[derive(Serialize)]
pub struct ListResponse {
    pub items: Vec<Value>,
    pub total: u64,
    pub limit: i64,
    pub skip: u64,
}

pub async fn insert(
    State(state): State<AppState>,
    Path(name): Path<String>,
    Json(body): Json<Value>,
) -> ApiResult<Json<InsertResponse>> {
    validate_name(&name)?;

    let mut docs: Vec<Document> = match body {
        Value::Array(arr) => arr.into_iter().map(value_to_document).collect::<Result<_, _>>()?,
        Value::Object(_) => vec![value_to_document(body)?],
        _ => {
            return Err(ApiError::InvalidBody(
                "expected a JSON object or an array of objects".into(),
            ))
        }
    };

    if docs.is_empty() {
        return Err(ApiError::InvalidBody("empty payload".into()));
    }

    let now = BsonDateTime::from_chrono(Utc::now());
    for d in docs.iter_mut() {
        d.entry(INGEST_FIELD.to_string()).or_insert(Bson::DateTime(now));
    }

    let collection = state.db.collection::<Document>(&name);
    let result = collection.insert_many(docs).await?;

    let mut ids: Vec<String> = result
        .inserted_ids
        .values()
        .map(bson_id_to_string)
        .collect();
    ids.sort();

    Ok(Json(InsertResponse {
        inserted: ids.len(),
        ids,
    }))
}

pub async fn list(
    State(state): State<AppState>,
    Path(name): Path<String>,
    Query(params): Query<ListQuery>,
) -> ApiResult<Json<ListResponse>> {
    validate_name(&name)?;

    let limit = params
        .limit
        .unwrap_or(DEFAULT_LIMIT)
        .clamp(1, MAX_LIMIT);
    let skip = params.skip.unwrap_or(0);

    let filter = match params.q.as_deref() {
        Some(q) if !q.trim().is_empty() => {
            let parsed: Value = serde_json::from_str(q)
                .map_err(|e| ApiError::InvalidBody(format!("bad q filter: {e}")))?;
            value_to_document(parsed)?
        }
        _ => Document::new(),
    };

    let sort_doc = parse_sort(params.sort.as_deref());

    let collection = state.db.collection::<Document>(&name);
    let total = collection.count_documents(filter.clone()).await.unwrap_or(0);

    let cursor = collection
        .find(filter)
        .sort(sort_doc)
        .skip(skip)
        .limit(limit)
        .await?;

    let docs: Vec<Document> = cursor.try_collect().await?;
    let items = docs.into_iter().map(document_to_json).collect();

    Ok(Json(ListResponse {
        items,
        total,
        limit,
        skip,
    }))
}

pub async fn get_one(
    State(state): State<AppState>,
    Path((name, id)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    validate_name(&name)?;
    let oid = ObjectId::parse_str(&id).map_err(|_| ApiError::InvalidId(id.clone()))?;
    let doc = state
        .db
        .collection::<Document>(&name)
        .find_one(doc! { "_id": oid })
        .await?
        .ok_or(ApiError::NotFound)?;
    Ok(Json(document_to_json(doc)))
}

pub async fn delete_one(
    State(state): State<AppState>,
    Path((name, id)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    validate_name(&name)?;
    let oid = ObjectId::parse_str(&id).map_err(|_| ApiError::InvalidId(id.clone()))?;
    let result = state
        .db
        .collection::<Document>(&name)
        .delete_one(doc! { "_id": oid })
        .await?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound);
    }
    Ok(Json(json!({ "deleted": true, "id": id })))
}

fn value_to_document(value: Value) -> ApiResult<Document> {
    if !value.is_object() {
        return Err(ApiError::InvalidBody(
            "each item must be a JSON object".into(),
        ));
    }
    let bson = mongodb::bson::to_bson(&value)?;
    match bson {
        Bson::Document(d) => Ok(d),
        _ => Err(ApiError::InvalidBody(
            "could not convert payload to BSON document".into(),
        )),
    }
}

fn document_to_json(doc: Document) -> Value {
    Bson::Document(doc).into_relaxed_extjson()
}

fn bson_id_to_string(id: &Bson) -> String {
    match id {
        Bson::ObjectId(oid) => oid.to_hex(),
        other => other.to_string(),
    }
}

fn parse_sort(input: Option<&str>) -> Document {
    let mut sort = Document::new();
    match input {
        None => {
            sort.insert("_id", -1);
        }
        Some(raw) => {
            for part in raw.split(',').map(str::trim).filter(|s| !s.is_empty()) {
                let (field, dir) = if let Some(stripped) = part.strip_prefix('-') {
                    (stripped, -1)
                } else if let Some(stripped) = part.strip_prefix('+') {
                    (stripped, 1)
                } else {
                    (part, 1)
                };
                sort.insert(field.to_string(), dir);
            }
            if sort.is_empty() {
                sort.insert("_id", -1);
            }
        }
    }
    sort
}
