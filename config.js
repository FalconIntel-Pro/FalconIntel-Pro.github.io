/**
 * CYBERINTEL Scanner — Configuration
 * 
 * ⚠️ WARNING:
 * Never expose production API keys in frontend applications.
 * For production use, implement a backend proxy server (Vercel/Netlify/Express).
 * This config file is for demonstration purposes only.
 * 
 * In production, move your API key to:
 *   - Netlify Function: /.netlify/functions/proxy
 *   - Vercel Serverless: /api/proxy.js
 *   - Express backend: /api/securitytrails
 */

const CONFIG = {
  // Replace with your SecurityTrails API key
  // Get yours at: https://securitytrails.com/app/account/credentials
  API_KEY: "",

  // API base URL
  BASE_URL: "https://api.securitytrails.com/v1",

  // Request timeout in milliseconds
  TIMEOUT_MS: 15000,

  // App version
  VERSION: "2.0.0",
};
