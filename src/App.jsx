import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_MODEL, modelKey } from "./lib/catalog.js";
import { describeFindings, detect } from "./lib/detector.js";
import { generateWithFallback, getServerConfig, isAbort, runModel } from "./lib/engine.js";
import {
  TONES, buildAlternativesPrompt, buildAlternativesUser, buildDetectPrompt, buildDetectUser, buildPolishPrompt,
  buildPolishUser, buildRewritePrompt, buildRewriteUser,
} from "./lib/prompts.js";
import { cleanup, matchCase, parseList, sentenceAround, splitChunks } from "./lib/text.js";
import { useCatalog } from "./hooks/useCatalog.js";
import { useStored } from "./hooks/useStored.js";
import { InputPane } from "./components/InputPane.jsx";
import { OutputPane } from "./components/OutputPane.jsx";
import { SettingsDialog } from "./components/SettingsDialog.jsx";
import { StatusBanner } from "./components/StatusBanner.jsx";
import { Toolbar } from "./components/Toolbar.jsx";
import { SettingsIcon } from "./components/icons.jsx";

const MAX_WORDS_PER_CHUNK = 700;
const RECHECK_THRESHOLD = 50; // detector score that triggers the extra targeted pass
const ALREADY_HUMAN = 30;     // below this, warn before rewriting the input

const DEFAULT_PREFS = {
  tone: "natural",
  intensity: "medium",
  twoPass: true,
  keepFormat: false,
  highlight: true,
  autoFallback: true,
  selfCheck: true,
  model: DEFAULT_MODEL,
};

