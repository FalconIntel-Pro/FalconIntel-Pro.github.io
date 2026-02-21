# 🛰 FalconIntel-Pro — SecurityTrails Scanner

A professional cybersecurity-themed web application for domain and IP intelligence gathering using the SecurityTrails API.

## 🚀 Features

- 🔍 **Domain Scan** — DNS records (A, MX, NS, TXT, SOA), subdomains, Alexa rank
- 🌍 **IP Scan** — IP block info, organization data, associated domains
- 📋 **Scan History** — Saved in LocalStorage with one-click re-scan
- 💾 **Export as JSON** — Download intelligence results
- 📋 **Copy to Clipboard** — One-click copy
- 🎨 **Dark Cyber UI** — Neon glow, particle effects, animated scanning
- 📱 **Responsive** — Mobile-first layout

## ⚡ Setup

1. Clone / download the repository
2. Get a free API key at [securitytrails.com](https://securitytrails.com/app/account/credentials)
3. Open `index.html` in your browser or deploy to GitHub Pages
4. Enter your API key in the sidebar **API CONFIGURATION** panel and click **SAVE KEY**
5. Optionally paste your key directly in `config.js`

## 📁 Project Structure

```
/FalconIntel-Pro
├── index.html     — Main UI (HTML5 + Tailwind CDN)
├── config.js      — API configuration
├── app.js         — Application logic
└── README.md
```

## ⚠️ Security Warning

**Never expose production API keys in frontend applications.**

This project stores your API key in `localStorage` (browser storage). This is acceptable for personal use but **not secure** for public deployments.

For production use, implement a backend proxy:
- **Netlify Function** → `/.netlify/functions/proxy.js`
- **Vercel Serverless** → `/api/proxy.js`
- **Express server** → `/api/securitytrails`

## 🌐 Deploy to GitHub Pages

1. Push this folder to a GitHub repository
2. Go to **Settings → Pages**
3. Set source to `main` branch, root folder
4. Your scanner will be live at `https://FalconIntel-Pro.github.io`

## 🔗 API Reference

- [SecurityTrails API Docs](https://docs.securitytrails.com)
- [API Key Dashboard](https://securitytrails.com/app/account/credentials)

---

*For authorized use only. Powered by [SecurityTrails API](https://securitytrails.com).*
