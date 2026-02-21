/**
 * CYBERINTEL — SecurityTrails Scanner
 * Main Application Logic
 * 
 * ⚠️ WARNING:
 * Never expose production API keys in frontend applications.
 * For production use, implement a backend proxy server.
 */

"use strict";

/* ─────────────────────────────────────────
   STATE
───────────────────────────────────────── */
const state = {
  apiKey: "",
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
  scanInput:       $("scanInput"),
  scanType:        $("scanType"),
  scanBtn:         $("scanBtn"),
  scanBtnText:     $("scanBtnText"),
  clearInputBtn:   $("clearInputBtn"),
  clearResultsBtn: $("clearResultsBtn"),
  exportBtn:       $("exportBtn"),
  copyBtn:         $("copyBtn"),
  progressBar:     $("progressBar"),
  errorAlert:      $("errorAlert"),
  errorMsg:        $("errorMsg"),
  loader:          $("loader"),
  loaderMsg:       $("loaderMsg"),
  resultsContainer:$("resultsContainer"),
  resultSections:  $("resultSections"),
  resultTarget:    $("resultTarget"),
  resultTimestamp: $("resultTimestamp"),
  apiKeyInput:     $("apiKeyInput"),
  toggleApiKey:    $("toggleApiKey"),
  saveApiKeyBtn:   $("saveApiKeyBtn"),
  pingBtn:         $("pingBtn"),
  apiStatus:       $("apiStatus"),
  historyList:     $("historyList"),
  clearHistoryBtn: $("clearHistoryBtn"),
  statTotal:       $("statTotal"),
  statSuccess:     $("statSuccess"),
  statFailed:      $("statFailed"),
  statDomains:     $("statDomains"),
  clock:           $("clock"),
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
}

/* ─────────────────────────────────────────
   PERSIST / LOAD
───────────────────────────────────────── */
function loadPersistedData() {
  // Load API key from localStorage (or use CONFIG)
  const saved = localStorage.getItem("cyberintel_apikey");
  if (saved) {
    state.apiKey = saved;
    DOM.apiKeyInput.value = saved;
  } else if (CONFIG.API_KEY) {
    state.apiKey = CONFIG.API_KEY;
    DOM.apiKeyInput.value = CONFIG.API_KEY;
  }

  // Load history
  const savedHistory = localStorage.getItem("cyberintel_history");
  if (savedHistory) {
    try { state.history = JSON.parse(savedHistory); } catch (_) {}
  }

  // Load stats
  const savedStats = localStorage.getItem("cyberintel_stats");
  if (savedStats) {
    try { Object.assign(state.stats, JSON.parse(savedStats)); } catch (_) {}
  }
}

function persistHistory() {
  localStorage.setItem("cyberintel_history", JSON.stringify(state.history.slice(0, 30)));
}

function persistStats() {
  localStorage.setItem("cyberintel_stats", JSON.stringify(state.stats));
}

/* ─────────────────────────────────────────
   CLOCK
───────────────────────────────────────── */
function startClock() {
  function tick() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    DOM.clock.textContent = `${h}:${m}:${s} UTC`;
  }
  tick();
  setInterval(tick, 1000);
}

