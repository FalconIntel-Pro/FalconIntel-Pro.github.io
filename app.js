/**
 * FalconIntel-Pro — SecurityTrails Scanner
 * Main Application Logic v2.2
 *
 * Architecture:
 *   Browser → Cloudflare Worker (CORS proxy, holds API key) → SecurityTrails API
 *
 * The API key is NEVER in this file. It lives as a Worker secret on Cloudflare.
 */

"use strict";

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
const state = {
  currentResults: null,
  history: [],
  stats: { total: 0, success: 0, failed: 0, domains: 0 },
  isScanning: false,
};

/* ─────────────────────────────────────────
   DOM REFERENCES
───────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

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

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
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
   PROXY URL MANAGEMENT
───────────────────────────────────────── */
function getProxyUrl() {
  // Priority: localStorage > config.js PROXY_URL
  return (
    localStorage.getItem("falconintel_proxy") ||
    (typeof CONFIG !== "undefined" ? CONFIG.PROXY_URL : "") ||
    ""
  ).trim().replace(/\/$/, "");
}

function buildUrl(path) {
  const proxy = getProxyUrl();
  if (proxy) {
    // Route through CORS proxy Worker
    // Worker expects: GET /proxy/<st-path>?<query>
    // e.g. /proxy/domain/example.com  or  /proxy/ping
    return `${proxy}${path.startsWith("/") ? path : "/" + path}`;
  }

  // No proxy — fall back to direct call (works locally, blocked by CORS on GitHub Pages)
  const base = (typeof CONFIG !== "undefined" ? CONFIG.BASE_URL : "https://api.securitytrails.com/v1").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : "/" + path}`;
}

function updateProxyBadge() {
  if (!DOM.proxyBadge) return;
  const proxy = getProxyUrl();
  if (proxy) {
    DOM.proxyBadge.textContent = "PROXY ✓";
    DOM.proxyBadge.style.color = "#00ff88";
    DOM.proxyBadge.style.borderColor = "rgba(0,255,136,0.4)";
    DOM.proxyBadge.title = proxy;
  } else {
    DOM.proxyBadge.textContent = "NO PROXY";
    DOM.proxyBadge.style.color = "#ffd700";
    DOM.proxyBadge.style.borderColor = "rgba(255,215,0,0.4)";
    DOM.proxyBadge.title = "Configure a Cloudflare Worker proxy to enable live scanning";
  }
}

/* ─────────────────────────────────────────
   PERSIST / LOAD
───────────────────────────────────────── */
function loadPersistedData() {
  // Pre-fill proxy URL input from saved value
  const savedProxy = getProxyUrl();
  if (DOM.proxyUrlInput && savedProxy) {
    DOM.proxyUrlInput.value = savedProxy;
  } else if (DOM.proxyUrlInput && typeof CONFIG !== "undefined" && CONFIG.PROXY_URL) {
    DOM.proxyUrlInput.value = CONFIG.PROXY_URL;
  }

  // Load history
  try {
    const h = localStorage.getItem("falconintel_history");
    if (h) state.history = JSON.parse(h);
  } catch (_) {}

  // Load stats
  try {
    const s = localStorage.getItem("falconintel_stats");
    if (s) Object.assign(state.stats, JSON.parse(s));
  } catch (_) {}
}

function persistHistory() {
  localStorage.setItem("falconintel_history", JSON.stringify(state.history.slice(0, 30)));
}

function persistStats() {
  localStorage.setItem("falconintel_stats", JSON.stringify(state.stats));
}

/* ─────────────────────────────────────────
   CLOCK
───────────────────────────────────────── */
function startClock() {
  function tick() {
    const now = new Date();
    DOM.clock.textContent =
      String(now.getHours()).padStart(2, "0") + ":" +
      String(now.getMinutes()).padStart(2, "0") + ":" +
      String(now.getSeconds()).padStart(2, "0") + " UTC";
  }
  tick();
  setInterval(tick, 1000);
}

/* ─────────────────────────────────────────
   PARTICLES
───────────────────────────────────────── */
function initParticles() {
  const canvas = document.getElementById("particles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const particles = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  for (let i = 0; i < 80; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 1.5 + 0.3,
      opacity: Math.random() * 0.35 + 0.05,
    });
  }

  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,212,255,${p.opacity})`;
      ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    });
    requestAnimationFrame(draw);
  })();
}

