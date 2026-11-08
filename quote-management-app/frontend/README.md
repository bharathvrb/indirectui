# Quote Management frontend and server

AngularJS + Bootstrap workspace for OMW indirect quote requests, served by a Node server (`server.js`) that also proxies QuoteData.

## Commands

| Command | What it does |
| --- | --- |
| `npm ci` | Install dependencies (Node.js 22+). |
| `npm start` | Build into `dist/`, load `server.properties`, serve on http://127.0.0.1:8081/. |
| `npm run dev` | Rebuild on every change under `src/` (run alongside `npm start`, then refresh the browser). |
| `npm test` | Karma/Jasmine UI specs in headless Chrome. Set `CHROME_BIN` if Chrome/Edge is not auto-detected. |
| `npm run test:server` | Node tests for the server, login, proxy, properties loader and page routing (synthetic data; no network calls). |
| `npm run test:coverage` | Both suites with coverage: HTML report in `coverage/ui/html`, server summary in the console. |

Always serve `dist/`, not `src/`: vendor libraries (Angular, Bootstrap, icons, MSAL) are copied into `dist/vendor` at build time.

## Server settings (`server.properties`)

`npm start` reads `server.properties` next to `server.js` and loads each `KEY=VALUE` line as an environment variable. Real environment variables win, and `QM_PROPERTIES_FILE` can point to another file. The committed file contains placeholders written as `<...>`; the server ignores those, so an unfilled secret shows up as `503 SERVICE_AUTH_NOT_CONFIGURED`, and an unfilled password turns local sign-in off with a warning. After filling in real values, run `git update-index --skip-worktree server.properties` so git ignores your local edits and the secret is never committed. (`git update-index --no-skip-worktree server.properties` undoes it.)

| Key | Meaning |
| --- | --- |
| `QUOTEDATA_CLIENT_ID`, `QUOTEDATA_CLIENT_SECRET`, `QUOTEDATA_SCOPE` | QuoteData service account (OAuth `client_credentials`). Required for any data. |
| `QUOTEDATA_TOKEN_URL` | Token endpoint. Default `https://sat-ci.codebig2.net/v2/ws/token.oauth2`. Must be HTTPS. |
| `QUOTEDATA_BASE_URL` | QuoteData base including `/quotedata/v1`. Default `https://quotedata-flx.as-g8.cf.comcast.net/quotedata/v1`. |
| `QUOTEDATA_RETRY_ENABLED` | `true` forwards step retries to QuoteData (see Step retry). Anything else answers `501 RETRY_NOT_AVAILABLE`. |
| `QUOTEDATA_ALLOW_HTTP` | Set `true` only if the QuoteData host serves plain HTTP; then use an `http://` base URL. The token URL stays HTTPS-only. |
| `SSO_CLIENT_ID`, `SSO_TENANT_ID` | Used to verify SSO users' ID tokens. Must match `AUTH_CONFIG` in `src/config.js`. Without them SSO users get `503 SSO_AUTH_NOT_CONFIGURED`. |
| `LOCAL_LOGIN_USERNAME`, `LOCAL_LOGIN_PASSWORD` | Optional local development login (both or neither). Ignored when `NODE_ENV=production`. |

Restart the server after changing settings.

## Browser settings (`src/config.js`)

| Setting | Meaning |
| --- | --- |
| `APP_CONFIG.apiBaseUrl` | Proxy path, `/api`. |
| `APP_CONFIG.quoteDataLookupOnly` | `true`: the Quotes page looks up one quote by request ID, external ID or proposal ID. Set `false` to show the paged list with filters (25 rows, newest first) once QuoteData supports listing without an identifier. Ticket search works in both modes. |
| `APP_CONFIG.autoRefreshSeconds` | Quote list auto-refresh interval (default 60, minimum 15). The toggle starts off. |
| `APP_CONFIG.contractDownloadUrl` | Optional contract download endpoint (`documentType`, `dmaasId` query). Blank shows IDs with copy buttons only. |
| `APP_CONFIG.supportUrl` | Optional HTTPS support link shown in the menu and on error pages. |
| `APP_CONFIG.features.retryEnabled` | `false` (default): Retry buttons are visible but disabled with "Coming soon". `true`: failed steps can be retried (see Step retry). |
| `AUTH_CONFIG.clientId`, `tenantId`, `loginScopes`, `loginPrompt`, `redirectUri` | Entra ID (MSAL) sign-in. Currently the ONP UI LOWER - INT registration; its SPA redirect URIs must include `http://127.0.0.1:8081/`. |

`config.js` is public: never put secrets in it.

## Processing journey and step retry

The quote detail page shows the processing steps (`stepExecutions`) as a journey grouped into phases: Customer setup, Proposal, Validation & approval, Contract & design, and Other steps for names it doesn't know. Each step shows a plain-English name, status, duration and attempts. The mapping from OMW step names to labels and phases is in `src/app/services/quote-journey.service.js`; add new step names there. When the quote has failed, the failure summary (latest failed step, stage, error code and message) sits at the top of the journey.

Retry appears on the failure summary, on failed rows in the Processing tab and on every row in the Errors tab. To turn it on when the backend API exists:

