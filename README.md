# Live email receivers

SDK-first companion examples for [MailKite's receiving guides](https://mailkite.dev/guides#receive-by-language), [Gmail forwarding](https://mailkite.dev/guides/receive-gmail-email-live) and [iCloud Mail forwarding](https://mailkite.dev/guides/receive-icloud-email-live). Node.js, Python and PHP store one SQLite row per message before acknowledging. Ruby, Go, Java, C#, Rust and Elixir demonstrate verification and logging; add a durable inbox before production use.

[Deploy the Node receiver on Render](https://render.com/deploy?repo=https://github.com/mailkite/demo-live-receiving-email)

The Render blueprint uses paid compute and a persistent disk; review its pricing before applying. Supply your exact route's webhook secret in the deployment form, then point the route at the new service's `/hooks/mailkite`. Local tests require no hosting purchase. Browser WebContainers may not support node:sqlite, so use local Node 22.13+ for the SQLite-backed receiver and tests.

## First run: Node, Python or PHP

Clone this repository and install dependencies for the language you are testing:

- Node: `npm install`, then `node receive.mjs` (Node 22.13+).
- Python: create a virtual environment, `python -m pip install -r requirements.txt`, then `python receive.py`.
- PHP: `composer install`, then `php -S 127.0.0.1:3000 receive.php` (PHP 8.1+ and PDO SQLite).

Set `MAILKITE_WEBHOOK_SECRET` in the process environment. Use a made-up local value for synthetic tests, or the exact route's real secret for a configured webhook. Verification needs no API key. Set `INBOX_DB` to a persistent database location outside your public document root in production. Do not commit credentials or mailbox databases.

In another terminal with the same secret set, run `node check.mjs http://127.0.0.1:3000/hooks/mailkite`. This sends synthetic HTTP requests only; it does not send email. Run `python3 inspect-inbox.py inbox.sqlite` to read accepted messages locally, including a Gmail forwarding confirmation.

## Other runtimes

Use one fresh project directory per ecosystem. See the corresponding guide for copy-paste installation steps:

| Language | Entry | Guide |
|---|---|---|
| Ruby | `receive.rb` | [Ruby](https://mailkite.dev/guides/receive-email-in-ruby) |
| Go | `main.go` | [Go](https://mailkite.dev/guides/receive-email-in-go) |
| Java | `ReceiveEmail.java` + `pom.xml` | [Java](https://mailkite.dev/guides/receive-email-in-java) |
| C# | `Program.cs` | [C#](https://mailkite.dev/guides/receive-email-in-csharp) |
| Rust | `main.rs` | [Rust](https://mailkite.dev/guides/receive-email-in-rust) |
| Elixir | `receive.exs` | [Elixir](https://mailkite.dev/guides/receive-email-in-elixir) |

Each receiver verifies the raw body before parsing. The JSON acknowledgement also works with strict ack mode. Logging is not durable acceptance: save or enqueue using a unique event id before responding in production, then process attachments and other slow work in a worker.

## Tests

After installing dependencies, `node verify-storage.mjs node`, `node verify-storage.mjs python` and `node verify-storage.mjs php` exercise real HTTP handlers, Unicode persistence, duplicates, tampered and stale signatures, malformed JSON and a locked-database failure. `PYTHON` can select a virtualenv interpreter. CI runs all three SQLite receiver tests against published packages. The basic `check.mjs` can exercise any of the nine running receivers; 200 on a duplicate is protocol compatibility, not proof of deduplicated storage in the six logging demonstrations.

## Receiving mail

Create and verify a receiving domain or hosted subdomain, create an exact-address webhook route, supply its signing secret and expose the receiver over HTTPS. Send a real message to that address to verify routing. The dashboard's domain catch-all test does not exercise exact-address routes.

For Gmail, confirm the destination through Google's verification message, then enable forwarding and save settings. For iCloud Mail, use iCloud.com's server-side Mail Forwarding settings. This path receives new mail copies; it does not import history, mirror read state or authorize sending as the original mailbox.

License: MIT.
