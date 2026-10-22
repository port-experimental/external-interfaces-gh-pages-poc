const C = window.PORT_POC;
const $ = (id) => document.getElementById(id);

function log(msg, cls) {
  const li = document.createElement("li");
  li.textContent = msg;
  if (cls) {
    li.className = cls;
  }
  $("log").appendChild(li);
}

function showError(msg) {
  const e = $("error");
  e.textContent = msg;
  e.hidden = false;
  log("ERROR: " + msg, "err");
}

function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomString(n = 48) {
  return b64url(crypto.getRandomValues(new Uint8Array(n)));
}

async function sha256(s) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
}

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "===".slice((payload.length + 3) % 4);
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) {
    return null;
  }
}

async function startLogin() {
  try {
    if (!C.CLIENT_ID) {
      throw new Error("No client id configured. Register an External Interface app with the Port MCP and set its clientId above.");
    }
    if (!window.isSecureContext || !crypto.subtle) {
      throw new Error("crypto.subtle unavailable: open via https:// or http://localhost (secure context), not an IP/other host.");
    }

    const verifier = randomString(48);
    const state = randomString(16);
    const challenge = b64url(await sha256(verifier));

    // Top-level redirect (this page isn't framed): verifier kept in sessionStorage, deleted on read. Never in the URL/state.
    sessionStorage.setItem("pkce", JSON.stringify({ verifier, state }));

    const q = new URLSearchParams({
      response_type: "code",
      client_id: C.CLIENT_ID,
      redirect_uri: C.REDIRECT_URI,
      scope: C.SCOPE,
      audience: C.PORT_API_BASE,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
    });
    location.assign(`https://${C.AUTH0_DOMAIN}/authorize?${q}`);
  } catch (e) {
    showError(e.message);
  }
}

async function portGet(path, token) {
  const r = await fetch(C.PORT_API_BASE + path, {
    headers: { Authorization: "Bearer " + token },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(`${path} -> HTTP ${r.status}: ${body.message || body.error || JSON.stringify(body)}`);
  }
  return body;
}

// --- DOM helpers ---------------------------------------------------------

// el("div", { class: "x", onclick: fn }, "text", childNode, ...)
function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (v == null || v === false) {
      return;
    }
    if (k.startsWith("on")) {
      node.addEventListener(k.slice(2), v);
    } else {
      node.setAttribute(k, v === true ? "" : v);
    }
  });
  children.flat().forEach((c) => {
    if (c != null && c !== false) {
      node.append(c);
    }
  });
  return node;
}

// Opens a modal dialog with the pretty-printed JSON of `raw`.
function showJson(title, raw) {
  const dialog = $("json-dialog");
  $("json-title").textContent = title;
  $("json-body").textContent = JSON.stringify(raw, null, 2);
  dialog.showModal();
}

// A card with a title, optional icon, body and a "{ }" button that shows the raw JSON.
function infoCard(title, body, raw, icon, jsonTitle) {
  const toggle = el("button", { class: "json-btn", title: "Show full JSON" }, "{ }");
  toggle.onclick = () => showJson(jsonTitle || title, raw);
  return el("section", { class: "card" },
    el("div", { class: "card-head" }, el("h3", {}, icon, title), toggle),
    body,
  );
}

// Definition list from [label, value] pairs, skipping empty values.
function fields(pairs) {
  const dl = el("dl", { class: "fields" });
  pairs.forEach(([label, value]) => {
    if (value == null || value === "" || (Array.isArray(value) && !value.length)) {
      return;
    }
    dl.append(el("dt", {}, label), el("dd", {}, value));
  });
  return dl;
}

function pill(text, cls) {
  return el("span", { class: "pill" + (cls ? " " + cls : "") }, text);
}

// Port's enumColors names -> CSS colors.
const ENUM_COLORS = {
  blue: "#3b82f6", turquoise: "#14b8a6", orange: "#f97316", purple: "#a855f7", lightBlue: "#38bdf8",
  pink: "#ec4899", yellow: "#eab308", green: "#22c55e", red: "#ef4444", darkGray: "#4b5563",
  lightGray: "#9ca3af", bronze: "#b0793f", silver: "#94a3b8", gold: "#d4a017", paleBlue: "#93c5fd", brown: "#92400e",
};

function enumPill(value, colorName) {
  const p = pill(String(value));
  const color = ENUM_COLORS[colorName];
  if (color) {
    p.style.setProperty("--pill-color", color);
    p.classList.add("colored");
  }
  return p;
}

function names(list) {
  return (list || []).map((x) => (typeof x === "string" ? x : x.name || x.identifier || x.id)).filter(Boolean);
}

