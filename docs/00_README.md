# Cablix ERP Documentation

**Project:** Cablix ERP  
**Product Type:** Multi-Tenant SaaS ERP for Car Rental & Fleet Management Companies  
**Owner:** Cablix  
**Version:** 1.0  
**Status:** Approved Requirements Baseline (Frozen)

**Baseline Date:** 20 July 2026

---

# Overview

Welcome to the official documentation of **Cablix ERP**.

This documentation defines the business rules, system architecture, technical standards, workflows, coding guidelines, and development roadmap for the Cablix ERP platform.

The purpose of this documentation is to ensure that every developer, architect, AI coding assistant (Codex/ChatGPT), QA engineer, or future contributor understands the system before making any modifications.

---

# Source of Truth

The documents inside this folder are the **official source of truth** for the project.

If the source code conflicts with these documents, **the documentation takes precedence** until officially updated.

Architecture decisions should never be inferred from existing code alone.

## Baseline and Change Control

Version 1.0 of these documents is the approved requirements baseline. Product,
business, security, data, workflow, and architecture requirements in this
baseline are frozen for implementation.

Any proposed change must:

1. Be documented before implementation.
2. Identify the affected requirements, workflows, APIs, data, and tests.
3. Be reviewed and approved by the project owner.
4. Update the relevant document version and change history.
5. Be implemented only after documentation approval.

Implementation details may evolve without changing the baseline only when they
do not alter an approved business rule, security boundary, data rule, workflow,
or external contract.

---

# Product Overview

Cablix ERP is a cloud-based **Multi-Tenant SaaS ERP** built specifically for the Car Rental and Fleet Management industry.

The system enables independent car rental companies to manage their complete business through a centralized platform.

The platform is owned and operated by **Cablix**.

Every subscribed car rental company operates as an independent **Tenant**.

Each tenant has complete isolation of:

- Users
- Customers
- Vendors
- Vehicles
- Drivers
- Bookings
- Invoices
- Accounts
- Reports
- Settings

No operational data is shared between tenants.

Fleet ownership rule:

- Vendors are parent records for vehicles and drivers.
- Each tenant has one own-company parent record for its own vehicles and drivers.
- External vendors are separate parent records for vendor vehicles and vendor drivers.
- In the UI, show the label as `Ownership` with values `Own` and `Vendor`.
- In backend/database design, store this as `ownership_type` for vehicles and drivers.

Profit rule:

- Own vehicle bookings contribute to vehicle profit.
- Vendor vehicle bookings produce separate vendor booking profit.
- Vendor booking profit must not be mixed with own vehicle profit.
- Recoverable charges such as toll, parking, driver night allowance, and GST remain pass-through charges.

---

# Documentation Structure

The documentation has been divided into multiple documents for easier maintenance.

```
docs/
│
├── 00_README.md
├── 01_SYSTEM_ARCHITECTURE.md
├── 02_SAAS_PLATFORM.md
├── 03_AUTHENTICATION_AND_SECURITY.md
├── 04_DATABASE_PRINCIPLES.md
├── 05_BOOKING_ENGINE.md
├── 06_INVOICE_ENGINE.md
├── 07_ACCOUNTS_ENGINE.md
└── 08_BACKEND_ARCHITECTURE.md
```

---

# Recommended Reading Order

Every new developer or AI assistant should read the documents in the following order.

| Priority | Document | Purpose |
|-----------|----------|---------|
| 1 | 00_README.md | Documentation overview |
| 2 | 01_SYSTEM_ARCHITECTURE.md | Overall system architecture |
| 3 | 02_SAAS_PLATFORM.md | Platform admin, tenants, subscriptions |
| 4 | 03_AUTHENTICATION_AND_SECURITY.md | Login, JWT, roles, permissions, isolation |
| 5 | 04_DATABASE_PRINCIPLES.md | Database standards and multi-tenancy rules |
| 6 | 05_BOOKING_ENGINE.md | Booking workflow, assignment, closure |
| 7 | 06_INVOICE_ENGINE.md | Invoice numbering, drafts, GST, cancellation |
| 8 | 07_ACCOUNTS_ENGINE.md | Collections, ledgers, expenses, daily closing |
| 9 | 08_BACKEND_ARCHITECTURE.md | Node.js backend architecture and API layering |

