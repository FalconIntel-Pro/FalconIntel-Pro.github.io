/**
 * FalconIntel-Pro — Configuration
 *
 * ⚠️ SECURITY WARNING:
 * The API_KEY field below is intentionally left empty.
 * Your SecurityTrails API key is stored securely as a Cloudflare Worker secret
 * (SECURITYTRAILS_KEY) and is NEVER exposed in frontend code.
 *
 * All API requests are routed through the CORS proxy Worker below.
 * Do NOT paste your API key here — it will be publicly visible in your GitHub repo.
 */

const CONFIG = {
  // ─── PROXY ─────────────────────────────────────────────────────────────────
  // Your Cloudflare Worker CORS proxy URL.
  // Requests go: Browser → Worker (adds API key) → SecurityTrails → back.
  // Leave empty to use demo mode (no real data).
  PROXY_URL: "", // ← PASTE YOUR WORKER URL HERE after deploying

  // ─── LEGACY / LOCAL DEV ────────────────────────────────────────────────────
  // Only used if PROXY_URL is empty AND you want live data without a proxy.
  // NEVER commit a real key here — it will be publicly visible in your GitHub repo.
  API_KEY: "",

  // SecurityTrails API base (used by the Worker server-side only, not the browser)
  BASE_URL: "https://api.securitytrails.com/v1",

  // Request timeout in milliseconds
  TIMEOUT_MS: 15000,

  VERSION: "2.2.0",
};
