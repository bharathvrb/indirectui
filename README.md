# OMW Quote Management UI

Web workspace for Orion Middleware (OMW) indirect quote requests. Sales Support and OMW Support users can search quotes, open a quote's full detail (customer, sites, products, promotions, processing steps, errors, events, payload, contracts) and mark a manually resolved failed quote as completed.

The UI is an AngularJS single-page app served by a small Node server. The server signs users in (SSO or a local development login) and proxies requests to the **QuoteData** service using a service account, so no QuoteData credential ever reaches the browser.

```
Browser ──(SSO ID token or local session cookie)──▶ Node server :8081 ──(service bearer token)──▶ QuoteData /quotedata/v1
                                                       └── client_credentials ──▶ token endpoint (sat-ci.codebig2.net)
```

## Run it

Requirements: Node.js 22 or newer, and a machine on the Comcast network (QuoteData is an internal host).

```bash
cd quote-management-app/frontend
npm ci
# edit server.properties: fill in the <...> values (client secret, local password)
git update-index --skip-worktree server.properties   # keep your secret out of commits
npm start
```

Open **http://127.0.0.1:8081/** and sign in with SSO, or with the local login from `server.properties`.

`npm start` builds the app into `dist/`, loads `server.properties` and starts the server on `127.0.0.1:8081`. It prints which settings it loaded.

## Configuration

| File | Holds |
| --- | --- |
| `frontend/server.properties` | Server settings: QuoteData service account, token/QuoteData URLs, SSO verification IDs, local login. Committed with placeholders; never commit the real secret. |
| `frontend/src/config.js` | Public browser settings: SSO client/tenant, list mode, auto-refresh interval, optional support/contract URLs. Rebuild (`npm start` does it) after changes. |

See [frontend/README.md](quote-management-app/frontend/README.md) for every setting, the proxy contract, troubleshooting and tests.

## Repository layout

```
quote-management-app/frontend/
  server.js              Node server: static files, local login, QuoteData proxy, properties loader
  quote-data-proxy.js    Authenticated proxy to QuoteData (token caching, error mapping)
  local-auth.js          Optional local development login
  sso-identity.js        Verifies Entra ID (SSO) ID tokens
  src/                   AngularJS app (screens, services, styles)
  tests/                 Karma UI specs and Node server tests
openspec/                Design proposals and specs for this app
```
