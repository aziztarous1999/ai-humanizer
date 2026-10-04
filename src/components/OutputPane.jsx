import { useEffect, useMemo, useRef, useState } from "react";
import { detect } from "../lib/detector.js";
import { WORD_RE, countLabel, expandToWords } from "../lib/text.js";
import { AlternativesPopover } from "./AlternativesPopover.jsx";
import { DetectorPanel } from "./DetectorPanel.jsx";
import { CheckIcon, CopyIcon, UndoIcon } from "./icons.jsx";

// The result is rendered as spans so single words can be clicked and phrases
// selected. Every span carries data-o, its character offset in `text`.
export function OutputPane({ text, busy, highlight, flashAt, toneLabel, canUndo, onUndo, onReplace, getAlternatives, onDeepScan, aiReady }) {
  const rootRef = useRef(null);
  const [target, setTarget] = useState(null); // { start, end, rect, mode: "word" | "phrase" }
  const [copied, setCopied] = useState(false);

  useEffect(() => setTarget(null), [text, busy]);

  const tokens = useMemo(() => {
    const out = [];
    let o = 0;
    text.split(WORD_RE).forEach((tok, i) => {
      if (!tok) return;
      out.push({ tok, o, word: i % 2 === 1 });
      o += tok.length;
    });
    return out;
  }, [text]);
  const report = useMemo(() => detect(text), [text]);
  const tells = highlight ? report.phrases : [];
  const flaggedRanges = highlight ? report.flagged.map((f) => [f.start, f.end]) : [];

  function onMouseUp(e) {
    if (busy) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && rootRef.current.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      const a = domOffset(range.startContainer, range.startOffset);
      const b = domOffset(range.endContainer, range.endOffset);
      if (a != null && b != null && b > a) {
        const [start, end] = expandToWords(text, a, b);
        if (text.slice(start, end).trim()) {
          setTarget({ start, end, rect: range.getBoundingClientRect(), mode: "phrase" });
          return;
        }
      }
    }
    const word = e.target.closest?.(".w");
    if (word) {
      const start = Number(word.dataset.o);
      setTarget({ start, end: start + word.textContent.length, rect: word.getBoundingClientRect(), mode: "word" });
    }
  }

  function domOffset(node, offset) {
    const root = rootRef.current;
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    const span = el?.closest?.("[data-o]");
    if (span && root.contains(span)) return Number(span.dataset.o) + (node.nodeType === Node.TEXT_NODE ? offset : 0);
    if (node === root) {
      const child = root.childNodes[offset];
      return child?.dataset ? Number(child.dataset.o) : text.length;
    }
    return null;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = Object.assign(document.createElement("textarea"), { value: text });
      document.body.append(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  const inRange = (o, len, [s, e]) => o < e && o + len > s;

  return (
    <div className="pane out">
      <div className="pane-head">
        <span className="pane-title">Humanized</span>
        <span className="pane-sub">{toneLabel} tone</span>
      </div>
      <div className="pane-body">
        {busy && <div className="progress" aria-hidden="true" />}
        <div
          ref={rootRef}
          className={`editor-text output${text ? "" : " empty"}${busy ? " loading" : ""}`}
          data-placeholder={busy ? "Rewriting…" : "Your rewritten text appears here. Click a word for synonyms, or select a phrase to reword it."}
          onMouseUp={onMouseUp}
          aria-label="Humanized text"
          aria-busy={busy}
          aria-live="polite"
        >
          {tokens.map(({ tok, o, word }) => {
            const cls = [
              word && "w",
              tells.some((r) => inRange(o, tok.length, r)) && "tell",
              flaggedRanges.some(([a, b]) => o >= a && o + tok.length <= b) && "ai-sent",
              target && o >= target.start && o + tok.length <= target.end && "active",
              word && o === flashAt && "flash",
            ].filter(Boolean).join(" ");
            return <span key={o} data-o={o} className={cls || undefined}>{tok}</span>;
          })}
        </div>
      </div>
      {!busy && <DetectorPanel report={report} text={text} onDeepScan={onDeepScan} aiReady={aiReady} />}
      <div className="pane-foot">
        <span className="meta">{countLabel(text)}</span>
        <div className="tools">
          <button className="icon-btn" type="button" onClick={onUndo} disabled={!canUndo || busy} title="Undo (Ctrl+Z)" aria-label="Undo">
            <UndoIcon />
          </button>
          <button className={`icon-btn${copied ? " done" : ""}`} type="button" onClick={copy} disabled={!text} title={copied ? "Copied" : "Copy"} aria-label="Copy result">
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>
      </div>

      {target && (
        <AlternativesPopover
          key={`${target.start}-${target.end}`}
          target={target}
          text={text}
          aiReady={aiReady}
          getAlternatives={getAlternatives}
          onReplace={(value) => { onReplace(target.start, target.end, value); setTarget(null); }}
          onClose={() => { setTarget(null); window.getSelection()?.removeAllRanges(); }}
        />
      )}
    </div>
  );
}
