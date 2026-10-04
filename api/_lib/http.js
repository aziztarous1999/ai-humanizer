import { PROVIDERS } from "../../src/lib/catalog.js";

export const json = (data, status = 200) => Response.json(data, { status });

export const findProvider = (id) => PROVIDERS.find((p) => p.id === id);

// Picks the key for a request: the visitor's own key, or the server's key from
// the environment. Server keys can be protected with an ACCESS_CODE env var.
// Returns { apiKey } or { error: Response }.
export function resolveKey(request, provider, userKey, { optional = false } = {}) {
  const own = typeof userKey === "string" ? userKey.trim() : "";
  if (own) return { apiKey: own };

  const server = process.env[provider.envKey];
  if (!server) {
    if (optional) return { apiKey: "" };
    return { error: json({ error: `No ${provider.name} API key. Add your free key in Models & keys.` }, 401) };
  }
  const code = process.env.ACCESS_CODE;
  if (code && request.headers.get("x-access-code") !== code) {
    return { error: json({ error: "This site's built-in keys need an access code. Enter it in Models & keys, or add your own free API key." }, 401) };
  }
  return { apiKey: server };
}
