## Context

The Orion Middleware (OMW) lacks a centralized quote management interface, requiring operators to manually track quote processing status and details across multiple systems. Currently there is no existing quote management infrastructure, making this a greenfield application. The solution must support the Sales Platform's operational needs while maintaining strict data privacy (no customer PII).

Key constraints:
- Phase 1 uses mock data only (no APA backend integration)
- Production data must exclude customer PII unless explicitly required by an approved integration. Phase 1 fixtures use synthetic business/customer data and the UI renders the TMF payload needed for quote operations.
- Operational focus for Orion Middleware (OMW) teams
- Integration with future APA backend planned for Phase 2

## Goals / Non-Goals

**Goals:**
- Create scalable full-stack Quote Management Application 
- Provide intuitive quote listing and detailed inspection capabilities
- Enable quote processing retry functionality and file management
- Establish clean API architecture for future APA integration
- Deliver production-ready application with AngularJS frontend and Spring Boot backend

**Non-Goals:**
- Customer PII handling or site address management
- Quote editing or configuration modification capabilities
- Live APA backend integration (Phase 2)
- Comcast Azure AD authentication is implemented conditionally; full tenant registration and production claim/group mapping remain deployment prerequisites.
- Real-time quote processing monitoring

## Decisions

### Frontend Framework: AngularJS
**Rationale:** AngularJS provides mature, well-documented framework for building responsive SPAs with strong two-way data binding and component architecture.
**Alternatives Considered:** 
- React: More modern but requires additional tooling setup
- Vue.js: Simpler learning curve but smaller ecosystem
- Angular (modern): Overkill for current scope and requirements

### Local Runtime Topology
**Decision:** Run the Spring Boot API on port `8080` and serve the AngularJS `src/` directory on port `8081` during local development.
**Rationale:** The frontend service is configured with `API_BASE_URL = http://localhost:8080`, while the backend owns port 8080. Separate static hosting avoids the frontend/backend port collision and keeps the API origin explicit.
**Commands:** Use Java 17 with `backend\\gradlew.bat bootRun`; from `frontend/`, use `npx http-server src -p 8081 -c-1`.

### Backend Framework: Spring Boot  
**Rationale:** Spring Boot offers rapid development with built-in REST capabilities, comprehensive testing support, and seamless file handling. Strong ecosystem for future APA integration.
**Alternatives Considered:**
- Node.js/Express: Consistent JavaScript stack but less robust for enterprise integrations
- .NET Core: Good performance but adds platform complexity
- Django: Excellent but Python adds language diversity

### Data Model Standard: TMF 648 Quote Management API
**Rationale:** TMF 648 provides telecommunications industry-standard quote management schemas, ensuring interoperability with other TM Forum compliant systems and future APA backend integration. Reduces custom development effort and increases system reliability.
**Alternatives Considered:**
- Custom quote schema: Faster initial development but lacks industry standardization
- Generic business schemas: Good flexibility but not telecommunications-specific
- Legacy quote formats: Existing compatibility but limits future integration capabilities
**TMF 648 Benefits:** Standardized quote lifecycle, product catalog integration, party management, pricing structures, and event notifications

