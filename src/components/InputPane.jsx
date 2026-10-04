import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { detect } from "../lib/detector.js";
import { countLabel } from "../lib/text.js";
import { DetectorPanel } from "./DetectorPanel.jsx";
import { CloseIcon, SparkleIcon, StopIcon } from "./icons.jsx";

export function InputPane({ value, onChange, highlight, busy, onRun, onStop, onDeepScan, aiReady }) {
  const taRef = useRef(null);

  // The textarea grows with its content instead of scrolling, like DeepL.
  const grow = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  };
  useLayoutEffect(grow, [value]);
  useEffect(() => {
    window.addEventListener("resize", grow);
    return () => window.removeEventListener("resize", grow);
  }, []);

  // Detection runs on a deferred copy so typing stays smooth on long texts.
  const deferred = useDeferredValue(value);
  const report = useMemo(() => detect(deferred), [deferred]);

  // Highlight layer rendered behind the transparent textarea. It must contain
  // exactly the textarea's text, so it only renders once detection caught up.
  const backdrop = useMemo(() => {
    if (!highlight || deferred !== value) return null;
    return [...renderMarked(value, report), "\n"];
  }, [value, deferred, highlight, report]);

  return (
    <div className="pane">
      <div className="pane-head">
        <span className="pane-title">AI text</span>
      </div>
      <div className="pane-body">
        <div className="field-wrap">
          <div className="backdrop editor-text" aria-hidden="true">{backdrop}</div>
          <textarea
            ref={taRef}
            className="editor-text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            readOnly={busy}
            placeholder="Paste AI-generated text here"
            aria-label="AI text"
            spellCheck="false"
          />
        </div>
        {value && !busy && (
          <button className="icon-btn clear" type="button" title="Clear" aria-label="Clear text" onClick={() => { onChange(""); taRef.current?.focus(); }}>
            <CloseIcon />
          </button>
        )}
      </div>
      <DetectorPanel report={report} text={deferred} onDeepScan={onDeepScan} aiReady={aiReady} />
      <div className="pane-foot">
        <span className="meta">{countLabel(value)}</span>
        <button
          type="button"
          className={`run ${busy ? "stop" : "primary"}`}
          onClick={busy ? onStop : onRun}
          title={busy ? "Stop (Esc)" : "Humanize (Ctrl+Enter)"}
          aria-label={busy ? "Stop humanizing" : "Humanize"}
        >
          {busy ? <><StopIcon /> Stop</> : <><SparkleIcon size={18} /> Humanize</>}
        </button>
      </div>
    </div>
  );
}

// Text split into plain runs, flagged sentences (underlined) and AI phrases
// (highlighted), as React nodes.
function renderMarked(text, report) {
  const cuts = new Set([0, text.length]);
  const flagged = report.flagged.map((s) => [s.start, s.end]);
  for (const [s, e] of [...flagged, ...report.phrases]) { cuts.add(s); cuts.add(e); }
  const points = [...cuts].sort((a, b) => a - b);
  const inAny = (ranges, a, b) => ranges.some(([s, e]) => a >= s && b <= e);

  const nodes = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]];
    if (a === b) continue;
    const chunk = text.slice(a, b);
    const sent = inAny(flagged, a, b);
    const phrase = inAny(report.phrases, a, b);
    if (!sent && !phrase) nodes.push(chunk);
    else if (phrase) nodes.push(<mark key={a} className={sent ? "ai-sent" : undefined}>{chunk}</mark>);
    else nodes.push(<span key={a} className="ai-sent">{chunk}</span>);
  }
  return nodes;
}