export default function App() {
  const [prefs, setPrefs] = useStored("prefs", DEFAULT_PREFS);
  const [keys, setKeys] = useStored("keys", {});
  const [accessCode, setAccessCode] = useStored("accessCode", "");
  const [input, setInput] = useStored("draft", "");
  const catalog = useCatalog();

  const [output, setOutput] = useState("");
  const [history, setHistory] = useState([]); // earlier outputs, for undo
  const [flashAt, setFlashAt] = useState(-1);
  const [status, setStatus] = useState(null); // { msg, kind }
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [serverConfig, setServerConfig] = useState({});
  const abortRef = useRef(null);

  const setPref = (key, value) => setPrefs((p) => ({ ...p, [key]: value }));
  const setKey = (provider, value) => setKeys((k) => ({ ...k, [provider]: value }));
  const say = useCallback((msg, kind = "info") => setStatus(msg ? { msg, kind } : null), []);

  useEffect(() => { getServerConfig().then(setServerConfig); }, []);

  // Success messages fade out on their own; errors stay until dismissed.
  useEffect(() => {
    if (status?.kind !== "ok") return;
    const t = setTimeout(() => setStatus(null), 8000);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (flashAt < 0) return;
    const t = setTimeout(() => setFlashAt(-1), 1700);
    return () => clearTimeout(t);
  }, [flashAt]);

  const hasKey = (pid) => !!keys[pid]?.trim() || !!serverConfig.serverKeys?.[pid];
  const selected = catalog.enabled.find((m) => modelKey(m) === prefs.model) || catalog.enabled[0];
  const providerName = (pid) => catalog.providerById(pid)?.name || pid;

  // The selected model first, then (if auto-switch is on) the other enabled
  // models of the same provider, then models of other providers with a key.
  function candidates() {
    if (!selected) return [];
    const rest = prefs.autoFallback
      ? [
          ...catalog.enabled.filter((m) => m.provider === selected.provider && m !== selected),
          ...catalog.enabled.filter((m) => m.provider !== selected.provider),
        ]
      : [];
    return [selected, ...rest]
      .filter((m) => hasKey(m.provider))
      .map((m) => ({ model: m, provider: catalog.providerById(m.provider), apiKey: keys[m.provider]?.trim() || "" }));
  }

  const caller = (req) => (c, signal) =>
    runModel({ provider: c.provider, model: c.model.id, apiKey: c.apiKey, accessCode, signal, ...req });

  function checkReady() {
    if (!selected) {
      setSettingsOpen(true);
      say("Turn on at least one model in Models & keys.", "warn");
      return false;
    }
    if (!hasKey(selected.provider)) {
      setSettingsOpen(true);
      say(`Add your free ${providerName(selected.provider)} API key in Models & keys.`, "warn");
      return false;
    }
    return true;
  }

  // `force` skips the "already reads as human" check (the user confirmed).
  async function run(force = false) {
    if (busy) return;
    const text = input.trim();
    if (!text) return say("Paste some text first.", "warn");
    if (!checkReady()) return;

    // Rewriting text that already reads as human mostly makes it more polished,
    // which is exactly what detectors look for. Ask first.
    const original = detect(text);
    if (!force && original.reliable && original.score < ALREADY_HUMAN) {
      return setStatus({
        kind: "warn",
        msg: `Your text already reads as human (${original.score}% AI). Rewriting usually makes text more polished, which looks more like AI. If you only want a different tone, the app will make minimal changes.`,
        actions: [{ label: "Rewrite anyway (minimal changes)", onClick: () => run(true) }],
      });
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;
    const chunks = splitChunks(text, MAX_WORDS_PER_CHUNK);
    const previous = output;
    const results = [];
    let cands = candidates();
    let recheckedParts = 0;

    // A model that had to step in stays first for the remaining parts.
    const step = async (label, req) => {
      const r = await generateWithFallback(cands, caller(req), { onStatus: say, label, signal });
      cands = [r.used, ...cands.filter((c) => c !== r.used)];
      return cleanup(r.text);
    };

    setBusy(true);
    try {
      for (let i = 0; i < chunks.length; i++) {
        const part = chunks.length > 1 ? ` part ${i + 1} of ${chunks.length}` : "";
        const source = chunks.length > 1 ? detect(chunks[i]) : original;
        const lang = source.lang === "other" ? original.lang : source.lang;
        const system = buildRewritePrompt(prefs.tone, prefs.intensity, prefs.keepFormat, { lang, original: source });
        const polishSystem = buildPolishPrompt(prefs.tone, lang);
        // The bar a rewrite has to clear: clearly AI, or worse than what we started with.
        const worse = (r) => r.reliable && (r.score >= RECHECK_THRESHOLD || (source.reliable && r.score > source.score + 5));

        say(`Rewriting${part} with ${cands[0].model.label}…`, "busy");
        let draft = await step(`Rewriting${part}`, { system, user: buildRewriteUser(chunks[i]), temperature: 0.9 });
        if (prefs.twoPass) {
          say(`Polishing${part}…`, "busy");
          const findings = describeFindings(detect(draft));
          draft = await step(`Polishing${part}`, { system: polishSystem, user: buildPolishUser(chunks[i], draft, findings), temperature: 0.6 });
        }
        // Re-check with the detector; one targeted pass if it still reads as AI.
        if (prefs.selfCheck) {
          const report = detect(draft);
          if (worse(report)) {
            recheckedParts++;
            say(`Detector rates${part} ${report.score}% AI (original: ${source.score}%). Fixing ${report.flagged.length} flagged sentences…`, "busy");
            draft = await step(`Fixing flagged sentences${part}`, {
              system: polishSystem,
              user: buildPolishUser(chunks[i], draft, describeFindings(report)),
              temperature: 0.7,
            });
          }
        }
        results.push(draft);
        setOutput(results.join("\n\n"));
      }
      if (previous) setHistory((h) => [...h, previous]);
      const used = cands[0].model;
      const result = results.join("\n\n");
      const final = detect(result);
      const lead = used === selected ? "Done." : `Done with ${used.label}, because ${selected.label} wasn't available.`;
      const scores = final.reliable && original.reliable
        ? ` Detector: ${original.score}% AI → ${final.score}% AI${recheckedParts ? " (after an extra fix pass)" : ""}.`
        : final.reliable ? ` Detector: ${final.score}% AI.` : "";

      if (final.reliable && original.reliable && final.score > original.score + 5) {
        // Never silently hand back something worse than the user's own text.
        setStatus({
          kind: "warn",
          msg: `${lead}${scores} The rewrite reads more like AI than your original. Try Light strength, a different tone or another model, or keep your original.`,
          actions: [{ label: "Use my original instead", onClick: () => { setHistory((h) => [...h, result]); setOutput(text); setStatus(null); } }],
        });
      } else if (final.reliable && final.score >= RECHECK_THRESHOLD) {
        say(`${lead}${scores} Still reads as AI. Try Strong strength or a different model.`, "warn");
      } else {
        say(`${lead}${scores} Click any word for synonyms.`, "ok");
      }
    } catch (err) {
      if (isAbort(err)) {
        if (results.length) {
          if (previous) setHistory((h) => [...h, previous]);
          say(`Stopped. Kept the ${results.length} finished part${results.length > 1 ? "s" : ""} of ${chunks.length}.`, "info");
        } else {
          setOutput(previous);
          say("Stopped. Nothing was changed.", "info");
        }
      } else {
        if (!results.length) setOutput(previous);
        say(err.message || String(err), "error");
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function undo() {
    if (!history.length || busy) return;
    setOutput(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  }

  function replace(start, end, value) {
    const original = output.slice(start, end);
    const atSentenceStart = start === 0 || /[.!?]\s*$/.test(output.slice(0, start));
    setHistory((h) => [...h, output]);
    setOutput(output.slice(0, start) + matchCase(original, value, atSentenceStart) + output.slice(end));
    setFlashAt(start);
  }

  async function getAlternatives(start, end) {
    const r = await generateWithFallback(
      candidates(),
      caller({
        system: buildAlternativesPrompt(prefs.tone, detect(output).lang),
        user: buildAlternativesUser(output.slice(start, end), sentenceAround(output, start, end)),
        temperature: 0.8,
      }),
      { label: "Finding alternatives" }
    );
    return parseList(r.text);
  }

  // Second-opinion detection by the selected model (falls back like any call).
  async function deepScan(text) {
    if (!checkReady()) throw new Error("Add an API key in Models & keys first.");
    const r = await generateWithFallback(
      candidates(),
      caller({ system: buildDetectPrompt(), user: buildDetectUser(text), temperature: 0.1 }),
      { label: "Deep scan" }
    );
    const m = r.text.match(/\{[\s\S]*\}/);
    let data;
    try { data = JSON.parse(m?.[0] || ""); } catch { throw new Error("The model didn't return a readable answer. Try again or pick another model."); }
    const score = Math.round(Math.min(100, Math.max(0, Number(data.score))));
    if (!Number.isFinite(score)) throw new Error("The model didn't return a score. Try again or pick another model.");
    const list = (v) => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 5) : []);
    return { score, verdict: String(data.verdict || ""), reasons: list(data.reasons), flagged: list(data.flagged), model: r.used.model.label };
  }

  // Ctrl+Enter runs, Esc stops a run, Ctrl+Z undoes a word swap.
  const handlers = useRef({});
  handlers.current = { run, stop, undo, busy, canUndo: history.length > 0 };
  useEffect(() => {
    const onKey = (e) => {
      const h = handlers.current;
      const mod = e.ctrlKey || e.metaKey;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
      if (mod && e.key === "Enter") {
        e.preventDefault();
        if (!h.busy) h.run(false);
      } else if (e.key === "Escape" && h.busy && !document.querySelector("dialog[open]")) {
        h.stop();
      } else if (mod && e.key.toLowerCase() === "z" && !typing && h.canUndo) {
        e.preventDefault();
        h.undo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Stop any request still running if the page goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  return (
    <>
      <header className="top">
        <div className="brand"><span className="logo">h</span>Humanize</div>
        <button className="ghost" type="button" onClick={() => setSettingsOpen(true)}>
          <SettingsIcon size={18} /> Models &amp; keys
        </button>
      </header>

      <main>
        <Toolbar
          prefs={prefs}
          setPref={setPref}
          providers={catalog.providers}
          enabledModels={catalog.enabled}
          selectedKey={selected ? modelKey(selected) : ""}
          hasKey={hasKey}
          busy={busy}
        />

        <StatusBanner status={status} onDismiss={() => setStatus(null)} />

        <section className="workspace">
          <InputPane
            value={input}
            onChange={setInput}
            highlight={prefs.highlight}
            busy={busy}
            onRun={() => run(false)}
            onStop={stop}
            onDeepScan={deepScan}
            aiReady={!!selected && hasKey(selected.provider)}
          />
          <OutputPane
            text={output}
            busy={busy}
            highlight={prefs.highlight}
            flashAt={flashAt}
            toneLabel={(TONES[prefs.tone] || TONES.natural).label}
            canUndo={history.length > 0}
            onUndo={undo}
            onReplace={replace}
            getAlternatives={getAlternatives}
            onDeepScan={deepScan}
            aiReady={!!selected && hasKey(selected.provider)}
          />
        </section>

        <p className="hint foot">
          The AI score is an estimate from style signals (plus an optional AI review). No detector is fully reliable. Synonyms come
          from the free Datamuse dictionary (English); "Suggest with AI" works in any language.
        </p>
      </main>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        catalog={catalog}
        keys={keys}
        setKey={setKey}
        serverConfig={serverConfig}
        accessCode={accessCode}
        setAccessCode={setAccessCode}
      />
    </>
  );
}