### Architecture Pattern: RESTful API with TMF 648/629 Compliance
**Rationale:** Clean separation between frontend and backend enables independent development, testing, and future backend replacement for APA integration. TMF 648/629 compliance ensures industry-standard telecommunications quote and customer management and facilitates integration with other TM Forum compliant systems.
**API Design (implemented):**
- `GET/POST /tmf-api/quote/v4/quote` — TMF 648 compliant quote listing (paginated, filterable by state) and creation
- `GET /tmf-api/quote/v4/quote/{id}` — Individual quote details following TMF 648 schema
- `PATCH /tmf-api/quote/v4/quote/{id}/state` — Quote state transition
- `POST /tmf-api/quote/v4/quote/{id}/retry` — Processing retry (extension to TMF 648; only FAILED quotes eligible)
- `GET /tmf-api/quote/v4/quote/stats` — Quote counts by state (Sales Platform extension)
- `GET/POST /tmf-api/customerManagement/v4/customer` — TMF 629 customer listing and creation
- `GET /tmf-api/customerManagement/v4/customer/{id}` — Customer by internal ID
- `GET /tmf-api/customerManagement/v4/customer/ext/{externalId}` — Customer by business key
- `POST /api/files/quote/{quoteId}` — File attachment upload for a quote
- `GET /api/files/quote/{quoteId}` — List attachments for a quote
- `GET /api/files/{id}/download` — Download a specific file
- `DELETE /api/files/{id}` — Remove a file attachment
- `GET/POST/PATCH /api/support-tickets` — Sales Support Ticket CRUD
- `POST /api/support-tickets/quote/{quoteId}` — Auto-create ticket from failed quote
- `POST /api/support-tickets/{id}/retry` — Record a retry attempt from a ticket
- `POST /tmf-api/quote/v4/quote/{id}/complete` — Authorized completion of a failed quote
- **TMF 648/629 Benefits:** Standardized quote lifecycle, customer/party management (TMF 632 ContactMedium), product catalog integration, pricing structures
- **Current API boundary:** Pagination currently uses `page` and `size`; list responses return a wrapper object containing `quotes`, `totalElements`, `totalPages`, `currentPage`, and `pageSize`. TMF hypermedia headers and event notification endpoints remain planned work.

### Customer Management: TMF 629 Compliance
**Rationale:** Quotes reference customers as owning parties. Implementing TMF 629 Customer Management alongside TMF 648 provides a consistent TM Forum standards layer and avoids a custom party schema that would complicate future APA integration.
**Implementation:**
- `Customer` entity with `ContactMedium` (TMF 632) for communication details
- `CustomerController` at `/tmf-api/customerManagement/v4` with list, get, create, search by name/status/externalId
- `CustomerService` with pagination and `@Transactional` query support
- Customers seeded at startup via `MockDataService` alongside quotes
**Alternatives Considered:**
- Embed party info directly in Quote: Simpler but violates TMF separation of concerns
### Customer Management: TMF 629 Compliance
**Rationale:** Quotes reference customers as owning parties. Implementing TMF 629 Customer Management alongside TMF 648 provides a consistent TM Forum standards layer and avoids a custom party schema that would complicate future APA integration.
**Implementation:**
- `Customer` entity with `ContactMedium` (TMF 632) for communication details
- `CustomerController` at `/tmf-api/customerManagement/v4` with list, get, create, search by name/status/externalId
- `CustomerService` with pagination and `@Transactional` query support
- Customers seeded at startup via `MockDataService` alongside quotes
**Alternatives Considered:**
- Embed party info directly in Quote: Simpler but violates TMF separation of concerns
- Skip customer API for Phase 1: Reduces scope but makes Phase 2 APA integration harder

### rawPayload Storage: Full TMF 648 JSON Alongside JPA Entity
**Rationale:** Partner-originated quotes carry a richer TMF 648 JSON structure (nested relatedParty, contactMedium with site contacts, hierarchical quoteItem trees with packages and promotions) that cannot be fully expressed by the flat JPA-mapped columns without a major schema expansion. Storing the original JSON in a `rawPayload TEXT` column allows the frontend to parse and render all detail tabs directly without additional API calls or complex join queries.
**Implementation:**
- `@Column(name = "raw_payload", columnDefinition = "TEXT")` on the `Quote` entity
- `MockDataService.loadRawPayload(filename)` loads each `mock-data/<id>-quote.json` classpath resource and sets it on the quote before save
- 15 JSON files under `src/main/resources/mock-data/` — one per seeded quote
- Frontend `parseTmfPayload()` in `quote-detail.controller.js` parses the JSON and populates `$scope.tmfCustomer`, `$scope.tmfSites[]`, `$scope.tmfPromotions[]`, etc.
**Alternatives Considered:**
- Expand JPA schema with site/contact sub-tables: Complete relational model but high schema complexity and migration cost for Phase 1
- Fetch full payload from a separate endpoint: Extra round-trip; rawPayload is already returned in the quote detail response
- Store only for partner quotes: Inconsistent UX; decided to add rawPayload to all seeded quotes for uniform tab rendering

