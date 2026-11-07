# Common SSO setup — QuoteData workspace

The frontend uses Microsoft Entra ID (Azure AD), MSAL Browser and the OAuth authorization-code flow with PKCE. Everyone signs in through the same login page and receives the same workspace navigation; the remote QuoteData API still enforces access. Missing configuration or an authentication failure does **not** enable an anonymous/development bypass.

The frontend calls its authenticated same-origin Node proxy, which uses a separately configured service account to call remote QuoteData. The repository's historical Spring Boot mock backend is not that service. Starting a local Java server or setting its environment variables does not configure or validate this integration.

For now, public sign-in defaults match the reference ONP UI's **ONP UI LOWER - INT** registration: client, tenant, `openid/profile/email/User.Read` scopes, and account selection. The callback remains this application's origin, not ONP's URL. The ONP registration must permit that local redirect URI. Its Graph permission does not authorize QuoteData, and no Graph token is sent there. Browser `apiScopes` can remain empty in service-proxy mode.

## 1. Obtain the application and API registrations

Ask the organization's identity and QuoteData API owners for:

- An approved **single-page application (SPA)** registration for this frontend in the correct organizational tenant.
- Its application/client ID and directory/tenant ID.
- Approved QuoteData client-credentials access, service identifier/secret/scope and HTTPS endpoints, supplied privately.
- An approved deployment origin and registered redirect/logout URLs. A browser-direct alternative additionally needs delegated API scopes/audience, consent and upstream CORS.

The temporary ONP registration reuse is for sign-in only. The same-origin server verifies its ID token as browser identity; that token is never forwarded to QuoteData. Do not assume the frontend client ID or Graph token is the QuoteData audience. Service authorization belongs to the API's owner. No client secret is appropriate in browser code. Use an approved dedicated registration for production.

## 2. Register the SPA return URL

In the frontend app registration's **Authentication** settings, add the exact return URL used by the browser as a SPA redirect URI.

For the documented local server, this is:

```text
http://127.0.0.1:8081/
```

Use the identity team's supported loopback registration process; Entra's portal can require manifest configuration for a `127.0.0.1` loopback URI. `localhost` and `127.0.0.1` are different browser origins: do not alternate them without registering and configuring the chosen URI. Register the exact approved HTTPS URL for deployment, including its base path where applicable. Hash routes such as `#!/quotes` are application navigation, not part of the registered return URI.

Use SPA authorization-code/PKCE settings, not the implicit grant flow. Coordinate any post-logout return policy with the identity owner.

## 3. Configure private server authorization

Inject these process environment settings privately before `npm start`; do not place secrets in `.env`, source, public configuration, shell history, tests, logs or documentation:

| Server environment variable | Value |
| --- | --- |
| `QUOTEDATA_CLIENT_ID` | `<privately supplied service identifier>` |
| `QUOTEDATA_CLIENT_SECRET` | `<privately supplied service credential>` |
| `QUOTEDATA_SCOPE` | `<privately supplied approved service scope>` |
| `QUOTEDATA_TOKEN_URL` | Default `https://sat-ci.codebig2.net/v2/ws/token.oauth2` |
| `QUOTEDATA_BASE_URL` | Default `https://quotedata-flx.as-g8.cf.comcast.net/quotedata/v1` |
| `SSO_CLIENT_ID` | Approved frontend client ID, matching `AUTH_CONFIG.clientId` |
| `SSO_TENANT_ID` | Approved tenant ID, matching `AUTH_CONFIG.tenantId` |

The placeholders above are descriptions, not suggested credential values. Server SSO settings establish the trusted issuer, tenant and audience; browser-provided labels/configuration do not. `jose` verifies RS256 signature and required `sub`, `tid`, `iat`, `exp` claims using cached keys at `https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys`, exact issuer `https://login.microsoftonline.com/{tenant}/v2.0`, audience and expiry.

Configured service URLs must use HTTPS and contain no user information, query or fragment. Missing service settings leave startup/login available but return `503 SERVICE_AUTH_NOT_CONFIGURED` for authenticated proxy calls. Missing trusted SSO settings return `503 SSO_AUTH_NOT_CONFIGURED` for bearer callers; local sessions can still use configured service authorization. Restart after server environment changes.

The service client uses form-encoded OAuth `client_credentials`, caches tokens only in memory with expiry skew, deduplicates refreshes and refuses redirects. Neither the token endpoint nor its credentials/token are exposed to the browser. The API owner must approve the service's permissions; successful browser login alone does not establish remote permission.

## 4. Set public runtime configuration

Edit `frontend\src\config.js`, not inline code in `index.html`. Public client/tenant and login settings currently match ONP. Service permissions are configured independently on the server; browser `apiScopes` is not used in service-proxy mode.

Example shape only — replace every placeholder with approved public registration settings:

```javascript
window.AUTH_CONFIG = {
    clientId: 'YOUR_FRONTEND_APPLICATION_ID',
    tenantId: 'YOUR_ORGANIZATIONAL_TENANT_ID',
    loginScopes: ['openid', 'profile', 'email', 'User.Read'],
    loginPrompt: 'select_account',
    apiScopes: [],
    redirectUri: window.location.origin + '/'
};

window.APP_CONFIG = {
    apiBaseUrl: '/api',
    apiAuthMode: 'service-proxy',
    contractDownloadUrl: '',
    supportUrl: '',
    features: { retryEnabled: false }
};
```

`apiBaseUrl` excludes the `/quotedata/v1` suffix added by the client; the server's `QUOTEDATA_BASE_URL` includes it. `contractDownloadUrl` and `supportUrl` are optional; leave them blank until approved. The proxy does not implement contract downloads or retry. A deployment under a subpath must set `redirectUri` to its registered return URL rather than accepting the root-path default.

Runtime configuration is publicly readable. Never include a password, client secret, access token or customer payload.

## 5. Build and start

From the repository root:

```powershell
Set-Location quote-management-app\frontend
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:8081/**. Start rebuilds automatically and serves `dist`; rebuild after changes to `src\config.js`. Recognized clean case links such as `/quotes/<quoteRequestId>?tab=customer` are served the SPA and normalized to `/#!/quotes/<quoteRequestId>?tab=customer` before SSO initialization. Production hosting needs the same recognized-route fallback; missing assets and API requests must remain errors, not HTML responses. There is no required Gradle wrapper or local backend step. See [frontend commands and integration contract](frontend/README.md) for Karma tests, watch mode, asset paths and requirement coverage.

Use Node.js 22 or newer. If required by local corporate DNS/certificate configuration, a supported Node version can use `NODE_OPTIONS="--dns-result-order=ipv4first --use-system-ca"`. This preserves TLS certificate verification; never disable it. The supplied development server remains loopback-only and is not suitable for remote deployment without an approved hosting/authentication implementation.

## Authentication and return navigation

1. The browser loads public runtime configuration and the locally packaged MSAL library.
2. MSAL initializes and handles a returning authentication response. Angular displays login/setup/errors even when initialization cannot complete, without granting access.
3. Opening a protected quote/ticket link without a session takes the user to login. Only validated internal return destinations are retained.
4. Sign-in redirects to Entra. After successful authentication the user returns to the intended internal route and query state.
5. Before a same-origin API call, the browser supplies its MSAL ID token as identity proof to `/api`. The server validates the token and forwards only its separate service bearer token plus tracking ID to QuoteData. Local users instead authenticate with their server-validated HttpOnly session cookie.
6. When the session needs interaction again, the user signs in again and can return to the intended route. A token acquisition failure is not retried as an anonymous protected API request.
7. SSO sign-out uses MSAL's logout redirect; local sign-out invalidates the local session. All authenticated users share the same menu and service-account access; backend access decisions remain authoritative. Entra ID tokens remain valid until expiry under normal JWT semantics.

MSAL uses session storage for its authentication cache. The application must not persist quote payloads or customer records in local storage. Theme preference persistence is separate from authentication.

## Optional local-development username/password session

ONP/Entra sign-in remains available. For local development only, the frontend Node server can additionally enable a separate session when its **process environment** supplies both `LOCAL_LOGIN_USERNAME` (`<private local-development username>`, 1–128 characters) and `LOCAL_LOGIN_PASSWORD` (`<private local-development password>`, 1–1024 characters). These are placeholders, not suggested credentials. Inject values privately before `npm start`; never write them to source, `.env` files, runtime browser configuration, shell-command history, logs, tests or documentation. Do not persist passwords in browser storage.

Leave both variables unset to disable local login. Incomplete, empty or overlong configuration fails startup; `NODE_ENV=production` disables the feature even with valid credentials. Restart to pick up environment changes. The server still listens only on `127.0.0.1:8081`; valid local Host/Origin checks and loopback-client checks prevent remote and cross-site use. Use `localhost` or `127.0.0.1` consistently, not interchangeably within a session.

`GET /auth/local/session`, `POST /auth/local/login` and `POST /auth/local/logout` return no-store JSON session state. Sign-in requires same-origin JSON `{ username, password }`, with a 4 KiB limit; five failed attempts per address in five minutes trigger 429 with `Retry-After`. A successful sign-in sets the opaque `qm_local_session` cookie (`HttpOnly`, `SameSite=Strict`, `Path=/`, `Max-Age=3600`, also `Secure` on HTTPS). Login/logout also expire the legacy `/auth/local` cookie to avoid duplicates. Session IDs rotate on sign-in, expire after one hour, are invalidated on logout and do not survive restart. Only token hashes and salted scrypt credential hashes are retained for authentication, in bounded server memory.

