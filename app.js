/**
 * FalconIntel-Pro — SecurityTrails Scanner v2.4
 *
 * FIXED in v2.4:
 *  - Removed /domain/{host}/dns/a call (endpoint does not exist → was causing 404)
 *    DNS data is now read from the main /domain/{host} response under current_dns
 *  - Sequential API calls instead of parallel (avoids 429 rate-limit on free tier)
 *  - Fixed URL building to always normalise proxy URL (strips trailing /proxy if user
 *    saved bare worker URL in localStorage)
 *  - Graceful 404 handling for IPs with no ST data
 */

"use strict";

/* ─── STATE ─── */
const state = {
  currentResults: null,
  history:        [],
  stats:          { total: 0, success: 0, failed: 0, domains: 0 },
  isScanning:     false,
};

/* ─── DOM ─── */
const $   = (id) => document.getElementById(id);
const DOM = {
  scanInput:        $("scanInput"),
  scanType:         $("scanType"),
  scanBtn:          $("scanBtn"),
  scanBtnText:      $("scanBtnText"),
  clearInputBtn:    $("clearInputBtn"),
  clearResultsBtn:  $("clearResultsBtn"),
  exportBtn:        $("exportBtn"),
  copyBtn:          $("copyBtn"),
  progressBar:      $("progressBar"),
  errorAlert:       $("errorAlert"),
  errorMsg:         $("errorMsg"),
  loader:           $("loader"),
  loaderMsg:        $("loaderMsg"),
  resultsContainer: $("resultsContainer"),
  resultSections:   $("resultSections"),
  resultTarget:     $("resultTarget"),
  resultTimestamp:  $("resultTimestamp"),
  proxyUrlInput:    $("proxyUrlInput"),
  saveProxyBtn:     $("saveProxyBtn"),
  pingBtn:          $("pingBtn"),
  proxyStatus:      $("proxyStatus"),
  historyList:      $("historyList"),
  clearHistoryBtn:  $("clearHistoryBtn"),
  statTotal:        $("statTotal"),
  statSuccess:      $("statSuccess"),
  statFailed:       $("statFailed"),
  statDomains:      $("statDomains"),
  clock:            $("clock"),
  proxyBadge:       $("proxyBadge"),
};

/* ─── INIT ─── */
function init() {
  loadPersistedData();
  startClock();
  initParticles();
  bindEvents();
  renderHistory();
  updateStats();
  updateProxyBadge();
}

/* ─────────────────────────────────────────
   PROXY URL — normalise to always end with /proxy
   Handles all cases the user might have saved:
     https://worker.workers.dev          → https://worker.workers.dev/proxy
     https://worker.workers.dev/         → https://worker.workers.dev/proxy
     https://worker.workers.dev/proxy    → https://worker.workers.dev/proxy
     https://worker.workers.dev/proxy/   → https://worker.workers.dev/proxy
───────────────────────────────────────── */
function normaliseProxyUrl(raw) {
  if (!raw) return "";
  let url = raw.trim().replace(/\/+$/, "");           // strip trailing slashes
  if (!url.endsWith("/proxy")) url = url + "/proxy";  // ensure /proxy suffix
  return url;
}

function getProxyUrl() {
  const fromStorage = localStorage.getItem("falconintel_proxy") || "";
  const fromConfig  = (typeof CONFIG !== "undefined" ? CONFIG.PROXY_URL : "") || "";
  return normaliseProxyUrl(fromStorage || fromConfig);
}

function buildUrl(stPath) {
  // stPath is a SecurityTrails path like /domain/example.com
  const proxy = getProxyUrl();
  if (proxy) {
    // proxy already ends with /proxy, stPath starts with /
    return proxy + stPath;
    // → https://worker.workers.dev/proxy/domain/example.com
  }
  // Fallback: direct (CORS-blocked on GitHub Pages, works on localhost)
  const base = (typeof CONFIG !== "undefined" ? CONFIG.BASE_URL : "https://api.securitytrails.com/v1").replace(/\/$/, "");
  return base + stPath;
}