### Quote Detail View: 4-Tab Layout Driven by rawPayload Parsing
**Rationale:** A quote carries data at multiple levels — customer org, individual contacts, service sites with site-level contacts, nested product/package trees, and promotions. Rendering all of this in a single scrollable view would be overwhelming. A tabbed layout scoped to the TMF structure provides clear separation and intuitive navigation.
**Implementation:**
- **Customer tab** (`tmfCustomer` populated): Org info card, postal address card, contact cards (one per `relatedParty[role=Contact]` with mediums matched via `contactType` prefix)
- **Site tab** (`tmfSites.length > 0`): Card per site with service address and site-level contacts
- **Service Products tab**: Grouped by site → package/standalone header → child plans → grandchild add-ons with prices
- **Promotions tab** (`tmfPromotions.length > 0`): Cards per promotion with type badge and associated site name
- **Items tab** (fallback when no `tmfCustomer`): Legacy flat item list from JPA `quoteItems[]`
- Tab visibility is conditional; `activeTab` defaults to `'customer'` when rawPayload is present, else `'items'`
- `parseProductTree(item)` recurses to arbitrary depth for nested quoteItem trees
**Alternatives Considered:**
- Single scrollable detail page: Simpler but poor UX for multi-site quotes with many contacts and products
- Separate routes per tab: Cleaner URL structure but unnecessary complexity for Phase 1

### Dark/Light Theme: CSS Custom Properties with localStorage Persistence
**Rationale:** Operators use the tool in varying lighting environments. A theme toggle reduces eye strain during low-light usage without requiring a full skin swap or server-side preference storage.
**Implementation:**
- CSS custom properties (`--bg-color`, `--card-bg`, `--text-color`, etc.) defined for both `[data-theme="light"]` and `[data-theme="dark"]` on `:root`
- `applyTheme(theme)` sets `data-theme` on `<html>` and saves to `localStorage`
- Inline `<script>` in `index.html` reads `localStorage` and applies theme before first render (prevents flash of unstyled/wrong-theme content)
- Bootstrap 5 component overrides target `.card`, `.card-header`, `.table`, `.nav-tabs`, `.form-control`, `.navbar`, `.bg-light`, `.text-muted` with CSS specificity
- 0.25 s `transition` on `background-color` and `color` for smooth switching
**Alternatives Considered:**
- Server-side preference: Adds state management complexity with no benefit for Phase 1
- Separate CSS file per theme: Higher maintenance; custom properties are cleaner and co-located

### Application Branding: CB Integration Quote Management
**Rationale:** The application was initially named "OMW Quote Management" reflecting its Orion Middleware origin. Renaming to "CB Integration Quote Management" aligns the branding with the CB Integration platform context under which the tool is operated.
**Implementation:**
- `<title>` and navbar brand in `index.html` updated
- `$rootScope.appName` in `app.js` updated
- All user-visible strings referencing "OMW Quote Management" replaced
**Rationale:** H2 provides full SQL capabilities for development while being easily replaceable with production database for Phase 2.
**Alternatives Considered:**
- PostgreSQL: Production-ready but adds infrastructure complexity for mock data phase
- MongoDB: Good for document storage but adds NoSQL complexity
- File-based storage: Too simplistic for relational quote data

