# QuoteData workspace frontend

AngularJS and Bootstrap workspace for the remote QuoteData service. Quote and ticket search share a common authenticated experience; there are no role-specific menus or automatic authentication bypasses. The separate Spring Boot project is a historical mock backend, **not** the remote QuoteData API and not a prerequisite for running this frontend.

## Install, build, run and test

Use Node.js 22 or newer with npm and an installed Chrome or Chromium-based Edge browser for browser tests. From the repository root in PowerShell:

```powershell
Set-Location quote-management-app\frontend
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:8081/**. `npm start` rebuilds through `prestart`, then `server.js` uses the existing `http-server` package to serve only `dist` on loopback with caching disabled. Stop it with Ctrl+C. Do not serve `src` directly: dependencies are copied into `dist\vendor`, not into `src\node_modules`.

Both `http://127.0.0.1:8081/quotes/<quoteRequestId>?tab=customer` case links and `http://127.0.0.1:8081/#!/quotes/<quoteRequestId>?tab=customer` hash links are supported. The local server falls back to `index.html` only for GET/HEAD navigation to `/login`, `/support-tickets`, `/quotes`, and `/quotes/<id>` (excluding file-like paths). Early runtime configuration normalizes recognized clean routes to hash routes before SSO boot, preserving the query. Missing JavaScript/assets, unknown paths and `/quotedata`/`/api` requests are never rewritten to HTML. Only the authenticated, allowlisted `/api/quotedata/v1` routes below are proxied.

Public sign-in settings in `src\config.js` temporarily match the reference ONP UI registration. The local callback must be permitted by that registration. Both authenticated local and SSO users access QuoteData through the same-origin server service account; its credentials and scopes are configured privately on the server, not in browser `apiScopes`. See [SSO setup](../README-SSO.md).

```powershell
npm test
npm run test:server
```

`test:server` uses Node's built-in test runner, synthetic credentials, generated signing keys and ephemeral loopback ports. It exercises local authentication/cookie migration, real JWT verification, token caching/refresh, service forwarding, bounded responses, error handling, origin protection and throttling. It does not contact Entra or QuoteData or restart the running application.

`npm test` runs Karma/Jasmine once in ChromeHeadless. On Windows it detects Chrome, then Edge, under standard installation directories. Override the executable when needed:

```powershell
$env:CHROME_BIN = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm test
```

On other platforms install Chrome/Chromium or set `CHROME_BIN` to its executable. The launcher does not disable the browser sandbox. To keep Karma watching during development:

```powershell
npm test -- --single-run=false --auto-watch
```

Tests load AngularJS, route/sanitize/animate, angular-mocks, `src\config.js`, `src\theme.js`, the application module, services, components, and `tests\**\*.spec.js`, in that order. The automatic browser bootstrap script and retired ticket-detail controller are excluded. Templates are served under `/base/src/app/`; specs can populate `$templateCache` to handle route guards without live template requests. Test fixtures can override runtime globals and injectable services; tests must not use real credentials, customer records or live mutations.

For frontend edits, run `npm start` in one terminal and the following in a second terminal:

```powershell
npm run dev
```

`dev` builds once and watches `src`; refresh the browser after changes. It is not a second web server. Restart `npm start` after dependency changes.

## Optional local-development login

The Node server supports a separate username/password session **only for local development**, alongside ONP/Entra SSO. It is not deployment authentication and never mints a JWT or API token. A validated session may access the same-origin QuoteData proxy, which separately obtains service-account authorization. It provides neither fake data nor anonymous access.

Set these **process environment** variables before starting the server; placeholder values below are descriptions, not credentials to use:

| Variable | Value |
| --- | --- |
| `LOCAL_LOGIN_USERNAME` | `<private local-development username>`; 1–128 characters. |
| `LOCAL_LOGIN_PASSWORD` | `<private local-development password>`; 1–1024 characters. |
| `NODE_ENV` | Local login is disabled when this equals `production`. |

