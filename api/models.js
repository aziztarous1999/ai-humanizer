import { fetchModelList } from "../src/lib/llm.js";
import { findProvider, json, resolveKey } from "./_lib/http.js";

// Lists the models a provider offers right now (OpenRouter: free ones only).
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request body." }, 400); }

  const provider = findProvider(body.provider);
  if (!provider) return json({ error: "Unknown provider." }, 400);

  // OpenRouter's model list is public, so it works without any key.
  const key = resolveKey(request, provider, body.apiKey, { optional: provider.id === "openrouter" });
  if (key.error) return key.error;

  try {
    const models = await fetchModelList({ ...provider, apiKey: key.apiKey, freeOnly: provider.id === "openrouter" });
    return json({ models });
  } catch (err) {
    return json({ error: err.message || "Couldn't load models." }, err.status || 502);
  }
}
