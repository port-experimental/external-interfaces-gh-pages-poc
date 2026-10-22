# external-interfaces-gh-pages-poc

```text
+--------------------------------------------------+
|                                                  |
|         ____      ___     ____     _____         |
|        |  _ \    / _ \   |  _ \   |_   _|        |
|        | |_) |  | | | |  | |_) |    | |          |
|        |  __/   | |_| |  |  _ <     | |          |
|        |_|       \___/   |_| \_\    |_|          |
|                                                  |
|      E X T E R N A L   I N T E R F A C E S       |
|   on GitHub Pages  .  no backend  .  just PKCE   |
|                                                  |
+--------------------------------------------------+
```

Static proof of concept showing that a **frontend-only** site on GitHub Pages can sign users in with [Port External Interfaces](https://docs.port.io/) and call the Port API on their behalf. There is no backend and no client secret.

**Live site:** `https://<your-github-org>.github.io/<this-repo>/`

Throughout this README, replace `<your-github-org>` with the GitHub user or org that hosts the repo and `<this-repo>` with the repo name. For example, the site for `acme/external-interfaces-gh-pages-poc` is served at `https://acme.github.io/external-interfaces-gh-pages-poc/`. Enable GitHub Pages for the repo (Settings → Pages → deploy from the `main` branch, root folder) to publish it.

## How it works

An External Interface app in Port is a **public OAuth client**. Port registers it in Auth0 with a set of exact redirect URIs and gives you a `clientId`. It never gives you a client secret. That means the whole login can run in the browser using the OAuth 2.0 Authorization Code flow with [PKCE](https://oauth.net/2/pkce/):

```text
+----------------+                                      +----------------+
|    Browser     |    1. /authorize + code_challenge    |   Port login   |
| (GitHub Pages) | ----------------------------------->|    (Auth0)     |
|                |                                      |                |
|                |      2. callback.html?code=...       |                |
|   index.html   |<----------------------------------- |                |
| callback.html  |                                      |                |
|                |   3. POST /oauth/token + verifier    |                |
|                | ----------------------------------->|                |
|                |             access token             |                |
|                |<----------------------------------- |                |
|                |                                      +----------------+
|                |
|                |     4. GET /v1/* + Bearer token      +----------------+
|                | ----------------------------------->|    Port API    |
|                |<----------------------------------- | (CORS allowed) |
+----------------+                                      +----------------+

              no server of your own anywhere in this picture
```

1. **`index.html`**: clicking *Sign in with Port* generates a random `code_verifier` and `state` and keeps them in `sessionStorage`. It then redirects to `https://<auth0-domain>/authorize` with the SHA-256 `code_challenge`, the `client_id`, the `redirect_uri` and `audience` set to the region's Port API base.
2. **Port / Auth0**: the user logs in with their normal Port login. Auth0 redirects back to `callback.html?code=…&state=…`.
3. **`callback.html`**: checks `state`, then POSTs the `code` and the `code_verifier` to `https://<auth0-domain>/oauth/token` directly from the browser. Auth0 returns the access token (and an ID token). The token is stored in `sessionStorage`.
4. **`index.html`** (signed in): decodes the token claims and calls the Port API **directly from the browser** as the signed-in user:
   - `GET /v1/users/{email}`
   - `GET /v1/blueprints`

Both calls work because Port allows CORS from the origins of the app's registered redirect URIs.

| File | Purpose |
|---|---|
| `config.js` | Reads the client ID and region you provide and works out the redirect URI. All values are public. |
| `common.js` | PKCE helpers, login redirect, Port API calls, rendering. |
| `icons.js` | Loads Port's blueprint icons from the public [`@port-labs/anchor-icons`](https://www.npmjs.com/package/@port-labs/anchor-icons) package on jsDelivr. |
| `vendor/jsx-shim.js` | Tiny stand-in for React's JSX runtime, so those icon components render to plain SVG without React or a build step. |
| `index.html` | Start page: sign in, show claims, user record and blueprints. |
| `callback.html` | OAuth redirect target: exchanges the code for tokens. |
| `.nojekyll` | Makes GitHub Pages serve the files as they are. |

### Configuration

Nothing in the site is tied to this repo's URL. The redirect URI is computed from wherever the site is served, `<site base>/callback.html`, so it works on `localhost`, on this repo's Pages site and on a fork.

The site has **no client ID built in**. Every tester registers their own External Interface app with the Port MCP (see [How to test it](#how-to-test-it)) and gives the site that app's `clientId`. A static site can't call the MCP itself, so you pass the `clientId` in one of two ways:

- enter it, with the region, in the form on the start page, or
- add query parameters to the start page URL:

| Parameter | Example | Effect |
|---|---|---|
| `client_id` | `?client_id=AbC123…` | Your External Interface app's `clientId` (required) |
| `region` | `?region=eu` | `us` (default) or `eu` |
| `reset` | `?reset` | Forget the saved client ID and region |

These settings are saved in `localStorage`, so they survive the redirect to Auth0 and back. The start page shows the region, client ID and redirect URI in use.

| Region | Auth0 domain | Port API base (also the `audience`) |
|---|---|---|
| US | `auth.us.getport.io` | `https://api.us.port.io` |
| EU | `auth.getport.io` | `https://api.getport.io` |

## How to test it

You need **org admin** rights in a Port org and the [Port MCP server](https://docs.port.io/ai-interfaces/port-mcp-server/overview-and-installation) connected to your AI agent (Claude, Cursor, VS Code, …).

### 1. Register an External Interface app with the Port MCP

Paste this prompt into your agent. Replace the region if your org is on EU:

```text
Use the Port MCP to register an External Interface app (a public PKCE OAuth client) for a static site hosted on GitHub Pages.

- App name: external-interfaces-gh-pages-poc-<your-name>
- Redirect URIs:
  - https://<your-github-org>.github.io/<this-repo>/callback.html
  - http://localhost:8080/callback.html
- My Port org is in the US region.

First list my existing External Interface apps so we don't create a duplicate, then create the app.
When you're done, give me the clientId (not the app id) and the test URL:
https://<your-github-org>.github.io/<this-repo>/?client_id=<clientId>&region=us
```

The agent should call `list_external_interface_apps`, then `upsert_external_interface_app`. Note that the response has both an `id` and a `clientId`. The site needs the **`clientId`**. The `id` is only used to update or revoke the app later.

The redirect URI must match the site's URL exactly. The start page shows the redirect URI it uses, so you can compare.

### 2. Open the site with your client ID

Open the test URL the agent gave you:

```text
https://<your-github-org>.github.io/<this-repo>/?client_id=<clientId>&region=<us|eu>
```

Or open `https://<your-github-org>.github.io/<this-repo>/` and enter the `clientId` and region in the form. Check that the region, client ID and redirect URI shown on the page are the ones you expect, then click **Sign in with Port**.

### 3. What success looks like

After you log in, you land back on the start page and see:

- **Who am I**: the ID token claims (`sub`, `email`, `name`) and the access token's `aud`, which should be the region's API base.
- **Port user record**: your user from `/v1/users/{email}`.
- **Blueprints visible to me**: the blueprints in your org.
- The **Log** shows `Token exchange OK (no client secret used)` and `GET /v1/blueprints OK`.

### Run it locally

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080/?client_id=<clientId>&region=<us|eu>`. Use `localhost`, not `127.0.0.1` or a LAN IP, unless that exact origin is registered. PKCE needs `crypto.subtle`, which is only available in a secure context (HTTPS or `localhost`).

### Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Callback URL mismatch` | The redirect URI shown on the page isn't registered on the app exactly as shown. |
| `Service not found: <audience>` | Wrong region for your org. Try `?region=eu` or `?region=us`. |
| Token exchange `Failed to fetch` / CORS error | The site's origin isn't one of the app's redirect URI origins. |
| Port API CORS error right after registering | The CORS allowlist takes a short time to update. Wait about 30 seconds and retry. |
| `No pending PKCE login in sessionStorage` | The callback opened in a different tab, or the page was reloaded. Start again from the start page. |

### Clean up

When you're done, ask your agent to revoke the test app:

```text
Use the Port MCP to revoke my External Interface app named external-interfaces-gh-pages-poc-<your-name>.
```