Use private secret-input tooling rather than placing credentials in source, `.env` files, public configuration, shell-command history, logs or documentation. Never store passwords in browser storage. Both credential variables unset disables the feature; supplying only one, empty values or excessive lengths fails startup explicitly. Configuration is read at server creation, so restart after changing it. The listener remains `127.0.0.1:8081`; use either `http://127.0.0.1:8081/` or `http://localhost:8081/` consistently, since cookies are host-specific.

The server accepts authentication requests only from loopback clients with a valid local Host and matching port. POST requests require the exact same-origin `Origin` header; cross-site requests are rejected and CORS is not enabled. The API is:

| Endpoint | Behavior |
| --- | --- |
| `GET /auth/local/session` | Returns `{ enabled, authenticated, user, expiresAt }`; `user` and `expiresAt` are null when signed out. Disabled mode reports `enabled: false`. |
| `POST /auth/local/login` | Accepts JSON `{ username, password }` up to 4 KiB; success returns the session state. Invalid credentials return generic 401, malformed input 400, oversized input 413, disabled login 404. |
| `POST /auth/local/logout` | Invalidates the current session, clears its cookie and returns signed-out state; safe to repeat. |

An authenticated `user` contains `name`, `username` and `authType: 'local'`; `expiresAt` is the absolute expiry in milliseconds. Responses are JSON with `Cache-Control: no-store`; unsupported methods return 405. Five failed sign-ins per client address in five minutes cause 429 with `Retry-After`, including concurrent attempts. Successful attempts do not count as failures.

The opaque `qm_local_session` cookie is `HttpOnly`, `SameSite=Strict`, scoped to `/` so it reaches the proxy, and expires after 3,600 seconds without sliding renewal. Login and logout also explicitly expire the old `/auth/local` cookie; duplicate presented cookies never authenticate. It is `Secure` on HTTPS; forwarded protocol/address headers are not trusted. Successful sign-in rotates the presented sessions. Only token hashes, salted scrypt credential hashes and bounded session/rate-limit state are kept in server memory; restart invalidates all local sessions, and expired state is cleaned on requests. The configured username remains in memory for the session's user display. No password is returned to the browser. At most 256 sessions are retained; creating another evicts the oldest.

## Authenticated same-origin QuoteData proxy

The default public settings are `APP_CONFIG.apiBaseUrl = '/api'` and `APP_CONFIG.apiAuthMode = 'service-proxy'`. Local users send only the HttpOnly session cookie. SSO users send their MSAL **ID token** as proof to this same-origin server, not as remote API authorization. The server verifies its RS256 signature using cached Entra JWKS, exact issuer, tenant, audience, required subject/issued-at/expiry claims and expiration. No user labels or unsigned token decoding establish identity. Graph access tokens are never sent to QuoteData.

Inject the following **server process environment** privately before starting the server. These names and placeholders are documentation, not credential values. Never create a secret-containing `.env`, source file, test fixture, browser configuration or log entry.

| Variable | Required value/default |
| --- | --- |
| `QUOTEDATA_CLIENT_ID` | Privately supplied service application identifier. |
| `QUOTEDATA_CLIENT_SECRET` | Privately supplied service credential. |
| `QUOTEDATA_SCOPE` | Privately supplied approved service scope. |
| `QUOTEDATA_TOKEN_URL` | Defaults to `https://sat-ci.codebig2.net/v2/ws/token.oauth2`. |
| `QUOTEDATA_BASE_URL` | Defaults to `https://quotedata-flx.as-g8.cf.comcast.net/quotedata/v1`; includes the versioned path. |
| `SSO_CLIENT_ID` | Trusted frontend registration ID; must match public `AUTH_CONFIG.clientId`. Required for SSO proxy users. |
| `SSO_TENANT_ID` | Trusted organizational tenant ID; must match public `AUTH_CONFIG.tenantId`. Required for SSO proxy users. |

URLs must be HTTPS, without user information, query strings or fragments. HTTP loopback upstreams are available only through explicit dependency injection in synthetic tests, not an environment bypass. Missing/incomplete service settings do not prevent startup or login; authenticated API calls return 503. Changing configuration requires restarting the server. Where local corporate networking requires it, a supported Node version may optionally use `NODE_OPTIONS="--dns-result-order=ipv4first --use-system-ca"` to prefer IPv4 and trust the system certificate store. Never disable TLS verification.