### Quote State Standardisation and Contract Signed Sub-Status
**Rationale:** The five existing quote states remain unchanged. Contract Signed is the final lifecycle sub-status after the 15 processing sub-statuses and is stored in `Quote.subStep`, not in `QuoteState`.
**Implementation:**
- `QuoteState.java` remains `RECEIVED`, `IN_PROGRESS`, `PENDING_APPROVAL`, `COMPLETED`, and `FAILED`
- Completing a Failed quote changes its state to `COMPLETED` and its `subStep` to `Contract Signed`; retry changes its state to `IN_PROGRESS` and resets `subStep` to `Address Validation & Enrichment`
- `QuoteService.updateQuoteState()` keeps completion-date behavior on `COMPLETED` and sets `subStep` to `Contract Signed` when a quote is completed
- `MockDataService` generation methods updated: `generateAcceptedQuotes()` seeds with `RECEIVED`; `generatePendingQuotes()` seeds with `PENDING_APPROVAL`; `generateRejectedQuotes()` seeds with `FAILED`
- Frontend state labels, filters, and statistics remain limited to the five quote states
**Alternatives Considered:**
- Add a sixth quote state: Rejected because Contract Signed identifies a lifecycle sub-status, not a separate quote processing state

### Quote External ID Format: PARTNER-QUOTE-* Naming Convention
**Rationale:** All seeded quote IDs followed a `QT-*` internal format. Renaming to `PARTNER-QUOTE-*` reflects the partner portal origin of quotes and aligns with the CB Integration branding.
**Implementation:**
- All `buildQuote()` calls in `MockDataService` updated (e.g. `QT-A001` → `PARTNER-QUOTE-A001`)
- All 15 `mock-data/*.json` files updated (`externalId` field)
- `loadRawPayload()` filenames kept as `qt-*` (original filenames unchanged on disk)
- Multi-site Dominos quote `PARTNER-QUOTE-67890` seeded last to appear first in the default `createdAt DESC` sort
**Alternatives Considered:**
- Rename disk files too: Would break the `loadRawPayload()` mapping; deferred to a future cleanup task

### Mock Customer Normalisation: Midmarket / Majors
**Rationale:** All seeded customers had inconsistent `customerType` and `customerSubType` values. Normalising to `Midmarket` / `Majors` across all 15 JSON files ensures a consistent dataset for UI development and demo purposes.
**Implementation:**
- `customerType: "Midmarket"` and `customerSubType: "Majors"` applied to all 15 `mock-data/*.json` files

### Sub-Step Field: 16-Step Processing Lifecycle Across 4 Downstream Systems
**Rationale:** Quotes pass through a well-defined sequence of processing steps before completion, each owned by a distinct downstream system (ODS, Dynamics CRM, Amdocs CRM, SQO). Surfacing the current step gives operators immediate visibility into where a quote is in the pipeline and which system owns the active work, without opening the detail view. This is particularly valuable for diagnosing failures (which step in which system failed?) and tracking in-progress quotes.
**Implementation:**
- `@Column(name = "sub_step", length = 100)` + `@JsonProperty("subStep")` added to `Quote` entity with getter/setter
- 15 ordered processing sub-steps grouped by downstream system, followed by the final Contract Signed sub-status:
  - **ODS** (blue): Address Validation & Enrichment
  - **Dynamics CRM** (purple): Customer Create, Contact Reaction
  - **Amdocs CRM** (orange): Customer Creation, Site Creation
  - **SQO** (teal): Proposal Create, Add Sites, Assign Offers, Add Addon, Configure Offers, Add Add-Ons, Aggregate, Finalize, Internal Approval, Contract Generation
- `Contract Signed` is the 16th sub-status after Contract Generation and is serialized through the existing `subStep` property
- `MockDataService` assigns each quote a contextually appropriate sub-status:
  - `COMPLETED` → `Contract Signed`
  - `RECEIVED` → early steps (Address Validation & Enrichment, Customer Create)
  - `IN_PROGRESS` → mid-pipeline steps (Site Creation, Add Sites, Assign Offers, Configure Offers)
  - `FAILED` → the step at which processing failed (Customer Creation, Proposal Create, Add Addon, Aggregate, Contact Reaction)
  - `PENDING_APPROVAL` → Finalize
