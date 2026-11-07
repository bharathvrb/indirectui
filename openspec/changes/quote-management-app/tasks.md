## 1. Project Setup and Infrastructure

- [x] 1.1 Create Spring Boot backend project with Gradle structure
- [x] 1.2 Configure Spring Boot dependencies (Web, JPA, H2, File Upload, Validation)
- [x] 1.3 Create AngularJS frontend project structure with build tools
- [x] 1.4 Set up development environment configuration files
- [x] 1.5 Configure CORS settings for local development
- [x] 1.6 Set up H2 in-memory database configuration
- [x] 1.7 Create file storage directory structure

## 2. TMF 648 Data Model and Entity Implementation

- [x] 2.1 Implement TMF 648 compliant Quote entity with proper schema validation
- [x] 2.2 Create TMF 648 QuoteItem entity with product offering references
- [x] 2.3 Implement TMF 648 RelatedParty entity with PII exclusion validation
- [x] 2.4 Create TMF 648 QuotePrice and PriceAlteration entities
- [x] 2.5 Implement TMF 648 AttachmentRefOrValue entity for file management
- [x] 2.6 Create TMF 648 Note entity for quote annotations
- [x] 2.7 Define TMF 648 compliant entity relationships and validation rules
- [x] 2.8 Implement TMF 648 extension mechanisms for Sales Platform customizations
- [x] 2.9 Implement TMF 629 Customer entity with TMF 632 ContactMedium sub-entity
- [x] 2.10 Add `rawPayload` TEXT column to Quote entity for storing full TMF 648 JSON document
- [x] 2.11 Restrict the original `QuoteState` enum to the five operational values: `RECEIVED`, `IN_PROGRESS`, `PENDING_APPROVAL`, `COMPLETED`, `FAILED`
- [x] 2.12 Add `subStep` varchar(100) column to Quote entity with `@JsonProperty("subStep")` and getter/setter

## 3. TMF 648 Compliant Mock Data Layer Implementation

- [x] 3.1 Create TMF 648 compliant mock data generator service
- [x] 3.2 Generate diverse RelatedParty mock data following TMF 648 party schemas
- [x] 3.3 Generate realistic quote data with proper TMF 648 state distribution
- [x] 3.4 Create varied ProductOffering and QuoteItem combinations per TMF 648
- [x] 3.5 Generate TMF 648 compliant pricing data with PriceAlteration scenarios
- [x] 3.6 Create sample TMF 648 AttachmentRefOrValue references for files
- [x] 3.7 Implement temporal data distribution with TMF 648 date/time formats
- [x] 3.8 Add TMF 648 schema validation for all generated mock data
- [x] 3.9 Generate TMF 629 compliant Customer mock data with ContactMedium entries
- [x] 3.10 Generate Sales Support Ticket mock data linked to failed quotes
- [x] 3.11 Create individual TMF 648 JSON files (`mock-data/<id>-quote.json`) for all 15 seeded quotes with full relatedParty, contactMedium, quoteItem hierarchy, and promotions
- [x] 3.12 Implement `loadRawPayload(filename)` helper in `MockDataService` and attach rawPayload to every seeded quote at startup
- [x] 3.13 Rename all seeded quote external IDs from `QT-*` to `PARTNER-QUOTE-*` format in `MockDataService`
- [x] 3.14 Update all 15 `mock-data/*.json` files: set `externalId` to `PARTNER-QUOTE-*`, `customerType` to `Midmarket`, `customerSubType` to `Majors`
- [x] 3.15 Assign `subStep` values to all seeded quotes in `MockDataService` per state-appropriate lifecycle position (`COMPLETED` → `Contract Signed`; all others → contextual step)
- [x] 3.16 Ensure `PARTNER-QUOTE-67890` (multi-site Dominos) is seeded last in `generateMockData()` so it appears first in `createdAt DESC` sort

## 4. TMF 648 Compliant Backend REST API Implementation

