## ADDED Requirements

### Requirement: Quote List Display
The system SHALL display a tabular view of all quotes generated for the current day with essential quote information.

#### Scenario: Daily quote list view
- **WHEN** user accesses the quote management application
- **THEN** system displays a table with Quote ID, Quote Name/Reference, Creation Date & Time, and Quote Status columns

#### Scenario: Quote status visibility
- **WHEN** quote list is displayed
- **THEN** each quote shows one of the five quote states: Received, In Progress, Pending Approval, Completed, or Failed

### Requirement: Quote Detail Navigation
The system SHALL provide navigation from the quote list to individual quote detail views.

#### Scenario: View details button interaction
- **WHEN** user clicks "View Details" button for a quote
- **THEN** system navigates to the Quote Detail Screen for that specific quote

#### Scenario: Row-based navigation
- **WHEN** user clicks on any quote row in the table
- **THEN** system navigates to the Quote Detail Screen for that specific quote

### Requirement: Quote Detail Information Display
The system SHALL display comprehensive quote information including summary, customer details, products, pricing, and artifacts.

#### Scenario: Quote summary section display
- **WHEN** user views quote details
- **THEN** system displays Quote ID, Status, Creation timestamp, and Last updated timestamp

#### Scenario: Customer information display
- **WHEN** user views quote details
- **THEN** system displays Customer Name/Identifier and Customer Type while excluding any PII or address information

#### Scenario: Products and services section display
- **WHEN** user views quote details  
- **THEN** system displays all products with Product name, Product type (Base/Package/Add-on), and Configuration summary

#### Scenario: Pricing and promotions display
- **WHEN** user views quote details
- **THEN** system displays Base product price, Add-on pricing, Total estimated price, and applicable promotions with descriptions and discount values

### Requirement: Responsive User Interface
The system SHALL provide a responsive, intuitive user interface optimized for operational workflows.

#### Scenario: Mobile-responsive design
- **WHEN** application is accessed on different screen sizes
- **THEN** interface adapts appropriately maintaining usability and readability

#### Scenario: Loading state feedback
- **WHEN** data is being loaded or processed
- **THEN** system provides appropriate loading indicators to users

### Requirement: Quote Sub-Status Roadmap
The system SHALL show the current quote sub-status and an accessible roadmap of all 16 sub-statuses on the quote detail page.

#### Scenario: Current sub-status is visible
- **WHEN** a user views any quote detail page
- **THEN** the page displays the current processing sub-status from `quote.subStep`

#### Scenario: Click roadmap highlights current sub-status
- **WHEN** a user clicks or keyboard-activates the quote status
- **THEN** the system displays all 16 ordered processing sub-statuses, with Contract Signed last, and highlights completed, current, failed, and future sub-statuses distinctly

#### Scenario: Close roadmap dialog
- **WHEN** a user clicks the close control or dialog backdrop
- **THEN** the roadmap dialog closes

#### Scenario: Lifecycle roadmap is available on touch screens
- **WHEN** a user taps the quote status on a touch device
- **THEN** the same click-open roadmap is available on touch screens

#### Scenario: Contract Signed sub-status display
- **WHEN** a quote has state Completed and subStep Contract Signed
- **THEN** quote details and the final roadmap step display Contract Signed while status filters and summaries continue to use Completed

#### Scenario: Failed quote detail actions
- **WHEN** a user views a Failed quote detail page
- **THEN** Complete and Retry remain available to authorized users, and Create Ticket is not displayed

### Requirement: Failed Quote Recovery Actions
The system SHALL expose confirmed recovery actions only to users authorized to update quotes when a quote is Failed.

#### Scenario: Authorized user sees recovery actions
- **WHEN** an authorized user views a Failed quote
- **THEN** Complete and Retry buttons appear together in the quote detail actions area

#### Scenario: Recovery actions are hidden outside Failed status
- **WHEN** a quote is not Failed or the user lacks quote-update permission
- **THEN** neither Complete nor Retry is displayed

#### Scenario: Complete action confirmation
- **WHEN** an authorized user selects Complete for a Failed quote
- **THEN** the system asks "Do you wish to Complete this Quote?" with Yes and No actions and changes status only after Yes

#### Scenario: Retry action confirmation
- **WHEN** an authorized user selects Retry for a Failed quote
- **THEN** the system asks "Do you wish to Retry this Quote?" with Yes and No actions and restarts processing only after Yes