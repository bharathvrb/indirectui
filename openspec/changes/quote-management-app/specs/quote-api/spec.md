## ADDED Requirements

### Requirement: TMF 648 Quote List API Endpoint
The system SHALL provide TMF 648 compliant REST API endpoint to retrieve quote listings with filtering capabilities.

#### Scenario: Retrieve quotes with TMF 648 compliance
- **WHEN** GET /tmf-api/quote/v4/quote is called
- **THEN** system returns JSON array of quotes following TMF 648 Quote schema with id, href, state, quoteDate, and validFor fields

#### Scenario: TMF 648 quote state filtering
- **WHEN** GET /tmf-api/quote/v4/quote?state={state} is called
- **THEN** system returns quotes matching supported application states (received, inProgress, pendingApproval, completed, failed)

#### Scenario: TMF 648 query parameters support
- **WHEN** GET /tmf-api/quote/v4/quote is called with TMF 648 standard query parameters
- **THEN** system supports fields, offset, limit filtering and returns appropriate response headers

### Requirement: TMF 648 Quote Detail API Endpoint
The system SHALL provide TMF 648 compliant REST API endpoint to retrieve comprehensive quote details by ID.

#### Scenario: Retrieve quote details with TMF 648 schema
- **WHEN** GET /tmf-api/quote/v4/quote/{id} is called with valid quote ID
- **THEN** system returns complete quote details following TMF 648 schema including quoteItem, relatedParty, quoteTotalPrice, and attachment arrays

#### Scenario: TMF 648 compliant error handling
- **WHEN** GET /tmf-api/quote/v4/quote/{id} is called with non-existent quote ID
- **THEN** system returns TMF 648 Error structure with code, reason, message, status, and referenceError fields

### Requirement: TMF 648 Quote Creation API Endpoint
The system SHALL provide TMF 648 compliant REST API endpoint for quote creation operations.

#### Scenario: Create quote with TMF 648 structure
- **WHEN** POST /tmf-api/quote/v4/quote is called with valid TMF 648 Quote payload
- **THEN** system creates quote, assigns id and href, returns HTTP 201 with complete quote representation

#### Scenario: TMF 648 validation on quote creation
- **WHEN** POST /tmf-api/quote/v4/quote is called with invalid TMF 648 structure
- **THEN** system returns HTTP 400 with TMF 648 Error format detailing schema validation failures

### Requirement: Quote Processing Retry API Extension
The system SHALL provide custom API extension for retry processing while maintaining TMF 648 compliance.

#### Scenario: Quote retry operation
- **WHEN** POST /tmf-api/quote/v4/quote/{id}/retry is called for quote with failed state
- **THEN** system initiates retry processing, updates state to inProgress, and returns HTTP 202 with updated TMF 648 quote representation

#### Scenario: Invalid retry state handling
- **WHEN** POST /tmf-api/quote/v4/quote/{id}/retry is called for quote with accepted state
- **THEN** system returns HTTP 400 with TMF 648 Error indicating retry not available for current state

### Requirement: TMF 648 Attachment Management API
The system SHALL provide TMF 648 compliant endpoints for quote attachment operations.

#### Scenario: TMF 648 attachment upload
- **WHEN** POST /tmf-api/quote/v4/quote/{id}/attachment is called with file
- **THEN** system creates TMF 648 AttachmentRefOrValue, stores file, and returns HTTP 201 with attachment metadata

#### Scenario: TMF 648 attachment retrieval
- **WHEN** GET /tmf-api/quote/v4/quote/{id}/attachment/{attachmentId} is called
- **THEN** system returns file content with proper Content-Type and TMF 648 attachment reference

### Requirement: TMF 648 Event Notification Support
The system SHALL implement TMF 648 event notification patterns for quote lifecycle events.

#### Scenario: Quote state change notification structure
- **WHEN** quote state changes occur
- **THEN** system generates TMF 648 QuoteStateChangeEvent with eventId, eventTime, eventType, and event payload

#### Scenario: Event notification endpoint registration
- **WHEN** external systems register for quote events
- **THEN** system supports TMF 648 EventSubscription with callback, query, and eventType specifications

### Requirement: TMF 648 Compliance Validation and Headers
The system SHALL ensure full TMF 648 compliance with proper HTTP headers and response formats.

#### Scenario: TMF 648 response headers
- **WHEN** API responses are returned
- **THEN** system includes X-Total-Count, X-Result-Count headers for list operations and proper Content-Type for TMF 648

#### Scenario: TMF 648 hypermedia links
- **WHEN** TMF 648 entities are returned
- **THEN** system includes proper href fields and related entity links following TMF 648 hypermedia patterns

#### Scenario: TMF 648 versioning compliance
- **WHEN** API versioning is implemented
- **THEN** system follows TMF 648 versioning guidelines with version in URL path and backward compatibility support

### Requirement: Contract Signed Quote Sub-Status
The system SHALL expose Contract Signed through the existing quote `subStep` field without adding a quote state.

#### Scenario: Retrieve a quote at Contract Signed sub-status
- **WHEN** a completed quote has `subStep` equal to `Contract Signed`
- **THEN** list and detail APIs return state `completed` and subStep `Contract Signed`

#### Scenario: Quote state statistics remain unchanged
- **WHEN** a client requests quote status statistics
- **THEN** Contract Signed is counted under `completed` and no `contractSigned` state or statistic is returned

#### Scenario: Backward compatibility for existing states
- **WHEN** a client uses any existing supported quote state
- **THEN** filtering, serialization, and existing endpoints continue to work unchanged

### Requirement: Authorized Quote Recovery APIs
The system SHALL provide authorized and audited completion and retry operations for Failed quotes.

#### Scenario: Complete a failed quote
- **WHEN** an authenticated user with quote-update permission calls `POST /tmf-api/quote/v4/quote/{id}/complete` for a Failed quote
- **THEN** the API changes its state to `COMPLETED`, returns the updated quote, and records the actor, timestamp, previous state, and updated state

#### Scenario: Retry a failed quote
- **WHEN** an authenticated user with quote-update permission confirms retry of a Failed quote
- **THEN** the retry API changes its state to `IN_PROGRESS`, restarts existing processing rules, returns the updated quote, and records the actor, timestamp, previous state, and updated state

#### Scenario: Reject unauthorized or invalid recovery
- **WHEN** a caller lacks quote-update permission or the quote is not Failed
- **THEN** the API rejects the operation without changing the quote or creating a successful-transition audit record