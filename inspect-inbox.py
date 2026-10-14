# Docs: docs/website/content/live-receiving-email-series.md
# python3 inspect-inbox.py [inbox.sqlite] — run locally, never expose as a web route.
import json
import sqlite3
import sys

db = sqlite3.connect(sys.argv[1] if len(sys.argv) > 1 else "inbox.sqlite")
for message_id, raw in db.execute("SELECT id, payload FROM inbox ORDER BY rowid DESC LIMIT 10"):
    event = json.loads(raw)
    print(message_id, event.get("subject"))
    print(event.get("text") or event.get("textFromHtml") or event.get("html") or "(no body)")
    print()
db.close()
