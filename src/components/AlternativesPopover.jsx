import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isAiPhrase } from "../lib/detector.js";
import { CloseIcon, CopyIcon, SparkleIcon } from "./icons.jsx";

// Synonyms for a clicked word (free Datamuse dictionary, English) and
// context-aware AI alternatives for a word or a selected phrase.
export function AlternativesPopover({ target, text, aiReady, getAlternatives, onReplace, onClose }) {
  const { start, end, rect, mode } = target;
  const phrase = text.slice(start, end);
  const ref = useRef(null);
  const alive = useRef(true);
  const [pos, setPos] = useState({ left: rect.left + window.scrollX, top: rect.bottom + window.scrollY + 8 });
  const [dict, setDict] = useState({ state: mode === "word" ? "loading" : "off", items: [] });
  const [ai, setAi] = useState({ state: "idle", items: [], error: "" });

  useLayoutEffect(() => {
    const w = ref.current.offsetWidth;
    const maxLeft = window.scrollX + document.documentElement.clientWidth - w - 8;
    setPos({ left: Math.max(window.scrollX + 8, Math.min(rect.left + window.scrollX, maxLeft)), top: rect.bottom + window.scrollY + 8 });
  }, [rect]);

  async function loadAi() {
    if (!aiReady) {
      setAi({ state: "error", items: [], error: "Add an API key in Models & keys for AI suggestions." });
      return;
    }
    setAi({ state: "loading", items: [], error: "" });
    try {
      const items = (await getAlternatives(start, end)).filter((o) => o.toLowerCase() !== phrase.toLowerCase()).slice(0, 8);
      if (alive.current) setAi({ state: "done", items, error: "" });
    } catch (err) {
      if (alive.current) setAi({ state: "error", items: [], error: err.message });
    }
  }

  useEffect(() => {
    alive.current = true;
    // Deferred so React's dev double-mount doesn't send two AI requests.
    const timer = setTimeout(() => {
      if (mode === "phrase") return loadAi();
      fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(phrase.toLowerCase())}&max=14`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => [])
        .then((data) => {
          if (!alive.current) return;
          const items = [...new Set(data.map((d) => d.word))]
            .filter((w) => w.split(" ").length <= 2 && w.toLowerCase() !== phrase.toLowerCase() && !isAiPhrase(w))
            .slice(0, 10);
          setDict({ state: "done", items });
          if (!items.length && aiReady) loadAi(); // e.g. non-English text
        });
    }, 0);

    const onDown = (e) => {
      if (!ref.current?.contains(e.target) && !e.target.closest?.(".output")) onClose();
    };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      alive.current = false;
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // Runs once per target; the parent remounts this component for a new one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = (items) =>
    items.map((o) => (
      <button key={o} type="button" className="opt" onClick={() => onReplace(o)}>{o}</button>
    ));

  return createPortal(
    <div ref={ref} className="popover" role="dialog" aria-label={`Alternatives for ${phrase}`} style={pos}>
      <div className="pop-head">
        <span className="pop-title" title={phrase}>{phrase}</span>
        <button className="icon-btn sm" type="button" title="Copy" aria-label="Copy selection" onClick={() => navigator.clipboard?.writeText(phrase)}>
          <CopyIcon size={16} />
        </button>
        <button className="icon-btn sm" type="button" title="Close" aria-label="Close" onClick={onClose}>
          <CloseIcon size={16} />
        </button>
      </div>

      {mode === "word" && (
        <div className="pop-sec">
          <div className="pop-label">Synonyms</div>
          <div className="pop-list">
            {dict.state === "loading" && <span className="pop-note busy">Looking up…</span>}
            {dict.state === "done" && (dict.items.length ? options(dict.items) : <span className="pop-note">No dictionary synonyms.</span>)}
          </div>
        </div>
      )}

      <div className="pop-sec">
        <div className="pop-label">{mode === "word" ? "In context" : "Rephrase"}</div>
        <div className="pop-list">
          {ai.state === "idle" && (
            <button type="button" className="opt ai" onClick={loadAi}><SparkleIcon size={14} /> Suggest with AI</button>
          )}
          {ai.state === "loading" && <span className="pop-note busy">Thinking…</span>}
          {ai.state === "done" && (ai.items.length ? options(ai.items) : <span className="pop-note">No suggestions.</span>)}
          {ai.state === "error" && <span className="pop-note">{ai.error}</span>}
        </div>
      </div>
    </div>,
    document.body
  );
}