/* ─────────────────────────────────────────
   VALIDATION
───────────────────────────────────────── */
function validateInput(value, type) {
  const t = value.trim();
  if (!t) return { valid: false, msg: "Please enter a domain or IP address to scan." };

  if (type === "domain") {
    if (!/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(t)) {
      return { valid: false, msg: `Invalid domain: "${t}". Use format: example.com` };
    }
  } else {
    const v4 = /^(\d{1,3}\.){3}\d{1,3}$/;
    const v6 = /^([0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{0,4}$|^::1$|^::$/;
    if (!v4.test(t) && !v6.test(t)) {
      return { valid: false, msg: `Invalid IP address: "${t}". Use format: 8.8.8.8` };
    }
    if (v4.test(t) && t.split(".").map(Number).some((n) => n > 255)) {
      return { valid: false, msg: `Invalid IP: each octet must be 0–255.` };
    }
  }
  return { valid: true };
}

/* ─────────────────────────────────────────
   FETCH WRAPPER
───────────────────────────────────────── */
async function fetchWithTimeout(url, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONFIG.TIMEOUT_MS || 15000);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

class APIError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = "APIError";
  }
}

/* ─────────────────────────────────────────
   API CALLS (via proxy)
───────────────────────────────────────── */
async function fetchData(target, type) {
  const proxy = getProxyUrl();

  if (!proxy) {
    // No proxy configured → show helpful error
    throw new Error(
      "No proxy URL configured. " +
      "Deploy the Cloudflare Worker and paste the Worker URL in the PROXY CONFIGURATION panel, then save."
    );
  }

  // Headers — no API key needed from browser; proxy handles auth
  const headers = { "Content-Type": "application/json", "Accept": "application/json" };

  const results = {};

  if (type === "domain") {
    const [infoRes, dnsRes, subRes] = await Promise.allSettled([
      fetchWithTimeout(buildUrl(`/domain/${target}`), { headers }),
      fetchWithTimeout(buildUrl(`/domain/${target}/dns/a`), { headers }),
      fetchWithTimeout(buildUrl(`/domain/${target}/subdomains?children_only=false&include_inactive=false`), { headers }),
    ]);

    // Domain info is the primary call — throw on failure
    if (infoRes.status === "fulfilled") {
      if (!infoRes.value.ok) {
        const err = await infoRes.value.json().catch(() => ({}));
        throw new APIError(infoRes.value.status, err.message || infoRes.value.statusText, err);
      }
      results.domainInfo = await infoRes.value.json();
    } else {
      throw new Error(`Network error: ${infoRes.reason?.message || "Request failed"}`);
    }

    if (dnsRes.status === "fulfilled" && dnsRes.value.ok)
      results.dnsInfo = await dnsRes.value.json();

    if (subRes.status === "fulfilled" && subRes.value.ok)
      results.subdomains = await subRes.value.json();

  } else {
    // FIX: correct endpoints are /ips/nearby/{ip} and /ips/{ip}/associated
    // /ips/{ip}/domains does NOT exist → was causing 404s
    const [nearbyRes, associatedRes] = await Promise.allSettled([
      fetchWithTimeout(buildUrl(`/ips/nearby/${target}`), { headers }),
      fetchWithTimeout(buildUrl(`/ips/${target}/associated?page=1`), { headers }),
    ]);

    if (nearbyRes.status === "fulfilled") {
      if (nearbyRes.value.ok) {
        results.ipInfo = await nearbyRes.value.json();
      }
      // 404 on nearby just means no neighbor data — not a fatal error for IP scans
    }

    if (!results.ipInfo && nearbyRes.status !== "fulfilled") {
      throw new Error(`Network error: ${nearbyRes.reason?.message || "Request failed"}`);
    }

    if (associatedRes.status === "fulfilled" && associatedRes.value.ok)
      results.ipAssociated = await associatedRes.value.json();
  }

  return results;
}

