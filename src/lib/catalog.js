// Built-in providers and the models that are free on them (checked October 2026).
// Free lineups change often: users can hide these, browse each provider's live
// list and add new models (or whole OpenAI-compatible providers) in the app.

export const PROVIDERS = [
  {
    id: "gemini",
    name: "Google Gemini",
    type: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    keyUrl: "https://aistudio.google.com/apikey",
    envKey: "GEMINI_API_KEY",
    note: "Best writing quality on a free tier. Limits are per model, so falling back to another Gemini model often works.",
  },
  {
    id: "groq",
    name: "Groq",
    type: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    keyUrl: "https://console.groq.com/keys",
    envKey: "GROQ_API_KEY",
    note: "Very fast with generous free limits. A good backup when Gemini is busy.",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    type: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    keyUrl: "https://openrouter.ai/keys",
    envKey: "OPENROUTER_API_KEY",
    note: "Free models end in \":free\" (about 50 requests a day without credits). The free lineup rotates, so use Browse to refresh.",
  },
];

export const MODELS = [
  { provider: "gemini", id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
  { provider: "gemini", id: "gemini-3.7-flash", label: "Gemini 3.7 Flash" },
  { provider: "gemini", id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
  { provider: "gemini", id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite" },
  { provider: "gemini", id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite" },
  { provider: "groq", id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B" },
  { provider: "groq", id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
  { provider: "groq", id: "openai/gpt-oss-20b", label: "GPT-OSS 20B" },
  { provider: "groq", id: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B (preview)" },
  { provider: "groq", id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
  { provider: "openrouter", id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B" },
  { provider: "openrouter", id: "nvidia/nemotron-3-ultra-550b-a55b:free", label: "Nemotron 3 Ultra" },
  { provider: "openrouter", id: "nvidia/nemotron-3-super-120b-a12b:free", label: "Nemotron 3 Super" },
  { provider: "openrouter", id: "qwen/qwen3.8-27b:free", label: "Qwen 3.8 27B" },
  { provider: "openrouter", id: "thinkingmachines/inkling:free", label: "Inkling" },
];

export const DEFAULT_MODEL = "gemini::gemini-3.8-flash";

export const modelKey = (m) => `${m.provider}::${m.id}`;
