# Invoice Inspection Drawer — 2 September 2026

## Evidence

- Source visual truth: user-supplied invoice-list and invoice-drawer mockups in the current conversation; no local source-image path is available.
- Implementation routes: `/client/invoices?invoiceId=:invoiceId` and `/professional/invoices?invoiceId=:invoiceId`.
- Implementation screenshot: unavailable because browser discovery returned no available browser surfaces.
- Intended viewport: supplied desktop workspace composition, plus responsive drawer behavior down to mobile width; exact source viewport and density metadata are unavailable.
- State: authenticated client or professional inspecting an invoice without leaving the invoice list.

## Full-view comparison evidence

Blocked. The implementation keeps the established invoice list visible beneath a modal sheet and replaces dedicated detail navigation with a 94vw-capped, 36rem drawer. No browser-rendered capture is available to compare its shell, overlay, vertical rhythm, or viewport fit with the supplied mockup.

## Focused-region comparison evidence

Blocked. Component tests cover the loaded drawer content and actions, but they do not establish pixel fidelity for the financial summary, related-service grid, line-item table, payment history, status timeline, notes, or sticky action footer.

## Findings

- [P1] Browser-rendered invoice drawer comparison unavailable.
  - Location: invoice row inspection on client and professional invoice lists.
  - Evidence: the configured browser runtime reported no available browser surfaces.
  - Impact: exact spacing, drawer scrolling, overlay treatment, responsive stacking, and visual fidelity cannot be signed off from code and tests alone.
  - Fix: capture a partially paid invoice drawer at desktop and mobile widths, compare it with the supplied mockup, and correct any P0, P1, or P2 differences.

## Required fidelity surfaces

- Fonts and typography: existing Veterans Bay workspace hierarchy and semibold weight ceiling are preserved; rendered comparison blocked.
- Spacing and layout rhythm: compact numbered sections and sticky actions follow the supplied hierarchy; rendered comparison blocked.
- Colors and visual tokens: existing lime, neutral, warning, danger, border, and surface tokens are reused; rendered comparison blocked.
- Image quality and asset fidelity: no new raster assets are required; existing Lucide invoice, payment, person, and calendar icons are used.
- Copy and content: financial figures, related service, line items, payments, timeline, terms, and manual-record guidance are sourced from authoritative invoice data.

## Comparison history

- Implementation pass: converted invoice selection into an in-place drawer and redirected legacy invoice-detail routes back to the list with the selected invoice open.
- Workflow pass: replaced generic full-detail and support actions with PDF download and a role-aware service or job destination; the unnecessary reference-copy action was removed.
- Header collision follow-up: the supplied crop showed the status badge beneath the close button. The header now preserves a 4rem right-side close-control lane at mobile and desktop breakpoints; browser-rendered post-fix evidence remains unavailable.
- Automated evidence: focused UI/PDF tests, database tests, changed-file lint, typecheck, production build, and whitespace checks pass.
- Post-fix rendered comparison: blocked because no browser surface is available.

final result: blocked

# Client Quotation Detail Design QA

## Evidence

- Source visual truth: user-supplied desktop quotation-detail mockup in the current conversation; no local source-image path is available.
- Implementation route: `/client/quotations/d5000000-0000-4000-8000-000000000002`.
- Implementation screenshot: unavailable because the configured in-app browser reported no available browser surfaces.
- Intended viewport: desktop reference at approximately 1680 by 971 CSS pixels, plus tablet and mobile responsive states.
- Source pixels and density: 1680 by 971 supplied image; density metadata unavailable.
- Implementation pixels and density: unavailable.
- State: authenticated client, current quotation version 2, awaiting decision, with accept, revision, or decline confirmation modal open.

## Full-view comparison evidence

Blocked. The source quotation layout and the user's inline-confirmation screenshots are available in the conversation, but a browser-rendered capture of the replacement modal states could not be produced. Code, test output, build output, and HTTP responses are not substitutes for the required visual comparison.

## Focused-region comparison evidence

Blocked for the same reason. The intended focused regions are the stable journey and decision panel, each modal's heading, copy, note field and actions, focus containment, and narrow-screen modal geometry.

## Findings

- [P1] Browser-rendered modal comparison unavailable.
  - Location: accept, request-revision, and decline decision states on the client quotation detail route.
  - Evidence: browser discovery returned no available surfaces, so there is no rendered modal screenshot to compare with the supplied inline states and established workspace dialog pattern.
  - Impact: modal spacing, viewport fit, focus behavior, and final visual fidelity cannot be signed off.
  - Fix: connect the in-app browser or approve a Playwright CLI capture, then check all modal states at desktop and mobile widths.

