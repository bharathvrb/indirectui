# Quote Status Management Service

A **TMF 648-compliant** Quote Management backend built with Spring Boot 3, providing REST APIs for managing telecommunications sales quotes, customer records, support tickets, and file attachments.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Running Locally](#running-locally)
- [API Reference](#api-reference)
  - [Quote API (TMF 648)](#quote-api-tmf-648)
  - [Customer API (TMF 629)](#customer-api-tmf-629)
  - [Support Ticket API](#support-ticket-api)
  - [File Management API](#file-management-api)
  - [Actuator / Health](#actuator--health)
- [Configuration](#configuration)
  - [Profiles](#profiles)
  - [Azure AD SSO](#azure-ad-sso)
- [Database](#database)
- [Mock / Seed Data](#mock--seed-data)
- [Project Structure](#project-structure)

---

## Overview

The Quote Status Management Service is the backend engine for Orion's telecommunications quote lifecycle platform. It enables sales representatives and automated systems to:

- Create and track quotes through their full TMF 648 lifecycle (`inProgress` → `sendToCustomer` → `accepted` / `rejected` / `cancelled`)
- Manage customer accounts aligned with TMF 629
- Auto-generate support tickets when quotes reach a failed state
- Attach documents (PDFs, contracts, SoW files) to quotes
- Seed and replay realistic mock data for development and QA environments

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Java 17 |
| Framework | Spring Boot 3.2.4 |
| Persistence | Spring Data JPA + Hibernate |
| Database (dev) | H2 in-memory |
| Security | Spring Security + OAuth2 Resource Server (Azure AD JWT) |
| Build | Gradle 8 |
| Standards | TMF 648 (Quote), TMF 629 (Customer) |

---

## Getting Started

### Prerequisites

- **Java 17+** — [Microsoft OpenJDK 17](https://aka.ms/download-jdk/microsoft-jdk-17-windows-x64.zip) or any OpenJDK 17 distribution
- **Gradle** — wrapper included (`./gradlew`)

### Running Locally

```bash
# Windows
.\gradlew bootRun

# macOS / Linux
./gradlew bootRun
```

The service starts on **http://localhost:8080** using the `dev` profile by default.

To run with a specific profile:

```bash
.\gradlew bootRun --args='--spring.profiles.active=prod'
```

To build a deployable JAR:

```bash
.\gradlew bootJar
java -jar build/libs/quote-management-backend-0.0.1-SNAPSHOT.jar
```

---

## API Reference

### Quote API (TMF 648)

Base path: `/tmf-api/quote/v4`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/quote` | List quotes with pagination, sorting, and optional `state` filter |
| `GET` | `/quote/{id}` | Get a quote by internal ID |
| `POST` | `/quote` | Create a new quote |
| `PATCH` | `/quote/{id}` | Update quote fields (partial update) |
| `DELETE` | `/quote/{id}` | Delete a quote |

**Query parameters for `GET /quote`:**

| Param | Default | Description |
|-------|---------|-------------|
| `page` | `0` | Zero-based page index |
| `size` | `10` | Page size |
| `sortBy` | `createdAt` | Field to sort by |
| `sortDir` | `desc` | `asc` or `desc` |
| `state` | — | Filter by `QuoteState` value |

**Quote States (TMF 648):** `inProgress`, `sendToCustomer`, `accepted`, `rejected`, `cancelled`, `approved`

---

### Customer API (TMF 629)

Base path: `/tmf-api/customerManagement/v4`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/customer` | List customers (supports `name` and `status` filters) |
| `GET` | `/customer/{id}` | Get customer by internal ID |
| `GET` | `/customer/ext/{externalId}` | Get customer by external business key |
| `POST` | `/customer` | Create a new customer |
| `PATCH` | `/customer/{id}` | Update customer fields |
| `DELETE` | `/customer/{id}` | Delete a customer |

---

### Support Ticket API

Base path: `/api/support-tickets`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | List tickets (supports `status` and `priority` filters) |
| `GET` | `/{id}` | Get a ticket by ID |
| `POST` | `/` | Create a support ticket manually |
| `PATCH` | `/{id}` | Update a ticket |

Tickets are also auto-created when a quote transitions to a failed/rejected state.

---

### File Management API

Base path: `/api/files`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/quote/{quoteId}` | Upload an attachment for a quote |
| `GET` | `/quote/{quoteId}` | List all attachments for a quote |
| `GET` | `/{fileId}` | Download a file by ID |
| `DELETE` | `/{fileId}` | Delete a file attachment |

Supported attachment types: `QUOTE_DOCUMENT`, `CONTRACT`, `SOW`, `AMENDMENT`, `CORRESPONDENCE`, `OTHER`

Max upload size: **10 MB** per file.

---

### Actuator / Health

| Endpoint | Description |
|----------|-------------|
| `GET /actuator/health` | Service health (always public) |
| `GET /actuator/info` | Build info |
| `GET /actuator/metrics` | Micrometer metrics |
| `GET /h2-console` | H2 web console (dev profile only) |

---

## Configuration

### Profiles

| Profile | Database | SQL Init | Log Level | Mock Data |
|---------|----------|----------|-----------|-----------|
| `dev` (default) | H2 in-memory | Disabled (mock service handles init) | DEBUG | Enabled on startup |
| `prod` | Configure via env vars | — | INFO | Disabled |

Override via environment variable:

```bash
SPRING_PROFILES_ACTIVE=prod
```

### Azure AD SSO

The service supports Azure AD JWT authentication. Set these environment variables to enable it:

```bash
AZURE_TENANT_ID=<your-tenant-id>
AZURE_CLIENT_ID=<your-client-id>
```

When these are **not set**, the service runs in open/dev mode and permits all requests (no JWT required). This allows the UI to load without SSO during local development.

> See `src/main/java/.../config/SecurityConfig.java` for implementation details.

---

## Database

The service uses **H2 in-memory** for development. Schema is managed by Hibernate (`ddl-auto: create-drop`).

H2 console (dev only): **http://localhost:8080/h2-console**

| Setting | Value |
|---------|-------|
| JDBC URL | `jdbc:h2:mem:quotedb` |
| Username | `sa` |
| Password | `password` |

---

## Mock / Seed Data

On startup (dev profile), `MockDataService` loads a set of realistic TMF 648 quotes from JSON files in `src/main/resources/mock-data/`. This includes quotes for multiple customers across different states, along with related parties, quote items, pricing, and notes.

Mock data files: `qt-a001-quote.json`, `qt-c010-quote.json`, `qt-f006-quote.json`, `dominos-quote.json`, and more.

---

## Project Structure

```
src/main/java/com/orion/quotemanagement/
├── QuoteManagementApplication.java     # Entry point
├── config/
│   ├── CorsConfig.java                 # CORS settings
│   ├── H2Config.java                   # H2 datasource config
│   ├── JacksonConfig.java              # JSON serialization
│   ├── SecurityConfig.java             # Azure AD OAuth2 / open-dev mode
│   └── WebMvcConfig.java               # MVC config
├── controller/
│   ├── QuoteController.java            # TMF 648 Quote endpoints
│   ├── CustomerController.java         # TMF 629 Customer endpoints
│   ├── SupportTicketController.java    # Support ticket endpoints
│   ├── FileController.java             # File upload/download
│   └── GlobalExceptionHandler.java     # Unified error responses
├── entity/                             # JPA entities (Quote, Customer, etc.)
├── repository/                         # Spring Data JPA repositories
└── service/
    ├── QuoteService.java
    ├── CustomerService.java
    ├── SupportTicketService.java
    ├── FileStorageService.java
    └── MockDataService.java            # Dev seed data loader

src/main/resources/
├── application.yml                     # Base config
├── application-dev.yml                 # Dev overrides
├── application-prod.yml                # Prod overrides
├── data.sql                            # SQL schema/seed (unused in dev)
└── mock-data/                          # JSON fixtures for dev seed
