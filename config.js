/**
 * FalconIntel-Pro — Configuration v2.4
 *
 * ⚠️  Do NOT put your API key here — it's public in your GitHub repo.
 *     Your SecurityTrails key lives as a secret on the Cloudflare Worker.
 */
const CONFIG = {
  PROXY_URL:  "https://falconintel-proxy.inbox-ashen.workers.dev/proxy",
  API_KEY:    "",   // intentionally empty — key is a Worker secret
  BASE_URL:   "https://api.securitytrails.com/v1",
  TIMEOUT_MS: 15000,
  VERSION:    "2.4.0",
};
