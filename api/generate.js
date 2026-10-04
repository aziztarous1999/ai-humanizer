import { callModel } from "../src/lib/llm.js";
import { findProvider, json, resolveKey } from "./_lib/http.js";

const MAX_CHARS = 60_000; // keeps one request well under free-tier context limits

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request body." }, 400); }

  const provider = findProvider(body.provider);
  if (!provider) return json({ error: "Unknown provider." }, 400);
  const { model, system, user } = body;
  if (typeof model !== "string" || !model || typeof system !== "string" || typeof user !== "string") {
    return json({ error: "Missing model, system or user text." }, 400);
  }
  if (system.length + user.length > MAX_CHARS) return json({ error: "Text is too long for one request." }, 413);

  const key = resolveKey(request, provider, body.apiKey);
  if (key.error) return key.error;

  const temperature = Math.min(Math.max(Number(body.temperature) || 0.9, 0), 2);
  try {
    const text = await callModel({ ...provider, apiKey: key.apiKey, model, system, user, temperature, signal: request.signal });
    return json({ text });
  } catch (err) {
    if (err?.name === "AbortError") return json({ error: "Stopped." }, 499);
    return json({ error: err.message || "Request failed.", retryAfter: err.retryAfter || 0 }, err.status || 502);
  }
}
