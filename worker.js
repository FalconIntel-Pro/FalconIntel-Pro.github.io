/**
 * FalconIntel-Pro — Cloudflare Worker CORS Proxy v2.3
 *
 * DEPLOYMENT:
 *   1. Paste this entire file into Cloudflare Workers editor → Deploy
 *   2. Settings → Variables → Secrets → Add: SECURITYTRAILS_KEY = your API key
 *
 * NEVER hardcode your API key here — use the secret above.
 */

const ST_BASE = "https://api.securitytrails.com/v1";

// Whitelist of valid SecurityTrails endpoint patterns
// FIX: /ips/{ip}/domains → /ips/{ip}/associated  (correct endpoint)
const ALLOWED = [
  /^\/ping$/,
  /^\/domain\/[a-zA-Z0-9.\-]{1,253}$/,
  /^\/domain\/[a-zA-Z0-9.\-]{1,253}\/dns\/[a-zA-Z]{1,10}$/,
  /^\/domain\/[a-zA-Z0-9.\-]{1,253}\/subdomains$/,
  /^\/domain\/[a-zA-Z0-9.\-]{1,253}\/whois$/,
  /^\/ips\/nearby\/[\d.:a-fA-F]{3,45}$/,
  /^\/ips\/[\d.:a-fA-F]{3,45}\/associated$/,   // FIXED: was /domains
];

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age":       "86400",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (request.method !== "GET")     return json({ error: "Method not allowed" }, 405);

    const url = new URL(request.url);

    // Strip /proxy prefix to get the SecurityTrails path
    const stPath    = url.pathname.replace(/^\/proxy/, "") || "/ping";
    const cleanPath = stPath.split("?")[0];

    // Validate against whitelist
    if (!ALLOWED.some((re) => re.test(cleanPath))) {
      return json({ error: "Endpoint not permitted", path: cleanPath }, 403);
    }

    // API key from Worker secret — NEVER from the browser
    const apiKey = (env.SECURITYTRAILS_KEY || "").trim();
    if (!apiKey) {
      return json({
        error: "SECURITYTRAILS_KEY secret is not configured.",
        hint:  "Workers → Settings → Variables → Secrets → Add: SECURITYTRAILS_KEY",
      }, 503);
    }

    const target = `${ST_BASE}${stPath}${url.search}`;

    try {
      const upstream = await fetch(target, {
        headers: {
          "APIKEY":         apiKey,
          "Content-Type":   "application/json",
          "Accept":         "application/json",
          "User-Agent":     "FalconIntel-Pro/2.3",
        },
      });

      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: {
          "Content-Type":  "application/json",
          "Cache-Control": "no-store",
          ...CORS,
        },
      });

    } catch (err) {
      return json({ error: "Upstream fetch failed", detail: err.message }, 502);
    }
  },
};