function updateProxyBadge() {
  if (!DOM.proxyBadge) return;
  const proxy = getProxyUrl();
  if (proxy) {
    DOM.proxyBadge.textContent   = "PROXY ✓";
    DOM.proxyBadge.style.color   = "#00ff88";
    DOM.proxyBadge.style.borderColor = "rgba(0,255,136,0.4)";
    DOM.proxyBadge.title = proxy;
  } else {
    DOM.proxyBadge.textContent   = "NO PROXY";
    DOM.proxyBadge.style.color   = "#ffd700";
    DOM.proxyBadge.style.borderColor = "rgba(255,215,0,0.4)";
    DOM.proxyBadge.title = "Configure a Cloudflare Worker proxy to enable live scanning";
  }
}

/* ─── PERSIST / LOAD ─── */
function loadPersistedData() {
  const savedProxy = getProxyUrl();
  if (DOM.proxyUrlInput) DOM.proxyUrlInput.value = savedProxy;

  try { const h = localStorage.getItem("falconintel_history"); if (h) state.history = JSON.parse(h); } catch (_) {}
  try { const s = localStorage.getItem("falconintel_stats");   if (s) Object.assign(state.stats, JSON.parse(s)); } catch (_) {}
}

function persistHistory() { localStorage.setItem("falconintel_history", JSON.stringify(state.history.slice(0, 30))); }
function persistStats()   { localStorage.setItem("falconintel_stats",   JSON.stringify(state.stats)); }

/* ─── CLOCK ─── */
function startClock() {
  function tick() {
    const n = new Date();
    DOM.clock.textContent = `${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())} UTC`;
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  tick(); setInterval(tick, 1000);
}

/* ─── PARTICLES ─── */
function initParticles() {
  const canvas = document.getElementById("particles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const P   = [];
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize(); window.addEventListener("resize", resize);
  for (let i = 0; i < 80; i++) P.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, size: Math.random() * 1.5 + 0.3, op: Math.random() * 0.35 + 0.05 });
  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    P.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fillStyle = `rgba(0,212,255,${p.op})`; ctx.fill(); p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > canvas.width) p.vx *= -1; if (p.y < 0 || p.y > canvas.height) p.vy *= -1; });
    requestAnimationFrame(draw);
  })();
}

/* ─── VALIDATION ─── */
function validateInput(value, type) {
  const t = value.trim();
  if (!t) return { valid: false, msg: "Please enter a domain or IP address to scan." };
  if (type === "domain") {
    if (!/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(t))
      return { valid: false, msg: `Invalid domain: "${t}". Use format: example.com` };
  } else {
    const v4 = /^(\d{1,3}\.){3}\d{1,3}$/;
    const v6 = /^([0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{0,4}$|^::1$|^::$/;
    if (!v4.test(t) && !v6.test(t))
      return { valid: false, msg: `Invalid IP address: "${t}". Use format: 8.8.8.8` };
    if (v4.test(t) && t.split(".").map(Number).some(n => n > 255))
      return { valid: false, msg: "Invalid IP: each octet must be 0–255." };
  }
  return { valid: true };
}

/* ─── FETCH WRAPPER ─── */
async function fetchWithTimeout(url, options = {}) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), (typeof CONFIG !== "undefined" ? CONFIG.TIMEOUT_MS : 15000) || 15000);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(timer);
    return res;
  } catch (err) { clearTimeout(timer); throw err; }
}

class APIError extends Error {
  constructor(status, msg, data) { super(msg); this.status = status; this.data = data; this.name = "APIError"; }
}

