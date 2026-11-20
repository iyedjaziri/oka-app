// Petit serveur statique pour le développement : http://localhost:8000 (app) et /admin/ (espace pro).
import http from "http";
import fs from "fs";
import path from "path";

const racine = path.resolve(new URL("../app", import.meta.url).pathname);
const port = Number(process.env.PORT || 8000);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json" };

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(racine, path.normalize(p));
  if (!f.startsWith(racine) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end("Introuvable"); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream", "cache-control": "no-cache" });
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log(`OKA : http://localhost:${port}/  ·  espace pro : http://localhost:${port}/admin/`));
