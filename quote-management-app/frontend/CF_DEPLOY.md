# Cloud Foundry deployment

This app deploys the same way as `onp-onboard-ui` in the Orion Notification Platform: the Node.js buildpack
installs the dependencies, `npm start` builds the UI and runs `server.js`, and the platform checks `/health`.

## Files

| File | Purpose |
| --- | --- |
| `manifest.yml` | App name `omw-quote-management-ui`, 512 MB, 1 GB disk, 1 instance, `nodejs_buildpack` on `cflinuxfs4`, HTTP health check on `/health`, and the public settings (QuoteData URLs, scope, client ID, SSO IDs). **No secrets.** |
| `.cfignore` | Keeps `node_modules`, `dist`, tests and **`server.properties`** out of the upload (the platform builds the app, and local secrets must never be uploaded). |
| `server.js` | Uses the platform's `PORT` and `0.0.0.0`, answers `/health`, and takes its public address from the app's route. |

## Deploy

```bash
cf login -a <api-endpoint>
cd quote-management-app/frontend
cf push --no-start
```

Set the secrets (they are not in the manifest) and start:

```bash
cf set-env omw-quote-management-ui QUOTEDATA_CLIENT_SECRET '<client secret from the requirement document>'
cf set-env omw-quote-management-ui LOCAL_LOGIN_USERNAME '<username>'
cf set-env omw-quote-management-ui LOCAL_LOGIN_PASSWORD '<password>'
cf start omw-quote-management-ui
```

Without the client secret every QuoteData call answers `503 SERVICE_AUTH_NOT_CONFIGURED`. Local sign-in stays off until both the username and password are set (SSO still works).
Later changes to a secret: `cf set-env ...` then `cf restage omw-quote-management-ui`.

Find the address and open it:

```bash
cf app omw-quote-management-ui     # shows the route
```

## After the first deploy

1. **Register the SSO redirect URI.** Add `https://<route>/` as a single-page-application redirect URI on the Entra app registration used by `AUTH_CONFIG.clientId` in `src/config.js`. Until then SSO shows `AADSTS50011`; local sign-in works.
2. **Check the health endpoint:** `curl https://<route>/health` returns `{"status":"ok"}`.
3. **Sign in** with the local username and password, then look up a quote.

## How it works on the platform

1. **Staging:** the buildpack runs `npm ci`. `NPM_CONFIG_PRODUCTION: "false"` and `NPM_CONFIG_INCLUDE: dev` keep the dev dependencies, because the build tool (gulp) is one of them.
2. **Start:** `npm start` runs `prestart` (`gulp build` into `dist/`) and then `node server.js`.
3. **Port and address:** the server listens on `$PORT` at `0.0.0.0`. Even a `server.properties` saying `127.0.0.1:8081` is overridden on the platform.
4. **Public address:** `QM_PUBLIC_ORIGIN` is taken from the app's first route in `VCAP_APPLICATION` (always `https://`). That makes sign-in cookies `Secure` and enables `Strict-Transport-Security`. Requests must carry that host and origin, so use the route you see in `cf app`. For a custom domain, map the route and set `QM_PUBLIC_ORIGIN` yourself:
   ```bash
   cf set-env omw-quote-management-ui QM_PUBLIC_ORIGIN https://quotes.example.com
   cf restage omw-quote-management-ui
   ```
5. **Client addresses:** `QM_TRUST_PROXY: "true"` counts failed sign-ins per real client (the router appends the address). Without it, five wrong passwords from anyone would lock everyone out.
6. **Logs:** one line per QuoteData call with its tracking ID. `cf logs omw-quote-management-ui --recent`.

## Settings

| Setting | Where | Notes |
| --- | --- | --- |
| `QUOTEDATA_CLIENT_ID`, `QUOTEDATA_SCOPE`, `QUOTEDATA_TOKEN_URL`, `QUOTEDATA_BASE_URL` | `manifest.yml` | Public values from the requirement document. |
| `QUOTEDATA_CLIENT_SECRET` | `cf set-env` | Secret. |
| `LOCAL_LOGIN_USERNAME`, `LOCAL_LOGIN_PASSWORD` | `cf set-env` | Secret; both or neither. |
| `QUOTEDATA_RETRY_ENABLED` | `manifest.yml` | `"false"` until the retry endpoint exists. Also set `features.retryEnabled: true` in `src/config.js`, then push again. |
| `SSO_CLIENT_ID`, `SSO_TENANT_ID` | `manifest.yml` | Must match `AUTH_CONFIG` in `src/config.js`. |
| `QM_PUBLIC_ORIGIN` | `cf set-env` (optional) | Only for a custom domain or several routes. |
| `src/config.js` | repository | Browser settings; changing it needs a new `cf push`. |

## Limits to know about

- **One instance.** Sign-in sessions live in the server's memory, so scaling out would send users to an instance that does not know them. A restart or restage signs everyone out. Keep `instances: 1`.
- **Outbound access.** The app must reach the token host (`sat-ci.codebig2.net`) and the QuoteData host directly; it does not use an HTTP proxy.
- **AngularJS 1.x is end-of-life.** See Known risks in `README.md`.

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| Crash at start with `gulp: not found` | The dev dependencies were not installed. Check `NPM_CONFIG_PRODUCTION` and `NPM_CONFIG_INCLUDE` in the manifest. |
| Health check keeps failing | `cf logs --recent` for the start error. The app must answer `/health` on `$PORT` within the 180 s `timeout`. |
| `403 REQUEST_FORBIDDEN` or sign-in refused | The browser's host or origin is not the app's public address. Open the route from `cf app`, or set `QM_PUBLIC_ORIGIN` for a custom domain. |
| `503 SERVICE_AUTH_NOT_CONFIGURED` | `QUOTEDATA_CLIENT_SECRET` is not set. |
| `502 SERVICE_TOKEN_FAILED` | Wrong secret or scope, or the token host is not reachable from the platform. |
| `Local sign-in is off` in the log | `LOCAL_LOGIN_USERNAME` and `LOCAL_LOGIN_PASSWORD` are not both set. |
| Everyone gets "Too many sign-in attempts" | `QM_TRUST_PROXY` is not `"true"`, so all users share the router's address. |

Useful commands: `cf app omw-quote-management-ui`, `cf events omw-quote-management-ui`, `cf ssh omw-quote-management-ui`, `cf restart omw-quote-management-ui`.
