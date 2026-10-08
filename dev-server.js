/**
 * LOCAL PREVIEW SERVER
 *
 * This tiny server exists only so `npm run dev` can preview the static website.
 * It uses Node.js built-in modules and requires no packages or npm install.
 * GitHub Pages does not use this file when publishing the website.
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const HOST = "127.0.0.1";
const START_PORT = Number(process.env.PORT) || 8080;
const PUBLIC_ROOT = __dirname;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

function resolveRequest(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, `http://${HOST}`).pathname);
  const requested = pathname === "/" ? "/index.html" : pathname;
  const resolved = path.resolve(PUBLIC_ROOT, `.${requested}`);

  // Prevent requests from reading anything outside the Snappi Live folder.
  if (!resolved.startsWith(PUBLIC_ROOT + path.sep)) return null;
  return resolved;
}

function createServer(port) {
  const server = http.createServer((request, response) => {
    let filePath = resolveRequest(request.url || "/");
    if (!filePath) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    if (!fs.existsSync(filePath)) {
      filePath = path.join(PUBLIC_ROOT, "404.html");
      response.statusCode = 404;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.setHeader("Content-Type", contentTypes[extension] || "application/octet-stream");
    response.setHeader("Cache-Control", "no-store");
    fs.createReadStream(filePath).pipe(response);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && port < START_PORT + 10) {
      createServer(port + 1);
      return;
    }
    console.error(`Snappi preview could not start: ${error.message}`);
    process.exitCode = 1;
  });

  server.listen(port, HOST, () => {
    console.log(`Snappi Live is available at http://${HOST}:${port}`);
    console.log("Press Control+C to stop the preview server.");
  });
}

createServer(START_PORT);
