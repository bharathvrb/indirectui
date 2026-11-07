# Architecture Brief — Quote Status Management Service

**Version:** 1.0  
**Date:** July 2026  
**Team:** Orion / Comcast Sales Engineering  
**Standard:** TM Forum TMF 648 (Quote Management), TMF 629 (Customer Management)

---

## 1. System Overview

The Quote Status Management Service is a stateless REST backend for managing telecommunications sales quotes through their complete lifecycle. It is built to the **TM Forum Open API** standards (TMF 648 and TMF 629) and serves as the data and business logic layer behind the Quote Management web UI.

The service is designed to be:
- **Standards-aligned** — TMF 648 / TMF 629 API shapes and lifecycle states
- **Stateless** — no HTTP session; authentication via Azure AD JWT bearer tokens
- **Environment-portable** — H2 in-memory for dev/test; pluggable JDBC datasource for production
- **Observable** — Spring Boot Actuator health, metrics, and info endpoints

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Layer                                 │
│   AngularJS SPA (port 8080/static)   │   External API Consumers     │
└───────────────────────┬─────────────────────────────────────────────┘
                        │  HTTP / REST (JSON)
                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Spring Boot Application (port 8080)                │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   Spring Security Filter Chain                │   │
│  │  Azure AD JWT Validation (when AZURE_TENANT_ID is set)       │   │
│  │  Open/Permit-All mode (dev, no env vars)                     │   │
│  └───────────────────────────┬──────────────────────────────────┘   │
│                               │                                      │
│  ┌────────────────────────────▼─────────────────────────────────┐   │
│  │                      Controller Layer                         │   │
│  │                                                               │   │
│  │  QuoteController          /tmf-api/quote/v4/**               │   │
│  │  CustomerController       /tmf-api/customerManagement/v4/**  │   │
│  │  SupportTicketController  /api/support-tickets/**            │   │
│  │  FileController           /api/files/**                      │   │
│  │  GlobalExceptionHandler   (unified error responses)          │   │
│  └────────────────────────────┬─────────────────────────────────┘   │
│                               │                                      │
│  ┌────────────────────────────▼─────────────────────────────────┐   │
│  │                       Service Layer                           │   │
│  │                                                               │   │
│  │  QuoteService             Business logic, state transitions   │   │
│  │  CustomerService          Customer CRUD, search               │   │
│  │  SupportTicketService     Ticket lifecycle                    │   │
│  │  FileStorageService       Multipart upload / download         │   │
│  │  MockDataService          Dev seed data (ApplicationReady)    │   │
│  └────────────────────────────┬─────────────────────────────────┘   │
│                               │                                      │
│  ┌────────────────────────────▼─────────────────────────────────┐   │
│  │                    Repository Layer (JPA)                     │   │
│  │                                                               │   │
│  │  QuoteRepository           AttachmentRepository              │   │
│  │  CustomerRepository        NoteRepository                    │   │
│  │  SupportTicketRepository                                     │   │
│  └────────────────────────────┬─────────────────────────────────┘   │
│                               │                                      │
│  ┌────────────────────────────▼─────────────────────────────────┐   │
│  │                       Persistence                             │   │
│  │   Dev:  H2 in-memory (jdbc:h2:mem:quotedb)                   │   │
│  │   Prod: External JDBC datasource (env-configured)            │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                        │
         ┌──────────────┘
         ▼
┌─────────────────────┐
│   Azure Active       │
│   Directory (SSO)    │
│   JWKS endpoint      │
└─────────────────────┘
```

---

## 3. Layer Responsibilities

### 3.1 Controller Layer

Each controller maps to a TMF API domain or internal capability:

| Controller | Base Path | Responsibility |
|------------|-----------|----------------|
| `QuoteController` | `/tmf-api/quote/v4` | TMF 648 CRUD — create, read, update, delete, paginate, filter quotes |
| `CustomerController` | `/tmf-api/customerManagement/v4` | TMF 629 CRUD — customer accounts, search by name / status / external ID |
| `SupportTicketController` | `/api/support-tickets` | Sales support tickets for failed / rejected quote transactions |
| `FileController` | `/api/files` | Multipart file upload and download linked to quote attachments |
| `GlobalExceptionHandler` | — | `@ControllerAdvice` — maps domain exceptions to standardised HTTP error responses |

### 3.2 Service Layer

| Service | Key Responsibilities |
|---------|----------------------|
| `QuoteService` | Quote lifecycle transitions, pagination/sorting, state validation, cascade to support tickets on failure |
| `CustomerService` | Customer CRUD, `externalId` lookups, segment/credit-tier management |
| `SupportTicketService` | Ticket creation (manual and auto), priority routing, status transitions |
| `FileStorageService` | Validates file type and size, persists to `./uploads/`, creates `AttachmentRefOrValue` records |
| `MockDataService` | Fires on `ApplicationReadyEvent`; loads JSON fixtures from `classpath:/mock-data/` into JPA repositories |

### 3.3 Data / Entity Model

Core JPA entities and their TMF alignment:

```
Quote (TMF 648)
 ├── externalId, href, quoteDate, validUntil
 ├── state: QuoteState  (inProgress | sendToCustomer | accepted | rejected | cancelled | approved)
 ├── totalPrice: BigDecimal
 ├── List<QuoteItem>
 │    └── QuoteItemPrice  (priceType, price, recurringChargePeriod)
 ├── List<RelatedParty>   (role: seller | buyer | salesAgent | technicalContact)
 ├── List<Note>           (category, priority, status)
 └── List<AttachmentRefOrValue>

Customer (TMF 629)
 ├── externalId, href, name, tradingName
 ├── status: CustomerStatus
 ├── segment, creditTier, languagePreference
 ├── List<ContactMedium>  (email, phone, address)
 └── List<RelatedParty>

SupportTicket
 ├── ticketId, title, description
 ├── status: TicketStatus   (open | inProgress | resolved | closed)
 ├── priority: TicketPriority (critical | high | medium | low)
 ├── category: TicketCategory
 └── relatedQuoteId (FK reference to Quote)

AttachmentRefOrValue
 ├── name, mimeType, size
 ├── attachmentType: AttachmentType
 ├── storagePath (local filesystem path)
 └── quote (FK to Quote)
```

---

## 4. Security Architecture

### Authentication Model

The service uses a **dual-mode security model** governed by `SecurityConfig.java`:

```
AZURE_TENANT_ID + AZURE_CLIENT_ID set?
        │
   YES  │  NO
        │
        ▼          ▼
  SSO Active    Open Dev Mode
  JWT required  All requests
  on /tmf-api   permitted
```

**SSO Active (Production):**
- All `/tmf-api/**` endpoints require a valid Azure AD Bearer token
- JWT decoder is built at startup from the OIDC discovery document at  
  `https://login.microsoftonline.com/{tenantId}/v2.0`
- Session policy: **STATELESS** (no cookies)
- CSRF disabled (JWT-only API)

**Open Dev Mode:**
- No credentials required; useful for local UI development without an AD tenant
- H2 console, Actuator health, and static assets always permitted in both modes

### CORS

Origins permitted in dev: `http://localhost:8080`, `http://localhost:3000`  
Production: configured via `app.cors.allowed-origins` in `application-prod.yml`

---

## 5. Data Flow — Quote Lifecycle

```
POST /tmf-api/quote/v4/quote
         │
         ▼
   QuoteController.createQuote()
         │
         ▼
   QuoteService.createQuote()
         │  sets state = inProgress
         │  timestamps quoteDate
         ▼
   QuoteRepository.save()
         │
         ▼
   Quote persisted (H2 / DB)


PATCH /tmf-api/quote/v4/quote/{id}  (state transition)
         │
         ▼
   QuoteService.updateQuote()
         │
         ├── state → rejected/cancelled?
         │        └── SupportTicketService.autoCreateTicket()
         │
         └── Quote saved with new state
```

---

## 6. File Storage

Uploaded files are stored on the local filesystem under `./uploads/`:

```
uploads/
  quotes/        ← quote attachments (named by quoteId + original filename)
  attachments/   ← general attachments
  temp/          ← in-progress uploads
```

`AttachmentRefOrValue` records in the database hold the storage path, MIME type, size, and TMF attachment type. The `FileController` streams files back via `FileSystemResource`.

> **Production note:** Replace the local filesystem path with an object storage integration (Azure Blob Storage / S3) by swapping the `FileStorageService` implementation.

---

## 7. Configuration & Profiles

| Property | Dev | Prod |
|----------|-----|------|
| `spring.datasource.url` | `jdbc:h2:mem:quotedb` | Env-configured |
| `spring.jpa.ddl-auto` | `create-drop` | `validate` / `none` |
| `spring.sql.init.mode` | `never` | Env-configured |
| `app.mock-data.enabled` | `true` | `false` |
| `app.file-storage.path` | `./dev-uploads` | Production path |
| `logging.level.com.orion` | `DEBUG` | `INFO` |

Activate with: `SPRING_PROFILES_ACTIVE=prod`

---

## 8. Observability

Spring Boot Actuator is enabled with the following endpoints:

| Endpoint | Access |
|----------|--------|
| `/actuator/health` | Public (always) |
| `/actuator/info` | Public |
| `/actuator/metrics` | Public |

Health response includes database connectivity (`db`) and disk space checks.

---

## 9. Build & Dependencies

**Build tool:** Gradle 8 (wrapper included)  
**Java version:** 17 (source and target compatibility)

Key runtime dependencies:

| Dependency | Purpose |
|------------|---------|
| `spring-boot-starter-web` | REST API, Tomcat embed |
| `spring-boot-starter-data-jpa` | Hibernate ORM |
| `spring-boot-starter-security` | Security filter chain |
| `spring-boot-starter-oauth2-resource-server` | Azure AD JWT validation |
| `spring-boot-starter-validation` | Bean Validation (JSR 380) |
| `spring-boot-starter-actuator` | Health / metrics |
| `com.h2database:h2` | In-memory DB (dev) |
| `jackson-datatype-jsr310` | Java 8 date/time serialisation |
| `commons-fileupload` | Multipart file handling |

---

## 10. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| TMF 648 / TMF 629 API shapes | Industry standard for telecom BSS; enables interoperability with upstream ordering and CRM systems |
| H2 in-memory for dev | Zero-config local development; schema always fresh on restart |
| Dual-mode security | Allows frontend development without an Azure AD tenant while enforcing SSO in production |
| MockDataService on `ApplicationReadyEvent` | Seed data loads after all beans are wired; idempotent (skips if data exists) |
| `@ControllerAdvice` global error handler | Centralises exception-to-HTTP mapping; keeps controllers clean |
| Stateless JWT (no sessions) | Horizontally scalable; no sticky sessions required |
| Local filesystem for attachments | Simplest path for MVP; interface is abstracted in `FileStorageService` for easy cloud migration |