/* ─────────────────────────────────────────
   API CALLS — Sequential to avoid rate-limits
   
   VALID SecurityTrails v1 endpoints used:
     GET /v1/ping
     GET /v1/domain/{hostname}           ← includes current_dns (A, MX, NS, SOA, TXT)
     GET /v1/domain/{hostname}/subdomains
     GET /v1/ips/nearby/{ip}
     GET /v1/ips/{ip}/associated
   
   REMOVED (don't exist / caused 404):
     ✗ GET /v1/domain/{hostname}/dns/a   ← DNS is in the main domain endpoint
     ✗ GET /v1/ips/{ip}/domains          ← correct path is /associated
───────────────────────────────────────── */
async function fetchData(target, type) {
  if (!getProxyUrl()) throw new Error(
    "No proxy URL configured. Deploy the Cloudflare Worker and paste the URL in the PROXY CONFIGURATION panel."
  );

  const headers = { "Content-Type": "application/json", "Accept": "application/json" };

  if (type === "domain") {
    // ── Step 1: Main domain info (contains current_dns with ALL record types) ──
    setLoaderMsg("FETCHING DOMAIN INTELLIGENCE...");
    const infoRes = await fetchWithTimeout(buildUrl(`/domain/${target}`), { headers });
    if (!infoRes.ok) {
      const e = await infoRes.json().catch(() => ({}));
      throw new APIError(infoRes.status, e.message || infoRes.statusText, e);
    }
    const domainInfo = await infoRes.json();

    // ── Step 2: Subdomains (separate endpoint, sequential to avoid 429) ──
    setLoaderMsg("ENUMERATING SUBDOMAINS...");
    await delay(400); // brief pause to stay within rate limit
    let subdomains = null;
    try {
      const subRes = await fetchWithTimeout(
        buildUrl(`/domain/${target}/subdomains?children_only=false&include_inactive=false`),
        { headers }
      );
      if (subRes.ok) subdomains = await subRes.json();
      // 429 = rate limited; we just skip subdomains rather than crashing the whole scan
    } catch (_) {}

    return { domainInfo, subdomains };

  } else {
    // ── IP scan: nearby block info ──
    setLoaderMsg("FETCHING IP INTELLIGENCE...");
    let ipInfo = null;
    const nearbyRes = await fetchWithTimeout(buildUrl(`/ips/nearby/${target}`), { headers });
    if (nearbyRes.ok) ipInfo = await nearbyRes.json();
    // 404 on nearby = IP not in ST DB, non-fatal

    // ── Associated domains (sequential) ──
    setLoaderMsg("FETCHING ASSOCIATED DOMAINS...");
    await delay(300);
    let ipAssociated = null;
    try {
      const assocRes = await fetchWithTimeout(buildUrl(`/ips/${target}/associated?page=1`), { headers });
      if (assocRes.ok) ipAssociated = await assocRes.json();
    } catch (_) {}

    // If we got nothing at all, throw a helpful error
    if (!ipInfo && !ipAssociated) {
      throw new Error(`No data found for IP "${target}" in the SecurityTrails database.`);
    }

    return { ipInfo, ipAssociated };
  }
}

/* ─── DEMO DATA ─── */
function getDemoData(target, type) {
  if (type === "domain") return {
    _demo: true,
    domainInfo: {
      alexa_rank: 1, apex_domain: target, hostname: target,
      current_dns: {
        a:   { values: [{ ip: "93.184.216.34", ttl: 3600 }], first_seen: "2013-01-01", last_seen: "2024-01-15" },
        mx:  { values: [{ priority: 10, value: `mail.${target}` }], first_seen: "2013-01-01", last_seen: "2024-01-15" },
        ns:  { values: [{ nameserver: `ns1.${target}` }, { nameserver: `ns2.${target}` }], first_seen: "2013-01-01", last_seen: "2024-01-15" },
        soa: { values: [{ email: `hostmaster@${target}`, ttl: 3600 }] },
        txt: { values: [{ value: "v=spf1 include:_spf.google.com ~all" }] },
      },
    },
    subdomains: { subdomain_count: 42, subdomains: ["www", "mail", "ftp", "api", "blog", "dev", "staging", "cdn"] },
  };
  return {
    _demo: true,
    ipInfo: { blocks: [{ network: target + "/24", cidr: target + "/24", name: "EXAMPLE-NET", organization: "Example Org", allocation: "allocated", created: "2000-01-01T00:00:00.000Z" }] },
    ipAssociated: { record_count: 5, records: [{ hostname: "example.com" }, { hostname: "example.net" }, { hostname: "example.org" }] },
  };
}