1. Confirm the QuoteData endpoint. The app currently calls `POST {QUOTEDATA_BASE_URL}/quote/{quoteRequestId}/steps/{stepExecutionId}/retry` with no body; adjust `quote-data-proxy.js` if the real path differs.
2. Set `QUOTEDATA_RETRY_ENABLED=true` in `server.properties`.
3. Set `features: { retryEnabled: true }` in `src/config.js`, then restart (`npm start` rebuilds).

Users confirm each retry in a dialog. The page then reloads the quote, and that step can't be retried again until the page is opened again. 403, 404, 409, 501 and network errors show specific messages with the tracking ID.

## Sign-in

- **SSO:** MSAL authorization code + PKCE. The browser sends its SSO **ID token** to the local server, which verifies signature, issuer, tenant, audience and expiry. That token is never forwarded to QuoteData.
- **Local login:** username/password from `server.properties`, giving a one-hour HttpOnly session cookie. Development only; loopback clients only.
- Opening a case link such as `/quotes/<quoteRequestId>` without a session goes to sign-in and returns to the same quote afterwards.

## QuoteData proxy

Only these routes are forwarded, with a `trackingId` header on every request and response:

| Browser route | Upstream |
| --- | --- |
| `GET /api/quotedata/v1/quote?…` | `GET {QUOTEDATA_BASE_URL}/quote?…` with `quoteRequestId`, `externalId`, `proposalId`, `ticketNumber`, `page`, `size`, `sort`, `search`, `state`, `designStatus`, `category`, `channelType`, `createdFrom`, `createdTo` |
| `POST /api/quotedata/v1/quote/{id}/complete` | Same path upstream, body `{ "resolutionNote": "…" }` (1–1000 chars). **Assumed contract; confirm with the QuoteData owner.** |
| `POST /api/quotedata/v1/quote/{id}/steps/{stepExecutionId}/retry` | Same path upstream, no body. Only when `QUOTEDATA_RETRY_ENABLED=true`. **Assumed contract; change `RETRY_ROUTE` and the forwarded path in `quote-data-proxy.js` if the real API differs.** |

The service token is cached in memory until 10 seconds before it expires, and concurrent requests share one token request. A QuoteData 401 refreshes the token and retries a GET once; a POST is never replayed.

| Error code | Meaning / fix |
| --- | --- |
| `401 SIGN_IN_REQUIRED` | Browser session missing or expired; sign in again. |
| `503 SERVICE_AUTH_NOT_CONFIGURED` | QuoteData client ID/secret/scope missing or a URL invalid (e.g. `http://` without `QUOTEDATA_ALLOW_HTTP`). |
| `503 SSO_AUTH_NOT_CONFIGURED` | Set `SSO_CLIENT_ID` / `SSO_TENANT_ID`. |
| `502 SERVICE_TOKEN_FAILED` | Token endpoint unreachable or rejected the credentials. Check the secret/scope and network access to the token host. |
| `502 UPSTREAM_UNAUTHORIZED` | QuoteData rejected the service token; the service account lacks access. |
| `403 UPSTREAM_FORBIDDEN`, `404 QUOTE_NOT_FOUND`, `409 QUOTE_CONFLICT` | Passed through from QuoteData with safe messages. |
| `501 RETRY_NOT_AVAILABLE` | Step retry is switched off on the server (`QUOTEDATA_RETRY_ENABLED`). |
| `502 UPSTREAM_FAILED` | QuoteData unreachable, timed out or returned invalid JSON. |

Provider error bodies and secrets are never sent to the browser; the UI shows the tracking ID so you can search the server logs.

## Troubleshooting on a corporate machine

- **TLS errors to internal hosts:** start Node with the system certificate store: `NODE_OPTIONS="--use-system-ca" npm start`. Never disable certificate checks.
- **Outbound HTTP proxy:** the server connects directly to the token and QuoteData hosts and does not use `HTTPS_PROXY`. Run it on a network where both hosts are directly reachable.
- **`AADSTS50011` on SSO sign-in:** `http://127.0.0.1:8081/` is not a registered redirect URI for the SSO app registration. Use the local login meanwhile.
- **Use `127.0.0.1` or `localhost` consistently**; session cookies are per host.

## Requirement coverage

| Requirement | Where |
| --- | --- |
| UI-01/02 Quote list and ticket search | `quote-list`, `support-tickets`, shared `quote-table` component |
| UI-03 Header, failure summary, IDs | `quote-detail` header, failure summary, system IDs, processing pipeline |
| UI-04–UI-10, UI-16/17 Tabs | Customer (CSV export), Sites, Products, Promotions, Processing, Errors, Events, Payload, Contracts |
| UI-11 Retry | Retry on every failed step and error row; disabled "Coming soon" until `features.retryEnabled` and `QUOTEDATA_RETRY_ENABLED` are on |
| UI-12 Complete | Mark Completed dialog (note 1–1000 chars, 403/409 handling) |
| UI-13–15 Case links, access, empty/error states | Route guard with return URL, Access denied / Quote not found / Quote archived pages, tracking IDs |

Role-based menus (UI-14) are not implemented: every signed-in user sees the same workspace and QuoteData enforces access.
