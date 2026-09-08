import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createOrders } from "./model.mjs";

// Loopback fixture. Never trust this mock bearer value as a Databricks credential.
export function createFixtureServer() {
  const write = createOrders();
  return createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(body));
    };
    if (req.method === "GET" && req.url === "/api/health") return send(200, { fixtureOnly: true });
    if (req.url !== "/api/orders") return send(404, { error: "not_found" });
    if (req.method !== "POST") return send(405, { error: "method_not_allowed" });
    if (req.headers.authorization !== "Bearer fixture-only") return send(401, { error: "fixture_auth_required" });
    if (req.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json") return send(415, { error: "json_required" });
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 16384) return send(413, { error: "payload_too_large" });
        chunks.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
      catch { return send(400, { error: "invalid_json" }); }
      const result = write(req.headers["idempotency-key"], body);
      return send(result.status, result.body);
    } catch { if (!res.headersSent) send(400, { error: "invalid_request" }); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.env.DATABRICKS_APP_PORT) throw new Error("Fixture server must not run as a deployed Databricks App.");
  const server = createFixtureServer();
  server.listen(0, "127.0.0.1", () => console.log("Fixture only: http://127.0.0.1:" + server.address().port));
}