function relativeTime(date) {
  const mins = Math.round((date - Date.now()) / 60000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  return Math.abs(mins) < 60 ? rtf.format(mins, "minute") : rtf.format(Math.round(mins / 60), "hour");
}

// --- Signed-in view ------------------------------------------------------

function renderUser(idc, atc, user) {
  const u = user || {};
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || (idc && idc.name) || "";
  const email = u.email || (idc && idc.email) || "";
  const picture = u.picture || (idc && idc.picture);

  const profile = el("div", { class: "profile" },
    picture ? el("img", { class: "avatar", src: picture, alt: "", referrerpolicy: "no-referrer" }) : null,
    el("div", {},
      el("div", { class: "profile-name" }, name || email),
      name ? el("div", { class: "muted" }, email) : null,
      u.status ? pill(u.status, u.status === "ACTIVE" ? "ok" : "") : null,
    ),
  );

  const roles = names(u.roles);
  const teams = names(u.teams);
  const access = fields([
    ["Roles", roles.length ? roles.map((r) => pill(r)) : null],
    ["Teams", teams.length ? teams.map((t) => pill(t)) : el("span", { class: "muted" }, "No teams")],
    ["Type", u.type],
    ["Login via", names(u.providers).join(", ")],
    ["Member since", u.createdAt && new Date(u.createdAt).toLocaleDateString()],
  ]);

  const exp = atc && atc.exp ? new Date(atc.exp * 1000) : null;
  const token = fields([
    ["Audience", atc && el("code", {}, [].concat(atc.aud).join(", "))],
    ["Expires", exp && `${exp.toLocaleTimeString()} (${relativeTime(exp)})`],
    ["Scopes", atc && atc.scope ? atc.scope.split(" ").map((s) => pill(s)) : null],
    ["Client", atc && el("code", {}, atc.azp)],
  ]);

  $("user-cards").replaceChildren(
    infoCard("Profile", profile, user || idc),
    infoCard("Access", access, user || { note: "Port user record not available" }),
    infoCard("Token", token, { id_token: idc, access_token: atc }),
  );
}

async function renderBlueprints(blueprints) {
  const grid = $("blueprints");
  grid.replaceChildren();
  $("bp-count").textContent = String(blueprints.length);

  const tiles = await Promise.all(blueprints.map(async (bp) => {
    const tile = el("button", { class: "bp-tile", title: bp.description || bp.identifier },
      await iconEl(bp.icon, bp.title || bp.identifier),
      el("span", { class: "bp-text" },
        el("span", { class: "bp-title" }, bp.title || bp.identifier),
        el("span", { class: "bp-id" }, bp.identifier),
      ),
    );
    tile.onclick = () => showBlueprint(bp);
    return tile;
  }));
  grid.append(...tiles);
}

async function showBlueprint(bp) {
  const props = Object.entries((bp.schema && bp.schema.properties) || {});
  const required = new Set((bp.schema && bp.schema.required) || []);

  const propRows = await Promise.all(props.map(async ([id, p]) => {
    const type = p.format ? `${p.type} · ${p.format}` : p.type || (p.items && "array");
    return el("li", { class: "prop" },
      await iconEl(p.icon, p.title || id),
      el("div", { class: "prop-main" },
        el("div", {},
          el("strong", {}, p.title || id), " ",
          el("code", {}, id),
          required.has(id) ? pill("required", "warn") : null,
        ),
        p.description ? el("div", { class: "muted" }, p.description) : null,
        p.enum ? el("div", { class: "chips" }, p.enum.map((v) => enumPill(v, (p.enumColors || {})[v]))) : null,
      ),
      el("span", { class: "prop-type" }, type || ""),
    );
  }));

  const relations = Object.entries(bp.relations || {}).map(([id, r]) =>
    el("li", {},
      el("strong", {}, r.title || id), " → ",
      el("code", {}, r.target),
      r.many ? pill("many") : null,
      r.required ? pill("required", "warn") : null,
    ),
  );

  const extras = ["mirrorProperties", "calculationProperties", "aggregationProperties"]
    .map((k) => [k.replace("Properties", ""), Object.keys(bp[k] || {}).length])
    .filter(([, n]) => n)
    .map(([k, n]) => pill(`${n} ${k}`));

  const body = el("div", {},
    bp.description ? el("p", { class: "muted" }, bp.description) : null,
    extras.length ? el("div", { class: "chips" }, extras) : null,
    el("h4", {}, `Properties (${props.length})`),
    props.length ? el("ul", { class: "props" }, propRows) : el("p", { class: "muted" }, "No properties"),
    relations.length ? [el("h4", {}, `Relations (${relations.length})`), el("ul", { class: "relations" }, relations)] : null,
  );

  const head = el("span", { class: "detail-title" },
    await iconEl(bp.icon, bp.title || bp.identifier),
    el("span", {}, bp.title || bp.identifier, " ", el("code", {}, bp.identifier)),
  );
  const card = infoCard("", body, bp, head, `Blueprint: ${bp.identifier}`);
  card.classList.add("bp-card");
  const close = el("button", { class: "secondary" }, "Close");
  close.onclick = () => $("bp-dialog").close();
  const cardHead = card.querySelector(".card-head");
  cardHead.append(el("div", { class: "card-actions" }, cardHead.querySelector(".json-btn"), close));

  $("bp-detail").replaceChildren(card);
  $("bp-dialog").showModal();
}

async function renderSignedIn() {
  const tok = JSON.parse(sessionStorage.getItem("tokens") || "null");
  if (!tok) {
    return false;
  }
  $("signedin").hidden = false;
  loadIcons(); // start fetching icons while the API calls run

  const idc = tok.id_token ? decodeJwt(tok.id_token) : null;
  const atc = decodeJwt(tok.access_token);

  let user = null;
  if (idc && idc.email) {
    try {
      const u = await portGet("/v1/users/" + encodeURIComponent(idc.email), tok.access_token);
      user = u.user || u;
      log("GET /v1/users/{email} OK", "ok");
    } catch (e) {
      log("users lookup failed: " + e.message, "err");
    }
  }
  renderUser(idc, atc, user);

  try {
    const b = await portGet("/v1/blueprints", tok.access_token);
    const blueprints = (b.blueprints || []).sort((x, y) => (x.title || x.identifier).localeCompare(y.title || y.identifier));
    await renderBlueprints(blueprints);
    log(`GET /v1/blueprints OK: ${blueprints.length} blueprints (called directly from the browser)`, "ok");
  } catch (e) {
    showError("Port API call failed: " + e.message + " (if CORS error right after registering, wait ~30s and retry)");
  }
  return true;
}

function signOut() {
  sessionStorage.clear();
  location.href = C.BASE_URL;
}