- Quote list table: `Sub-Step` column added next to `State` column displaying a grey secondary badge or `—`
**Alternatives Considered:**
- Store step index instead of name: More compact but less readable in API responses and harder to display directly in UI
- Derive sub-step from support ticket data: Indirect; not all quotes have tickets

### Sub-Step Progress Offcanvas Panel: Grouped Vertical Track Side-Drawer
**Rationale:** A clickable state badge opening an offcanvas side-drawer gives operators a compact, scannable view of how far along the 15-step pipeline a quote has progressed without navigating to the detail page. Grouping steps by downstream system (ODS, Dynamics CRM, Amdocs CRM, SQO) with distinct colour coding immediately communicates which system owns the current work and where failures occurred. The offcanvas approach (vs. a modal) keeps the full quote list visible and scrollable in the background.
**Implementation:**
- State badge in `quote-list.html` gains `ng-click="openSubStepModal(q, $event)"` and `style="cursor:pointer"`
- `ALL_SUB_STEP_GROUPS` array in `quote-list.controller.js` defines 4 groups with their steps and colour tokens (`ods`, `dynamics`, `amdocs`, `sqo`); a flat `ALL_SUB_STEPS` list is derived from the groups for index-based status calculation
- `openSubStepModal()` builds a mixed `subStepStatuses[]` array containing both group header items (`type: 'group'`) and step items (`type: 'step'`, with `groupColor`, `stepNum`, `isLast`)
  - `COMPLETED` → all 15 steps = `completed` (all group-coloured)
  - `IN_PROGRESS` / `RECEIVED` / `PENDING_APPROVAL` → steps before current = `completed`, current = `active` (group-coloured pulse), rest = `pending`
  - `FAILED` → steps before current = `completed`, current = `failed` (red), rest = `pending`
- `$scope.completedCount` counts only `type === 'step'` items with `status === 'completed'`; `$scope.totalStepCount = 15` drives the progress bar width
- Bootstrap 5 Offcanvas (`#subStepOffcanvas`, `offcanvas-end`, 380 px) rendered via `bootstrap.Offcanvas` JS API with `{ keyboard: true, scroll: true }`
- Panel structure: header (externalId code, state badge, current subStep badge) → progress summary bar (thin 6 px bar, state-coloured fill) → scrollable body with `.substep-track`
- Group headers rendered as `.substep-group-header.substep-group-{color}` with a small coloured pill label
- Step items carry `.substep-group-step-{color}` — overrides the default icon background/border/connector colour with the system colour when `completed` or `active`; `failed` state always renders red
- CSS colour tokens: ODS=`#1d4ed8` (blue), Dynamics CRM=`#7c3aed` (purple), Amdocs CRM=`#ea580c` (orange), SQO=`#0f766e` (teal)
- Dark mode supported via `[data-theme="dark"]` overrides for all group label pills
**Alternatives Considered:**
- Bootstrap Modal dialog: Blocks the quote list in the background; switched to offcanvas
- Flat ungrouped list: Loses the downstream-system context that helps operators identify ownership of the active/failed step
- Horizontal stepper: More compact but truncates step names at small widths

### Quote List Column: Customer Name Instead of Description
**Rationale:** Displaying the description string in the list gave operators no immediate context about who the quote belongs to. Replacing it with `q.customer.name` (from the linked TMF 629 Customer entity) surfaces the account name at a glance, consistent with how operators think about quotes.
**Implementation:**
- `quote-list.html` column header changed from `Description` to `Customer Name`; cell renders `{{q.customer.name || '—'}}`
- All 15 seeded quotes now have a populated `customer` FK in `MockDataService` — 8 new Customer entities added: SenseTech Manufacturing (CUST-0103), Crestwood Logistics (CUST-0071), Pacific Rim Trading (CUST-0034), InterConnect Partners (CUST-0012), Sunrise Retail Group (CUST-0092), GreenSpace Properties (CUST-0067), GlobalTrade Corporation (CUST-0001), BlueStream Media (CUST-0018)
- `setCustomer()` called for every quote that previously had no customer FK (P005, F006–F009, C010–C011, PND012)
**Alternatives Considered:**
- Show both Description and Customer Name: Too wide; customer name is more operationally valuable for the list view

