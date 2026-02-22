/**
 * FalconIntel-Pro — Cloudflare Worker CORS Proxy
 *
 * Deploy this to Cloudflare Workers (free tier).
 * Then add your SecurityTrails API key as a secret named: SECURITYTRAILS_KEY
 *
 * This Worker:
 *  1. Accepts GET requests from your GitHub Pages frontend
 *  2. Adds the API key from the Worker secret (never exposed to browser)
 *  3. Forwards the request to SecurityTrails
 *  4. Returns the response with CORS headers so the browser accepts it
 *
 * Route: Worker URL + /proxy/<securitytrails-path>
 * Example: https://your-worker.workers.dev/proxy/domain/example.com
 */

const ST_BASE = "https://api.securitytrails.com/v1";

// Whitelist of allowed SecurityTrails endpoint patterns
const ALLOWED = [
  /^\/ping$/,
  /^\/domain\/[a-zA-Z0-9.\-]{1,253}$/,
  /^\/domain\/[a-zA-Z0-9.\-]{1,253}\/dns\/[a-zA-Z]{1,10}$/,
  /^\/domain\/[a-zA-Z0-9.\-]{1,253}\/subdomains$/,
  /^\/ips\/nearby\/[\d.:a-fA-F]{3,45}$/,
  /^\/ips\/[\d.:a-fA-F]{3,45}\/domains$/,
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
    // Preflight
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (request.method !== "GET")     return json({ error: "Method not allowed" }, 405);

    const url = new URL(request.url);

    // Strip /proxy prefix, keep the rest
    const stPath = url.pathname.replace(/^\/proxy/, "") || "/ping";
    const cleanPath = stPath.split("?")[0];

    // Validate against whitelist
    if (!ALLOWED.some((re) => re.test(cleanPath))) {
      return json({ error: "Endpoint not permitted" }, 403);
    }

    // Check secret
    const apiKey = (env.SECURITYTRAILS_KEY || "").trim();
    if (!apiKey) {
      return json({
        error: "SECURITYTRAILS_KEY secret not configured on this Worker.",
        hint: "Go to Workers → Settings → Variables → Add secret: SECURITYTRAILS_KEY",
      }, 503);
    }

    const target = `${ST_BASE}${stPath}${url.search}`;

    try {
      const upstream = await fetch(target, {
        headers: {
          "APIKEY":       apiKey,
          "Content-Type": "application/json",
          "Accept":       "application/json",
        },
      });

      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS },
      });

    } catch (err) {
      return json({ error: "Upstream fetch failed", detail: err.message }, 502);
    }
  },
};
