## Why

The Orion Middleware (OMW) supporting the Sales Platform needs a Quote Management UI to enable operators to view, manage, and inspect quotes generated during operations, along with their detailed product, pricing, and configuration information. Currently, there is no centralized interface to track quote status, drill down into details, or manage failed quote processing, creating operational blind spots and manual overhead. Operators also need a clear final contract milestone, a self-service recovery path for failed processing, and immediate visibility into where each quote is in its lifecycle.

## What Changes

- Create a new Quote Management Application with AngularJS frontend and Spring Boot backend
- Implement TMF 648 compliant quote data model and API structures
- Implement quote listing interface with status tracking and filtering capabilities  
- Build detailed quote inspection views with product, pricing, and configuration visibility; 4-tab layout (Customer, Site, Service Products, Promotions) driven by client-side parsing of a full TMF 648 rawPayload JSON field stored on the Quote entity
- Add `rawPayload` TEXT column to the Quote entity to store the complete TMF 648 JSON alongside the JPA-mapped fields, enabling rich client-side parsing without extra API calls
- Add `subStep` varchar(100) column to the Quote entity to record the current processing sub-step within the quote lifecycle (15 ordered sub-steps across 4 downstream systems: ODS, Dynamics CRM, Amdocs CRM, SQO)
- Add file upload and management for quote definition documents (PDF/JSON/images) with SHA-256 checksum validation and MIME type enforcement
- Implement quote processing retry functionality for failed quotes only (max 3 attempts)
- Add Sales Support Ticket tracking for failed quote transactions
- Establish REST API endpoints following TMF 648 standards for quote data operations, including a stats endpoint for quote counts by state
- Implement TMF 629 Customer Management API for customer data linked to quotes
- Create mock data layer for Phase 1 using an in-memory H2 database with individual TMF 648 JSON files (`mock-data/*.json`) for all 15 seeded quotes (no live backend integration initially)
- Add `Contract Signed` as the final quote sub-status after the existing 15 processing sub-statuses; preserve the five existing quote states (`RECEIVED`, `IN_PROGRESS`, `PENDING_APPROVAL`, `COMPLETED`, `FAILED`)
- Add authorization-checked Complete and Retry actions for failed quotes, with confirmation dialogs and persistent status-change audit records
- Display the current processing stage and a sequential quote lifecycle roadmap on quote details, including Contract Signed
- Rename all quote external IDs from `QT-*` format to `PARTNER-QUOTE-*` format
- Standardise all mock customer `customerType` to `Midmarket` and `customerSubType` to `Majors`
- Add dark/light theme toggle with `localStorage` persistence and flash-free initialization via inline script in the app shell
- Rename application from "OMW Quote Management" to "CB Integration Quote Management"
- Add Comcast Azure AD SSO authentication layer: MSAL.js (`msal-browser` 3.28.1) on the frontend for PKCE redirect login flow; Spring Security OAuth2 Resource Server on the backend for JWT Bearer token validation; authentication is conditional — activates only when `AZURE_TENANT_ID` and `AZURE_CLIENT_ID` environment variables are set to real values, otherwise the application runs in open dev/bypass mode so the UI loads without credentials during development
- Provide a verified local development runtime: Spring Boot API on `http://localhost:8080` and the AngularJS static frontend on `http://localhost:8081`, with seeded quote data available through the API

## Capabilities

### New Capabilities
- `quote-management-ui`: AngularJS-based frontend application with quote list, quote detail (4-tab view: Customer, Site, Service Products, Promotions), and support tickets screens; dark/light theme toggle persisted in `localStorage`; branded as "CB Integration Quote Management"; **Customer Name column (from `q.customer.name`) replacing Description in quote list; Sub-Step column showing current processing step; clickable State badge slides open a Bootstrap 5 Offcanvas side-drawer panel (offcanvas-end, 380 px) displaying a progress summary bar (X / 15 steps with state-coloured fill) above a vertical track of 15 steps grouped by downstream system (ODS=blue, Dynamics CRM=purple, Amdocs CRM=orange, SQO=teal) with colour-coded step status (green=completed, yellow=in-progress, red=failed, grey=pending); quote list remains fully visible and scrollable behind the open panel**
- `quote-api`: Spring Boot REST API at `/tmf-api/quote/v4` following TMF 648 standards; endpoints for list, get, create, state update, retry, and stats
- `quote-data-model`: TMF 648 compliant data structures for quotes (`Quote`, `QuoteItem`, `QuoteItemPrice`, `Note`, `RelatedParty`) and TMF 629 `Customer` with TMF 632 `ContactMedium`; `Quote` entity includes a `rawPayload` TEXT column for storing the complete TMF 648 JSON document alongside the JPA-mapped fields; **`subStep` varchar(100) column carries the 16-step lifecycle including final sub-status `Contract Signed`; `QuoteState` remains the five values `RECEIVED`, `IN_PROGRESS`, `PENDING_APPROVAL`, `COMPLETED`, `FAILED`**
- `customer-management`: TMF 629 Customer Management API at `/tmf-api/customerManagement/v4` for managing customers linked to quotes
- `file-upload-management`: Upload, storage, and retrieval of quote attachments (PDF, JSON, images) with MIME type validation, 10 MB size limit, UUID-based storage, and SHA-256 checksum verification
- `quote-processing-retry`: Retry mechanism for failed quote processing only, with a maximum of 3 attempts enforced server-side
- `sales-support-tickets`: Sales Support Ticket tracking and management at `/api/support-tickets` with status, priority, and category filtering
- `mock-data-layer`: TMF 648 compliant seed data generated at startup via `MockDataService` using an in-memory H2 database; includes customers, quotes, quote items, prices, notes, related parties, and support tickets; all 15 seeded quotes have a corresponding `mock-data/<id>-quote.json` file loaded as `rawPayload` at startup, giving each quote a full TMF 648 JSON document (relatedParty, contactMedium, quoteItem hierarchy with sites, packages, pricing, and promotions); **all quote IDs follow `PARTNER-QUOTE-*` naming; all customers use `customerType=Midmarket`, `customerSubType=Majors`; every quote has a Customer entity FK so `q.customer.name` is available in the list view; each non-completed quote has an appropriate `subStep` assigned matching its position in the 15-step lifecycle across 4 downstream systems**
- `sso-authentication`: Azure AD SSO authentication using MSAL.js on the frontend and Spring Security OAuth2 Resource Server on the backend; frontend manually bootstraps AngularJS only after MSAL authentication completes; Angular `AuthInterceptor` attaches `Authorization: Bearer <token>` to all API calls; backend `SecurityConfig` validates JWTs against the Comcast Azure AD tenant JWKS endpoint; navbar displays authenticated user's name and a Sign Out button; dev bypass mode boots the app without SSO when Azure AD credentials are not yet configured