### File Storage: Local Filesystem (Phase 1)
**Rationale:** Simple file storage for attachments during development phase, easily migrated to cloud storage later.
**Security Controls (implemented):**
- MIME type allowlist: PDF, JSON, CSV, Excel (.xls/.xlsx), PNG, JPEG, GIF
- 10 MB maximum file size enforced server-side
- UUID-prefixed filenames to prevent path traversal
- SHA-256 checksum computed and stored on upload for integrity verification
- Files stored under `./uploads/quotes/` with quote-scoped subdirectory
**Future Migration Path:** Azure Blob Storage or AWS S3 for production deployment

## Risks / Trade-offs

**[Legacy AngularJS Framework] →** Mitigation: Well-documented upgrade path to modern Angular exists for future modernization. Current team expertise with AngularJS reduces development risk.

**[Mock Data Limitations] →** Mitigation: Design data models to match expected APA backend structure. Create comprehensive test data covering all quote scenarios and edge cases.

**[File Storage Scalability] →** Mitigation: Abstract file storage behind service interface. Local storage acceptable for Phase 1 scope, cloud migration planned for production.

**[Authentication and Authorization] →** **Mitigated for the current implementation:** Azure AD SSO and server-side quote-update authorization are implemented conditionally. Production activation still requires Comcast app registration, real environment variables, and confirmation of the role/claim mapping.

**[H2 Database Limitations] →** Mitigation: Use standard JPA annotations and queries compatible with production databases. Include database migration strategy in Phase 2 planning.

## Migration Plan

**Phase 1 Deployment:**
1. Deploy as standalone application with embedded H2 database
2. Configure local file storage directory
3. Load comprehensive mock data set
4. Validate all quote management workflows

**Phase 2 Migration Strategy:**
1. Replace mock data layer with APA backend integration
2. Migrate to production database (PostgreSQL recommended)
3. Implement cloud file storage (Azure Blob Storage)
4. Complete Comcast Azure AD app registration and set `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` to activate SSO enforcement (code is already in place)
5. Performance optimization and monitoring

**Local smoke-test baseline:** With Java 17, start the backend on `8080`, start the frontend on `8081`, verify `/actuator/health` returns `UP`, verify the paginated quote endpoint returns seeded data, and load the frontend shell from `http://localhost:8081/`.

**Rollback Strategy:**
- Maintain current manual processes during Phase 1 deployment
- Feature flags for gradual rollout of quote management capabilities
- Database backup and restore procedures for production migration

## Open Questions

1. ~~**Quote Processing Retry Logic:** What specific retry mechanisms should be implemented?~~ **RESOLVED:** Retry is manual and immediate. Only `FAILED` quotes are eligible. On retry the state transitions to `IN_PROGRESS` and the version number is incremented. `MAX_RETRY_ATTEMPTS = 3` is defined server-side. Retry can also be triggered from a Support Ticket via `POST /api/support-tickets/{id}/retry`.

2. ~~**File Size and Type Validation:** Beyond PDF/JSON, are there specific file size limits?~~ **RESOLVED:** 10 MB limit enforced. Allowed types: PDF, JSON, plain text, CSV, Excel (.xls/.xlsx), PNG, JPEG, GIF. SHA-256 checksum validated on upload.

3. ~~**Quote Status Lifecycle:** Are there additional quote statuses?~~ **UPDATED:** Quote states remain `RECEIVED`, `IN_PROGRESS`, `PENDING_APPROVAL`, `COMPLETED`, and `FAILED`. Contract Signed is the 16th and final `subStep`, after Contract Generation. `FAILED` is recoverable only through authorized Complete or Retry actions. Ticket states remain: `OPEN`, `IN_PROGRESS`, `PENDING_CUSTOMER`, `RESOLVED`, `CLOSED`, `CANCELLED`.

