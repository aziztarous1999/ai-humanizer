import { useEffect, useRef, useState } from "react";
import { modelKey } from "../lib/catalog.js";
import { listProviderModels } from "../lib/engine.js";
import { CloseIcon, ExternalIcon, EyeIcon, EyeOffIcon, PlusIcon, TrashIcon } from "./icons.jsx";

export function SettingsDialog({ open, onClose, catalog, keys, setKey, serverConfig, accessCode, setAccessCode }) {
  const ref = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="settings" onClose={onClose} onMouseDown={(e) => e.target === ref.current && onClose()} aria-labelledby="settings-title">
      <header className="settings-head">
        <h2 id="settings-title">Models &amp; keys</h2>
        <button className="icon-btn" type="button" onClick={onClose} aria-label="Close"><CloseIcon /></button>
      </header>

      <div className="settings-body">
        <p className="hint">
          Keys are free and stay in this browser. They're only sent to the provider (through this site's own server for the built-in providers).
        </p>

        {serverConfig.accessCode && (
          <section className="card">
            <label className="field">
              <span>Access code</span>
              <input type="password" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Unlocks this site's built-in keys" autoComplete="off" />
            </label>
          </section>
        )}

        {catalog.providers.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            catalog={catalog}
            apiKey={keys[p.id] || ""}
            setKey={(v) => setKey(p.id, v)}
            serverKey={!!serverConfig.serverKeys?.[p.id]}
            accessCode={accessCode}
          />
        ))}

        <AddModelForm catalog={catalog} />
        <AddProviderForm catalog={catalog} setKey={setKey} />
      </div>
    </dialog>
  );
}

function ProviderCard({ provider: p, catalog, apiKey, setKey, serverKey, accessCode }) {
  const [show, setShow] = useState(false);
  const [browse, setBrowse] = useState(null); // { state, items, error }
  const models = catalog.models.filter((m) => m.provider === p.id);
  const known = new Set(models.map((m) => m.id));

  async function loadBrowse() {
    setBrowse({ state: "loading", items: [], error: "" });
    try {
      const items = await listProviderModels(p, apiKey, accessCode);
      setBrowse({ state: "done", items, error: "" });
    } catch (err) {
      setBrowse({ state: "error", items: [], error: err.message });
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h3>{p.name}</h3>
        {p.custom && <span className="badge">custom</span>}
        {serverKey && <span className="badge ok" title="This deployment has a key for this provider; yours is optional.">server key</span>}
        {p.keyUrl && (
          <a className="link" href={p.keyUrl} target="_blank" rel="noopener noreferrer">Get a free key <ExternalIcon /></a>
        )}
        {p.custom && (
          <button className="icon-btn sm" type="button" title="Remove provider" aria-label={`Remove ${p.name}`} onClick={() => catalog.removeProvider(p.id)}>
            <TrashIcon size={16} />
          </button>
        )}
      </div>
      {p.note && <p className="hint">{p.note}</p>}
      {p.custom && <p className="hint mono">{p.baseUrl}</p>}

      <div className="key-row">
        <input
          type={show ? "text" : "password"}
          value={apiKey}
          onChange={(e) => setKey(e.target.value)}
          placeholder={serverKey ? "Optional: your own key" : "Paste your API key"}
          aria-label={`${p.name} API key`}
          autoComplete="off"
          spellCheck="false"
        />
        <button className="icon-btn" type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide key" : "Show key"} title={show ? "Hide" : "Show"}>
          {show ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      </div>

      <ul className="model-list">
        {models.map((m) => {
          const k = modelKey(m);
          return (
            <li key={k}>
              <label className="check">
                <input type="checkbox" checked={!catalog.hidden.includes(k)} onChange={() => catalog.toggleModel(k)} />
                <span>{m.label}</span>
                <code>{m.id}</code>
              </label>
              {m.custom && (
                <button className="icon-btn sm" type="button" title="Remove model" aria-label={`Remove ${m.label}`} onClick={() => catalog.removeModel(k)}>
                  <TrashIcon size={14} />
                </button>
              )}
            </li>
          );
        })}
        {!models.length && <li className="hint">No models yet. Browse or add one below.</li>}
      </ul>

      <div className="browse">
        <button className="ghost small" type="button" onClick={browse ? () => setBrowse(null) : loadBrowse}>
          {browse ? "Hide available models" : `Browse ${p.id === "openrouter" ? "free " : ""}models from ${p.name}`}
        </button>
        {browse?.state === "loading" && <span className="pop-note busy">Loading…</span>}
        {browse?.state === "error" && <span className="pop-note">{browse.error}</span>}
        {browse?.state === "done" && (
          <div className="browse-list">
            {browse.items.length === 0 && <span className="pop-note">No models returned.</span>}
            {browse.items.map((it) => (
              <button
                key={it.id}
                type="button"
                className="opt"
                disabled={known.has(it.id)}
                title={it.id}
                onClick={() => catalog.addModel({ provider: p.id, id: it.id, label: it.label || it.id })}
              >
                {known.has(it.id) ? "✓ " : <PlusIcon size={12} />} {it.label || it.id}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function AddModelForm({ catalog }) {
  const [provider, setProvider] = useState(catalog.providers[0]?.id || "");
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    const modelId = id.trim();
    if (!modelId) return setError("Enter the model id exactly as the provider names it.");
    if (catalog.models.some((m) => m.provider === provider && m.id === modelId)) return setError("That model is already in the list.");
    catalog.addModel({ provider, id: modelId, label: label.trim() || modelId });
    setId("");
    setLabel("");
    setError("");
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3>Add a model</h3>
      <p className="hint">Paste any model id from a provider's docs, e.g. a newer Gemini release or another <code>:free</code> model on OpenRouter.</p>
      <div className="form-grid">
        <label className="field">
          <span>Provider</span>
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            {catalog.providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Model id</span>
          <input value={id} onChange={(e) => setId(e.target.value)} placeholder="e.g. gemini-3.8-flash" spellCheck="false" />
        </label>
        <label className="field">
          <span>Display name (optional)</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Gemini 3.8 Flash" />
        </label>
        <button className="primary small-primary" type="submit"><PlusIcon size={16} /> Add model</button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}

function AddProviderForm({ catalog, setKey }) {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [key, setKeyValue] = useState("");
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    let url;
    try { url = new URL(baseUrl.trim()); } catch { return setError("Enter a full base URL, e.g. https://api.example.com/v1"); }
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) return setError("Use an https:// URL.");
    if (!name.trim()) return setError("Give the provider a name.");
    const id = catalog.addProvider({ name: name.trim(), baseUrl: url.href.replace(/\/+$/, "") });
    if (key.trim()) setKey(id, key.trim());
    setName("");
    setBaseUrl("");
    setKeyValue("");
    setError("");
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3>Add a provider</h3>
      <p className="hint">
        Any OpenAI-compatible API (Mistral, Cerebras, Together, a local Ollama or LM Studio…). It's called directly from your browser, so the provider must allow browser (CORS) requests.
      </p>
      <div className="form-grid">
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mistral" />
        </label>
        <label className="field">
          <span>Base URL</span>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.mistral.ai/v1" spellCheck="false" />
        </label>
        <label className="field">
          <span>API key</span>
          <input type="password" value={key} onChange={(e) => setKeyValue(e.target.value)} placeholder="Optional for local servers" autoComplete="off" />
        </label>
        <button className="primary small-primary" type="submit"><PlusIcon size={16} /> Add provider</button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}