Only these same-origin routes are available:

| Route | Request |
| --- | --- |
| `GET /api/quotedata/v1/quote` | Detail via `quoteRequestId`, or list/search via `ticketNumber`, `page`, `size`, `sort`, `search`, `state`, `designStatus`, `category`, `channelType`, `createdFrom`, `createdTo`. |
| `POST /api/quotedata/v1/quote/{id}/complete` | JSON `{ "resolutionNote": "..." }`, 1–1000 characters, trimmed before forwarding. Existing assumed contract; obtain owner approval before any real mutation. |

Query strings are limited to 4 KiB, unique allowlisted parameters and 1024 characters per value. Completion bodies are limited to 8 KiB and contain only `resolutionNote`; IDs use 1–200 letters/digits/underscores/hyphens. Unknown routes/methods, arbitrary upstream URLs, retry and token endpoints are unavailable. Loopback-client and matching local Host/port checks apply; cross-site fetch metadata and mismatched Origin are rejected, and POST requires exact Origin.

The server sends form-encoded OAuth `client_credentials` before each QuoteData request and forwards the returned bearer token in the upstream `Authorization` header. Token responses are bounded to 64 KiB with a 10-second deadline; redirects are never followed. Backend JSON is bounded to 20 MiB with a 30-second deadline. Forwarded headers contain service authorization and a validated/generated `trackingId`, never browser cookies or identity tokens. Responses are `no-store` with a tracking header. If a backend 401 occurs, GET may reacquire and retry **once**, but POST is **never replayed**. Other failures never turn into successful empty data.

| Status / code | Meaning |
| --- | --- |
| `401 SIGN_IN_REQUIRED` | Browser identity is missing, invalid or expired; sign in again. |
| `503 SSO_AUTH_NOT_CONFIGURED` | Configure trusted server SSO registration settings. |
| `503 SERVICE_AUTH_NOT_CONFIGURED` | Configure complete service credentials/scope and valid HTTPS URLs. |
| `502 SERVICE_TOKEN_FAILED` | Service token issuance failed; ask the service administrator. |
| `502 UPSTREAM_UNAUTHORIZED` | QuoteData rejected service authorization; personal re-login will not fix it. |
| `403 UPSTREAM_FORBIDDEN` | The service account lacks permission. |
| `404 QUOTE_NOT_FOUND` | QuoteData did not find the requested quote. |
| `409 QUOTE_CONFLICT` | The quote state conflicts with completion. |
| `502 UPSTREAM_FAILED` | Backend timeout, disconnect, invalid/oversized response or other upstream failure. |

Errors contain safe `code`, `message` and `trackingId` fields; provider error bodies are never relayed. Same-origin proxying removes the browser's dependency on upstream CORS. This development listener remains loopback-only even when local login is disabled; it is not a production reverse proxy. A browser-direct deployment requires an explicitly selected alternative authentication mode, approved delegated QuoteData scopes/audience, and upstream CORS. Do not send an ID token or Graph token directly to QuoteData.

## Build output

Gulp cleans `dist`, copies `src` unchanged, and copies these installed browser assets. No concatenation, minification, CDN dependency, or source-directory symlink is required.

| Browser URL relative to `dist` | Installed source |
| --- | --- |
| `vendor/angular/angular.min.js` | `angular` |
| `vendor/angular-route/angular-route.min.js` | `angular-route` |
| `vendor/angular-sanitize/angular-sanitize.min.js` | `angular-sanitize` |
| `vendor/angular-animate/angular-animate.min.js` | `angular-animate` |
| `vendor/bootstrap/css/bootstrap.min.css` | `bootstrap\dist\css` |
| `vendor/bootstrap/js/bootstrap.bundle.min.js` | `bootstrap\dist\js` |
| `vendor/bootstrap-icons/bootstrap-icons.css` | `bootstrap-icons\font` |
| `vendor/bootstrap-icons/fonts/bootstrap-icons.woff` and `.woff2` | `bootstrap-icons\font\fonts` |
| `vendor/msal/msal-browser.min.js` | `@azure\msal-browser\lib\msal-browser.min.js` |