4. **Performance Requirements:** Expected quote volume and concurrent user load for sizing infrastructure appropriately? *(Unresolved — relevant for Phase 2 database migration planning.)*

5. **Integration Timing:** Phase 2 APA backend integration timeline to inform API design decisions? *(Unresolved — H2 → PostgreSQL migration and APA wiring deferred to Phase 2.)*

### Authentication: Azure AD SSO with MSAL.js
**Rationale:** The dashboard contains commercially sensitive quote data that should be accessible only to authorised Comcast personnel. Azure AD is Comcast's corporate identity provider, making it the natural SSO target. MSAL.js (Microsoft Authentication Library) is the Microsoft-supported library for SPA OAuth 2.0 PKCE flows and was chosen over generic OAuth libraries for first-class Azure AD support.
**Implementation:**
- **Frontend (`index.html`)**: MSAL.js 3.28.1 loaded from CDN before AngularJS; `ng-app` attribute removed from `<html>`; MSAL bootstrap block at bottom of `<body>` initialises `PublicClientApplication`, calls `handleRedirectPromise()` to process the Azure AD callback, then manually calls `angular.bootstrap()` once an authenticated account is confirmed — ensuring Angular never runs without a valid session
- **Dev bypass mode**: If `clientId` / `tenantId` placeholders are still set (`YOUR_AZURE_CLIENT_ID_HERE` / `YOUR_COMCAST_TENANT_ID_HERE`), the bootstrap block sets `window.__ssoBypass = true` and boots Angular directly without contacting Azure AD — the UI is fully functional for development
- **`AuthService` (`auth.service.js`)**: AngularJS factory wrapping the `window.__msalInstance`; exposes `getUser()`, `isAuthenticated()`, `acquireToken()` (silent → redirect fallback), `logout()`
- **`AuthInterceptor` (`app.js`)**: AngularJS HTTP interceptor registered in `.config()`; detects API-bound requests (`/tmf-api`, `/api`, `localhost:8080`); calls `AuthService.acquireToken()` and injects `Authorization: Bearer <token>` before dispatching; non-API requests (templates, assets) pass through unmodified
- **Navbar**: `ng-bind="currentUser.name"` (no raw interpolation `{{}}` to avoid flash); `ng-if="currentUser"` hides the user bar when `$rootScope.currentUser` is not set; Sign Out button calls `$rootScope.logout()` → `AuthService.logout()` → `msalInstance.logoutRedirect()`
- **Backend (`SecurityConfig.java`)**: `@EnableWebSecurity`; reads `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` env vars; `isSsoConfigured()` check compares against placeholder strings — if real values present, builds `JwtDecoder` via `JwtDecoders.fromIssuerLocation(issuerUri)` at bean creation time and applies `.oauth2ResourceServer(jwt → jwt.decoder(...))` to all non-public routes; if placeholders remain, falls through to `.anyRequest().permitAll()`
- **Critical design note**: `spring.security.oauth2.resourceserver.jwt.issuer-uri` is intentionally NOT set in `application.yml` — Spring Boot's auto-configuration would attempt to fetch the JWKS from the issuer URL at startup, crashing the app with placeholder values. The decoder is constructed in code inside the `if (isSsoConfigured())` branch only
- **Stateless**: `SessionCreationPolicy.STATELESS`; CSRF disabled; CORS delegated to existing `CorsConfigurationSource` bean in `CorsConfig.java`
- **Permitted routes (when SSO active)**: `/h2-console/**`, `/actuator/health`, `/`, `/index.html`, `/app/**`, `/assets/**`, static assets
- **Activation steps** (no code changes required): (1) Register app in Comcast Azure AD portal; (2) expose `api://<clientId>/access_as_user` scope; (3) replace two placeholder values in `index.html`; (4) set `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` env vars before starting backend
**Alternatives Considered:**
- Basic Auth: Simple to implement but single shared credential; not per-user; no identity propagation
- Google / GitHub OAuth2: No Comcast IT approval required but uses non-corporate identity provider
- Auth0 free tier: Supports any email including Comcast addresses; closest to real SSO without IT approval; deferred in favour of native Azure AD
- Custom session-based login: Full control, no external dependency; requires user table management; deferred as Phase 2 option
- `issuer-uri` in `application.yml`: Rejected — triggers JWKS fetch at startup even with placeholder values, crashing the app in dev mode

