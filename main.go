// Docs: docs/website/content/live-receiving-email-series.md
package main

import (
    "encoding/json"
    "io"
    "log"
    "net/http"
    "os"
    "strings"
    mailkite "github.com/mailkite/mailkite-go"
)

func main() {
    secret := os.Getenv("MAILKITE_WEBHOOK_SECRET")
    if strings.TrimSpace(secret) == "" { log.Fatal("Set MAILKITE_WEBHOOK_SECRET") }
    mk := mailkite.New("unused-for-verify")
    http.HandleFunc("/hooks/mailkite", func(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodPost { w.WriteHeader(405); return }
        raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 10 << 20))
        if err != nil { w.WriteHeader(413); return }
        if !mk.VerifyWebhook(r.Header.Get("x-mailkite-signature"), string(raw), secret) {
            w.WriteHeader(401); return
        }
        var event struct {
            ID string `json:"id"`
            Type string `json:"type"`
            From struct { Address string `json:"address"` } `json:"from"`
            Subject *string `json:"subject"`
        }
        if json.Unmarshal(raw, &event) != nil || strings.TrimSpace(event.Type) == "" { w.WriteHeader(400); return }
        if event.Type == "email.received" {
            if strings.TrimSpace(event.ID) == "" { w.WriteHeader(400); return }
            log.Printf("received %s", event.ID)
        }
        // Demonstration only: persist/enqueue and deduplicate before acknowledging in production.
        w.Header().Set("Content-Type", "application/json")
        _, _ = io.WriteString(w, mk.ReplyOk())
    })
    port := os.Getenv("PORT")
    if port == "" { port = "3000" }
    log.Fatal(http.ListenAndServe(":" + port, nil))
}
