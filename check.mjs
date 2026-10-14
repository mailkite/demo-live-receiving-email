// Docs: docs/website/content/live-receiving-email-series.md
// Exercise a RUNNING receiver with a synthetic signed event; never sends email.
// node check.mjs http://127.0.0.1:3000/hooks/mailkite
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
const url = process.argv[2] || "http://127.0.0.1:3000/hooks/mailkite";
const secret = process.env.MAILKITE_WEBHOOK_SECRET;
if (!secret) throw new Error("Set MAILKITE_WEBHOOK_SECRET to the receiver's secret");
const event = {
  id: "msg_00000000000040008000000000000001", type: "email.received",
  from: { address: "test-live-source@mailkite.dev", name: "Test" },
  to: [{ address: "test-live-destination@mailkite.dev", name: null }],
  subject: "Synthetic test — café", text: "Local test only", html: null,
  textFromHtml: null, threadId: null, attachments: [],
};
const raw = JSON.stringify(event);
const timestamp = String(Date.now());
const signature = `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")}`;
for (const [label, payload, header, expected] of [
  ["valid Unicode event", raw, signature, 200],
  ["duplicate id", raw, signature, 200],
  ["tampered body", raw + " ", signature, 401],
  ["missing signature", raw, "", 401],
]) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-mailkite-signature": header }, body: payload });
  assert.equal(response.status, expected, label);
  if (expected === 200) assert.equal((await response.json()).status, "ok", `${label}: strict acknowledgement`);
  console.log(`PASS ${label}: ${response.status}`);
}
const malformed = "{";
const malformedSignature = `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${malformed}`).digest("hex")}`;
const badJson = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-mailkite-signature": malformedSignature }, body: malformed });
assert.equal(badJson.status, 400, "signed malformed JSON");
console.log("PASS signed malformed JSON: 400");
// 200 on duplicate is protocol compatibility, not proof of a unique database row.
// SQLite receivers: inspect the inbox separately with inspect-inbox.py.
