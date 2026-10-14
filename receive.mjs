// Docs: docs/website/content/live-receiving-email-series.md
import express from "express";
import { DatabaseSync } from "node:sqlite";
import { MailKite } from "mailkite";

const secret = process.env.MAILKITE_WEBHOOK_SECRET;
if (!secret) throw new Error("Set MAILKITE_WEBHOOK_SECRET");
const db = new DatabaseSync(process.env.INBOX_DB || "inbox.sqlite");
db.exec("PRAGMA busy_timeout = 5000");
db.exec("CREATE TABLE IF NOT EXISTS inbox (id TEXT PRIMARY KEY, payload TEXT NOT NULL)");
const insert = db.prepare("INSERT INTO inbox (id, payload) VALUES (?, ?) ON CONFLICT(id) DO NOTHING");
const app = express();
app.post("/hooks/mailkite", express.raw({ type: "application/json", limit: "10mb" }), (req, res) => {
  if (!Buffer.isBuffer(req.body) || !MailKite.verifyWebhook(req.get("x-mailkite-signature") || "", req.body, secret)) {
    return res.sendStatus(401);
  }
  let event;
  try { event = JSON.parse(req.body.toString("utf8")); }
  catch { return res.sendStatus(400); }
  if (!event || typeof event !== "object" || Array.isArray(event)) return res.sendStatus(400);
  if (event.type === "email.received") {
    if (typeof event.id !== "string" || !event.id) return res.sendStatus(400);
    try { insert.run(event.id, req.body.toString("utf8")); }
    catch { return res.sendStatus(503); }
  }
  return res.json({ status: "ok" });
});
app.listen(Number(process.env.PORT || 3000));
