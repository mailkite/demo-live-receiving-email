<?php
// Docs: docs/website/content/live-receiving-email-series.md
require __DIR__ . '/vendor/autoload.php';
$secret = getenv('MAILKITE_WEBHOOK_SECRET');
if (!$secret) { throw new RuntimeException('Set MAILKITE_WEBHOOK_SECRET'); }
if (parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) !== '/hooks/mailkite') {
    http_response_code(404); exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }
$mk = new \MailKite\Client('unused-for-verify');
$raw = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_MAILKITE_SIGNATURE'] ?? '';
if (!$mk->verifyWebhook($signature, $raw, $secret)) {
    http_response_code(401); exit;
}
try { $event = json_decode($raw, true, 512, JSON_THROW_ON_ERROR); }
catch (JsonException $e) { http_response_code(400); exit; }
if (!is_array($event)) { http_response_code(400); exit; }
if (($event['type'] ?? '') === 'email.received') {
    if (!is_string($event['id'] ?? null) || $event['id'] === '') {
        http_response_code(400); exit;
    }
    try {
        $db = new PDO('sqlite:' . (getenv('INBOX_DB') ?: __DIR__ . '/inbox.sqlite'));
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $db->exec('PRAGMA busy_timeout = 5000');
        $db->exec('CREATE TABLE IF NOT EXISTS inbox (id TEXT PRIMARY KEY, payload TEXT NOT NULL)');
        $insert = $db->prepare('INSERT INTO inbox (id, payload) VALUES (?, ?) ON CONFLICT(id) DO NOTHING');
        $insert->execute([$event['id'], $raw]);
    } catch (PDOException $e) { http_response_code(503); exit; }
}
header('Content-Type: application/json');
echo $mk->replyOk(); // SQLite's autocommit write has finished before we acknowledge.