---

# High-Level Architecture

```
Cablix (Application / Platform Owner)
        |
        v
SaaS Platform Admin
        |
        v
Tenant / Car Rental Company
        |
        v
Subscription
        |
        v
Owner Login
        |
        v
Tenant ERP
```

Important:

- Cablix is the platform owner and SaaS provider.
- Cablix must not be treated as a tenant.
- Existing mock-data screens belong to the Tenant ERP area.
- Each tenant is a subscribed car rental company with isolated ERP data.
- Tenant users can access only their own tenant.

---

# Major Components

The system consists of three major applications.

## 1. Authentication

Responsible for:

- Login
- Password Management
- User Authentication
- Session Management

---

## 2. Platform Administration

Managed by Cablix.

Responsible for:

- Tenant Management
- Subscription Plans
- Subscription Management
- Platform Users
- Payments
- Platform Reports
- Support

---

## 3. Tenant ERP

Used by subscribed car rental companies.

Includes:

- Dashboard
- Customers
- Vendors
- Vehicles
- Drivers
- Bookings
- Duty Assignment
- Booking Closure
- Invoice Management
- Collections
- Accounts
- Fleet
- Reports
- Settings

---

# Project Goals

The primary objectives of Cablix ERP are:

- Digital transformation of car rental businesses
- Reduce manual operations
- Standardize workflows
- Improve financial transparency
- Support business growth through SaaS
- Provide scalable architecture
- Maintain complete tenant isolation
- Simplify fleet operations
- Generate business intelligence through reports

---

# Development Philosophy

The project follows the following principles.

## Business First

Business workflows drive software design.

Software should not force businesses to change their operations unnecessarily.

---

## Documentation First

Every major feature should be documented before implementation.

Documentation is considered part of the source code.

---

## Architecture Before Code

No module should be implemented before its architecture is finalized.

Major architectural changes should always be documented.

---

## Modular Design

Every business domain should remain independent.

Examples:

- Booking
- Invoice
- Accounts
- Fleet

Each module should have minimal dependency on others.

---

## Security by Default

Security is never optional.

Every request should be authenticated and authorized.

Tenant isolation must be enforced at every layer.

---

## Scalability

The architecture should support:

- Thousands of tenants
- Millions of bookings
- High concurrent users
- Horizontal scaling

without requiring major redesign.

---

# Technology Stack

## Frontend

- React
- TypeScript

---

## Backend

- Node.js
- Express.js
- TypeScript

---

## Database

- MySQL

---

## Authentication

- JWT
- Refresh Tokens

---

## Hosting

(To be finalized)

Expected deployment:

- Backend
- Frontend
- Database
- Object Storage
- CDN
- Reverse Proxy

---

# Documentation Rules

When updating any document:

- Preserve existing architecture.
- Keep terminology consistent.
- Update related documents if required.
- Avoid contradictory business rules.
- Record major architectural changes.

---

# Rules for AI Coding Assistants

Every AI assistant (Codex, ChatGPT, Claude, etc.) must follow these rules before making any changes.

## MUST

- Read documentation before coding.
- Follow business rules.
- Preserve tenant isolation.
- Respect module boundaries.
- Keep code modular.
- Follow coding standards.

## MUST NOT

- Invent new architecture.
- Modify business workflows without approval.
- Remove tenant isolation.
- Change invoice numbering logic.
- Mix customer collections with manager ledger.
- Introduce breaking architectural changes.

---

# Versioning

Current Documentation Version:

```
1.0
```

Documentation will evolve as the product evolves.

Major architecture changes should increment the version.

Example:

```
1.0
1.1
1.2
2.0
```

---

# Contribution Guidelines

Before implementing any feature:

1. Read the relevant documentation.
2. Confirm architecture.
3. Design database changes.
4. Design APIs.
5. Implement.
6. Test.
7. Update documentation if required.

Documentation should evolve together with the product.

---

# Final Note

Cablix ERP is intended to become a professional SaaS ERP platform for the transportation industry.

This documentation is designed to ensure consistency, maintainability, scalability, and long-term success of the product.

Every contributor is expected to understand these documents before making any architectural or implementation decisions.