### Failed Quote Recovery, Authorization, and Audit
**Rationale:** Recovery actions change operational state and must be deliberate, attributable, and unavailable to users without quote-update permission.
**Implementation:**
- Render Complete and Retry only when the quote state is `FAILED` and the authenticated principal has the configured quote-update authority; when SSO is explicitly unconfigured, local development bypass enables these actions for local testing only
- Complete and Retry each require a Yes/No confirmation using the requested prompt. No closes the dialog without an API call or state change
- Complete uses `POST /tmf-api/quote/v4/quote/{id}/complete` and transitions `FAILED` to `COMPLETED`; Retry uses the existing retry API, transitions `FAILED` to `IN_PROGRESS`, and invokes the existing retry processing rules
- Reject unauthorized actions server-side even if a client calls the endpoint directly; return the existing API error format and do not mutate quote or audit data
- Persist an append-only quote status audit record in the same transaction as each successful transition, with quote ID, authenticated user ID, timestamp, previous state, and updated state
- Resolve user ID from the validated security principal; never trust a user ID supplied in the request body
- Maintain backward compatibility for existing state values and endpoints; expose Contract Signed in the quote `subStep` field
**Alternatives Considered:**
- Reuse generic PATCH state update for manual completion: Rejected because a dedicated authorized operation makes the recovery intent and audit boundary explicit
- Client-only authorization: Rejected because it cannot protect direct API calls

### Quote Detail Lifecycle Visibility and Roadmap
**Rationale:** Operators need the complete processing sub-status path and its current position directly on the quote detail page.
**Implementation:**
- Use the 16 ordered sub-statuses directly in the quote-detail roadmap: Address Validation & Enrichment, Customer Create, Contact Reaction, Customer Creation, Site Creation, Proposal Create, Add Sites, Assign Offers, Add Addon, Configure Offers, Add Add-Ons, Aggregate, Finalize, Internal Approval, Contract Generation, Contract Signed
- Derive the highlighted position from the quote's `subStep`; when a completed quote has no supplied sub-step, show Contract Signed as its final sub-status
- For `FAILED`, highlight the sub-step where processing stopped and mark preceding sub-statuses complete
- Show the current stage directly on every quote detail page, with refresh after status mutations and periodic refresh while processing is active
- Clicking or keyboard-activating the quote state opens a horizontally scrollable 16-step roadmap dialog with an explicit close control and backdrop dismissal; touch users activate it by tapping the state. Completed, current, failed, and future sub-statuses have distinct visual states
- On narrow screens, allow the roadmap to scroll horizontally within the dialog without clipping stage names; provide an accessible text equivalent and focus behavior
- Apply the supplied table conventions where the lifecycle view includes tabular data: no underline for ordinary links, `#464feb` link color, `#e6e6e6` table cell borders, and `#f5f5f5` header backgrounds
**Alternatives Considered:**
- A separate summary roadmap: Rejected because it omits the detailed sub-statuses operators need to locate the current processing point
- Hover-only roadmap: Rejected because opening the roadmap must be an intentional click/tap or keyboard action

### Open Questions
- Which Azure AD group is assigned the `QUOTE_UPDATE` app role in each environment? The API checks the validated JWT `roles` claim for `ROLE_QUOTE_UPDATE`; the identity-provider group-to-app-role assignment must be configured before production use. Local SSO bypass is intended only for development.