# Known Limitations

- This deployment is a controlled, non-commercial demonstration. Public registration is disabled; do not enter real personal, service, or payment information.
- M-Pesa, card payments, payouts, subscriptions, and commissions are not active. Preview financial records are explicitly simulated, use `PREVIEW-` references, and cannot include payment evidence.
- Email verification, password reset delivery, SMS, WhatsApp, and outbound email notifications are not active until a provider is approved and verified.
- Real-time chat, live location, offline technician mode, native apps, AI features, inventory, suppliers, multi-country/multi-currency, and external search are deferred.
- Analytics projections are eventually consistent and intentionally limited to supported MVP events.
- Public projection caching may show marketplace changes for up to the short cache window; live availability, reservations, messages, financials, moderation, notifications, and outbox state are not cached.
- Final operator legal identity, notice address, governing law, dispute forum, production support owner, and data-protection registration/assessment remain release-owner decisions.
- Development tooling retains upstream audit advisories in build/test-only dependency paths; production dependencies have no high or critical audit findings after compatible updates.
- The preview uses Cloudflare `workers.dev` addresses instead of a branded custom domain.
- Only the isolated preview environment is configured. Deployable production Wrangler environments, separate production infrastructure, and production promotion are deferred by delivery-owner decision.