/* ─────────────────────────────────────────
   DEMO DATA
───────────────────────────────────────── */
function getDemoData(target, type) {
  if (type === "domain") {
    return {
      _demo: true,
      domainInfo: {
        alexa_rank: 1, apex_domain: target, hostname: target,
        current_dns: {
          a:   { values: [{ ip: "93.184.216.34", ttl: 3600 }], first_seen: "2013-01-01", last_seen: "2024-01-15" },
          mx:  { values: [{ priority: 10, value: `mail.${target}` }], first_seen: "2013-01-01", last_seen: "2024-01-15" },
          ns:  { values: [{ nameserver: `ns1.${target}` }, { nameserver: `ns2.${target}` }], first_seen: "2013-01-01", last_seen: "2024-01-15" },
          soa: { values: [{ email: `hostmaster@${target}`, ttl: 3600 }] },
          txt: { values: [{ value: "v=spf1 include:_spf.example.com ~all" }] },
        },
      },
      subdomains: { subdomain_count: 42, subdomains: ["www", "mail", "ftp", "api", "blog", "dev", "staging", "cdn"] },
    };
  }
  return {
    _demo: true,
    ipInfo: {
      blocks: [{ network: target + "/24", cidr: target + "/24", name: "EXAMPLE-NET", organization: "Example Org", allocation: "allocated", created: "2000-01-01T00:00:00.000Z" }],
    },
    // /v1/ips/{ip}/associated returns: { records: [{hostname, alexa_rank, whois}], record_count, pages }
    ipAssociated: {
      record_count: 15,
      pages: 1,
      records: [
        { hostname: "example.com",  alexa_rank: null, whois: { registrar: "MarkMonitor Inc." } },
        { hostname: "example.net",  alexa_rank: null, whois: { registrar: "MarkMonitor Inc." } },
        { hostname: "example.org",  alexa_rank: null, whois: { registrar: "MarkMonitor Inc." } },
        { hostname: "example.info", alexa_rank: null, whois: { registrar: "MarkMonitor Inc." } },
        { hostname: "example.co",   alexa_rank: null, whois: { registrar: "MarkMonitor Inc." } },
      ],
    },
  };
}

