// Public values only. No client secret exists for External Interface apps.
// The client id comes from the External Interface app you register with the Port MCP (its `clientId`, not its `id`).
// Set it per browser with ?client_id=...&region=us|eu (persisted in localStorage), or ?reset to clear it.
(() => {
  const REGIONS = {
    us: { AUTH0_DOMAIN: "auth.us.getport.io", PORT_API_BASE: "https://api.us.port.io" },
    eu: { AUTH0_DOMAIN: "auth.getport.io", PORT_API_BASE: "https://api.getport.io" },
  };
  const DEFAULTS = { region: "us", client_id: "" };
  const KEY = "port_poc_config";

  const q = new URLSearchParams(location.search);
  const reset = q.has("reset");

  let saved = {};
  if (!reset) {
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    } catch (e) {
      saved = {};
    }
  }

  if (q.get("client_id")) {
    saved.client_id = q.get("client_id");
  }
  const region = (q.get("region") || "").toLowerCase();
  if (REGIONS[region]) {
    saved.region = region;
  }

  try {
    if (reset) {
      localStorage.removeItem(KEY);
    } else {
      localStorage.setItem(KEY, JSON.stringify(saved));
    }
  } catch (e) {
    // Storage blocked (private mode etc.): settings only last for this page load.
  }

  const cfg = { ...DEFAULTS, ...saved };

  // Directory the site is served from: "/" locally, "/<repo>/" on a GitHub Pages project site.
  const BASE_URL = new URL(".", location.href).href;

  window.PORT_POC = {
    REGIONS,
    REGION: cfg.region,
    ...REGIONS[cfg.region], // PORT_API_BASE is also used as the OAuth audience
    CLIENT_ID: cfg.client_id,
    BASE_URL,
    REDIRECT_URI: new URL("callback.html", BASE_URL).href, // works on localhost, GitHub Pages and forks
    SCOPE: "openid profile email offline_access",
  };
})();
