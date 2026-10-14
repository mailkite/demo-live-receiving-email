// Docs: docs/website/content/live-receiving-email-series.md
use axum::{body::Bytes, http::{header, HeaderMap, StatusCode}, response::{IntoResponse, Response}, routing::post, Router};
use serde_json::Value;

async fn receive(headers: HeaderMap, body: Bytes) -> Response {
    let signature = headers.get("x-mailkite-signature").and_then(|v| v.to_str().ok()).unwrap_or("");
    let raw = match std::str::from_utf8(&body) { Ok(raw) => raw, Err(_) => return StatusCode::BAD_REQUEST.into_response() };
    let secret = std::env::var("MAILKITE_WEBHOOK_SECRET").expect("Set MAILKITE_WEBHOOK_SECRET");
    if !mailkite::verify_webhook(signature, raw, &secret) { return StatusCode::UNAUTHORIZED.into_response(); }
    let event: Value = match serde_json::from_str(raw) { Ok(v) => v, Err(_) => return StatusCode::BAD_REQUEST.into_response() };
    let kind = match event.get("type").and_then(Value::as_str) {
        Some(kind) if !kind.trim().is_empty() => kind,
        _ => return StatusCode::BAD_REQUEST.into_response(),
    };
    if kind == "email.received" {
        let id = match event.get("id").and_then(Value::as_str) {
            Some(id) if !id.trim().is_empty() => id,
            _ => return StatusCode::BAD_REQUEST.into_response(),
        };
        println!("received {id}");
    }
    // Demonstration only: persist/enqueue and deduplicate before production acknowledgement.
    ([(header::CONTENT_TYPE, "application/json")], mailkite::reply_ok()).into_response()
}

#[tokio::main]
async fn main() {
    let secret = std::env::var("MAILKITE_WEBHOOK_SECRET").expect("Set MAILKITE_WEBHOOK_SECRET");
    assert!(!secret.trim().is_empty(), "Set MAILKITE_WEBHOOK_SECRET");
    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".into());
    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{port}")).await.unwrap();
    axum::serve(listener, Router::new().route("/hooks/mailkite", post(receive))).await.unwrap();
}
