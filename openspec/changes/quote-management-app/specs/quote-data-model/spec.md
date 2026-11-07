## ADDED Requirements

### Requirement: TMF 648 Compliant Quote Entity Data Model
The system SHALL implement quote entities following TMF 648 Quote Management API specifications with all required attributes and relationships.

#### Scenario: Core TMF 648 quote structure
- **WHEN** quote entity is created
- **THEN** system includes id, href, description, externalId, quoteDate, validFor (TimePeriod), state, and version fields per TMF 648 schema

#### Scenario: TMF 648 quote state enumeration
- **WHEN** quote state is set
- **THEN** system validates state is one of the five supported application values: received, inProgress, pendingApproval, completed, failed

#### Scenario: Quote lifecycle timestamps
- **WHEN** quote progresses through lifecycle
- **THEN** system maintains requestedQuoteCompletionDate, expectedQuoteCompletionDate, and effectiveQuoteCompletionDate per TMF 648

### Requirement: TMF 648 Party and Related Party Model
The system SHALL implement party information structure following TMF 648 party management specifications while excluding PII.

#### Scenario: Related party structure
- **WHEN** customer information is stored
- **THEN** system includes @type, id, href, name, and role fields following TMF 648 RelatedParty schema

#### Scenario: PII exclusion with TMF compliance
- **WHEN** party data is processed
- **THEN** system includes only business identifiers and party references, excluding individual customer characteristics and contact information

### Requirement: TMF 648 Quote Item and Product Offering Model
The system SHALL implement quote items and product offerings following TMF 648 product catalog specifications.

#### Scenario: Quote item structure
- **WHEN** quote item is defined
- **THEN** system includes id, quantity, action (add/modify/delete), state, productOffering reference, and product specification per TMF 648

#### Scenario: Product offering reference
- **WHEN** product offering is referenced
- **THEN** system includes @type, id, href, name, and category following TMF 648 ProductOffering schema

#### Scenario: Product specification characteristics
- **WHEN** product configuration is stored
- **THEN** system uses TMF 648 ProductSpecificationCharacteristic structure with name, value, and valueType fields

### Requirement: TMF 648 Price and Quote Price Model
The system SHALL implement pricing structures following TMF 648 pricing specifications with promotional handling.

#### Scenario: Quote price structure
- **WHEN** pricing information is created
- **THEN** system includes price (Money), priceType, recurringChargePeriod, and unitOfMeasure per TMF 648 QuotePrice schema

#### Scenario: Price alteration for promotions
- **WHEN** promotions are applied
- **THEN** system uses TMF 648 PriceAlteration structure with priceType, applicationDuration, and priority fields

#### Scenario: Money data type compliance
- **WHEN** monetary values are stored
- **THEN** system uses TMF 648 Money structure with unit (currency) and value fields

### Requirement: TMF 648 Attachment and Note Model
The system SHALL implement file attachments using TMF 648 attachment specifications.

#### Scenario: TMF 648 attachment structure
- **WHEN** file is uploaded
- **THEN** system creates AttachmentRefOrValue entity with @type, id, href, attachmentType, content, description, mimeType, name, and url fields

#### Scenario: Quote notes and annotations
- **WHEN** notes are added to quotes
- **THEN** system uses TMF 648 Note structure with author, date, system, and text fields

### Requirement: TMF 648 Extension Points for Custom Fields
The system SHALL implement TMF 648 extension mechanisms for Sales Platform specific requirements.

#### Scenario: Custom quote attributes
- **WHEN** Sales Platform specific data is required
- **THEN** system uses TMF 648 @schemaLocation and @type extension points for additional fields

#### Scenario: Support ticket integration extension
- **WHEN** support tickets are associated with quotes
- **THEN** system extends TMF 648 Quote with supportTicket reference using proper extension patterns

#### Scenario: Retry mechanism extension
- **WHEN** quote retry functionality is implemented
- **THEN** system extends TMF 648 with retryHistory and retryConfiguration fields using extension mechanisms

### Requirement: Quote Sub-Status and Status Audit
The system SHALL represent Contract Signed as the final value in the quote sub-status lifecycle and persist an audit record for successful recovery transitions.

#### Scenario: Validate quote lifecycle states
- **WHEN** a quote state is created, updated, serialized, or filtered
- **THEN** the system supports only `RECEIVED`, `IN_PROGRESS`, `PENDING_APPROVAL`, `COMPLETED`, and `FAILED` as quote states and represents Contract Signed through `subStep`

#### Scenario: Complete quote sub-status
- **WHEN** a Failed quote is completed successfully
- **THEN** its quote state is `COMPLETED` and its `subStep` is `Contract Signed`

#### Scenario: Record recovery transition audit
- **WHEN** an authorized Complete or Retry transition succeeds
- **THEN** an append-only audit record stores quote ID, authenticated user ID, timestamp, previous status, and updated status

#### Scenario: Preserve audit and quote consistency
- **WHEN** a recovery transition fails
- **THEN** neither a status change nor a successful-transition audit record is committed