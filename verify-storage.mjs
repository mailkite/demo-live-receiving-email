// Docs: docs/website/content/live-receiving-email-series.md
// Integration test of the three SQLite receivers, using synthetic requests only.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";

const runtime = process.argv[2] || "node";
const dir = await mkdtemp(join(process.env.DEMO_TEST_TMP || tmpdir(), "receive-test-"));
const database = join(dir, "inbox.sqlite");
const secret = "public-synthetic-test-secret-not-a-live-credential";
const socket = createServer();
await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const commands = {
  node: [process.execPath, ["receive.mjs"]],
  python: [process.env.PYTHON || "python3", ["receive.py"]],
  php: ["php", ["-S", `127.0.0.1:${port}`, "receive.php"]],
};
assert.ok(commands[runtime], "choose node, python or php");
const [command, args] = commands[runtime];
const child = spawn(command, args, { cwd: new URL(".", import.meta.url), env: { ...process.env, MAILKITE_WEBHOOK_SECRET: secret, INBOX_DB: database, PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
child.stdout.on("data", (chunk) => { output += chunk; });
child.stderr.on("data", (chunk) => { output += chunk; });
const url = `http://127.0.0.1:${port}/hooks/mailkite`;
function signature(body, timestamp = Date.now()) {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}
async function post(body, expected, header = signature(body)) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-mailkite-signature": header }, body });
  assert.equal(response.status, expected);
  if (expected === 200) assert.equal((await response.json()).status, "ok");
}
let db;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(output);
    try { await fetch(url); ready = true; break; } catch { await delay(100); }
  }
  assert.ok(ready, output);
  const raw = JSON.stringify({ id: "msg_00000000000040008000000000000001", type: "email.received", subject: "Café — Unicode", from: { address: "test-source@mailkite.dev", name: null }, to: [{ address: "test-dest@mailkite.dev", name: null }], text: null, textFromHtml: "fallback", html: "<p>fallback</p>", attachments: [] });
  await post(raw, 200);
  await post(raw, 200);
  await post(raw + " ", 401, signature(raw));
  await post(raw, 401, "");
  await post(raw, 401, signature(raw, Date.now() - 600_000));
  await post("{", 400);
  await post("null", 400);
  await post(JSON.stringify({ type: "email.received" }), 400);
  await post(JSON.stringify({ type: "email.sent", id: "unused" }), 200);
  db = new DatabaseSync(database);
  assert.equal(db.prepare("SELECT count(*) AS n FROM inbox").get().n, 1, "retry creates no second row");
  assert.equal(db.prepare("SELECT payload FROM inbox").get().payload, raw, "raw Unicode payload persisted before acknowledgement");
  db.exec("BEGIN EXCLUSIVE");
  try { await post(JSON.stringify({ type: "email.received", id: "msg_00000000000040008000000000000002" }), 503); }
  finally { db.exec("ROLLBACK"); }
  assert.equal(db.prepare("SELECT count(*) AS n FROM inbox").get().n, 1, "storage failure does not create a phantom accepted row");
  console.log(`PASS ${runtime}: valid/duplicate, strict ack, tamper, missing/stale signature, bad JSON, missing id, irrelevant event, persisted raw bytes, storage-failure 503`);
} finally {
  db?.close();
  child.kill("SIGTERM");
  await delay(200);
  await rm(dir, { recursive: true, force: true });
}
