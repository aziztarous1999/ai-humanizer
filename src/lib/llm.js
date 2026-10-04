// Raw calls to model providers. Used by the Vercel functions (built-in
// providers) and directly by the browser (custom providers), so it relies on
// fetch only.

export class LLMError extends Error {
  constructor(message, status = 0, retryAfter = 0) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function callModel({ type, baseUrl, apiKey, model, system, user, temperature, signal }) {
  const args = { baseUrl: trimSlash(baseUrl), apiKey, model, system, user, temperature, signal };
  return type === "gemini" ? callGemini(args) : callOpenAI(args);
}

async function callGemini({ baseUrl, apiKey, model, system, user, temperature, signal }) {
  const res = await fetch(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature, topP: 0.95 },
    }),
  });
  const data = await readJson(res);
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
  if (!text) throw new LLMError(`The model returned no text${cand?.finishReason ? ` (${cand.finishReason})` : ""}.`, 502);
  return text;
}

async function callOpenAI({ baseUrl, apiKey, model, system, user, temperature, signal }) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", ...(apiKey && { Authorization: `Bearer ${apiKey}` }) },
    body: JSON.stringify({
      model,
      temperature,
      top_p: 0.95,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  const data = await readJson(res);
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new LLMError("The model returned no text.", 502);
  return text;
}

const NON_TEXT = /whisper|tts|guard|embed|image|audio|transcri|safety|moderation|live|robotics|veo|lyria|imagen|research|computer-use/i;

// Models a provider offers right now, for the "Browse" list in Models & keys.
export async function fetchModelList({ type, baseUrl, apiKey, freeOnly = false }) {
  baseUrl = trimSlash(baseUrl);
  if (type === "gemini") {
    const res = await fetch(`${baseUrl}/models?pageSize=1000`, { headers: { "x-goog-api-key": apiKey } });
    const data = await readJson(res);
    return (data.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => ({ id: m.name.replace(/^models\//, ""), label: m.displayName || m.name }))
      .filter((m) => /^gemini|^gemma/.test(m.id) && !NON_TEXT.test(m.id));
  }
  const res = await fetch(`${baseUrl}/models`, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} });
  const data = await readJson(res);
  return (data.data || [])
    .filter((m) => !freeOnly || (m.pricing?.prompt === "0" && m.pricing?.completion === "0"))
    .filter((m) => !m.architecture?.output_modalities || m.architecture.output_modalities.includes("text"))
    .filter((m) => !NON_TEXT.test(m.id))
    .map((m) => ({ id: m.id, label: m.name || m.id }));
}

async function readJson(res) {
  let data = {};
  try { data = await res.json(); } catch {}
  if (res.ok) return data;

  const detail = data.error?.message || (typeof data.error === "string" && data.error) || data.message || res.statusText;
  let status = res.status;
  let message = `Error ${status}: ${detail}`;
  if (status === 429) message = "Free-tier rate limit reached.";
  else if (status === 400 && /api key/i.test(detail)) { status = 401; message = "The API key isn't valid."; }
  else if (status === 400 && /model/i.test(detail) && /valid|exist|found|support/i.test(detail)) { status = 404; message = "This model isn't available."; }
  else if (status === 401 || status === 403) message = `The API key was rejected (${detail}).`;
  else if (status === 404) message = "This model isn't available.";
  else if (status >= 500) message = "The model is overloaded right now.";
  throw new LLMError(message, status, parseRetryAfter(res, data));
}

function parseRetryAfter(res, data) {
  const header = Number(res.headers.get("retry-after"));
  if (header) return header;
  const info = (data.error?.details || []).find((d) => d.retryDelay);
  return info ? parseFloat(info.retryDelay) : 0;
}

function trimSlash(url) {
  return String(url || "").replace(/\/+$/, "");
}
