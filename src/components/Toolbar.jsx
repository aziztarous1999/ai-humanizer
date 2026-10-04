import { TONES } from "../lib/prompts.js";
import { modelKey } from "../lib/catalog.js";

export function Toolbar({ prefs, setPref, providers, enabledModels, selectedKey, hasKey, busy }) {
  const toggle = (key, label, title) => (
    <label className="check" title={title}>
      <input type="checkbox" checked={prefs[key]} onChange={(e) => setPref(key, e.target.checked)} />
      {key === "highlight" && <span className="swatch" />}
      {label}
    </label>
  );

  return (
    <section className="toolbar">
      <div className="chips" role="group" aria-label="Tone">
        {Object.entries(TONES).map(([key, t]) => (
          <button key={key} type="button" className="chip" aria-pressed={prefs.tone === key} onClick={() => setPref("tone", key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="opts">
        <label className="select-field">
          Model
          <select value={selectedKey} onChange={(e) => setPref("model", e.target.value)} disabled={busy}>
            {providers.map((p) => {
              const models = enabledModels.filter((m) => m.provider === p.id);
              if (!models.length) return null;
              return (
                <optgroup key={p.id} label={hasKey(p.id) ? p.name : `${p.name} (needs a key)`}>
                  {models.map((m) => (
                    <option key={modelKey(m)} value={modelKey(m)}>{m.label}</option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>
        <label className="select-field">
          Strength
          <select value={prefs.intensity} onChange={(e) => setPref("intensity", e.target.value)}>
            <option value="light">Light</option>
            <option value="medium">Medium</option>
            <option value="strong">Strong</option>
          </select>
        </label>
        {toggle("twoPass", "Polish pass", "A second pass that fixes leftover AI patterns (2 requests per part)")}
        {toggle("autoFallback", "Auto-switch model", "If a model is busy, retired or rate-limited, try your other enabled models")}
        {toggle("keepFormat", "Keep lists & headings")}
        {toggle("selfCheck", "Auto re-check", "After rewriting, run the detector and do one extra targeted pass if the text still reads as AI")}
        {toggle("highlight", "Highlight AI patterns", "Mark AI phrases and underline sentences the detector flags")}
      </div>
    </section>
  );
}