/* ─────────────────────────────────────────
   PARTICLES (canvas background)
───────────────────────────────────────── */
function initParticles() {
  const canvas = document.getElementById("particles");
  const ctx = canvas.getContext("2d");
  let particles = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  function createParticle() {
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 1.5 + 0.3,
      opacity: Math.random() * 0.4 + 0.05,
    };
  }

  for (let i = 0; i < 80; i++) particles.push(createParticle());

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 212, 255, ${p.opacity})`;
      ctx.fill();

      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    });
    requestAnimationFrame(draw);
  }
  draw();
}

/* ─────────────────────────────────────────
   VALIDATION
───────────────────────────────────────── */
function validateInput(value, type) {
  const trimmed = value.trim();
  if (!trimmed) return { valid: false, msg: "Please enter a domain or IP address to scan." };

  if (type === "domain") {
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(trimmed)) {
      return { valid: false, msg: `Invalid domain format: "${trimmed}". Expected format: example.com` };
    }
  } else {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^(([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4})?::(([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4})?$/;
    if (!ipv4Regex.test(trimmed) && !ipv6Regex.test(trimmed)) {
      return { valid: false, msg: `Invalid IP address format: "${trimmed}". Expected format: 192.168.1.1` };
    }
    if (ipv4Regex.test(trimmed)) {
      const parts = trimmed.split(".").map(Number);
      if (parts.some((p) => p > 255)) {
        return { valid: false, msg: `Invalid IP address: "${trimmed}". Each octet must be 0-255.` };
      }
    }
  }
  return { valid: true };
}

/* ─────────────────────────────────────────
   API CALLS
───────────────────────────────────────── */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS || 15000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}


function isSameOrigin(url) {
  try {
    return new URL(url, window.location.origin).origin === window.location.origin;
  } catch (_) {
    return false;
  }
}

function getApiBaseUrl() {
  const proxy = (CONFIG.PROXY_URL || "").trim();
  if (proxy) return proxy.replace(/\/$/, "");

  if (CONFIG.REQUIRE_PROXY !== false && !isSameOrigin(CONFIG.BASE_URL)) {
    throw new Error(
      "Direct browser calls to SecurityTrails are blocked by CORS. Configure CONFIG.PROXY_URL to a backend proxy endpoint."
    );
  }

  return (CONFIG.BASE_URL || "").replace(/\/$/, "");
}

function buildApiUrl(path) {
  const base = getApiBaseUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

async function fetchData(target, type) {
  const apiKey = state.apiKey;
  if (!apiKey) throw new Error("No API key configured. Please enter your SecurityTrails API key in the sidebar.");

  const headers = {
    "APIKEY": apiKey,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  const results = {};

  if (type === "domain") {
    // Parallel fetch domain + DNS info
    const [infoRes, dnsRes, subdomainsRes] = await Promise.allSettled([
      fetchWithTimeout(buildApiUrl(`/domain/${target}`), { headers }),
      fetchWithTimeout(buildApiUrl(`/domain/${target}/dns/a`), { headers }),
      fetchWithTimeout(buildApiUrl(`/domain/${target}/subdomains?children_only=false&include_inactive=false`), { headers }),
    ]);

    if (infoRes.status === "fulfilled") {
      if (!infoRes.value.ok) {
        const err = await infoRes.value.json().catch(() => ({}));
        throw new APIError(infoRes.value.status, err.message || infoRes.value.statusText, err);
      }
      results.domainInfo = await infoRes.value.json();
    }

    if (dnsRes.status === "fulfilled" && dnsRes.value.ok) {
      results.dnsInfo = await dnsRes.value.json();
    }

    if (subdomainsRes.status === "fulfilled" && subdomainsRes.value.ok) {
      results.subdomains = await subdomainsRes.value.json();
    }

    return results;

  } else {
    // IP scan
    const [infoRes, domainsRes] = await Promise.allSettled([
      fetchWithTimeout(buildApiUrl(`/ips/nearby/${target}`), { headers }),
      fetchWithTimeout(buildApiUrl(`/ips/${target}/domains?page=1`), { headers }),
    ]);

    if (infoRes.status === "fulfilled") {
      if (!infoRes.value.ok) {
        const err = await infoRes.value.json().catch(() => ({}));
        throw new APIError(infoRes.value.status, err.message || infoRes.value.statusText, err);
      }
      results.ipInfo = await infoRes.value.json();
    }

    if (domainsRes.status === "fulfilled" && domainsRes.value.ok) {
      results.ipDomains = await domainsRes.value.json();
    }

    return results;
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
   DEMO DATA (when no API key)
───────────────────────────────────────── */
function getDemoData(target, type) {
  if (type === "domain") {
    return {
      _demo: true,
      domainInfo: {
        alexa_rank: 1,
        apex_domain: target,
        hostname: target,
        current_dns: {
          a: { values: [{ ip: "93.184.216.34", ttl: 3600 }], first_seen: "2013-01-01", last_seen: "2024-01-15" },
          aaaa: { values: [], first_seen: null, last_seen: null },
          mx: { values: [{ priority: 10, value: `mail.${target}` }], first_seen: "2013-01-01", last_seen: "2024-01-15" },
          ns: { values: [{ nameserver: `ns1.${target}` }, { nameserver: `ns2.${target}` }], first_seen: "2013-01-01", last_seen: "2024-01-15" },
          soa: { values: [{ email: `hostmaster@${target}`, ttl: 3600 }], first_seen: "2013-01-01", last_seen: "2024-01-15" },
          txt: { values: [{ value: "v=spf1 include:_spf.example.com ~all" }] },
        },
      },
      dnsInfo: {
        type: "a",
        pages: 1,
        records: {
          a: { ip: "93.184.216.34", ttl: 3600, first_seen: "2013-01-01T00:00:00.000Z", last_seen: "2024-01-15T12:00:00.000Z", organizations: ["EDGECAST INC"] },
        },
      },
      subdomains: {
        subdomain_count: 42,
        subdomains: ["www", "mail", "ftp", "api", "blog", "dev", "staging", "cdn"],
      },
    };
  } else {
    return {
      _demo: true,
      ipInfo: {
        blocks: [
          {
            network: target + "/24",
            cidr: target + "/24",
            name: "EXAMPLE-NET",
            organization: "Example Org",
            allocation: "allocated",
            created: "2000-01-01T00:00:00.000Z",
          },
        ],
      },
      ipDomains: {
        record_count: 15,
        pages: 1,
        records: [
          { alexa_rank: null, hostname: "example.com", whois: { registrar: "MarkMonitor Inc." } },
          { alexa_rank: null, hostname: "example.net", whois: { registrar: "MarkMonitor Inc." } },
          { alexa_rank: null, hostname: "example.org", whois: { registrar: "MarkMonitor Inc." } },
        ],
      },
    };
  }
}

/* ─────────────────────────────────────────
   RENDER RESULTS
───────────────────────────────────────── */
function renderResults(data, target, type) {
  DOM.resultSections.innerHTML = "";
  const isDemo = data._demo === true;

  if (isDemo) {
    DOM.resultSections.insertAdjacentHTML(
      "beforeend",
      `<div class="font-mono text-xs text-amber-400/70 border border-amber-400/20 bg-amber-400/5 p-3 mb-3 flex items-center gap-2">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        DEMO MODE — Add a real API key to retrieve live intelligence data
      </div>`
    );
  }

  if (type === "domain") {
    renderDomainResults(data, target);
  } else {
    renderIpResults(data, target);
  }

  // Show results
  DOM.resultsContainer.classList.remove("hidden");
  DOM.resultTarget.textContent = `[ ${target.toUpperCase()} ]`;
  DOM.resultTimestamp.textContent = new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC";

  // Scroll to results
  DOM.resultsContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderDomainResults(data, target) {
  const info = data.domainInfo || {};
  const dns = info.current_dns || {};
  const subs = data.subdomains || {};
  const dnsHistory = data.dnsInfo || {};

  // ─ Domain Status Section
  renderSection({
    id: "section-status",
    icon: "🛰",
    title: "DOMAIN STATUS",
    color: "cyan",
    rows: [
      { key: "hostname", value: info.hostname || info.apex_domain || target },
      { key: "alexa rank", value: info.alexa_rank ? `#${info.alexa_rank}` : "N/A" },
      { key: "apex domain", value: info.apex_domain || target },
    ],
  });

  // ─ DNS — A Records
  const aVals = dns.a?.values || [];
  if (aVals.length > 0) {
    renderSection({
      id: "section-a",
      icon: "📡",
      title: "DNS — A RECORDS (IPv4)",
      color: "green",
      rows: aVals.map((v) => ({ key: "ip address", value: v.ip, highlight: true }))
        .concat([
          { key: "first seen", value: dns.a?.first_seen || "—" },
          { key: "last seen", value: dns.a?.last_seen || "—" },
          { key: "ttl", value: v.ttl ? `${aVals[0].ttl}s` : "—" },
        ]),
    });
  }

  // ─ DNS — MX Records
  const mxVals = dns.mx?.values || [];
  if (mxVals.length > 0) {
    renderSection({
      id: "section-mx",
      icon: "📬",
      title: "DNS — MX RECORDS (MAIL)",
      color: "cyan",
      rows: mxVals.map((v) => ({ key: `mx ${v.priority || 10}`, value: v.value || v.hostname || "—" }))
        .concat([
          { key: "first seen", value: dns.mx?.first_seen || "—" },
          { key: "last seen", value: dns.mx?.last_seen || "—" },
        ]),
    });
  }

  // ─ DNS — NS Records
  const nsVals = dns.ns?.values || [];
  if (nsVals.length > 0) {
    renderSection({
      id: "section-ns",
      icon: "🌐",
      title: "DNS — NAMESERVERS",
      color: "cyan",
      rows: nsVals.map((v, i) => ({ key: `ns${i + 1}`, value: v.nameserver || v.value || "—" })),
    });
  }

  // ─ TXT Records
  const txtVals = dns.txt?.values || [];
  if (txtVals.length > 0) {
    renderSection({
      id: "section-txt",
      icon: "📝",
      title: "DNS — TXT RECORDS",
      color: "cyan",
      rows: txtVals.map((v, i) => ({ key: `txt ${i + 1}`, value: v.value || "—" })),
    });
  }

  // ─ SOA Record
  const soaVals = dns.soa?.values || [];
  if (soaVals.length > 0) {
    const soa = soaVals[0];
    renderSection({
      id: "section-soa",
      icon: "📋",
      title: "SOA RECORD",
      color: "cyan",
      rows: [
        { key: "admin email", value: soa.email || "—" },
        { key: "ttl", value: soa.ttl ? `${soa.ttl}s` : "—" },
        { key: "refresh", value: soa.refresh || "—" },
        { key: "retry", value: soa.retry || "—" },
      ],
    });
  }

  // ─ Subdomains
  if (subs.subdomain_count || subs.subdomains?.length) {
    const subList = (subs.subdomains || []).slice(0, 20);
    const extraCount = (subs.subdomain_count || subs.subdomains?.length) - subList.length;

    renderSection({
      id: "section-subs",
      icon: "🕵️",
      title: `SUBDOMAINS (${subs.subdomain_count || subList.length} TOTAL)`,
      color: "green",
      custom: `
        <div class="section-content">
          <div class="flex flex-wrap gap-1">
            ${subList.map((s) => `<span class="cyber-tag">${s}.${target}</span>`).join("")}
            ${extraCount > 0 ? `<span class="cyber-tag" style="color:#ffd700;border-color:rgba(255,215,0,0.3)">+${extraCount} more</span>` : ""}
          </div>
        </div>
      `,
    });
  }
}