- [x] 4.1 Create TMF 648 compliant QuoteController with proper endpoint structure
- [x] 4.2 Implement GET /tmf-api/quote/v4/quote endpoint with TMF 648 response format
- [x] 4.3 Implement GET /tmf-api/quote/v4/quote/{id} with complete TMF 648 schema
- [x] 4.4 Create POST /tmf-api/quote/v4/quote endpoint for quote creation
- [x] 4.5 Implement TMF 648 query parameter support (page, size, sortBy, sortDir, state)
- [x] 4.6 Add TMF 648 state-based filtering functionality
- [x] 4.7 Implement quote processing retry endpoint as TMF 648 extension
- [x] 4.8 Create TMF 648 attachment management endpoints
- [x] 4.9 Add TMF 648 compliant error handling with Error schema (GlobalExceptionHandler)
- [ ] 4.10 Implement TMF 648 hypermedia links and proper HTTP headers
- [ ] 4.11 Add TMF 648 event notification support for quote lifecycle
- [x] 4.12 Implement TMF 629 CustomerController at /tmf-api/customerManagement/v4
- [x] 4.13 Add GET /tmf-api/quote/v4/quote/stats endpoint for quote counts by state

## 5. File Management System

- [x] 5.1 Implement file upload service with PDF/JSON/CSV/Excel/image MIME type validation
- [x] 5.2 Create secure file storage with UUID-prefixed filename generation
- [x] 5.3 Implement file size (10 MB) and MIME type content validation
- [x] 5.4 Add file retrieval service with proper Content-Type headers
- [x] 5.5 Create file deletion functionality
- [x] 5.6 Implement file-quote association management
- [x] 5.7 Add file metadata tracking (SHA-256 checksum, size, mimeType, originalFilename)

## 6. Quote Processing and Retry Logic

- [x] 6.1 Create quote status management service
- [x] 6.2 Implement retry logic for failed quotes only
- [x] 6.3 Add retry attempt tracking and audit trail (version increment on retry)
- [x] 6.4 Implement retry limitations (only FAILED state eligible; MAX_RETRY_ATTEMPTS = 3)
- [x] 6.5 Create retry validation based on quote status
- [x] 6.6 Add retry outcome logging and reporting

## 7. Sales Support Tickets Implementation

- [x] 7.1 Create SupportTicket entity with JPA annotations and relationships
- [x] 7.2 Implement support ticket repository with status and priority queries
- [x] 7.3 Create SupportTicketController with CRUD operations
- [x] 7.4 Implement automatic ticket creation for failed quotes (createTicketForFailedQuote)
- [x] 7.5 Add manual ticket creation from quote detail views
- [x] 7.6 Create ticket status management and lifecycle validation
- [x] 7.7 Implement ticket priority and assignment functionality
- [x] 7.8 Add support ticket listing with status and priority filtering
- [x] 7.9 Create ticket detail view with quote context integration
- [x] 7.10 Implement POST /api/support-tickets/{id}/retry to record retry attempt from ticket

## 8. Frontend AngularJS Application