Font paths remain relative to the icons stylesheet. Applicable Angular/Bootstrap source maps are copied too. `node_modules`, `dist` and coverage output are ignored by Git; commit source/configuration and `package-lock.json`, not generated vendor assets.

## Public runtime configuration

`src\config.js` provides `window.AUTH_CONFIG` and `window.APP_CONFIG` before application startup. Rebuild after editing it, or supply an equivalent public `config.js` as part of deployment.

| Setting | Meaning |
| --- | --- |
| `AUTH_CONFIG.clientId` | Temporarily the ONP UI LOWER - INT public client ID; replace with the approved dedicated registration for production. Blank means setup is required. |
| `AUTH_CONFIG.tenantId` | The approved organizational directory/tenant ID. |
| `AUTH_CONFIG.loginScopes` | Sign-in permissions; currently ONP's `openid`, `profile`, `email`, `User.Read`. These are not used as QuoteData token scopes. |
| `AUTH_CONFIG.loginPrompt` | Currently ONP's `select_account` prompt. |
| `AUTH_CONFIG.apiScopes` | Delegated remote API scopes for an explicitly selected browser-direct deployment only. Not required by `service-proxy`; empty by default. |
| `AUTH_CONFIG.redirectUri` | Registered SPA return URL; defaults to `window.location.origin + '/'`. |
| `APP_CONFIG.apiBaseUrl` | `/api` in same-origin proxy mode, without the appended `/quotedata/v1` suffix. |
| `APP_CONFIG.apiAuthMode` | `service-proxy` for the supplied server; browser-direct deployment needs an explicit alternative mode. |
| `APP_CONFIG.contractDownloadUrl` | Optional, explicitly confirmed download endpoint. Leave blank when unavailable; contract IDs still display. |
| `APP_CONFIG.autoRefreshSeconds` | Quote list auto-refresh interval in seconds (default 60, minimum 15). Auto-refresh is off until the user enables the toggle. |
| `APP_CONFIG.supportUrl` | Optional approved support link; leave blank when no support destination is configured. |
| `APP_CONFIG.features.retryEnabled` | Keep `false`. Retry is unavailable in this release; changing this value does not establish backend support. |

These are public identifiers and URLs, not a secret store. Never add client secrets, passwords, bearer tokens or customer payloads. Entra authentication is external even though the MSAL JavaScript library is served locally.

Login precedes protected data. Successful SSO returns to a validated internal quote/ticket route, preserving its query state; session expiry requests another sign-in. Initialization or token failures never grant access. Every authenticated user sees the same navigation; remote API authorization remains authoritative.

## Remote API contract: confirmed samples versus assumptions

The requirements document provides examples, not evidence that this deployment has been tested live:

| Workflow | Contract status |
| --- | --- |
| Detail lookup | Documented sample: `GET /quotedata/v1/quote?quoteRequestId=<id>`, returning a direct object. |
| Home-page quote ID search | Smart search recognizes complete UUIDs, optionally prefixed by a numeric value and hyphen, and uses the same exact lookup. Choose **Quote request ID** for other ID formats, or **Other fields** to treat a UUID as general search text. The direct quote object becomes one result row; it is not parsed as a paginated list. |
| Ticket lookup | Documented sample: `GET /quotedata/v1/quote` with `ticketNumber`, `page`, `size`, `sort`. Ticket search uses QuoteData, not the historical local `/api/support-tickets` resource. |
| Paged results | Documented envelope: `content`, `totalElements`, `totalPages`, `page`, `size`; nested detail includes `sites[].items`, `contacts`, `stepExecutions`, `errorDetails`, and JSON-string `quotePayload`. |
| General search | Current UI convention: `search`, `state`, `designStatus`, `category`, `channelType`, `createdFrom`, `createdTo`, plus paging/sort. Accepted filters, date format/time zone, and general-list support need API-owner confirmation. |
| Complete quote | **Assumption awaiting confirmation:** `POST /quotedata/v1/quote/{quoteRequestId}/complete` with `{ "resolutionNote": "..." }`. Confirm authorization, state transitions and 403/409 behavior before a live mutation. |
| Contract download | Optional configured URL, currently requested with `documentType` and `dmaasId`, expecting a blob. Endpoint, response format and token audience must be confirmed before enabling it. |
| Retry | Disabled, “Coming soon”; no retry request is part of this release. |