function renderIpResults(data, target) {
  const blocks = data.ipInfo?.blocks || [];
  const domainData = data.ipDomains || {};
  const domains = domainData.records || [];

  // ─ IP Overview
  if (blocks.length > 0) {
    const b = blocks[0];
    renderSection({
      id: "section-ip",
      icon: "🌍",
      title: "IP INFORMATION",
      color: "cyan",
      rows: [
        { key: "ip address", value: target, highlight: true },
        { key: "cidr block", value: b.cidr || b.network || "—" },
        { key: "network", value: b.network || "—" },
        { key: "organization", value: b.organization || b.name || "—", highlight: true },
        { key: "allocation", value: b.allocation || "—" },
        { key: "created", value: b.created ? b.created.substring(0, 10) : "—" },
      ],
    });
  } else {
    renderSection({
      id: "section-ip",
      icon: "🌍",
      title: "IP INFORMATION",
      color: "cyan",
      rows: [{ key: "ip address", value: target, highlight: true }],
    });
  }

  // ─ Organization Data
  if (blocks.length > 0) {
    const b = blocks[0];
    renderSection({
      id: "section-org",
      icon: "🏢",
      title: "ORGANIZATION DATA",
      color: "green",
      rows: [
        { key: "name", value: b.name || b.organization || "—" },
        { key: "network", value: b.network || "—" },
        { key: "allocation", value: b.allocation || "—" },
      ],
    });
  }

  // ─ Associated Domains
  if (domains.length > 0) {
    renderSection({
      id: "section-domains",
      icon: "🔗",
      title: `ASSOCIATED DOMAINS (${domainData.record_count || domains.length})`,
      color: "cyan",
      custom: `
        <div class="section-content">
          <div class="flex flex-wrap gap-1 mb-2">
            ${domains.slice(0, 20).map((d) => `<span class="cyber-tag">${d.hostname}</span>`).join("")}
          </div>
          ${domainData.record_count > 20 ? `<p class="font-mono text-xs text-slate-600 mt-2">+${domainData.record_count - 20} more domains hosted on this IP</p>` : ""}
        </div>
      `,
    });
  }
}

