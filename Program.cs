// Docs: docs/website/content/live-receiving-email-series.md
using System.Text;
using System.Text.Json;
using MailKite;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
var secret = Environment.GetEnvironmentVariable("MAILKITE_WEBHOOK_SECRET")
    ?? throw new InvalidOperationException("Set MAILKITE_WEBHOOK_SECRET");
if (string.IsNullOrWhiteSpace(secret)) throw new InvalidOperationException("Set MAILKITE_WEBHOOK_SECRET");
app.MapPost("/hooks/mailkite", async (HttpRequest request) => {
    using var buffer = new MemoryStream();
    await request.Body.CopyToAsync(buffer);
    var raw = Encoding.UTF8.GetString(buffer.ToArray());
    var signature = request.Headers["x-mailkite-signature"].ToString();
    if (!MailKiteClient.VerifyWebhook(signature, raw, secret)) return Results.Unauthorized();
    try {
        using var json = JsonDocument.Parse(raw);
        var item = json.RootElement;
        if (item.ValueKind != JsonValueKind.Object || !item.TryGetProperty("type", out var type)
            || type.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(type.GetString()))
            return Results.BadRequest();
        if (type.GetString() == "email.received") {
            if (!item.TryGetProperty("id", out var id) || id.ValueKind != JsonValueKind.String
                || string.IsNullOrWhiteSpace(id.GetString())) return Results.BadRequest();
            Console.WriteLine("received " + id.GetString());
        }
        // Demonstration only: persist/enqueue and deduplicate before production acknowledgement.
        return Results.Ok(new { status = "ok" });
    } catch (JsonException) { return Results.BadRequest(); }
});
app.Run();
