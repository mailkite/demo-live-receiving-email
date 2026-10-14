# Docs: docs/website/content/live-receiving-email-series.md
require "sinatra"
require "json"
require "mailkite"
SECRET = ENV.fetch("MAILKITE_WEBHOOK_SECRET")
abort "Set MAILKITE_WEBHOOK_SECRET" if SECRET.strip.empty?
CLIENT = Mailkite::Client.new("unused-for-verify")
set :port, ENV.fetch("PORT", "3000").to_i
set :host_authorization, { permitted_hosts: ["localhost", "127.0.0.1", ENV.fetch("WEBHOOK_HOST", "localhost")] }

post "/hooks/mailkite" do
  raw = request.body.read
  halt 401 unless CLIENT.verifyWebhook(request.env["HTTP_X_MAILKITE_SIGNATURE"] || "", raw, SECRET)
  begin
    event = JSON.parse(raw)
  rescue JSON::ParserError
    halt 400
  end
  halt 400 unless event.is_a?(Hash) && event["type"].is_a?(String) && !event["type"].strip.empty?
  if event["type"] == "email.received"
    halt 400 unless event["id"].is_a?(String) && !event["id"].strip.empty?
    puts "received #{event['id']}"
  end
  # Demonstration only: persist/enqueue and deduplicate before acknowledging in production.
  content_type :json
  Mailkite.reply_ok
end
