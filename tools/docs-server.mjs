import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathInside, parseOptions } from "./lib/shared.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".md": "text/plain; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
export function createDocsServer(directory = join(root, "docs")) {
  return createServer(async (request, response) => {
    try {
      if (!["GET", "HEAD"].includes(request.method)) { response.writeHead(405); response.end(); return; }
      const url = new URL(request.url, "http://localhost");
      const pathname = decodeURIComponent(url.pathname === "/" || url.pathname === "/site/" ? "/site/index.html" : url.pathname);
      const path = pathInside(directory, `.${pathname}`);
      if (!(await stat(path)).isFile() || !types[extname(path)]) throw new Error("not found");
      response.writeHead(200, { "Content-Type": types[extname(path)], "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
      response.end(request.method === "HEAD" ? undefined : await readFile(path));
    } catch { response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); response.end("Not found"); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = parseOptions(process.argv.slice(2));
  const port = Number(options.port ?? 4173);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Choose a port from 1024 to 65535.");
  createDocsServer().listen(port, "127.0.0.1", () => console.log(`Documentation: http://127.0.0.1:${port}/site/ (local-only; Ctrl+C to stop)`));
}
