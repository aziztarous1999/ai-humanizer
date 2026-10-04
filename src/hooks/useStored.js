import { useEffect, useState } from "react";

const PREFIX = "humanize:";

// useState that survives reloads. Storage failures (private mode, blocked
// site data) fall back to plain in-memory state.
export function useStored(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw == null) return initial;
      const parsed = JSON.parse(raw);
      // New preference fields added later still get their defaults.
      if (isPlainObject(initial) && isPlainObject(parsed)) return { ...initial, ...parsed };
      return parsed;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch {}
  }, [key, value]);

  return [value, setValue];
}

const isPlainObject = (v) => v && typeof v === "object" && !Array.isArray(v);
