import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Serves the Vercel functions in /api during `npm run dev`, so local
// development behaves like the deployed site (no `vercel dev` needed).
function vercelApiDev() {
  return {
    name: "vercel-api-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://localhost");
        const match = url.pathname.match(/^\/api\/([a-z][\w-]*)$/i);
        if (!match) return next();

        let mod;
        try {
          mod = await server.ssrLoadModule(`/api/${match[1]}.js`);
        } catch {
          res.statusCode = 404;
          return res.end(JSON.stringify({ error: "Not found" }));
        }
        const handler = mod[req.method];
        if (!handler) {
          res.statusCode = 405;
          return res.end();
        }

        const abort = new AbortController();
        res.on("close", () => { if (!res.writableEnded) abort.abort(); });
        try {
          const chunks = [];
          for await (const c of req) chunks.push(c);
          const request = new Request(url, {
            method: req.method,
            headers: {
              "content-type": req.headers["content-type"] || "",
              "x-access-code": req.headers["x-access-code"] || "",
            },
            body: chunks.length ? Buffer.concat(chunks) : undefined,
            signal: abort.signal,
          });
          const response = await handler(request);
          if (abort.signal.aborted) return;
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make .env / .env.local keys visible to the /api functions in dev.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return { plugins: [react(), vercelApiDev()] };
});
