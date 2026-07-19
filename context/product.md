# Product Context — Veterans Bay

## Identity

- Implementation name: **Veterans Bay**
- Source specification working title: **ServiceLink**
- Initial market: Home repair and maintenance professionals

## Context

Independent professionals and small service businesses often manage enquiries, quotations, appointments, customers, payments, and job updates across disconnected tools such as messaging apps, calls, notebooks, and spreadsheets.

Clients struggle to find trustworthy professionals, understand pricing, compare quotations, track work, confirm agreements, access receipts and warranties, and resolve poor outcomes.

Veterans Bay connects clients and professionals while giving professionals an operational workspace for both marketplace-acquired and existing customers.

## Purpose

Provide a trusted service-commerce platform where clients can discover, hire, and manage professionals, while professionals manage services, customers, quotations, bookings, jobs, teams, payments, warranties, and business records from one workspace.

## Lifecycle

```txt
Discovery
→ Request
→ Quotation
→ Acceptance
→ Booking
→ Service fulfilment
→ Completion
→ Payment record
→ Warranty
→ Review
→ Repeat booking
```

## Product Principles

### Complete Service Lifecycle

Important agreements, updates, records, evidence, and follow-up actions stay connected to the engagement.

### Professional-First Value

Professionals receive useful business-management capability even when customers were not acquired through the marketplace.

### Verified Trust

Reviews, completed-job counts, and performance indicators derive from eligible platform-recorded engagements.

### Fair Customer Ownership

Preserve whether a client was marketplace-acquired, invited, imported, referred, or returning.

### Server-Controlled Business Rules

The frontend requests actions. The backend validates identity, access, status, ownership, permissions, and business conditions.

### Modular Delivery

Use a modular monolith during MVP. Keep domains separated without premature microservices.

## Personas

### Client

Can discover professionals, submit requirements, receive and compare quotations, book, track jobs, approve changes, confirm completion, access records, review completed work, and raise warranty concerns.

### Professional Owner

Can create an organisation and public profile, list services, manage enquiries, prepare quotations, schedule jobs, assign team members, manage customers, track payments, review performance, and manage permissions.

### Professional Team Member

Depending on permission, can view assigned jobs, access relevant requirements, update progress, complete checklists, record materials, upload evidence, request additional-work approval, and submit completion details.

### Platform Administrator

Can manage categories, review professional accounts, moderate listings and content, investigate reports, manage disputes, suspend accounts, review activity, configure rules, and inspect audit history.

## Product Experiences

1. Public marketplace
2. Client portal
3. Professional workspace
4. Permission-limited team experience within the professional workspace
5. Platform administration

## Canonical Service Models

### Fulfilment

```txt
DIRECT_BOOKING
REQUEST_QUOTATION
SITE_ASSESSMENT_REQUIRED
REMOTE_CONSULTATION
```

### Pricing

```txt
FIXED_PRICE
STARTING_FROM
HOURLY
DAILY
CUSTOM_QUOTATION
```

### Customer Origin

```txt
MARKETPLACE_ACQUIRED
PROFESSIONAL_INVITED
PROFESSIONAL_IMPORTED
CLIENT_REFERRAL
REPEAT_CLIENT
```

## MVP Scope

- Identity and account management
- Professional organisation onboarding
- Team membership and permissions
- Professional profiles and service catalogue
- Marketplace discovery
- Service requests and enquiries
- Quotations and versioning
- Booking and scheduling
- Job fulfilment
- Conversations and activity
- Manual invoices and payment records
- Completion confirmation
- Warranties and claims
- Verified reviews and reputation
- Professional customer management
- In-app notifications
- Platform moderation
- Basic dashboards and reporting
- Reliable asynchronous processing

## Deferred

- M-Pesa and card payments
- Automated payouts
- Paid subscriptions and commissions
- Live location tracking
- Offline technician mode
- Real-time chat
- SMS and WhatsApp notifications
- AI categorisation or quotation assistance
- Dynamic workflow builders
- Advanced inventory
- Supplier marketplace
- Multiple countries or currencies
- Native mobile applications
- Dedicated external search infrastructure
- Microservices
- Kafka

Deferred capability must not be presented as available.

## MVP Success Criteria

The MVP is functionally complete when:

1. A professional creates and publishes an approved profile and service.
2. A client discovers the professional and submits a request.
3. The professional issues a versioned quotation.
4. The client accepts the current eligible quotation.
5. The platform creates and schedules the resulting booking/job.
6. An authorised team member executes and updates the job.
7. The client confirms completion or reports an unresolved issue.
8. The professional records payment accurately.
9. The platform creates an eligible warranty record.
10. The client submits one verified review.
11. The professional manages the client as a repeat customer.
12. Important secondary actions process asynchronously and idempotently.
13. Platform administrators moderate professionals and reported activity.
