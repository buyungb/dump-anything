use mongodb::{options::ClientOptions, Client, Database};

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
}

impl AppState {
    pub async fn connect(uri: &str, database_name: &str) -> anyhow::Result<Self> {
        let mut options = ClientOptions::parse(uri).await?;
        options.app_name = Some("dump-anything-api".to_string());
        let client = Client::with_options(options)?;
        client
            .database("admin")
            .run_command(mongodb::bson::doc! { "ping": 1 })
            .await?;
        let db = client.database(database_name);
        Ok(Self { db })
    }
}
