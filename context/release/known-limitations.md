# Known Limitations

- M-Pesa, card payments, payouts, subscriptions, and commissions are not active. Financial records are manual and auditable.
- Email verification, password reset delivery, SMS, WhatsApp, and outbound email notifications are not active until a provider is approved and verified.
- Real-time chat, live location, offline technician mode, native apps, AI features, inventory, suppliers, multi-country/multi-currency, and external search are deferred.
- Analytics projections are eventually consistent and intentionally limited to supported MVP events.
- Public projection caching may show marketplace changes for up to the short cache window; live availability, reservations, messages, financials, moderation, notifications, and outbox state are not cached.
- Final operator legal identity, notice address, governing law, dispute forum, production support owner, and data-protection registration/assessment remain release-owner decisions.
- Development tooling retains upstream audit advisories in build/test-only dependency paths; production dependencies have no high or critical audit findings after compatible updates.
- Preview and initial production use Cloudflare `workers.dev` addresses instead of a branded custom domain.
- Only the isolated preview environment is being configured. Separate production infrastructure and production promotion are deferred by delivery-owner decision.