## Required fidelity surfaces

- Fonts and typography: implemented with the existing Poppins workspace typography and semibold maximum weight; rendered comparison blocked.
- Spacing and layout rhythm: the summary panel stays fixed-height while a centered, bounded dialog owns each confirmation; rendered comparison blocked.
- Colors and visual tokens: existing Veterans Bay lime, neutral, warning, border, and surface tokens are used; rendered comparison blocked.
- Image quality and asset fidelity: the existing brand shell is preserved and the professional's real published logo is used when available; rendered comparison blocked.
- Copy and content: accept names the preserved version and total, revision prompts for requested changes, and decline makes its reason optional; rendered comparison blocked.

## Comparison history

- No visual iteration was possible because an implementation capture was unavailable.

## Implementation checklist

- Capture the authenticated desktop route with each of the three decision modals open.
- Verify focus containment, Escape/backdrop dismissal, busy-state dismissal prevention, and retry behavior.
- Capture mobile width and check dialog fit, textarea height, scrolling, and full-width stacked actions.
- Confirm the underlying journey panel does not resize when a modal opens.
- Check console errors and repeat the comparison until no P0, P1, or P2 findings remain.

final result: blocked

## Saved Items Loading Skeleton — 2 September 2026

### Evidence

- Source visual truth: user-supplied desktop screenshot of `/client/saved` in the current conversation; no local source-image path is available.
- Implementation route: `/client/saved`.
- Implementation screenshot: unavailable because browser discovery returned no available browser surfaces.
- Intended viewport: supplied desktop screenshot at 1920 by 1080 pixels and a responsive mobile fallback.
- Source density: browser screenshot captured at 80% zoom; device-pixel density metadata is unavailable.
- Implementation pixels, CSS viewport, and density normalization: unavailable.
- State: authenticated client while saved professionals are loading.

### Full-view comparison evidence

Blocked. The surrounding workspace shell, page heading, summary cards, search, filters, and sort controls are intentionally unchanged. The generic centered spinner panel is replaced by a two-column grid of four card-shaped skeletons, but no browser-rendered implementation screenshot could be captured for direct comparison.

### Focused-region comparison evidence

Blocked. Source-informed code mirrors the loaded cards' 16px radius, border, white surface, subtle elevation, internal 16px padding, avatar or service-thumbnail geometry, title, badge, metadata, description, heart-control, and saved-date positions. A rendered focused crop is unavailable, so exact rhythm and shimmer appearance cannot be signed off.

### Required fidelity surfaces

- Fonts and typography: skeleton bars follow the existing text hierarchy and do not add visible loading copy; rendered comparison blocked.
- Spacing and layout rhythm: four placeholders use the loaded two-column grid and switch to one column below the existing medium breakpoint; rendered comparison blocked.
- Colors and visual tokens: the shared muted skeleton token, existing card border, white surface, and shadow are reused; rendered comparison blocked.
- Image quality and asset fidelity: no new image assets are required; avatar and service-image slots are represented by shared skeleton primitives.
- Copy and content: the former loading title and description are visually removed while an accessible `Loading saved items` busy status remains.

### Findings

- [P1] Browser-rendered loading-state comparison unavailable.
  - Location: saved-items card grid below the toolbar.
  - Evidence: the configured browser runtime reported no available browser surfaces.
  - Impact: exact desktop card proportions, shimmer contrast, mobile stacking, and viewport fit cannot be approved from code and tests alone.
  - Fix: capture the delayed saved-professionals request at the supplied desktop proportions and at a mobile width, then compare both renders with the loaded card grid.

### Comparison history

- Implementation pass: replaced the centered spinner panel with alternating professional and service card skeletons and retained an accessible busy announcement.
- Automated post-fix evidence: three focused component tests, changed-file lint, typecheck through the 82-route production build, and whitespace checks pass.
- Post-fix rendered comparison: blocked because no browser surface is available.

### Implementation checklist

- Capture the authenticated loading state at desktop and mobile widths.
- Confirm the grid transition, card height consistency, and no horizontal overflow.
- Check the browser console and repeat the comparison until no P0, P1, or P2 findings remain.

final result: blocked

## Dynamic Quotation Status Card — 1 September 2026

### Evidence

