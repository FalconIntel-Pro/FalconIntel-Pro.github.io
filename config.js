/**
 * CYBERINTEL Scanner — Configuration
 */

const CONFIG = {
  // Keep empty in frontend. Use backend proxy for production requests.
  API_KEY: "",

  // Set to your own backend proxy endpoint (same-origin) that forwards to SecurityTrails.
  // Example: "https://your-backend.example.com/api/securitytrails"
  PROXY_URL: "",

  // SecurityTrails API base URL (used only by secure proxy servers)
  BASE_URL: "https://api.securitytrails.com/v1",

  // Prevent direct browser calls to SecurityTrails (avoids CORS failures and key exposure)
  REQUIRE_PROXY: true,

  // Request timeout in milliseconds
  TIMEOUT_MS: 15000,

  VERSION: "2.1.0",
};
