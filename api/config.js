import { PROVIDERS } from "../src/lib/catalog.js";
import { json } from "./_lib/http.js";

// Tells the app which providers have a server-side key, so visitors of a
// deployment with keys set in Vercel don't need their own.
export function GET() {
  const serverKeys = Object.fromEntries(PROVIDERS.map((p) => [p.id, !!process.env[p.envKey]]));
  return json({ serverKeys, accessCode: !!process.env.ACCESS_CODE });
}
