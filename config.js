/**
 * FalconIntel-Pro — Configuration v2.3
 *
 * ⚠️  SECURITY: Do NOT put your API key here.
 *     It lives as a Cloudflare Worker secret (SECURITYTRAILS_KEY).
 *     Anything in this file is PUBLIC in your GitHub repo.
 */

const CONFIG = {
  // Your deployed Cloudflare Worker URL + /proxy
  // Example: "https://falconintel-proxy.inbox-ashen.workers.dev/proxy"
  PROXY_URL: "https://falconintel-proxy.inbox-ashen.workers.dev/proxy",

  // Never put a real key here — left blank intentionally
  API_KEY: "",

  BASE_URL:   "https://api.securitytrails.com/v1",
  TIMEOUT_MS: 15000,
  VERSION:    "2.3.0",
};