Search defaults to 25 rows and `createdAt,desc`, with zero-based request paging. General search is debounced by 300 ms. Missing data stays missing rather than being fabricated from sample records.

Exact-ID lookup pauses list filters, explicitly indicated beside the search box; their values are retained for the next general search. It sends `quoteRequestId`, not `search`, and does not send list paging/filter parameters. Proxy 401 indicates missing/invalid browser identity, not a missing quote; rejected upstream service authorization becomes 502. A browser status 0 reflects failure to reach the same-origin server. Browser-direct deployments additionally require valid CORS/preflight and HTTPS; those requirements do not apply between the browser and this same-origin proxy.

### Integration prerequisites

- Confirm that the temporary ONP SPA registration permits this application's exact redirect URI and that server SSO settings match it. Use a dedicated approved identity before production deployment.
- Configure the privately supplied service credentials/scope, trusted HTTPS URLs and server network access; confirm service-account permission with the API owner.
- Same-origin proxy mode needs no upstream browser CORS. An explicitly chosen browser-direct mode does need delegated API scopes/consent, exact-origin CORS/preflight and exposed diagnostic headers.
- Confirm service authorization, filters, date semantics, completion and optional downloads. The frontend client ID and Graph audience are not automatically the remote API's audience. The proxy does not implement optional contract downloads or retry.
- Deploying `dist` alone does not provide `/api` or service authorization. Production requires an approved authenticated server implementation and hosting policy; this supplied development server intentionally rejects non-loopback clients. Retain recognized-route-only SPA fallback and exact registered return URLs; never rewrite missing assets or API requests to HTML.

## Requirement coverage and release checks

This is the intended workspace behavior, not a claim of successful live SSO or remote API verification:

| Requirements | Workspace coverage |
| --- | --- |
| UI-01–02 | Shared quote/ticket result columns, server pagination, URL filters, debounce, date validation, current-request results and separate loading/error/empty states. |
| UI-03–10 | Quote context; customer/address/contacts; sites and product hierarchy; promotions; scoped processing/monitoring; related errors; events; safe payload view/search/copy. |
| UI-11–12 | Disabled retry; confirmed completion with a trimmed 1–1000-character note, duplicate-submission protection and explicit conflict/access errors. |
| UI-13–15 | Actionable loading, empty, not-found, access-denied, archived and API-failure states with available tracking IDs. |
| UI-16–17 | Visible/copyable contract IDs and optional downloads; safe customer/address/contact CSV export. |
| Common UX | Login-first common SSO, internal return navigation, responsive navigation, keyboard focus, light/dark/system themes, persistence and reduced motion. |

Before release, run build/tests and check desktop/mobile layouts, both themes, keyboard-only navigation, deep-link return, session expiry, Back/Forward, empty/error states, and vendor/font requests. Browser/functional validation is a separate release gate, not established by a successful build or unit test. Local browser checks may use synthetic CDP-intercepted authentication/API responses; these are test-only and must never become a production fixture path or authentication bypass. Real SSO, consent, CORS, token audience and remote contract behavior require the configured registration and API owner; synthetic checks do not verify them.

## Visual design

The workspace uses a blue, white and black design system defined entirely by CSS tokens in `src/assets/css/app.css` (`:root` for light, `[data-theme="dark"]` for dark): a black navigation rail, white content surfaces and blue primary actions. The quote detail page opens with a dark command header (state, IDs, key dates, counts), followed by the failure summary, an ordered processing pipeline with progress, copyable system IDs and tabbed sections. Customer, address and monitoring data are shown as field grids; product items as an expandable tree. Layouts adapt down to phone width, and the theme picker offers light, dark or system.
