# MVP Event Inventory

## Notification consumer

The in-app notification consumer owns participant-facing service request, message, quotation, booking, job, warranty, reminder, invoice, payment, review, moderation, listing enforcement, account enforcement, and dispute-opened/resolved notifications declared in `notificationSourceEvents`.

## Reputation consumer

`reputation.recalculation_requested` rebuilds organisation reputation from authoritative jobs, bookings, warranties, reviews, and responses. Duplicate delivery creates one projection update.

## Analytics consumer

`service_request.submitted`, `quotation.accepted`, `booking.confirmed`, `job.completed`, and `review.submitted` increment bounded daily projections. Dashboards label the projection as eventually consistent.

## Proof consumer

`system.outbox_proof` verifies publication and duplicate-delivery behaviour. It is an operational diagnostic, not a business feature.

## Scheduled database actions

Service-request expiry, quotation expiry, approved automatic job completion, service reminders, abandoned outbox-claim recovery, and outbox publication are database-coordinated, bounded, and repeat-safe.

## Intentionally record-only events

Audit/history, notification lifecycle, file lifecycle, membership lifecycle, catalogue lifecycle, and marketplace view/search events may have no secondary consumer when their durable source record or outbox record is the required effect. They remain observable and can be assigned a future consumer without changing the primary transaction.

Unsupported event versions are dead-lettered by the owning consumer. Manual retry preserves the original event ID and payload.