/* ─── RENDER ─── */
function renderResults(data, target, type) {
  DOM.resultSections.innerHTML = "";
  if (data._demo) DOM.resultSections.insertAdjacentHTML("beforeend", `
    <div style="font-family:'Share Tech Mono',monospace;font-size:.75rem;color:rgba(251,191,36,.7);border:1px solid rgba(251,191,36,.2);background:rgba(251,191,36,.05);padding:.75rem 1rem;margin-bottom:.75rem;display:flex;align-items:center;gap:.6rem">
      <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
      DEMO MODE — Configure the Cloudflare Worker proxy to retrieve live intelligence data
    </div>`);

  if (type === "domain") renderDomainResults(data, target);
  else renderIpResults(data, target);

  DOM.resultsContainer.classList.remove("hidden");
  DOM.resultTarget.textContent   = `[ ${target.toUpperCase()} ]`;
  DOM.resultTimestamp.textContent = new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";
  DOM.resultsContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderDomainResults(data, target) {
  const info = data.domainInfo || {};
  // All DNS data lives in current_dns from the main domain endpoint
  const dns  = info.current_dns || {};
  const subs = data.subdomains  || {};

  // Domain status
  renderSection({ id: "sec-status", icon: "🛰", title: "DOMAIN STATUS", color: "cyan", rows: [
    { key: "hostname",    value: info.hostname    || target },
    { key: "apex domain", value: info.apex_domain || target },
    { key: "alexa rank",  value: info.alexa_rank  ? `#${info.alexa_rank}` : "N/A" },
  ]});

  // A records (IPv4)
  const aVals = dns.a?.values || [];
  if (aVals.length) renderSection({ id: "sec-a", icon: "📡", title: "DNS — A RECORDS (IPv4)", color: "green", rows: [
    ...aVals.map(v => ({ key: "ip address", value: v.ip, highlight: true })),
    { key: "first seen", value: dns.a?.first_seen || "—" },
    { key: "last seen",  value: dns.a?.last_seen  || "—" },
    { key: "ttl",        value: aVals[0].ttl ? `${aVals[0].ttl}s` : "—" },
  ]});

  // AAAA records (IPv6)
  const aaaaVals = dns.aaaa?.values || [];
  if (aaaaVals.length) renderSection({ id: "sec-aaaa", icon: "📡", title: "DNS — AAAA RECORDS (IPv6)", color: "green", rows:
    aaaaVals.map(v => ({ key: "ipv6 address", value: v.ipv6 || v.ip || "—", highlight: true }))
  });

  // MX records
  const mxVals = dns.mx?.values || [];
  if (mxVals.length) renderSection({ id: "sec-mx", icon: "📬", title: "DNS — MX RECORDS (MAIL)", color: "cyan", rows: [
    ...mxVals.map(v => ({ key: `mx ${v.priority || "—"}`, value: v.value || v.hostname || "—" })),
    { key: "first seen", value: dns.mx?.first_seen || "—" },
    { key: "last seen",  value: dns.mx?.last_seen  || "—" },
  ]});

  // NS records
  const nsVals = dns.ns?.values || [];
  if (nsVals.length) renderSection({ id: "sec-ns", icon: "🌐", title: "DNS — NAMESERVERS", color: "cyan", rows:
    nsVals.map((v, i) => ({ key: `ns${i + 1}`, value: v.nameserver || v.value || "—" }))
  });

  // TXT records
  const txtVals = dns.txt?.values || [];
  if (txtVals.length) renderSection({ id: "sec-txt", icon: "📝", title: "DNS — TXT RECORDS", color: "cyan", rows:
    txtVals.map((v, i) => ({ key: `txt ${i + 1}`, value: v.value || "—" }))
  });

  // SOA record
  const soaVals = dns.soa?.values || [];
  if (soaVals.length) {
    const s = soaVals[0];
    renderSection({ id: "sec-soa", icon: "📋", title: "SOA RECORD", color: "cyan", rows: [
      { key: "admin email", value: s.email   || "—" },
      { key: "ttl",         value: s.ttl     ? `${s.ttl}s` : "—" },
      { key: "refresh",     value: s.refresh || "—" },
      { key: "retry",       value: s.retry   || "—" },
    ]});
  }

  // Subdomains
  if (subs.subdomain_count || subs.subdomains?.length) {
    const list  = (subs.subdomains || []).slice(0, 30);
    const extra = (subs.subdomain_count || list.length) - list.length;
    renderSection({ id: "sec-subs", icon: "🕵️", title: `SUBDOMAINS (${subs.subdomain_count || list.length} TOTAL)`, color: "green",
      custom: `<div class="section-content">
        <div style="display:flex;flex-wrap:wrap;gap:.25rem">
          ${list.map(s => `<span class="cyber-tag">${escapeHtml(s)}.${escapeHtml(target)}</span>`).join("")}
          ${extra > 0 ? `<span class="cyber-tag" style="color:#ffd700;border-color:rgba(255,215,0,.3)">+${extra} more</span>` : ""}
        </div>
      </div>`,
    });
  } else if (!subs._skipped) {
    // Subdomains call was made but returned nothing
    renderSection({ id: "sec-subs", icon: "🕵️", title: "SUBDOMAINS", color: "green", rows: [
      { key: "status", value: "No subdomains found in SecurityTrails database" },
    ]});
  }
}

function renderIpResults(data, target) {
  const blocks     = data.ipInfo?.blocks || [];
  const assocData  = data.ipAssociated   || {};
  const domains    = assocData.records   || [];
  const b          = blocks[0]           || {};

  renderSection({ id: "sec-ip", icon: "🌍", title: "IP INFORMATION", color: "cyan", rows: [
    { key: "ip address",   value: target,                              highlight: true },
    { key: "cidr block",   value: b.cidr         || b.network || "—" },
    { key: "organization", value: b.organization || b.name   || "—",  highlight: !!( b.organization || b.name) },
    { key: "allocation",   value: b.allocation   || "—" },
    { key: "created",      value: b.created      ? b.created.substring(0, 10) : "—" },
  ]});

  if (blocks.length) renderSection({ id: "sec-org", icon: "🏢", title: "ORGANIZATION DATA", color: "green", rows: [
    { key: "name",       value: b.name       || b.organization || "—" },
    { key: "network",    value: b.network    || "—" },
    { key: "allocation", value: b.allocation || "—" },
  ]});

  if (domains.length) {
    const total = assocData.record_count || domains.length;
    const shown = domains.slice(0, 25);
    const extra = total - shown.length;
    renderSection({ id: "sec-dom", icon: "🔗", title: `ASSOCIATED DOMAINS (${total})`, color: "cyan",
      custom: `<div class="section-content">
        <div style="display:flex;flex-wrap:wrap;gap:.25rem">
          ${shown.map(d => `<span class="cyber-tag">${escapeHtml(d.hostname)}</span>`).join("")}
        </div>
        ${extra > 0 ? `<p style="font-family:'Share Tech Mono',monospace;font-size:.72rem;color:#475569;margin-top:.5rem">+${extra} more domains associated with this IP</p>` : ""}
      </div>`,
    });
  } else {
    renderSection({ id: "sec-dom", icon: "🔗", title: "ASSOCIATED DOMAINS", color: "cyan", rows: [
      { key: "status", value: "No domains associated with this IP in SecurityTrails database" },
    ]});
  }
}

/* ─── SECTION RENDERER ─── */
function renderSection({ id, icon, title, color, rows, custom }) {
  const tc = color === "green" ? "#00ff88" : "#00d4ff";
  const bc = color === "green" ? "rgba(0,255,136,0.2)" : "rgba(0,212,255,0.2)";
  const rowsHTML = (rows || []).map(r => `
    <div class="data-row">
      <span class="data-key">${r.key}</span>
      <span class="data-value ${r.highlight ? "highlight" : r.warn ? "warn" : ""}">${escapeHtml(String(r.value ?? "—"))}</span>
    </div>`).join("");

  DOM.resultSections.insertAdjacentHTML("beforeend", `
    <div class="result-section collapsed cyber-card fade-in" id="${id}" style="border-color:${bc}">
      <div class="section-header" onclick="toggleSection('${id}')">
        <div style="display:flex;align-items:center;gap:.75rem">
          <span style="font-size:1rem">${icon}</span>
          <span class="font-display" style="font-size:.65rem;font-weight:700;letter-spacing:.08em;color:${tc}">${title}</span>
        </div>
        <svg class="chevron" style="width:1rem;height:1rem;transition:transform .2s;flex-shrink:0" fill="none" stroke="${tc}" stroke-width="2" viewBox="0 0 24 24">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      ${custom || `<div class="section-content">${rowsHTML}</div>`}
    </div>`);

  // Auto-expand first two sections
  const all = DOM.resultSections.querySelectorAll(".result-section");
  if (all.length <= 2) setTimeout(() => expandSection(id), 60 * (all.length - 1));
}

function toggleSection(id) {
  const el = $(id); if (!el) return;
  el.classList.contains("collapsed") ? expandSection(id) : collapseSection(id);
}
function expandSection(id) {
  const el = $(id); if (!el) return;
  el.classList.replace("collapsed", "expanded");
  const c = el.querySelector(".chevron"); if (c) c.style.transform = "rotate(180deg)";
}
function collapseSection(id) {
  const el = $(id); if (!el) return;
  el.classList.replace("expanded", "collapsed");
  const c = el.querySelector(".chevron"); if (c) c.style.transform = "";
}

/* ─── ERROR ─── */
function showError(msg) {
  DOM.errorMsg.textContent = msg;
  DOM.errorAlert.classList.remove("hidden");
  DOM.loader.classList.add("hidden");
  DOM.loader.classList.remove("flex");
  DOM.progressBar.classList.add("hidden");
}
function hideError() { DOM.errorAlert.classList.add("hidden"); }

/* ─── SCAN FLOW ─── */
async function runScan() {
  if (state.isScanning) return;
  const rawTarget = DOM.scanInput.value.trim();
  const scanType  = DOM.scanType.value;

  hideError();
  DOM.resultsContainer.classList.add("hidden");
  [DOM.clearResultsBtn, DOM.exportBtn, DOM.copyBtn].forEach(b => b.classList.add("hidden"));

  const v = validateInput(rawTarget, scanType);
  if (!v.valid) { showError(v.msg); DOM.scanInput.focus(); return; }

  const target = rawTarget.toLowerCase();
  state.isScanning = true;
  DOM.scanBtn.disabled       = true;
  DOM.scanBtnText.textContent = "⏳ SCANNING...";
  DOM.progressBar.classList.remove("hidden");
  DOM.loader.classList.remove("hidden");
  DOM.loader.classList.add("flex");
  state.stats.total++;

  try {
    setLoaderMsg("ESTABLISHING SECURE CONNECTION...");
    await delay(150);

    let data;
    if (!getProxyUrl()) {
      setLoaderMsg("NO PROXY — LOADING DEMO DATA...");
      await delay(800);
      data = getDemoData(target, scanType);
    } else {
      data = await fetchData(target, scanType);
    }

    setLoaderMsg("RENDERING RESULTS...");
    await delay(100);

    state.currentResults = { target, type: scanType, data, timestamp: new Date().toISOString() };
    state.stats.success++;
    if (scanType === "domain") state.stats.domains++;
    persistStats();
    addToHistory(target, scanType);
    renderResults(data, target, scanType);
    [DOM.clearResultsBtn, DOM.exportBtn, DOM.copyBtn].forEach(b => b.classList.remove("hidden"));

  } catch (err) {
    state.stats.failed++;
    persistStats();
    let msg = "An unexpected error occurred.";
    if (err.name === "AbortError") {
      msg = "Request timed out. Check your proxy URL and try again.";
    } else if (err instanceof APIError) {
      const map = {
        401: "Authentication failed (401). Ensure SECURITYTRAILS_KEY is set correctly as a Worker secret.",
        403: "Access forbidden (403). Your API key may lack permission for this endpoint.",
        429: "Rate limit exceeded (429). Your SecurityTrails free tier has been exhausted. Wait a minute and try again.",
        404: `Not found (404). The target "${target}" has no data in the SecurityTrails database.`,
        503: "Proxy not ready (503). Make sure SECURITYTRAILS_KEY is added as a secret on your Cloudflare Worker.",
      };
      msg = map[err.status] || `API Error ${err.status}: ${err.message}`;
    } else if (err.message) {
      msg = err.message;
    }
    showError(msg);
  } finally {
    state.isScanning = false;
    DOM.scanBtn.disabled       = false;
    DOM.scanBtnText.textContent = "▶ INITIATE SCAN";
    DOM.loader.classList.add("hidden");
    DOM.loader.classList.remove("flex");
    DOM.progressBar.classList.add("hidden");
    updateStats();
  }
}

/* ─── HISTORY ─── */
function addToHistory(target, type) {
  state.history = [{ target, type, timestamp: new Date().toISOString() }, ...state.history.filter(h => h.target !== target)].slice(0, 20);
  persistHistory(); renderHistory();
}
function renderHistory() {
  if (!state.history.length) { DOM.historyList.innerHTML = `<p style="font-family:'Share Tech Mono',monospace;font-size:.72rem;color:#475569;text-align:center;padding:1rem">No scans recorded</p>`; return; }
  DOM.historyList.innerHTML = state.history.map(e => {
    const time = new Date(e.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const tc   = e.type === "domain" ? "#00d4ff" : "#00ff88";
    const lbl  = e.type === "domain" ? "DOM" : "IP";
    return `<div class="history-item" onclick="loadFromHistory('${escapeHtml(e.target)}','${e.type}')">
      <div style="display:flex;align-items:center;gap:.5rem;min-width:0">
        <span style="font-family:'Share Tech Mono',monospace;font-size:.72rem;color:${tc};flex-shrink:0">[${lbl}]</span>
        <span style="font-family:'Share Tech Mono',monospace;font-size:.72rem;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(e.target)}</span>
      </div>
      <span style="font-family:'Share Tech Mono',monospace;font-size:.72rem;color:#334155;flex-shrink:0;margin-left:.5rem">${time}</span>
    </div>`;
  }).join("");
}
function loadFromHistory(target, type) {
  DOM.scanInput.value = target;
  DOM.scanType.value  = type;
  DOM.clearInputBtn.classList.remove("hidden");
  runScan();
}

/* ─── STATS ─── */
function updateStats() {
  DOM.statTotal.textContent   = state.stats.total;
  DOM.statSuccess.textContent = state.stats.success;
  DOM.statFailed.textContent  = state.stats.failed;
  DOM.statDomains.textContent = state.stats.domains;
}

/* ─── PING ─── */
async function pingProxy() {
  const proxy = getProxyUrl();
  if (!proxy) { showProxyStatus("error", "✗ No proxy URL saved. Enter the Worker URL and click SAVE URL first."); return; }
  showProxyStatus("loading", "PINGING PROXY...");
  DOM.pingBtn.disabled = true;
  try {
    const res = await fetchWithTimeout(buildUrl("/ping"), { headers: { "Content-Type": "application/json" } });
    if (res.ok) {
      const d = await res.json().catch(() => ({}));
      showProxyStatus("success", `✓ PROXY ONLINE — ${d.message || "SecurityTrails connection verified"}`);
    } else {
      const e = await res.json().catch(() => ({}));
      showProxyStatus("error", `✗ ERROR ${res.status}: ${e.error || e.message || res.statusText}`);
    }
  } catch (e) {
    showProxyStatus("error", `✗ ${e.name === "AbortError" ? "TIMEOUT" : e.message}`);
  } finally { DOM.pingBtn.disabled = false; }
}
function showProxyStatus(type, msg) {
  const colors = { success: "#00ff88", error: "#ff3366", loading: "#00d4ff" };
  DOM.proxyStatus.style.color = colors[type] || "#00d4ff";
  DOM.proxyStatus.textContent = msg;
  DOM.proxyStatus.classList.remove("hidden");
}

/* ─── EXPORT / COPY ─── */
function exportJSON() {
  if (!state.currentResults) return;
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([JSON.stringify(state.currentResults, null, 2)], { type: "application/json" })),
    download: `falconintel_${state.currentResults.target}_${Date.now()}.json`,
  });
  a.click(); URL.revokeObjectURL(a.href);
}
async function copyToClipboard() {
  if (!state.currentResults) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(state.currentResults, null, 2));
    const orig = DOM.copyBtn.textContent;
    DOM.copyBtn.textContent = "✓ COPIED!"; DOM.copyBtn.style.cssText = "border-color:#00ff88;color:#00ff88";
    setTimeout(() => { DOM.copyBtn.textContent = orig; DOM.copyBtn.style.cssText = ""; }, 2000);
  } catch (_) { showError("Clipboard access denied. Use the EXPORT JSON button instead."); }
}
function clearResults() {
  DOM.resultsContainer.classList.add("hidden");
  [DOM.clearResultsBtn, DOM.exportBtn, DOM.copyBtn].forEach(b => b.classList.add("hidden"));
  state.currentResults = null; hideError();
}

