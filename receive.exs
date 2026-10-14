# Docs: docs/website/content/live-receiving-email-series.md
Mix.install([{:mailkite, "~> 0.13"}, {:plug_cowboy, "~> 2.7"}, {:jason, "~> 1.4"}])

defmodule ReceiveEmail do
  use Plug.Router
  plug :match
  plug :dispatch

  post "/hooks/mailkite" do
    # No Plug.Parsers here: read the signed raw bytes before decoding JSON.
    case Plug.Conn.read_body(conn, length: 10_000_000) do
      {:ok, raw, conn} ->
        signature = List.first(get_req_header(conn, "x-mailkite-signature")) || ""
        secret = System.fetch_env!("MAILKITE_WEBHOOK_SECRET")
        if MailKite.Webhook.verify_webhook(signature, raw, secret) do
          case Jason.decode(raw) do
            {:ok, %{"type" => type} = event} when is_binary(type) ->
              id = event["id"]
              if String.trim(type) == "" or
                   (type == "email.received" and (not is_binary(id) or String.trim(id) == "")) do
                send_resp(conn, 400, "invalid event")
              else
                if type == "email.received", do: IO.puts("received #{id}")
                # Demonstration only: persist/enqueue and deduplicate before production acknowledgement.
                conn
                |> put_resp_content_type("application/json")
                |> send_resp(200, MailKite.Webhook.reply_ok())
              end
            _ -> send_resp(conn, 400, "bad JSON")
          end
        else
          send_resp(conn, 401, "bad signature")
        end
      {:more, _, conn} -> send_resp(conn, 413, "body too large")
      {:error, _} -> send_resp(conn, 400, "body read failed")
    end
  end
  match _, do: send_resp(conn, 404, "not found")
end

if String.trim(System.fetch_env!("MAILKITE_WEBHOOK_SECRET")) == "",
  do: raise("Set MAILKITE_WEBHOOK_SECRET")
port = String.to_integer(System.get_env("PORT", "3000"))
{:ok, _} = Plug.Cowboy.http(ReceiveEmail, [], port: port)
Process.sleep(:infinity)
