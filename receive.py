# Docs: docs/website/content/live-receiving-email-series.md
import json
import os
import sqlite3
from flask import Flask, request
from mailkite import verify_webhook

app = Flask(__name__)
SECRET = os.environ["MAILKITE_WEBHOOK_SECRET"]
DB = os.environ.get("INBOX_DB", "inbox.sqlite")
with sqlite3.connect(DB) as db:
    db.execute("CREATE TABLE IF NOT EXISTS inbox (id TEXT PRIMARY KEY, payload TEXT NOT NULL)")

@app.post("/hooks/mailkite")
def receive():
    raw = request.get_data()
    signature = request.headers.get("x-mailkite-signature", "")
    if not verify_webhook(signature, raw, SECRET):
        return "bad signature", 401
    try:
        event = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        return "bad JSON", 400
    if not isinstance(event, dict):
        return "bad event", 400
    if event.get("type") != "email.received":
        return {"status": "ok"}
    if not isinstance(event.get("id"), str) or not event["id"]:
        return "missing id", 400
    try:
        with sqlite3.connect(DB, timeout=5) as db:
            db.execute("INSERT INTO inbox (id, payload) VALUES (?, ?) ON CONFLICT(id) DO NOTHING",
                       (event["id"], raw.decode("utf-8")))
    except sqlite3.Error:
        return "storage unavailable", 503
    return {"status": "ok"}  # The transaction has committed before this response.

if __name__ == "__main__":
    app.run(port=int(os.environ.get("PORT", "3000")))
