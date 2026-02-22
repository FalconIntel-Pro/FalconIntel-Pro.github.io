# 🛰 FalconIntel-Pro — SecurityTrails Scanner

A professional cybersecurity-themed web application for domain and IP intelligence gathering using the SecurityTrails API.

## ⚡ Quick Start

> **Why a proxy?** SecurityTrails blocks direct browser requests (CORS policy). A Cloudflare Worker acts as a secure middleman — your API key never appears in the browser.

### Step 1 — Deploy the Cloudflare Worker (free, ~2 minutes)

1. Go to [workers.cloudflare.com](https://workers.cloudflare.com) and sign in (free account)
2. Click **Create Application → Create Worker**
3. Paste the entire contents of `worker.js` into the editor
4. Click **Deploy**
5. Copy your Worker URL (e.g. `https://falconintel-proxy.yourname.workers.dev`)

### Step 2 — Add your SecurityTrails API key as a secret

1. In your Worker dashboard → **Settings → Variables**
2. Under **Secrets**, click **Add variable**
3. Name: `SECURITYTRAILS_KEY` | Value: your API key from [securitytrails.com/app/account/credentials](https://securitytrails.com/app/account/credentials)
4. Click **Encrypt & Save**, then **Deploy**

### Step 3 — Configure the frontend

1. Open `config.js` and set `PROXY_URL` to your Worker URL + `/proxy`:
   ```js
   PROXY_URL: "https://falconintel-proxy.yourname.workers.dev/proxy",
   ```
2. OR paste it directly into the **PROXY CONFIGURATION** panel in the UI and click **SAVE URL**
3. Click **PING TEST** to verify the connection

### Step 4 — Deploy to GitHub Pages

Push the project to GitHub → Settings → Pages → Source: main branch root

---

## 🚀 Features

- 🔍 **Domain Scan** — A, MX, NS, TXT, SOA records + subdomain enumeration
- 🌍 **IP Scan** — Network block info, organization data, associated domains
- 🔒 **Secure proxy** — API key stored as Worker secret, never in browser
- 📋 **Scan History** — Persisted in LocalStorage
- 💾 **Export / Copy** — Download results as JSON or copy to clipboard
- 🎨 **Dark Cyber UI** — Neon glow, particles, animated scanning
- 📱 **Responsive** — Mobile-first layout

## 📁 Project Structure

```
/FalconIntel-Pro
├── index.html     — Main UI
├── config.js      — App configuration (no secrets here!)
├── app.js         — Application logic
├── worker.js      — Cloudflare Worker CORS proxy (deploy separately)
├── favicon.svg
└── README.md
```

## 🔒 Security Model

```
Browser (GitHub Pages)
    │
    │  GET /proxy/domain/example.com  (no API key)
    ▼
Cloudflare Worker
    │  Reads SECURITYTRAILS_KEY from env secret
    │
    │  GET /v1/domain/example.com  (API key added server-side)
    ▼
SecurityTrails API
    │
    └─ Response with CORS headers → back to browser
```

Your API key is **never** in the browser, GitHub repo, or network traffic from the client.

## 🔗 API Reference

- [SecurityTrails API Docs](https://docs.securitytrails.com)
- [API Key Dashboard](https://securitytrails.com/app/account/credentials)
- [Cloudflare Workers](https://workers.cloudflare.com)

---

*For authorized use only. Powered by [SecurityTrails API](https://securitytrails.com).*