This session is **not production authentication** and never manufactures a JWT/API token. It establishes local identity for the same-origin proxy; the separately configured service account authorizes QuoteData access for both local and SSO users. There are no fake records or anonymous protected requests. See [the local server API and test instructions](frontend/README.md#optional-local-development-login); `npm run test:server` exercises synthetic sessions, OAuth responses and cryptographically signed JWTs without contacting SSO or QuoteData.

## Proxy contract and failures

Only `GET /api/quotedata/v1/quote` (detail/list query) and `POST /api/quotedata/v1/quote/{id}/complete` (JSON `resolutionNote`, 1–1000 characters) are forwarded. The completion contract remains an assumption requiring owner confirmation before real mutation. Routes, query strings, note bodies and response sizes are bounded; same-origin Host/Origin and loopback restrictions apply. POST requires exact Origin, and cross-site fetch metadata is rejected. Cookies, browser ID tokens and raw provider error bodies never reach QuoteData/browser responses respectively. Responses are no-store with a `trackingId` header.

Browser identity failures are `401 SIGN_IN_REQUIRED`. Token issuance failures are `502 SERVICE_TOKEN_FAILED`, not personal sign-in failures. A backend 401 invalidates the service token; GET reacquires/retries at most once and a final 401 becomes `502 UPSTREAM_UNAUTHORIZED`. POST is never replayed. Backend 403, 404 and 409 remain meaningful: `UPSTREAM_FORBIDDEN`, `QUOTE_NOT_FOUND`, `QUOTE_CONFLICT`. Other network/invalid-response failures return safe 502 errors, not empty successful results. Retain tracking IDs for diagnosis without copying credentials, tokens or customer payloads.

## Remote delivery prerequisites

- Obtain approved HTTPS token/QuoteData endpoints, service-account permissions and trusted server network access.
- Same-origin proxy mode removes the browser's upstream CORS dependency. A browser-direct deployment must explicitly select an alternative authentication mode, obtain delegated QuoteData scopes/audience/consent, use HTTPS and permit the frontend origin/headers/methods in remote CORS. Never send ID or Graph tokens to QuoteData.
- Confirm `/quotedata/v1/quote` detail lookup by `quoteRequestId` and ticket paging by `ticketNumber`, `page`, `size`, `sort` against the documented samples.
- Confirm general search/filter/date semantics and the currently assumed completion endpoint/payload with the API owner.
- Configure contract download only after confirming the endpoint, query parameters, authorization audience and response. Retry remains unavailable.
- Verify SSO login, consent, internal return route, logout, session expiry and service-account API authorization with approved test data before deployment. Static `dist` hosting alone does not implement the required `/api` proxy; the supplied server intentionally rejects non-loopback clients.

No real SSO or remote QuoteData operation is claimed as tested by these instructions. A successful local build or unit test is not a substitute for identity/API-owner validation.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Setup message or disabled sign-in | Supply valid `clientId`, `tenantId` and login scopes in `src\config.js`, rebuild, and reload. |
| `SERVICE_AUTH_NOT_CONFIGURED` | Privately configure complete `QUOTEDATA_CLIENT_ID`, `QUOTEDATA_CLIENT_SECRET`, `QUOTEDATA_SCOPE` and valid HTTPS URLs; restart the server. Browser `apiScopes` is not used in proxy mode. |
| `SSO_AUTH_NOT_CONFIGURED` | Set server `SSO_CLIENT_ID`/`SSO_TENANT_ID` to the approved frontend registration, then restart. |
| MSAL/script/font 404 | Use `npm ci`, then `npm start`; serve `dist`, not `src`. Vendor assets are local, not CDN fallbacks. |
| `AADSTS50011` | Match the exact scheme, hostname, port and path against the SPA redirect URI registration. |
| Consent or `interaction_required` | Sign in again and ask the identity owner to confirm delegated permission/consent policy. |
| Initialization error | Confirm public configuration, browser storage/network policy and MSAL loading; failures do not bypass authentication. |
| API 401 / `SIGN_IN_REQUIRED` | Sign in again; confirm the ID token issuer, tenant, audience and expiry match trusted server SSO settings, or that the local session is valid. |
| `SERVICE_TOKEN_FAILED` / `UPSTREAM_UNAUTHORIZED` | Have the administrator check service credentials/scope, token endpoint and QuoteData authorization. Repeating personal SSO will not fix service authorization. |
| API 403 | Confirm same-origin request checks or service-account permission according to the response code. A common UI does not override authorization. |
| Status 0 or blocked request | Check the same-origin Node server and browser network. Check upstream DNS/system certificates for server 502s; CORS/preflight applies only to explicit browser-direct deployments. |
| No contract download | Expected with blank configuration; displaying an ID does not prove a download API exists. |
| Completion fails | Confirm the assumed API contract and state with the owner before retrying; retain the displayed tracking ID for support without sharing tokens or customer payloads. |