- [x] 8.1 Set up AngularJS application structure and routing
- [x] 8.2 Create quote list controller and view template
- [x] 8.3 Implement quote detail controller and comprehensive view
- [x] 8.4 Create quote service for API communication (QuoteService, FileService, SupportTicketService)
- [x] 8.5 Implement file upload component with progress indicators
- [x] 8.6 Add quote retry functionality with user feedback
- [x] 8.7 Create support tickets controller and listing view
- [x] 8.8 Implement support ticket detail view with quote integration
- [x] 8.9 Create responsive UI components and styling (Bootstrap 5)
- [x] 8.10 Implement loading states and error handling
- [x] 8.11 Add navigation and routing between screens
- [x] 8.12 Implement stats display on quote list and support tickets screens
- [x] 8.13 Implement 4-tab quote detail view (Customer, Site, Service Products, Promotions) driven by client-side `parseTmfPayload()` parsing of the `rawPayload` JSON field
- [x] 8.14 Add fallback `parseCustomerFromQuote()` for quotes using the `quote.customer` JPA entity when rawPayload is absent
- [x] 8.15 Add dark/light theme toggle to navbar with `localStorage` persistence and flash-free inline script in `index.html`
- [x] 8.16 Implement CSS custom properties for dark/light themes covering Bootstrap 5 component overrides (cards, tables, navbar, nav-tabs, form controls, badges)
- [x] 8.17 Rename application from "OMW Quote Management" to "CB Integration Quote Management" across `index.html`, `app.js`, and all user-visible strings
- [x] 8.18 Update `stateLabels` in `quote-list.controller.js` and `quote-detail.controller.js` for the existing operational states
- [x] 8.19 Update `quote-list.html` stat cards and total count calculation for the existing five operational states
- [x] 8.20 Add `Sub-Step` column to quote list table next to `State` column displaying `q.subStep` as a grey secondary badge or `—`
- [x] 8.21 Implement `openSubStepModal(quote, $event)` in `quote-list.controller.js` — builds mixed `subStepStatuses[]` array (group headers + step items) from `ALL_SUB_STEP_GROUPS`; each step item carries `groupColor`, `stepNum`, `isLast`; compute `$scope.completedCount` (step items only) and `$scope.totalStepCount = 15` for progress bar
- [x] 8.22 Add Bootstrap 5 sub-step progress offcanvas (`#subStepOffcanvas`, `offcanvas-end`) to `quote-list.html` with: header (externalId code badge, state badge, subStep badge), progress summary bar (`X / 15 steps`), and scrollable body with grouped vertical track — group header pills (`.substep-group-header.substep-group-{color}`) followed by step rows (`.substep-group-step-{color}`) with circular icon nodes, connector lines, and colour-coded status labels
- [x] 8.23 Add `.substep-track`, `.substep-item`, `.substep-icon`, `.substep-connector`, `.substep-label`, `.substep-group-header`, `.substep-group-label` CSS classes; per-group colour overrides for `ods` (blue), `dynamics` (purple), `amdocs` (orange), `sqo` (teal) covering completed/active icon, connector, and dark-mode variants in `app.css`
- [x] 8.24 Replace `bootstrap.Modal` with `bootstrap.Offcanvas` in `quote-list.controller.js`; configure `{ keyboard: true, scroll: true }` so quote list remains scrollable behind the open panel; rename `_subStepModalInstance` → `_offcanvasInstance`
- [x] 8.25 Replace `Description` column with `Customer Name` (`q.customer.name`) in `quote-list.html`
- [x] 8.26 Add 8 new Customer entities to `MockDataService.generateCustomers()` (CUST-0103, CUST-0071, CUST-0034, CUST-0012, CUST-0092, CUST-0067, CUST-0001, CUST-0018) and call `setCustomer()` on all quotes that previously lacked a customer FK

## 8a. SSO Authentication — Azure AD / MSAL.js

- [x] 8a.1 Add `spring-boot-starter-security` and `spring-boot-starter-oauth2-resource-server` to `build.gradle`
- [x] 8a.2 Create `SecurityConfig.java`: conditional SSO — reads `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` env vars; if real values present builds `JwtDecoder` programmatically via `JwtDecoders.fromIssuerLocation()`; if placeholders remain falls through to `permitAll()` dev bypass mode; stateless sessions; CSRF disabled; CORS delegated to existing `CorsConfigurationSource` bean
- [x] 8a.3 Add Azure AD SSO comment block to `application.yml` documenting required env vars; intentionally omit `spring.security.oauth2.resourceserver.jwt.issuer-uri` to prevent JWKS fetch crash at startup with placeholder values
- [x] 8a.4 Add MSAL.js 3.28.1 CDN `<script>` to `index.html` before AngularJS; remove `ng-app` attribute from `<html>` (Angular bootstrapped manually after MSAL auth)
- [x] 8a.5 Add MSAL bootstrap block to `index.html`: detects unconfigured placeholders → sets `window.__ssoBypass = true` and boots Angular directly; configured mode → `msalInstance.initialize()` → `handleRedirectPromise()` → set active account → `angular.bootstrap()`; SSO errors fall through to bypass mode with console warning (no blank-screen crash)
- [x] 8a.6 Add user info + Sign Out to navbar in `index.html`: `<span ng-bind="currentUser.name">` (no raw `{{}}` interpolation); `ng-if="currentUser"` hides bar when not set; Sign Out button calls `$rootScope.logout()`
- [x] 8a.7 Create `auth.service.js`: AngularJS factory wrapping `window.__msalInstance`; implements `getUser()`, `isAuthenticated()`, `acquireToken()` (silent → redirect fallback), `logout()`
- [x] 8a.8 Add `auth.service.js` `<script>` tag to `index.html` after `services.js`
- [x] 8a.9 Update `app.js`: inject `$httpProvider` in `.config()`; register `AuthInterceptor` factory that attaches `Authorization: Bearer <token>` to API-bound requests only; update `.run()` to set `$rootScope.currentUser` from `AuthService.getUser()` (real name from Azure AD token) or bypass mode fallback (hardcoded name); wire `$rootScope.logout()`
- [x] 8a.10 Hardcode `ManojKumar Ramakrishnan` / `ManojKumar_Ramakrishnan2@comcast.com` as bypass-mode user display (replaced automatically by real Azure AD profile once SSO is activated)
- [ ] 8a.11 Complete Azure AD app registration in Comcast portal: create app `CB Integration Quote Management`; set redirect URI `http://localhost:8080/`; expose `api://<clientId>/access_as_user` scope; grant admin consent
- [ ] 8a.12 Replace placeholder values in `index.html` `AUTH_CONFIG` block with real `clientId` and `tenantId` from app registration
- [ ] 8a.13 Set `AZURE_TENANT_ID` and `AZURE_CLIENT_ID` environment variables before backend startup to activate JWT enforcement