/* ─────────────────────────────────────────
   RENDER RESULTS
───────────────────────────────────────── */
function renderResults(data, target, type) {
  DOM.resultSections.innerHTML = "";

  if (data._demo) {
    DOM.resultSections.insertAdjacentHTML("beforeend", `
      <div class="font-mono text-xs text-amber-400/70 border border-amber-400/20 bg-amber-400/5 p-3 mb-3 flex items-center gap-2">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        DEMO MODE — Configure the Cloudflare Worker proxy to retrieve live intelligence data
      </div>`);
  }

  if (type === "domain") renderDomainResults(data, target);
  else renderIpResults(data, target);

  DOM.resultsContainer.classList.remove("hidden");
  DOM.resultTarget.textContent = `[ ${target.toUpperCase()} ]`;
  DOM.resultTimestamp.textContent = new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";
  DOM.resultsContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderDomainResults(data, target) {
  const info = data.domainInfo || {};
  const dns = info.current_dns || {};
  const subs = data.subdomains || {};

  renderSection({ id: "sec-status", icon: "🛰", title: "DOMAIN STATUS", color: "cyan",
    rows: [
      { key: "hostname", value: info.hostname || target },
      { key: "apex domain", value: info.apex_domain || target },
      { key: "alexa rank", value: info.alexa_rank ? `#${info.alexa_rank}` : "N/A" },
    ],
  });

  const aVals = dns.a?.values || [];
  if (aVals.length) renderSection({ id: "sec-a", icon: "📡", title: "DNS — A RECORDS (IPv4)", color: "green",
    rows: [
      ...aVals.map((v) => ({ key: "ip address", value: v.ip, highlight: true })),
      { key: "first seen", value: dns.a?.first_seen || "—" },
      { key: "last seen", value: dns.a?.last_seen || "—" },
      { key: "ttl", value: aVals[0].ttl ? `${aVals[0].ttl}s` : "—" },
    ],
  });

  const mxVals = dns.mx?.values || [];
  if (mxVals.length) renderSection({ id: "sec-mx", icon: "📬", title: "DNS — MX RECORDS (MAIL)", color: "cyan",
    rows: [
      ...mxVals.map((v) => ({ key: `mx ${v.priority || 10}`, value: v.value || v.hostname || "—" })),
      { key: "first seen", value: dns.mx?.first_seen || "—" },
      { key: "last seen", value: dns.mx?.last_seen || "—" },
    ],
  });

  const nsVals = dns.ns?.values || [];
  if (nsVals.length) renderSection({ id: "sec-ns", icon: "🌐", title: "DNS — NAMESERVERS", color: "cyan",
    rows: nsVals.map((v, i) => ({ key: `ns${i + 1}`, value: v.nameserver || v.value || "—" })),
  });

  const txtVals = dns.txt?.values || [];
  if (txtVals.length) renderSection({ id: "sec-txt", icon: "📝", title: "DNS — TXT RECORDS", color: "cyan",
    rows: txtVals.map((v, i) => ({ key: `txt ${i + 1}`, value: v.value || "—" })),
  });

  const soaVals = dns.soa?.values || [];
  if (soaVals.length) {
    const soa = soaVals[0];
    renderSection({ id: "sec-soa", icon: "📋", title: "SOA RECORD", color: "cyan",
      rows: [
        { key: "admin email", value: soa.email || "—" },
        { key: "ttl", value: soa.ttl ? `${soa.ttl}s` : "—" },
        { key: "refresh", value: soa.refresh || "—" },
        { key: "retry", value: soa.retry || "—" },
      ],
    });
  }

  if (subs.subdomain_count || subs.subdomains?.length) {
    const list = (subs.subdomains || []).slice(0, 20);
    const extra = (subs.subdomain_count || list.length) - list.length;
    renderSection({ id: "sec-subs", icon: "🕵️", title: `SUBDOMAINS (${subs.subdomain_count || list.length} TOTAL)`, color: "green",
      custom: `<div class="section-content">
        <div class="flex flex-wrap gap-1">
          ${list.map((s) => `<span class="cyber-tag">${s}.${escapeHtml(target)}</span>`).join("")}
          ${extra > 0 ? `<span class="cyber-tag" style="color:#ffd700;border-color:rgba(255,215,0,0.3)">+${extra} more</span>` : ""}
        </div>
      </div>`,
    });
  }
}

function renderIpResults(data, target) {
  const blocks  = data.ipInfo?.blocks || [];
  const assocData = data.ipAssociated || {};
  const domains   = assocData.records || [];

  const b = blocks[0] || {};
  renderSection({ id: "sec-ip", icon: "🌍", title: "IP INFORMATION", color: "cyan",
    rows: [
      { key: "ip address",   value: target,                               highlight: true },
      { key: "cidr block",   value: b.cidr     || b.network    || "—" },
      { key: "organization", value: b.organization || b.name   || "—",   highlight: true },
      { key: "allocation",   value: b.allocation              || "—" },
      { key: "created",      value: b.created ? b.created.substring(0, 10) : "—" },
    ],
  });

  if (blocks.length) renderSection({ id: "sec-org", icon: "🏢", title: "ORGANIZATION DATA", color: "green",
    rows: [
      { key: "name",       value: b.name       || b.organization || "—" },
      { key: "network",    value: b.network                      || "—" },
      { key: "allocation", value: b.allocation                   || "—" },
    ],
  });

  if (domains.length) {
    const totalCount = assocData.record_count || domains.length;
    const shown = domains.slice(0, 25);
    const extra = totalCount - shown.length;
    renderSection({ id: "sec-dom", icon: "🔗", title: `ASSOCIATED DOMAINS (${totalCount})`, color: "cyan",
      custom: `<div class="section-content">
        <div class="flex flex-wrap gap-1">
          ${shown.map((d) => `<span class="cyber-tag">${escapeHtml(d.hostname)}</span>`).join("")}
        </div>
        ${extra > 0 ? `<p class="font-mono text-xs text-slate-600 mt-2">+${extra} more domains associated with this IP</p>` : ""}
      </div>`,
    });
  } else {
    // No associated domains found — show informational row
    renderSection({ id: "sec-dom", icon: "🔗", title: "ASSOCIATED DOMAINS", color: "cyan",
      rows: [{ key: "status", value: "No domains associated with this IP in SecurityTrails database" }],
    });
  }
}

function renderSection({ id, icon, title, color, rows, custom }) {
  const tc = color === "green" ? "#00ff88" : "#00d4ff";
  const bc = color === "green" ? "rgba(0,255,136,0.2)" : "rgba(0,212,255,0.2)";

  const rowsHTML = (rows || []).map((r) =>
    `<div class="data-row">
      <span class="data-key">${r.key}</span>
      <span class="data-value ${r.highlight ? "highlight" : r.warn ? "warn" : ""}">${escapeHtml(String(r.value ?? "—"))}</span>
    </div>`
  ).join("");

  DOM.resultSections.insertAdjacentHTML("beforeend", `
    <div class="result-section collapsed cyber-card fade-in" id="${id}" style="border-color:${bc}">
      <div class="section-header" onclick="toggleSection('${id}')">
        <div class="flex items-center gap-3">
          <span class="text-base">${icon}</span>
          <span class="font-display text-xs font-bold tracking-widest" style="color:${tc}">${title}</span>
        </div>
        <svg class="chevron w-4 h-4 transition-transform" fill="none" stroke="${tc}" stroke-width="2" viewBox="0 0 24 24">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      ${custom || `<div class="section-content">${rowsHTML}</div>`}
    </div>
  `);

  // Auto-expand first two
  const all = DOM.resultSections.querySelectorAll(".result-section");
  if (all.length <= 2) {
    setTimeout(() => expandSection(id), 60 * (all.length - 1));
  }
}

function toggleSection(id) {
  const el = $(id);
  if (!el) return;
  el.classList.contains("collapsed") ? expandSection(id) : collapseSection(id);
}

function expandSection(id) {
  const el = $(id);
  if (!el) return;
  el.classList.replace("collapsed", "expanded");
  const c = el.querySelector(".chevron");
  if (c) c.style.transform = "rotate(180deg)";
}

function collapseSection(id) {
  const el = $(id);
  if (!el) return;
  el.classList.replace("expanded", "collapsed");
  const c = el.querySelector(".chevron");
  if (c) c.style.transform = "";
}

/* ─────────────────────────────────────────
   ERROR DISPLAY
───────────────────────────────────────── */
function showError(msg) {
  DOM.errorMsg.textContent = msg;
  DOM.errorAlert.classList.remove("hidden");
  DOM.loader.classList.add("hidden");
  DOM.loader.classList.remove("flex");
  DOM.progressBar.classList.add("hidden");
}

function hideError() { DOM.errorAlert.classList.add("hidden"); }

/* ─────────────────────────────────────────
   MAIN SCAN FLOW
───────────────────────────────────────── */
async function runScan() {
  if (state.isScanning) return;

  const rawTarget = DOM.scanInput.value.trim();
  const scanType = DOM.scanType.value;

  hideError();
  DOM.resultsContainer.classList.add("hidden");
  [DOM.clearResultsBtn, DOM.exportBtn, DOM.copyBtn].forEach((b) => b.classList.add("hidden"));

  const validation = validateInput(rawTarget, scanType);
  if (!validation.valid) { showError(validation.msg); DOM.scanInput.focus(); return; }

  const target = rawTarget.toLowerCase();
  state.isScanning = true;
  DOM.scanBtn.disabled = true;
  DOM.scanBtnText.textContent = "⏳ SCANNING...";
  DOM.progressBar.classList.remove("hidden");
  DOM.loader.classList.remove("hidden");
  DOM.loader.classList.add("flex");
  state.stats.total++;

  try {
    setLoaderMsg("ESTABLISHING SECURE CONNECTION...");
    await delay(150);

    let data;
    const hasProxy = !!getProxyUrl();

    if (!hasProxy) {
      setLoaderMsg("NO PROXY — LOADING DEMO DATA...");
      await delay(700);
      data = getDemoData(target, scanType);
    } else {
      setLoaderMsg(`QUERYING INTELLIGENCE DATA FOR: ${target.toUpperCase()}`);
      data = await fetchData(target, scanType);
      setLoaderMsg("PARSING INTELLIGENCE DATA...");
      await delay(200);
    }

    state.currentResults = { target, type: scanType, data, timestamp: new Date().toISOString() };
    state.stats.success++;
    if (scanType === "domain") state.stats.domains++;
    persistStats();
    addToHistory(target, scanType);
    renderResults(data, target, scanType);
    [DOM.clearResultsBtn, DOM.exportBtn, DOM.copyBtn].forEach((b) => b.classList.remove("hidden"));

  } catch (err) {
    state.stats.failed++;
    persistStats();

    let msg = "An unexpected error occurred. Please try again.";
    if (err.name === "AbortError") {
      msg = "Request timed out. The proxy or API server took too long to respond.";
    } else if (err instanceof APIError) {
      const codes = {
        401: "Authentication failed (401). Check that your API key is correctly set as the SECURITYTRAILS_KEY secret on the Worker.",
        403: "Access forbidden (403). Your API key may lack permission for this endpoint.",
        429: "Rate limit exceeded (429). Please wait before making another request.",
        404: `Target not found (404): "${target}" returned no results from SecurityTrails.`,
        503: "Proxy not ready (503). Ensure SECURITYTRAILS_KEY is set as a secret on your Cloudflare Worker.",
      };
      msg = codes[err.status] || `API Error ${err.status}: ${err.message}`;
    } else if (err.message) {
      msg = err.message;
    }

    showError(msg);
  } finally {
    state.isScanning = false;
    DOM.scanBtn.disabled = false;
    DOM.scanBtnText.textContent = "▶ INITIATE SCAN";
    DOM.loader.classList.add("hidden");
    DOM.loader.classList.remove("flex");
    DOM.progressBar.classList.add("hidden");
    updateStats();
  }
}

/* ─────────────────────────────────────────
   HISTORY
───────────────────────────────────────── */
function addToHistory(target, type) {
  state.history = [
    { target, type, timestamp: new Date().toISOString() },
    ...state.history.filter((h) => h.target !== target),
  ].slice(0, 20);
  persistHistory();
  renderHistory();
}

function renderHistory() {
  if (!state.history.length) {
    DOM.historyList.innerHTML = `<p class="font-mono text-xs text-slate-600 text-center py-4">No scans recorded</p>`;
    return;
  }
  DOM.historyList.innerHTML = state.history.map((e) => {
    const time = new Date(e.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const tc = e.type === "domain" ? "#00d4ff" : "#00ff88";
    const lbl = e.type === "domain" ? "DOM" : "IP";
    return `<div class="history-item" onclick="loadFromHistory('${escapeHtml(e.target)}','${e.type}')">
      <div class="flex items-center gap-2 min-w-0">
        <span class="font-mono text-xs flex-shrink-0" style="color:${tc}">[${lbl}]</span>
        <span class="font-mono text-xs text-slate-400 truncate">${escapeHtml(e.target)}</span>
      </div>
      <span class="font-mono text-xs text-slate-700 flex-shrink-0 ml-2">${time}</span>
    </div>`;
  }).join("");
}

function loadFromHistory(target, type) {
  DOM.scanInput.value = target;
  DOM.scanType.value = type;
  DOM.clearInputBtn.classList.remove("hidden");
  runScan();
}

/* ─────────────────────────────────────────
   STATS
───────────────────────────────────────── */
function updateStats() {
  DOM.statTotal.textContent = state.stats.total;
  DOM.statSuccess.textContent = state.stats.success;
  DOM.statFailed.textContent = state.stats.failed;
  DOM.statDomains.textContent = state.stats.domains;
}

/* ─────────────────────────────────────────
   PING PROXY
───────────────────────────────────────── */
async function pingProxy() {
  const proxy = getProxyUrl();
  if (!proxy) {
    showProxyStatus("error", "✗ No proxy URL configured. Enter a Worker URL and save first.");
    return;
  }

  showProxyStatus("loading", "PINGING PROXY...");
  DOM.pingBtn.disabled = true;

  try {
    const pingUrl = buildUrl("/ping");
    const res = await fetchWithTimeout(pingUrl, {
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      showProxyStatus("success", `✓ PROXY ONLINE — ${data.message || "SecurityTrails connection verified"}`);
    } else {
      const err = await res.json().catch(() => ({}));
      showProxyStatus("error", `✗ ERROR ${res.status}: ${err.error || err.message || res.statusText}`);
    }
  } catch (e) {
    const msg = e.name === "AbortError" ? "TIMEOUT" : e.message;
    showProxyStatus("error", `✗ ${msg}`);
  } finally {
    DOM.pingBtn.disabled = false;
  }
}

function showProxyStatus(type, msg) {
  const colors = { success: "#00ff88", error: "#ff3366", loading: "#00d4ff" };
  DOM.proxyStatus.style.color = colors[type] || "#00d4ff";
  DOM.proxyStatus.textContent = msg;
  DOM.proxyStatus.classList.remove("hidden");
}

/* ─────────────────────────────────────────
   EXPORT / COPY
───────────────────────────────────────── */
function exportJSON() {
  if (!state.currentResults) return;
  const blob = new Blob([JSON.stringify(state.currentResults, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `falconintel_${state.currentResults.target}_${Date.now()}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
}

async function copyToClipboard() {
  if (!state.currentResults) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(state.currentResults, null, 2));
    const orig = DOM.copyBtn.textContent;
    DOM.copyBtn.textContent = "✓ COPIED!";
    DOM.copyBtn.style.cssText = "border-color:#00ff88;color:#00ff88";
    setTimeout(() => { DOM.copyBtn.textContent = orig; DOM.copyBtn.style.cssText = ""; }, 2000);
  } catch (_) {
    showError("Clipboard access denied. Use the export button instead.");
  }
}

function clearResults() {
  DOM.resultsContainer.classList.add("hidden");
  [DOM.clearResultsBtn, DOM.exportBtn, DOM.copyBtn].forEach((b) => b.classList.add("hidden"));
  state.currentResults = null;
  hideError();
}

/* ─────────────────────────────────────────
   UTILITIES
───────────────────────────────────────── */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }
function setLoaderMsg(msg) { DOM.loaderMsg.textContent = msg; }

/* ─────────────────────────────────────────
   EVENT BINDINGS
───────────────────────────────────────── */
function bindEvents() {
  DOM.scanBtn.addEventListener("click", runScan);
  DOM.scanInput.addEventListener("keydown", (e) => e.key === "Enter" && runScan());
  DOM.scanInput.addEventListener("input", () => {
    DOM.clearInputBtn.classList.toggle("hidden", !DOM.scanInput.value);
    hideError();
  });
  DOM.clearInputBtn.addEventListener("click", () => {
    DOM.scanInput.value = "";
    DOM.clearInputBtn.classList.add("hidden");
    DOM.scanInput.focus();
    hideError();
  });
  DOM.clearResultsBtn.addEventListener("click", clearResults);
  DOM.exportBtn.addEventListener("click", exportJSON);
  DOM.copyBtn.addEventListener("click", copyToClipboard);

  DOM.saveProxyBtn.addEventListener("click", () => {
    const url = DOM.proxyUrlInput.value.trim().replace(/\/$/, "");
    if (url) {
      localStorage.setItem("falconintel_proxy", url);
      showProxyStatus("success", "✓ PROXY URL SAVED");
    } else {
      localStorage.removeItem("falconintel_proxy");
      showProxyStatus("error", "PROXY URL CLEARED — Demo mode active");
    }
    updateProxyBadge();
  });

  DOM.pingBtn.addEventListener("click", pingProxy);

  DOM.clearHistoryBtn.addEventListener("click", () => {
    state.history = [];
    persistHistory();
    renderHistory();
  });

  // Auto-detect domain vs IP on paste
  DOM.scanInput.addEventListener("paste", () => {
    setTimeout(() => {
      const val = DOM.scanInput.value.trim();
      DOM.scanType.value = /^(\d{1,3}\.){3}\d{1,3}$/.test(val) || /^[0-9a-fA-F:]+$/.test(val) ? "ip" : "domain";
      DOM.clearInputBtn.classList.toggle("hidden", !val);
    }, 50);
  });
}

/* ─────────────────────────────────────────
   BOOT
───────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", init);
window.toggleSection = toggleSection;
window.loadFromHistory = loadFromHistory;
