import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";

const rawPort = process.env.PORT ?? "5173";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

// Serve library-data JSON files directly from disk to work around a Vite 7
// dev-server issue where public-dir files beyond its internal scan limit get
// the SPA fallback instead of the static file.
function libraryDataPlugin() {
  return {
    name: "serve-library-data",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        const stripped = url.split("?")[0];
        if (!stripped.startsWith("/library-data/") || !stripped.endsWith(".json")) {
          return next();
        }
        const filePath = path.join(
          import.meta.dirname,
          "public",
          decodeURIComponent(stripped),
        );
        fs.readFile(filePath, (err, data) => {
          if (err) return next();
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(data);
        });
      });
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss(), libraryDataPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
  },
  optimizeDeps: {
    include: ["@tanstack/react-query"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
