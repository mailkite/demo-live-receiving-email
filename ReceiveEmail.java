// Docs: docs/website/content/live-receiving-email-series.md
import com.sun.net.httpserver.HttpServer;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.mailkite.MailKite;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;

public class ReceiveEmail {
  public static void main(String[] args) throws Exception {
    String secret = System.getenv("MAILKITE_WEBHOOK_SECRET");
    if (secret == null || secret.isBlank()) throw new IllegalStateException("Set MAILKITE_WEBHOOK_SECRET");
    MailKite mk = new MailKite("unused-for-verify");
    ObjectMapper json = new ObjectMapper().enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "3000"));
    HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
    server.createContext("/hooks/mailkite", ex -> {
      int status = 200;
      String result = mk.replyOk();
      if (!"POST".equals(ex.getRequestMethod())) { status = 405; }
      else {
        String raw = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        if (!mk.verifyWebhook(ex.getRequestHeaders().getFirst("x-mailkite-signature"), raw, secret)) {
          status = 401;
        } else {
          try {
            Object parsed = json.readValue(raw, Object.class);
            if (!(parsed instanceof Map<?, ?> event)) { status = 400; }
            else {
              if (!(event.get("type") instanceof String type) || type.isBlank()) { status = 400; }
              else if ("email.received".equals(type)) {
                if (!(event.get("id") instanceof String id) || id.isBlank()) { status = 400; }
                else { System.out.println("received " + id); }
              }
              // Demonstration only: persist/enqueue and deduplicate before production acknowledgement.
            }
          } catch (JsonProcessingException e) { status = 400; }
        }
      }
      if (status != 200) result = "{\"error\":\"invalid request\"}";
      byte[] body = result.getBytes(StandardCharsets.UTF_8);
      ex.getResponseHeaders().set("Content-Type", "application/json");
      ex.sendResponseHeaders(status, body.length);
      try (var out = ex.getResponseBody()) { out.write(body); }
    });
    server.start();
  }
}
