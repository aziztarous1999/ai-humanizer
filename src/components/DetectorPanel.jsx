import { useEffect, useState } from "react";
import { ChevronIcon, SparkleIcon } from "./icons.jsx";

// AI-likelihood meter for one pane. The local score is instant; "Deep scan"
// asks the selected model for a second opinion and averages the two.
export function DetectorPanel({ report, text, onDeepScan, aiReady }) {
  const [open, setOpen] = useState(false);
  const [deep, setDeep] = useState(null); // { state: "loading" | "done" | "error", result?, error? }

  useEffect(() => setDeep(null), [text]);

  if (!report.words) return <div className="detector placeholder" />;

  const ai = deep?.state === "done" ? deep.result : null;
  const score = ai ? Math.round((report.score + ai.score) / 2) : report.score;
  const level = !report.reliable ? "muted" : score >= 70 ? "high" : score >= 45 ? "mid" : "low";
  const verdict = !report.reliable ? report.verdict : score >= 70 ? "Likely AI" : score >= 45 ? "Mixed signals" : "Likely human";
  const flagged = report.flagged.length;

  async function scan() {
    setOpen(true);
    setDeep({ state: "loading" });
    try {
      setDeep({ state: "done", result: await onDeepScan(text) });
    } catch (err) {
      setDeep({ state: "error", error: err.message });
    }
  }

  return (
    <div className={`detector ${level}`}>
      <button type="button" className="det-summary" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="det-meter" aria-hidden="true"><span style={{ width: `${report.reliable ? score : 0}%` }} /></span>
        <span className="det-score">{report.reliable ? `${score}% AI` : "–"}</span>
        <span className="det-verdict">{verdict}</span>
        {report.reliable && flagged > 0 && <span className="det-sub">· {flagged} sentence{flagged > 1 ? "s" : ""} flagged</span>}
        {ai && <span className="det-sub">· with AI review</span>}
        <ChevronIcon size={16} className={`icon chev${open ? " up" : ""}`} />
      </button>

      {open && (
        <div className="det-panel">
          <ul className="signals">
            {report.signals.map((s) => (
              <li key={s.id} title={s.detail}>
                <span className="sig-label">{s.label}</span>
                <span className="sig-bar" aria-hidden="true">
                  <span className={s.impact >= 0 ? "ai" : "human"} style={{ width: `${Math.min(50, Math.abs(s.impact) * 19)}%` }} />
                </span>
                <span className="sig-detail">{s.detail}</span>
              </li>
            ))}
          </ul>
          <p className="sig-legend"><span className="key ai" /> points to AI <span className="key human" /> points to a person</p>

          <div className="deep">
            {(!deep || deep.state === "error") && (
              <button type="button" className="ghost small" onClick={scan} disabled={!aiReady || !report.reliable}
                title={!aiReady ? "Add an API key in Models & keys" : !report.reliable ? "Needs at least 60 words" : "Ask the selected model for a second opinion"}>
                <SparkleIcon size={15} /> Deep scan with AI
              </button>
            )}
            {deep?.state === "loading" && <span className="pop-note busy">Asking the model for a second opinion…</span>}
            {deep?.state === "error" && <span className="pop-note">{deep.error}</span>}
            {ai && (
              <div className="deep-result">
                <div><strong>AI review: {ai.score}% AI</strong>{ai.verdict && <> · {ai.verdict}</>} <span className="hint">(local score {report.score}%)</span></div>
                {ai.reasons.length > 0 && <ul>{ai.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
                {ai.flagged.length > 0 && (
                  <>
                    <div className="hint">Most machine-like sentences:</div>
                    <ul className="quotes">{ai.flagged.map((q) => <li key={q}>“{q}”</li>)}</ul>
                  </>
                )}
              </div>
            )}
          </div>
          <p className="hint">
            {report.limited
              ? "This language has no dedicated pattern pack yet (English and French do), so only language-independent signals were used. Use Deep scan for a better read. "
              : `The local score comes from ${report.signals.length} style signals for ${report.lang === "fr" ? "French" : "English"} text, worked out in your browser. `}
            These are estimates. No detector, including commercial ones, is fully reliable, especially on short or edited text.
          </p>
        </div>
      )}
    </div>
  );
}
