const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "artifacts/ibn-al-qayyim/dist/public");
const port = 5174;

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function sendFile(file, res) {
  fs.readFile(file, (error, body) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
    });
    res.end(body);
  });
}

http
  .createServer((req, res) => {
    const rawUrl = (req.url || "/").split("?")[0];
    let requestPath;
    try {
      requestPath = decodeURIComponent(rawUrl);
    } catch {
      requestPath = "/";
    }

    let file = path.join(root, requestPath === "/" ? "index.html" : requestPath);
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) {
        file = path.join(root, "index.html");
      }
      sendFile(file, res);
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Static site running at http://localhost:${port}/`);
  });