## 9. Testing and Quality Assurance

- [ ] 9.1 Write unit tests for Spring Boot services and controllers
- [ ] 9.2 Create integration tests for REST API endpoints
- [ ] 9.3 Implement AngularJS unit tests for controllers and services
- [ ] 9.4 Add end-to-end tests for critical user workflows
- [ ] 9.5 Test file upload and download functionality
- [ ] 9.6 Validate quote retry operations and status transitions
- [ ] 9.7 Test responsive design across different devices
- [ ] 9.8 Perform security testing for file handling and API endpoints

## 10. Documentation and Deployment

- [ ] 10.1 Create API documentation with endpoint descriptions
- [ ] 10.2 Write user manual for quote management operations
- [ ] 10.3 Document deployment and configuration procedures
- [ ] 10.4 Create development environment setup guide
- [ ] 10.5 Prepare production deployment configuration
- [ ] 10.6 Set up application logging and monitoring
- [ ] 10.7 Create database migration scripts for future phases
- [ ] 10.8 Document Phase 2 integration requirements and API contracts

## 11. Quote Lifecycle Visibility and Operational Recovery

- [x] 11.1 Add Contract Signed as the final `subStep` value; preserve the existing five quote states
- [x] 11.2 Keep Complete and Retry state transitions Failed-to-Completed and Failed-to-In Progress; set completed `subStep` to Contract Signed and retry `subStep` to Address Validation & Enrichment
- [x] 11.3 Persist append-only quote status audit records with a JPA entity and repository; the H2 development schema is generated by Hibernate
- [x] 11.4 Enforce `ROLE_QUOTE_UPDATE` on recovery APIs and hide actions from unauthorized SSO users; local SSO bypass enables actions only for development
- [x] 11.5 Record authenticated user ID, timestamp, previous status, and updated status transactionally for Complete and Retry
- [x] 11.6 Add an authorized Complete API operation for Failed quotes and return the updated quote representation
- [x] 11.7 Update Retry to process only Failed quotes, reset processing to its first sub-status, and return the updated In Progress quote with version incremented
- [x] 11.8 Add Failed-only Complete and Retry buttons to quote details with Yes/No confirmation; No leaves quote and audit data unchanged
- [x] 11.9 Display the current processing sub-step on quote details and refresh while processing is active
- [x] 11.10 Add the responsive 16-sub-status roadmap to click/keyboard/tap quote-state activation with explicit close and completed, current, failed, and future-stage styling
- [x] 11.11 Keep quote filters and statistics limited to the five quote states; expose Contract Signed as `subStep`
- [x] 11.12 Add backend tests for state transitions, audit attributes, and authorization
- [ ] 11.13 Verify confirmation behavior and the lifecycle roadmap in a browser across desktop and mobile viewports
- [x] 11.14 Update proposal, design, API, operational, and implementation task documentation for the new status, recovery operations, authorization, and audit records
- [ ] 11.15 Confirm the authorization claim/group mapping with the identity-provider owner before enabling recovery outside development

## 12. Local Runtime Verification

- [x] 12.1 Start the Spring Boot backend with Java 17 on port 8080
- [x] 12.2 Start the AngularJS static frontend on port 8081 to avoid the backend port collision
- [x] 12.3 Verify `GET /actuator/health` returns HTTP 200 with H2 status `UP`
- [x] 12.4 Verify the paginated quote endpoint returns HTTP 200 with seeded quote data
- [x] 12.5 Verify the frontend application shell is served successfully from `http://localhost:8081/`