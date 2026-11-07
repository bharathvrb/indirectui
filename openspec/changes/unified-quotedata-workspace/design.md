## Context

The AngularJS/Bootstrap UI has login, quote search, ticket lookup and nine detail tabs. The Word requirements UI-01 through UI-17 are the source of truth except role distinctions, which the user explicitly removed. Existing uncommitted changes are retained and refined. The static server serves `src` but dependencies live outside it; the declared Gulp and Karma configuration files are missing.

The document demonstrates a QuoteData list envelope containing `content`, `totalElements`, `totalPages`, `page`, `size`. Detail is a direct object with nested `sites[].items`, `contacts`, `stepExecutions`, `errorDetails`, and a JSON string `quotePayload`. Missing sample fields do not prove that the API never returns them.

## Goals / Non-Goals

**Goals:** Deliver a cohesive operational UI, common SSO, faithful data display, robust navigation, responsive layouts, keyboard access, and a working local build. Address requirement gaps rather than merely repainting screens.

**Non-Goals:** Implement a replacement QuoteData backend, invent remote API capabilities, enable retry, copy credentials, or rewrite the application framework.

The subsequent user-requested temporary SSO configuration reuses ONP's public registration and login scopes. QuoteData token scopes remain separate; no Graph token is substituted for API authorization. The login page is a single centered sign-in card without promotional copy.

An explicitly enabled local-development account is available alongside SSO. Its credentials come only from the Node server process environment; a server-validated, expiring HTTP-only cookie restores the local session. This option is loopback-only, disabled in production, and cannot authorize QuoteData requests.

## Decisions

1. **One token-based theme stylesheet.** Replace stacked variants with light and dark tokens, blue brand surfaces, readable neutral content, and red/amber/green/purple accents with text labels. Use system preference as an optional setting. Reuse existing Bootstrap classes so detail tables remain consistent. Another final CSS override was rejected because it retains cascade conflicts.
2. **Common authenticated shell.** Responsive workspace navigation and breadcrumbs are shared by all authenticated users. Login is the unauthenticated entry point. Preserve only validated internal return URLs through SSO; display initialization errors instead of bypassing authentication. Runtime configuration supplies public client/tenant/scope identifiers. Real authentication remains dependent on registration.
3. **Shared results component and data helpers.** Quote and ticket views share all required columns and pagination; keep server paging and 300 ms debounce. Request generations prevent old responses overwriting newer results. URL-driven state must handle Back/Forward without duplicate requests. Missing fields remain an em dash, not invented data.
4. **Context-first detail workspace.** Preserve all required fields while improving header/failure summary hierarchy, site scope, accessible tab navigation, product tree expansion, target-row focus, diagnostics and copy feedback. Cross-reference execution IDs when error rows lack direct site/item references. Parse payload only for explicitly supported fallback fields, never to silently overwrite stored database state.
5. **Explicit capabilities.** Retry remains disabled and never calls an API. Contract IDs display independently of an optional configured download endpoint. Completion keeps its existing API assumption documented until confirmed, with precise error handling and no duplicate submissions.
6. **Reuse build and test dependencies.** Add the missing Gulp and Karma configuration using already declared packages; copy browser assets from installed dependencies to the served/built output. Use synthetic fixtures only in tests. No production mock data fallback.

## Risks / Trade-offs

- Unknown remote search/date/filter parameters and complete/download contracts -> retain documented request conventions, flag optional downloads, and document verification prerequisites rather than claiming live success.
- Missing SSO IDs/scopes -> visible setup state with no implicit authenticated session.
- Dense required fields -> retain horizontal table scrolling, strong labels and accessible row navigation rather than hiding required columns.
- AngularJS is legacy -> stay within its existing architecture to avoid a framework migration obscuring requirements work.
- Runtime validation cannot use real customer records -> use synthetic browser/test fixtures and do not send mutations to the remote service.

## Migration Plan

Build frontend assets, configure public SSO/QuoteData settings, then serve the generated output. Keep the existing backend unchanged. Rollback consists of restoring the previous frontend deployment; no database changes are involved.

## Open Questions

- Confirm QuoteData accepted search/date/filter names and token audience with the service owner.
- Confirm Complete API path/payload and whether an OMW contract-download API is available.
- Supply this application's SSO registration and permitted redirect URI.