### Modified Capabilities
- `quote-management-ui`: show the current processing stage and a click-open horizontal 16-sub-status roadmap with an explicit close action; show Complete and Retry actions only to authorized users for Failed quotes and require confirmation before either action
- `quote-api`: retain the five quote states, expose Contract Signed through the quote `subStep`, and provide authorized completion and retry operations
- `quote-data-model`: store Contract Signed as the final `subStep` and persist recovery audit records with actor, timestamp, previous status, and updated status
- `quote-processing-retry`: restrict recovery controls and transitions to Failed quotes, confirm user intent, resume existing processing on Retry, and audit both recovery transitions

## Impact

- **New Systems**: Complete Quote Management Application stack (AngularJS frontend + Spring Boot backend). The backend runs on port 8080; local static frontend hosting runs on port 8081 to avoid a port collision.
- **Standards Compliance**: TMF 648 Quote Management API and TMF 629 Customer Management API for telecommunications industry interoperability; contact mediums follow TMF 632
- **Dependencies**: AngularJS 1.8, Spring Boot 3.2 (requires Java 17+), H2 in-memory database (dev), local filesystem file storage, MSAL.js 3.28.1 (CDN), Spring Security + OAuth2 Resource Server (Spring Boot starter)
- **APIs**:
  - `GET/POST /tmf-api/quote/v4/quote` — list and create quotes
  - `GET /tmf-api/quote/v4/quote/{id}` — get quote detail
  - `PATCH /tmf-api/quote/v4/quote/{id}/state` — update quote state
  - `POST /tmf-api/quote/v4/quote/{id}/retry` — retry failed quote
  - `GET /tmf-api/quote/v4/quote/stats` — quote counts by state
  - `GET/POST /tmf-api/customerManagement/v4/customer` — list and create customers
  - `POST /api/files/quote/{quoteId}` — upload file attachment
  - `GET /api/files/quote/{quoteId}` — list attachments for a quote
  - `GET /api/support-tickets` — list support tickets
  - `POST /tmf-api/quote/v4/quote/{id}/complete` — complete a failed quote after explicit confirmation
  - `POST /tmf-api/quote/v4/quote/{id}/retry` — restart processing for a failed quote after explicit confirmation
  - Quote lifecycle responses expose Contract Signed through `subStep`; status statistics remain limited to the five quote states and recovery audit records capture actor and transition details
- **Data**: TMF 648/629 compliant entities, H2 in-memory database seeded at startup, file attachments stored under `./uploads/quotes/`
- **Infrastructure**: Spring Boot JVM process on port 8080; AngularJS static assets served on port 8081 during local development; H2 console available at `/h2-console` in dev mode; requires Java 17+
- **Security**: Azure AD SSO enforced when `AZURE_TENANT_ID` + `AZURE_CLIENT_ID` env vars are set; only Comcast Azure AD tenant tokens accepted; stateless JWT validation on every API request; no session state on the server
- **Integration Benefits**: Future APA backend integration simplified through TMF 648/629 standard compliance

## Current Local Verification

- Backend startup command: `backend\\gradlew.bat bootRun` with Java 17.
- Frontend startup command: `npx http-server src -p 8081 -c-1` from `frontend/`.
- Verified `GET http://localhost:8080/actuator/health` returns HTTP 200 with H2 status `UP`.
- Verified `GET http://localhost:8080/tmf-api/quote/v4/quote?page=0&size=1` returns HTTP 200 with seeded quote data.
- Verified `http://localhost:8081/` returns the AngularJS application shell.