- Source visual truth: the four user-supplied desktop mockups in the current conversation for awaiting-decision, revision-requested, accepted, and declined quotation states; no local source-image paths are available.
- Implementation route: `/client/quotations/d5000000-0000-4000-8000-000000000002`.
- Implementation screenshot: unavailable because the configured browser connection reported no available browser surfaces.
- Intended viewport: supplied desktop mockups at approximately 1450 by 1086 pixels, plus responsive tablet and mobile states.
- Implementation pixels, CSS viewport, and density normalization: unavailable.
- State: authenticated client viewing the current quotation version.

### Full-view comparison evidence

Blocked. The implementation places the status card in the same 360px desktop grid track as Timing, Professional, Request summary, and the protection note. The quotation body spans the left track unchanged. On narrower layouts, source order promotes the status card ahead of the quotation body while the remaining supporting cards stay below it. A rendered screenshot is unavailable, so exact alignment and responsive geometry cannot be signed off.

### Focused-region comparison evidence

Blocked. Code and interaction tests cover the four supplied workflow states, semantic headings, actions, modal entry points, preserved revision and decline reasons, accepted booking link, current-version binding, and closed-state recovery links. They do not establish pixel fidelity for card height, wrapping, border tone, or rail alignment.

### Required fidelity surfaces

- Fonts and typography: existing Veterans Bay Poppins hierarchy and semibold weight ceiling are preserved; rendered comparison blocked.
- Spacing and layout rhythm: the card uses the established 360px rail, 20px grid gap, responsive 20px/24px padding, and shared surface radius; rendered comparison blocked.
- Colors and visual tokens: calm lime, amber, green, red, and neutral state treatments follow the supplied states without changing global tokens; rendered comparison blocked.
- Image quality and asset fidelity: no new raster assets are required; the implementation uses the existing icon library and preserves existing provider imagery.
- Copy and content: awaiting, revision, accepted, declined, expired, cancelled, replaced, and draft states use authoritative quotation, version, booking, date, provider, and history data.

### Findings

- [P1] Browser-rendered state-card comparison unavailable.
  - Location: first card in the client quotation detail right rail.
  - Evidence: browser selection returned no available browser surface.
  - Impact: exact right-rail alignment, state-card proportions, mobile ordering, and visual fidelity cannot be approved from code and tests alone.
  - Fix: capture awaiting, revision-requested, accepted, and declined states at desktop and mobile widths, compare each against the matching supplied mockup, and correct any P0/P1/P2 differences.

### Comparison history

- Implementation pass: replaced the full-width journey/action panel with one status-aware right-rail card while preserving the quotation body and supporting cards.
- State pass: bound decision messaging and actions to the authoritative current version even when an older version is selected for inspection.
- Post-fix rendered comparison: blocked because no browser surface is available.

final result: blocked

## Attachment Row Padding Follow-up — 1 September 2026

### Evidence

- Source visual truth: user-supplied focused crop of the `Quotation_V2.pdf` attachment row in the current conversation; no local source-image path is available.
- Implementation route: `/client/quotations/d5000000-0000-4000-8000-000000000002`.
- Implementation screenshot: unavailable because the configured browser connection reported no available browser surfaces.
- Intended viewport: responsive attachment card within the client quotation detail layout; exact source viewport and density metadata are unavailable.
- State: authenticated client viewing the current quotation attachment.

### Focused-region comparison evidence

Blocked. The source crop shows the attachment pill, document tile, two-line label, and download control, but no browser-rendered implementation crop could be captured. The source-guided change separates horizontal and vertical padding, increasing the side inset from `0.5rem` to `0.75rem` while preserving the compact `0.5rem` vertical inset, icon dimensions, text truncation, and responsive full width.

### Required fidelity surfaces

- Fonts and typography: unchanged; existing semibold/medium quotation hierarchy is preserved.
- Spacing and layout rhythm: horizontal edge clearance is increased without increasing row height; rendered comparison remains blocked.
- Colors and visual tokens: unchanged.
- Image quality and asset fidelity: unchanged; the existing icon-library assets remain in use.
- Copy and content: unchanged.

### Finding

- [P2] Browser-rendered padding comparison unavailable.
  - Location: attachment rows in the client quotation detail Attachments card.
  - Evidence: browser connection returned no available surface.
  - Impact: exact pixel balance at desktop and mobile widths cannot be signed off from code alone.
  - Fix: capture the authenticated attachment row at desktop and mobile widths when a browser surface is connected.

### Comparison history

- Source-guided implementation pass: replaced uniform `0.5rem` padding with `0.75rem` horizontal and `0.5rem` vertical padding.
- Post-fix rendered comparison: blocked because no browser surface is available.

final result: blocked
