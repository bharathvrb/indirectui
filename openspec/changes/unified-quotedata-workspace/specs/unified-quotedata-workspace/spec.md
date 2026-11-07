## ADDED Requirements

### Requirement: Common SSO entry and return navigation
The UI SHALL show login before protected data, give authenticated users a common menu without role distinctions, and preserve the intended internal route through login or session expiry. Configuration or authentication errors MUST NOT grant access.

#### Scenario: Open a quote case link
- **WHEN** an unauthenticated user opens a quote link
- **THEN** login appears and successful SSO returns to that quote with its query state intact.

#### Scenario: SSO cannot initialize
- **WHEN** SSO configuration is absent or initialization fails
- **THEN** an actionable login error/setup state appears without protected API requests.

### Requirement: Consistent accessible themes
The UI SHALL use a single responsive light/dark/system theme design with blue branding, neutral surfaces and distinct labeled status colors. Theme choice SHALL persist without storing quote payloads. Keyboard focus, reduced motion and small-screen navigation SHALL be supported.

#### Scenario: Switch theme
- **WHEN** the user changes theme on login or any workspace page
- **THEN** controls, tables, dialogs, text and status indicators remain readable and the preference survives reload.

### Requirement: Quote and ticket search
UI-01 and UI-02 SHALL share a results table containing all ten specified columns. Searches SHALL use server paging, default to 25 rows ordered by creation descending, trim ticket input, debounce general search by 300 ms, preserve query state and ignore obsolete responses. Invalid date ranges SHALL show an explanation without requesting invalid data.

#### Scenario: Rapid search and navigation
- **WHEN** filters change rapidly or the browser navigates Back
- **THEN** results match the latest URL/filter state and one request is made per committed change.

#### Scenario: Ticket result paging
- **WHEN** a ticket query returns multiple pages
- **THEN** the user can navigate all pages without changing the ticket filter.

### Requirement: Complete quote context
UI-03 through UI-10 SHALL display the specified header/IDs, customer/address/contacts, sites, nested products with characteristics/prices/terms, promotions, steps/monitoring, errors, events and payload. Null values SHALL be an em dash; empty sections SHALL identify their table. Site scope SHALL consistently filter products, processing and errors. Referenced items/sites/contacts SHALL be navigable by keyboard.

#### Scenario: Documented nested detail response
- **WHEN** QuoteData returns items nested in sites and errors linked by execution ID
- **THEN** products and failure context remain visible without requiring invented top-level arrays.

#### Scenario: Invalid or large payload
- **WHEN** payload JSON is invalid or exceeds 1 MB
- **THEN** raw text is safely rendered with a warning or collapsed preview respectively, with copy and text search and no HTML execution or local-storage persistence.

### Requirement: Recovery and exports
UI-11 retry controls SHALL be disabled with a Coming soon explanation and no retry requests. UI-12 completion SHALL require a trimmed 1-to-1000-character note, display quote/ticket context, prevent duplicate submissions and handle 403/409 distinctly. UI-16 SHALL display contract IDs and explicitly describe unavailable downloads. UI-17 SHALL export every displayed customer/address/contact field as safe CSV.

#### Scenario: Completion conflict
- **WHEN** completion returns 409
- **THEN** the user sees the specified conflict explanation and refreshed quote state.

#### Scenario: No contract download capability
- **WHEN** contract IDs exist but no download endpoint is configured
- **THEN** IDs remain visible/copyable and the UI does not call an assumed endpoint.

### Requirement: Honest runtime and error states
The local frontend SHALL serve its browser dependencies successfully. UI-13 through UI-15 SHALL distinguish loading, empty, access-denied, not-found, archived and API-failure states without exposing stale quote data; errors SHALL expose available tracking IDs. Remote integration prerequisites SHALL be documented.

#### Scenario: API failure
- **WHEN** a list/detail request fails
- **THEN** a recoverable error with available tracking ID appears, not a simultaneous successful-empty state.

#### Scenario: Fresh local build
- **WHEN** the documented build and start commands are used after dependency restoration
- **THEN** AngularJS, Bootstrap and application assets load from the served frontend.
