import { callModel, fetchModelList, LLMError } from "./llm.js";

const RETRY_DELAYS = [3, 6, 12]; // seconds, for overloaded (5xx) models

export const isAbort = (err) => err?.name === "AbortError";

function abortError() {
  return new DOMException("Stopped", "AbortError");
}

// A sleep that ends early (with an AbortError) when the user stops the run.
function sleep(seconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const t = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, seconds * 1000);
    function onAbort() { clearTimeout(t); reject(abortError()); }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

// One model call. Built-in providers go through the Vercel function (which can
// use server-side keys); custom providers are called straight from the browser.
export async function runModel({ provider, model, apiKey, accessCode, system, user, temperature, signal }) {
  if (provider.custom) return callModel({ ...provider, apiKey, model, system, user, temperature, signal });
  const data = await postApi("/api/generate", { provider: provider.id, model, apiKey, system, user, temperature }, accessCode, signal);
  return data.text;
}

export async function listProviderModels(provider, apiKey, accessCode) {
  if (provider.custom) return fetchModelList({ ...provider, apiKey });
  const data = await postApi("/api/models", { provider: provider.id, apiKey }, accessCode);
  return data.models;
}

export async function getServerConfig() {
  try {
    const res = await fetch("/api/config");
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
}

async function postApi(path, body, accessCode, signal) {
  let res;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(accessCode && { "x-access-code": accessCode }) },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (isAbort(err)) throw err;
    throw new LLMError("Can't reach the server. Check your connection.");
  }
  let data = null;
  try { data = await res.json(); } catch (err) { if (isAbort(err)) throw err; }
  if (!data) {
    const err = new LLMError("The /api functions aren't running. Use `npm run dev` locally, or deploy to Vercel.");
    err.fatal = true;
    throw err;
  }
  if (!res.ok) throw new LLMError(data.error || `Request failed (${res.status}).`, res.status, data.retryAfter || 0);
  return data;
}

// Tries candidates in order until one answers.
// - overloaded (5xx): retried with backoff, then the next model is tried
// - rate limited (429): waits once if the provider asks for <= 60s, else next model
// - retired (404) or other failures: next model
// - rejected key (401/403): every model of that provider is skipped
// - stopped by the user (signal aborted): rejects with an AbortError right away
export async function generateWithFallback(candidates, call, { onStatus = () => {}, label = "Working", signal } = {}) {
  const badProviders = new Set();
  const skipped = [];
  let last = null;

  for (const c of candidates) {
    if (badProviders.has(c.provider.id)) continue;
    let attempt = 0;
    let waited = false;
    for (;;) {
      if (signal?.aborted) throw abortError();
      try {
        return { text: await call(c, signal), used: c, skipped };
      } catch (err) {
        if (isAbort(err) || signal?.aborted) throw abortError();
        if (err.fatal) throw err;
        last = { err, c };
        const s = err.status;
        if (s >= 500 && attempt < RETRY_DELAYS.length) {
          const wait = RETRY_DELAYS[attempt++];
          for (let t = wait; t > 0; t--) {
            onStatus(`${c.model.label} is busy. Retrying in ${t}s (attempt ${attempt}/${RETRY_DELAYS.length})…`, "busy");
            await sleep(1, signal);
          }
          onStatus(`${label}…`, "busy");
          continue;
        }
        if (s === 429 && !waited && err.retryAfter > 0 && err.retryAfter <= 60) {
          waited = true;
          for (let t = Math.ceil(err.retryAfter); t > 0; t--) {
            onStatus(`${c.model.label} hit its free-tier limit. Continuing in ${t}s…`, "busy");
            await sleep(1, signal);
          }
          onStatus(`${label}…`, "busy");
          continue;
        }
        if (s === 401 || s === 403) badProviders.add(c.provider.id);
        skipped.push({ model: c.model, reason: err.message });
        if (candidates.length > 1) onStatus(`${c.model.label}: ${err.message} Trying another model…`, "info");
        break;
      }
    }
  }

  if (!last) throw new LLMError("No model with an API key is available. Add a key in Models & keys.");
  const tried = skipped.length > 1 ? ` Tried ${skipped.length} models.` : "";
  throw new LLMError(`${last.c.model.label}: ${last.err.message}${tried} Wait a minute, pick another model, or add another provider's free key.`, last.err.status);
}
