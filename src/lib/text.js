export const WORD_RE = /([\p{L}\p{N}][\p{L}\p{N}'’-]*)/u;

// Strips wrappers models sometimes add and the em dashes the prompt bans.
export function cleanup(text) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^\s*(here(?:'s| is)[^\n]*:\s*\n)/i, "")
    .replace(/^\s*<<<\s*\w+\s*\n?|\n?\s*\w+\s*>>>\s*$/g, "")
    .replace(/\s*—\s*/g, ", ")
    .replace(/ – /g, ", ")
    .replace(/,\s*([.!?])/g, "$1")
    .replace(/^["“](.*)["”]$/s, "$1")
    .trim();
}

export function splitChunks(text, maxWords) {
  const chunks = [];
  let current = [];
  let count = 0;
  for (const para of text.split(/\n\s*\n/)) {
    const n = wordCount(para);
    if (count + n > maxWords && current.length) {
      chunks.push(current.join("\n\n"));
      current = [];
      count = 0;
    }
    current.push(para);
    count += n;
  }
  if (current.length) chunks.push(current.join("\n\n"));
  return chunks;
}

export function wordCount(text) {
  return (text.trim().match(/\S+/g) || []).length;
}

export function countLabel(text) {
  const w = wordCount(text);
  return w ? `${w} word${w > 1 ? "s" : ""} · ${text.length} characters` : "";
}

// The sentence (or ~300 characters) around a range, as context for alternatives.
export function sentenceAround(text, start, end) {
  const s = Math.max(text.slice(0, start).search(/[^.!?\n]*$/), start - 300, 0);
  const rel = text.slice(end).search(/[.!?\n]/);
  const e = rel === -1 ? Math.min(text.length, end + 300) : end + rel + 1;
  return text.slice(s, e).trim();
}

// Grows a character range to whole words and trims surrounding spaces.
export function expandToWords(text, start, end) {
  const isWordChar = (c) => c && /[\p{L}\p{N}'’-]/u.test(c);
  while (start > 0 && isWordChar(text[start - 1]) && isWordChar(text[start])) start--;
  while (end < text.length && isWordChar(text[end - 1]) && isWordChar(text[end])) end++;
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  return [start, end];
}

// Parses a model's JSON-array answer, falling back to one option per line.
export function parseList(raw) {
  const m = raw.match(/\[[\s\S]*\]/);
  if (m) {
    try { return JSON.parse(m[0]).map(String).map((s) => s.trim()).filter(Boolean); } catch {}
  }
  return raw.split("\n").map((s) => s.replace(/^[\s\-*\d.)"]+|["\s,]+$/g, "")).filter(Boolean);
}

// Keeps the replaced text's capitalization consistent with what it replaces.
export function matchCase(original, replacement, atStart) {
  if (!replacement) return replacement;
  if (/^\p{Lu}/u.test(original) && !/^\p{Lu}{2}/u.test(original)) return replacement[0].toUpperCase() + replacement.slice(1);
  if (/^\p{Ll}/u.test(original) && !atStart) return replacement[0].toLowerCase() + replacement.slice(1);
  return replacement;
}