/* ─── UTILS ─── */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function setLoaderMsg(msg) { DOM.loaderMsg.textContent = msg; }

/* ─── EVENTS ─── */
function bindEvents() {
  DOM.scanBtn.addEventListener("click", runScan);
  DOM.scanInput.addEventListener("keydown", e => e.key === "Enter" && runScan());
  DOM.scanInput.addEventListener("input", () => { DOM.clearInputBtn.classList.toggle("hidden", !DOM.scanInput.value); hideError(); });
  DOM.clearInputBtn.addEventListener("click", () => { DOM.scanInput.value = ""; DOM.clearInputBtn.classList.add("hidden"); DOM.scanInput.focus(); hideError(); });
  DOM.clearResultsBtn.addEventListener("click", clearResults);
  DOM.exportBtn.addEventListener("click", exportJSON);
  DOM.copyBtn.addEventListener("click", copyToClipboard);
  DOM.saveProxyBtn.addEventListener("click", () => {
    const raw = DOM.proxyUrlInput.value.trim();
    const url = normaliseProxyUrl(raw);
    if (url) {
      localStorage.setItem("falconintel_proxy", url);
      DOM.proxyUrlInput.value = url; // show normalised value
      showProxyStatus("success", "✓ PROXY URL SAVED — click PING TEST to verify");
    } else {
      localStorage.removeItem("falconintel_proxy");
      showProxyStatus("error", "PROXY URL CLEARED — Demo mode active");
    }
    updateProxyBadge();
  });
  DOM.pingBtn.addEventListener("click", pingProxy);
  DOM.clearHistoryBtn.addEventListener("click", () => { state.history = []; persistHistory(); renderHistory(); });
  DOM.scanInput.addEventListener("paste", () => {
    setTimeout(() => {
      const v = DOM.scanInput.value.trim();
      DOM.scanType.value = /^(\d{1,3}\.){3}\d{1,3}$/.test(v) || /^[0-9a-fA-F:]+$/.test(v) ? "ip" : "domain";
      DOM.clearInputBtn.classList.toggle("hidden", !v);
    }, 50);
  });
}

/* ─── BOOT ─── */
document.addEventListener("DOMContentLoaded", init);
window.toggleSection    = toggleSection;
window.loadFromHistory  = loadFromHistory;