function renderSection({ id, icon, title, color, rows, custom }) {
  const borderColor = color === "green" ? "rgba(0,255,136,0.2)" : "rgba(0,212,255,0.2)";
  const textColor = color === "green" ? "#00ff88" : "#00d4ff";
  const hoverBg = color === "green" ? "rgba(0,255,136,0.05)" : "rgba(0,212,255,0.05)";

  const rowsHTML = rows
    ? rows
        .map(
          (r) =>
            `<div class="data-row">
              <span class="data-key">${r.key}</span>
              <span class="data-value ${r.highlight ? "highlight" : r.warn ? "warn" : ""}">${escapeHtml(String(r.value ?? "—"))}</span>
            </div>`
        )
        .join("")
    : "";

  const html = `
    <div class="result-section collapsed cyber-card fade-in" id="${id}" style="--accent:${textColor}; border-color:${borderColor};">
      <div class="section-header" onclick="toggleSection('${id}')">
        <div class="flex items-center gap-3">
          <span class="text-base">${icon}</span>
          <span class="font-display text-xs font-bold tracking-widest" style="color:${textColor}">${title}</span>
        </div>
        <svg class="chevron w-4 h-4 transition-transform" fill="none" stroke="${textColor}" stroke-width="2" viewBox="0 0 24 24">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      ${custom || `<div class="section-content">${rowsHTML}</div>`}
    </div>
  `;

  DOM.resultSections.insertAdjacentHTML("beforeend", html);

  // Auto-expand first two sections
  const allSections = DOM.resultSections.querySelectorAll(".result-section");
  if (allSections.length <= 2) {
    const newSection = DOM.resultSections.lastElementChild;
    setTimeout(() => expandSection(newSection.id), 50 * (allSections.length - 1));
  }
}

function toggleSection(id) {
  const el = $(id);
  if (!el) return;
  if (el.classList.contains("collapsed")) {
    expandSection(id);
  } else {
    collapseSection(id);
  }
}

function expandSection(id) {
  const el = $(id);
  if (!el) return;
  el.classList.remove("collapsed");
  el.classList.add("expanded");
  const chevron = el.querySelector(".chevron");
  if (chevron) chevron.style.transform = "rotate(180deg)";
}

function collapseSection(id) {
  const el = $(id);
  if (!el) return;
  el.classList.remove("expanded");
  el.classList.add("collapsed");
  const chevron = el.querySelector(".chevron");
  if (chevron) chevron.style.transform = "";
}

/* ─────────────────────────────────────────
   ERROR DISPLAY
───────────────────────────────────────── */
function showError(msg) {
  DOM.errorMsg.textContent = msg;
  DOM.errorAlert.classList.remove("hidden");
  DOM.loader.classList.remove("flex");
  DOM.loader.classList.add("hidden");
  DOM.progressBar.classList.add("hidden");
}

function hideError() {
  DOM.errorAlert.classList.add("hidden");
}

/* ─────────────────────────────────────────
   MAIN SCAN FLOW
───────────────────────────────────────── */
async function runScan() {
  if (state.isScanning) return;

  const rawTarget = DOM.scanInput.value.trim();
  const scanType = DOM.scanType.value;

  hideError();
  DOM.resultsContainer.classList.add("hidden");
  DOM.clearResultsBtn.classList.add("hidden");
  DOM.exportBtn.classList.add("hidden");
  DOM.copyBtn.classList.add("hidden");

  // Validate
  const validation = validateInput(rawTarget, scanType);
  if (!validation.valid) {
    showError(validation.msg);
    DOM.scanInput.focus();
    return;
  }

  const target = rawTarget.toLowerCase();

  // Show loader
  state.isScanning = true;
  DOM.scanBtn.disabled = true;
  DOM.scanBtnText.textContent = "⏳ SCANNING...";
  DOM.progressBar.classList.remove("hidden");
  DOM.loader.classList.remove("hidden");
  DOM.loader.classList.add("flex");
  DOM.loaderMsg.textContent = `SCANNING ${scanType === "domain" ? "DOMAIN" : "IP ADDRESS"}: ${target.toUpperCase()}`;

  state.stats.total++;

  try {
    let data;
    setLoaderMsg("ESTABLISHING SECURE CONNECTION...");
    await delay(200);

    if (!state.apiKey) {
      setLoaderMsg("API KEY NOT FOUND — LOADING DEMO DATA...");
      await delay(600);
      data = getDemoData(target, scanType);
    } else {
      setLoaderMsg("QUERYING SECURITYTRAILS API...");
      data = await fetchData(target, scanType);
    }

    setLoaderMsg("PARSING INTELLIGENCE DATA...");
    await delay(300);

    state.currentResults = { target, type: scanType, data, timestamp: new Date().toISOString() };

    // Update stats
    state.stats.success++;
    if (scanType === "domain") state.stats.domains++;
    persistStats();

    // Save to history
    addToHistory(target, scanType);

    // Render
    renderResults(data, target, scanType);

    // Show action buttons
    DOM.clearResultsBtn.classList.remove("hidden");
    DOM.exportBtn.classList.remove("hidden");
    DOM.copyBtn.classList.remove("hidden");

  } catch (err) {
    state.stats.failed++;
    persistStats();

    let errorMsg = "An unexpected error occurred. Please try again.";
    if (err.name === "AbortError") {
      errorMsg = "Request timed out. The API server took too long to respond.";
    } else if (err instanceof APIError) {
      if (err.status === 401) {
        errorMsg = "Authentication failed (401). Please check your API key in the sidebar.";
      } else if (err.status === 403) {
        errorMsg = "Access forbidden (403). Your API key may not have permission for this endpoint.";
      } else if (err.status === 429) {
        errorMsg = "Rate limit exceeded (429). Please wait before making another request.";
      } else if (err.status === 404) {
        errorMsg = `Target not found (404): "${target}" returned no results.`;
      } else {
        errorMsg = `API Error ${err.status}: ${err.message}`;
      }
    } else if (err.message) {
      errorMsg = err.message.includes("CORS") ? `${err.message} Until proxy is configured, run scans without an API key to use demo mode.` : err.message;
    }

    showError(errorMsg);

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
  const entry = {
    target,
    type,
    timestamp: new Date().toISOString(),
  };
  state.history = [entry, ...state.history.filter((h) => h.target !== target)].slice(0, 20);
  persistHistory();
  renderHistory();
}

function renderHistory() {
  if (state.history.length === 0) {
    DOM.historyList.innerHTML = `<p class="font-mono text-xs text-slate-600 text-center py-4">No scans recorded</p>`;
    return;
  }

  DOM.historyList.innerHTML = state.history
    .map((entry) => {
      const time = new Date(entry.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      const typeColor = entry.type === "domain" ? "#00d4ff" : "#00ff88";
      const typeLabel = entry.type === "domain" ? "DOM" : "IP";
      return `
        <div class="history-item" onclick="loadFromHistory('${escapeHtml(entry.target)}', '${entry.type}')">
          <div class="flex items-center gap-2 min-w-0">
            <span class="font-mono text-xs flex-shrink-0" style="color:${typeColor}">[${typeLabel}]</span>
            <span class="font-mono text-xs text-slate-400 truncate">${escapeHtml(entry.target)}</span>
          </div>
          <span class="font-mono text-xs text-slate-700 flex-shrink-0 ml-2">${time}</span>
        </div>
      `;
    })
    .join("");
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
   API KEY / PING
───────────────────────────────────────── */
async function pingApi() {
  const key = DOM.apiKeyInput.value.trim();
  if (!key) {
    showApiStatus("error", "Please enter an API key first.");
    return;
  }

  showApiStatus("loading", "PINGING API...");
  DOM.pingBtn.disabled = true;

  try {
    const res = await fetchWithTimeout(buildApiUrl(`/ping`), {
      headers: { "APIKEY": key, "Content-Type": "application/json" },
    });

    if (res.ok) {
      const data = await res.json();
      showApiStatus("success", `✓ API ONLINE — ${data.message || "Connection successful"}`);
    } else {
      const err = await res.json().catch(() => ({}));
      showApiStatus("error", `✗ ERROR ${res.status}: ${err.message || res.statusText}`);
    }
  } catch (e) {
    if (e.name === "AbortError") {
      showApiStatus("error", "✗ TIMEOUT: API did not respond");
    } else {
      showApiStatus("error", e.message.includes("CORS") ? `✗ ${e.message}` : `✗ NETWORK ERROR: ${e.message}`);
    }
  } finally {
    DOM.pingBtn.disabled = false;
  }
}

function showApiStatus(type, msg) {
  const colors = { success: "#00ff88", error: "#ff3366", loading: "#00d4ff" };
  DOM.apiStatus.style.color = colors[type] || "#00d4ff";
  DOM.apiStatus.textContent = msg;
  DOM.apiStatus.classList.remove("hidden");
}

/* ─────────────────────────────────────────
   EXPORT / COPY
───────────────────────────────────────── */
function exportJSON() {
  if (!state.currentResults) return;
  const json = JSON.stringify(state.currentResults, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cyberintel_${state.currentResults.target}_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyToClipboard() {
  if (!state.currentResults) return;
  const json = JSON.stringify(state.currentResults, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    const original = DOM.copyBtn.textContent;
    DOM.copyBtn.textContent = "✓ COPIED!";
    DOM.copyBtn.style.borderColor = "#00ff88";
    DOM.copyBtn.style.color = "#00ff88";
    setTimeout(() => {
      DOM.copyBtn.textContent = original;
      DOM.copyBtn.style.borderColor = "";
      DOM.copyBtn.style.color = "";
    }, 2000);
  } catch (_) {
    showError("Clipboard access denied. Use the export button instead.");
  }
}

function clearResults() {
  DOM.resultsContainer.classList.add("hidden");
  DOM.clearResultsBtn.classList.add("hidden");
  DOM.exportBtn.classList.add("hidden");
  DOM.copyBtn.classList.add("hidden");
  state.currentResults = null;
  hideError();
}

/* ─────────────────────────────────────────
   UTILITIES
───────────────────────────────────────── */
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setLoaderMsg(msg) {
  DOM.loaderMsg.textContent = msg;
}

/* ─────────────────────────────────────────
   EVENT BINDINGS
───────────────────────────────────────── */
function bindEvents() {
  // Scan button
  DOM.scanBtn.addEventListener("click", runScan);

  // Enter key in input
  DOM.scanInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runScan();
  });

  // Input change → show/hide clear btn
  DOM.scanInput.addEventListener("input", () => {
    if (DOM.scanInput.value.length > 0) {
      DOM.clearInputBtn.classList.remove("hidden");
    } else {
      DOM.clearInputBtn.classList.add("hidden");
    }
    hideError();
  });

  // Clear input
  DOM.clearInputBtn.addEventListener("click", () => {
    DOM.scanInput.value = "";
    DOM.clearInputBtn.classList.add("hidden");
    DOM.scanInput.focus();
    hideError();
  });

  // Clear results
  DOM.clearResultsBtn.addEventListener("click", clearResults);

  // Export
  DOM.exportBtn.addEventListener("click", exportJSON);

  // Copy
  DOM.copyBtn.addEventListener("click", copyToClipboard);

  // Toggle API key visibility
  DOM.toggleApiKey.addEventListener("click", () => {
    DOM.apiKeyInput.type = DOM.apiKeyInput.type === "password" ? "text" : "password";
  });

  // Save API key
  DOM.saveApiKeyBtn.addEventListener("click", () => {
    const key = DOM.apiKeyInput.value.trim();
    state.apiKey = key;
    if (key) {
      localStorage.setItem("cyberintel_apikey", key);
      showApiStatus("success", "✓ API KEY SAVED TO LOCAL STORAGE");
    } else {
      localStorage.removeItem("cyberintel_apikey");
      showApiStatus("error", "API KEY CLEARED");
    }
  });

  // Ping
  DOM.pingBtn.addEventListener("click", pingApi);

  // Clear history
  DOM.clearHistoryBtn.addEventListener("click", () => {
    state.history = [];
    persistHistory();
    renderHistory();
  });

  // Paste detection in input (auto-detect domain vs IP)
  DOM.scanInput.addEventListener("paste", (e) => {
    setTimeout(() => {
      const val = DOM.scanInput.value.trim();
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      const ipv6Regex = /^[0-9a-fA-F:]+$/;
      if (ipv4Regex.test(val) || ipv6Regex.test(val)) {
        DOM.scanType.value = "ip";
      } else {
        DOM.scanType.value = "domain";
      }
      DOM.clearInputBtn.classList.remove("hidden");
    }, 50);
  });
}

/* ─────────────────────────────────────────
   BOOT
───────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", init);

// Expose to window for inline onclick handlers
window.toggleSection = toggleSection;
window.loadFromHistory = loadFromHistory;
