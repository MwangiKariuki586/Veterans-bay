# Public Professional Detail Design QA

**Comparison Target**

- Source visual truth: the responsive ProLine Plumbing mockup attached to the user request (desktop, tablet, and phone compositions). The attachment does not expose a readable local file path.
- Implementation: `/professionals/[slug]` in the local Veterans Bay application.
- Latest implementation screenshot path: unavailable because no in-app browser is connected.
- State: public professional profile, light theme, authoritative new-professional data.

**Viewport And Normalization**

- Intended desktop comparison: 1440 CSS px viewport at density 1.
- Intended tablet comparison: approximately 768 CSS px viewport at density 1.
- Intended mobile comparison: 390 CSS px viewport at density 1.
- The supplied current-page screenshot was useful for the initial failure audit, but it predates the fixes and cannot serve as post-fix evidence.
- Exact source pixels and crop normalization cannot be recorded because the chat attachments have no local file paths.

**Findings**

- [P1, fixed in code] Hero image ended at a hard vertical seam.
  Location: desktop hero image-to-details boundary.
  Evidence: the focused current-state screenshot showed a black-background portrait ending on a sharp vertical edge, while the mockup blends a room-backed professional image gradually into the white details surface.
  Fix: replaced the black fallback with the approved room-backed male professional asset, widened the desktop image track from 360px to 440px, corrected the portrait crop, removed the internal boundary, and added a broad transparent-to-white transition over the image edge.

- [P1, fixed in code] Availability content was split across unrelated surfaces.
  Location: desktop hero availability rail.
  Evidence: the current-state screenshot placed availability inside a small lime card while service areas floated beneath it on white; the mockup uses one full-height softly tinted rail with a clear information hierarchy.
  Fix: rebuilt the rail as one full-height lime surface containing status, authoritative next-availability text, a full-width calendar action, divider, and service areas, with tablet and mobile grid adaptations.

- [P2, fixed in code] Hero proportions and action geometry remained too flat.
  Location: desktop hero columns, metadata blocks, and action row.
  Evidence: the current-state screenshot had a short 360px image column, a very wide details column, inline location/response text, and content-sized actions; the mockup uses a taller, image-led composition, two-line metadata blocks, and consistently sized pill actions.
  Fix: set the desktop hero to `440px / minmax(0,1fr) / 270px`, raised its minimum height to 380px, stacked metadata secondary text, tightened body width, and normalized the primary action widths.

- [P1, fixed in code] Empty portfolio caused major vertical bloat.
  Location: portfolio section below reviews.
  Evidence: the current-page screenshot showed a full-width empty portfolio panel absent from the mockup, pushing the footer substantially below the intended fold.
  Fix: render the portfolio section only when authoritative portfolio items exist.

- [P1, fixed in code] Mobile density and grouping did not match the mockup.
  Location: hero, availability, trust bar, tabs, and booking card.
  Evidence: the implementation stacked large trust items, used a horizontally scrolling pill tab bar, and kept booking fully expanded; the mockup uses four compact trust columns, a six-item underline tab row, a separated availability card, and a collapsed mobile booking disclosure.
  Fix: introduced compact four-column trust treatment, equal-width underline tabs, a separately surfaced mobile availability panel, and an interactive booking disclosure.

- [P2, fixed in code] Desktop hero and content grid were too tall and evenly proportioned.
  Location: hero and overview grid.
  Evidence: the implementation used a 380/auto/300 hero and equal thirds below; the mockup has a denser hero and a narrower booking column.
  Fix: reduced desktop hero tracks and height, tightened internal padding/type, and changed the overview grid to `1.05fr 1.05fr 0.85fr`.

- [P2, fixed in code] Overview cards lacked the mockup's internal hierarchy and finish.
  Location: tabs, About card, and overview metrics.
  Evidence: the supplied focused current-state screenshot showed a heavy full-width tab strip, oversized card radii, unboxed metrics, and a shorter three-card composition; the mockup uses a restrained underline navigation, 16px card radii, equal-height cards, and four individually outlined metric tiles.
  Fix: tightened the tab divider and active underline, set the desktop composition to a 405px minimum height with narrower booking track, reduced card radii, bottom-aligned the metric row, and restored four bordered metric tiles while retaining authoritative values.

- [P2, fixed in code] Service and booking cards read as generic controls rather than the mockup's structured lists.
  Location: Services offered and Book this professional cards.
  Evidence: the supplied current-state screenshot used one large rounded service container and disconnected grey step badges; the mockup uses flat service rows with separators and circular icons, plus pale-lime numbered steps connected by a dashed vertical timeline.
  Fix: rebuilt services as compact divided rows with trailing price and arrow treatment, bottom-aligned the View all services action, and introduced a shared connected booking timeline with a full-width lime CTA and right-aligned arrow for desktop and the responsive disclosure.

- [P1, fixed in code] Review headline contradicted its visible distribution.
  Location: What clients say rating summary.
  Evidence: the supplied focused current-state screenshot showed “New” and “0 reviews” beside distribution counts of two five-star and one four-star reviews. The headline used a missing reputation snapshot while the bars independently counted published reviews.
  Fix: derive the public aggregate rating and count from published reviews whenever the reputation snapshot is absent, so the hero, Reviews tab, score, count, cards, and distribution share one consistent projection.

- [P2, fixed in code] Rating-summary geometry and visual weight did not match the mockup.
  Location: What clients say rating summary card.
  Evidence: the current card was narrow with a large radius, compact score block, text-glyph row labels, and flat lime bars; the mockup uses a wider restrained-radius card, a larger score and five-star row, compact aligned labels, longer tracks, and yellow-to-lime fills.
  Fix: widened the desktop summary track to 320px, set a 154px minimum height and 16px radius, enlarged and vertically centred the score area, replaced text-glyph stars with the existing icon system, and tightened the bar/count grid with gradient fills.

- [P1, fixed in code] New-professional fallbacks fabricated review and performance data.
  Location: hero metadata, about metrics, rating distribution, and availability copy.
  Evidence: a provider with zero reviews displayed 4.8, 248 reviews, 1,200+ jobs, 98% feedback, and a 15-minute reply time.
  Fix: new/zero states now stay truthful, response rate is labelled correctly, availability derives from the API summary, and the empty review distribution uses zero counts.

- [P2, fixed in code] Save control was visual-only.
  Location: hero action row.
  Evidence: the heart button had no action despite stating that it saved a professional.
  Fix: connected it to the existing authenticated saved-professional API, including signed-out redirect, loading protection, pressed state, and feedback.

- [P1, still blocked] Post-fix rendered comparison evidence is unavailable.
  Location: complete route at desktop, tablet, and mobile widths.
  Evidence: browser discovery returned no available in-app browser.
  Impact: exact typography, crop, wrapping, spacing, and fold position cannot be approved as pixel-faithful.
  Fix: connect the in-app browser, capture the same route/state at the three target widths, combine each capture with the matching mockup, and iterate on visible differences.

**Required Fidelity Surfaces**

- Fonts and typography: existing Poppins family and product weights are preserved; rendered optical comparison is blocked.
- Spacing and layout rhythm: major proportions and mobile density were corrected in code; browser geometry is blocked.
- Colors and visual tokens: existing Veterans Bay navy, lime, white surfaces, borders, radii, and shadows are preserved; sampled comparison is blocked.
- Image quality and asset fidelity: the black-background fallback was replaced by an existing approved room-backed professional asset that better matches the source subject and environment; post-fix crop comparison is blocked.
- Copy and content: visible labels now distinguish authoritative values from unavailable data; rendered wrapping is blocked.

**Comparison History**

1. Initial supplied implementation screenshot was compared with the supplied responsive mockup and the P1/P2 failures above were recorded.
2. The structural, responsive, truthful-data, and interaction fixes were applied.
3. Focused component tests, TypeScript, and changed-file lint passed.
4. Browser setup was attempted; no browser surface was available, so no post-fix capture or second visual comparison could be completed.
5. The user supplied a focused hero comparison that exposed the remaining hard image seam, undersized image column, and fragmented availability styling.
6. The hero asset/crop/transition, desktop proportions, metadata hierarchy, and full availability rail were rebuilt; all 117 UI tests, TypeScript, changed-file lint, the 82-route production build, and whitespace checks passed again.
7. Browser discovery was retried and still returned no available browser, so fresh rendered evidence remains blocked.
8. The hero Book Now resting outline identified in the focused follow-up was removed without suppressing its keyboard-only focus ring; focused tests, TypeScript, changed-file lint, and whitespace checks passed.
9. The supplied overview-section comparison exposed unboxed metrics, generic service-row styling, disconnected booking steps, oversized radii, weak equal-height composition, and decorative-only tabs. Those P2 differences were corrected in code; all six tabs now smoothly navigate to real sections, update their active state and URL hash, and handle an empty portfolio truthfully. The focused component test, full 117-test UI suite, TypeScript, changed-file lint, and whitespace checks pass. A post-fix browser capture remains unavailable.
10. The supplied rating-summary comparison exposed a P1 aggregate contradiction and P2 card styling drift. The public projection now falls back to published-review aggregates, and the card dimensions, score hierarchy, iconography, bars, and counts were refined. Live local API verification returns 3 reviews and a 4.67 average for the three published records; the full 117-test UI and 156-test Worker/API suites pass. Post-fix browser comparison remains unavailable.

**Implementation Checklist**

- [x] Remove empty portfolio vertical bloat.
- [x] Refine hero and overview proportions.
- [x] Match compact mobile trust, tabs, availability, and booking structure.
- [x] Blend the hero image into the details surface without an internal seam.
- [x] Rebuild the availability rail as one mockup-matched surface.
- [x] Preserve authoritative data and saved-professional behavior.
- [x] Match the overview tab rhythm, boxed metrics, divided service rows, and connected booking timeline.
- [x] Keep review aggregates and distribution consistent and match the focused summary-card styling.
- [x] Run the full UI suite, typecheck, changed-file lint, production build, and whitespace checks.
- [ ] Capture desktop, tablet, and mobile post-fix screenshots.
- [ ] Resolve any remaining P0/P1/P2 differences from browser evidence.

**Follow-up Polish**

- Defer P3 optical adjustments until browser-rendered comparison is available.

final result: blocked

---

# Dark Band Width Alignment Design QA

**Comparison Target**

- Source visual truth: the user-provided community-stats and final-CTA screenshots.
- Implementation: `/become-a-professional`.
- After screenshot: unavailable because no supported browser surface is connected.

**Implemented Alignment**

- Changed both sections from viewport-wide breakouts to the parent shell's full width, giving them identical outer edges aligned with the navigation and footer.
- Preserved their existing inner 1340px rail and responsive gutters.
- Reverted the unrelated lighting, texture, avatar, typography, padding, spacing, and watermark changes from the previous misinterpreted pass.
- Made no height or content-density changes in this correction.
- Follow-up: the stats band now uses the shared 22px radius. The CTA no longer has a navy surface; it inherits the page background and uses dark heading, supporting-copy, and watermark colors for contrast.

**User-Selected Replacement**

- Replaced the rejected proof/CTA composition with the supplied community-proof reference, then integrated the narrow reputation column into the testimonial hierarchy at the user's direction.
- Removed both the standalone stats band and the duplicate testimonial card from How It Works.
- Desktop now uses two primary columns: community heading/metrics/avatar proof and the Mark D. Plumbing testimonial.
- The compact 42-job and Top Rated evidence row sits directly beneath Mark's profile and rating instead of reading as a detached dashboard KPI.
- Both desktop columns are equal-height flex stacks: the kicker and quote share the top edge, while the avatar proof and testimonial evidence share the bottom edge.
- Mobile preserves the same content hierarchy, with the compact evidence row remaining attached to the testimonial.
- The growth-card View all leads and View Dashboard controls are semantic, keyboard-focusable links with visible hover and focus states.
- The final CTA button, house watermark, and prior dotted treatment are not present because the selected reference does not include them.
- Existing avatar assets and icon-library symbols provide every visible image and icon in the reference.

**Verification**

- [x] Changed-file ESLint.
- [x] TypeScript strict check.
- [x] 82-route Next.js production build.
- [x] Local route response.
- [x] Single testimonial and single completed-job proof confirmed.
- [x] Compact job and reputation evidence is nested beneath Mark's profile in the testimonial column.
- [x] Whitespace validation.
- [ ] Same-viewport rendered comparison.

final result: blocked

---

# Community Stats Band Design QA

**Comparison Target**

- Source visual truth: the user-provided compact navy stats-band reference.
- Implementation: `/become-a-professional`, immediately below the professional-growth cards.
- After screenshot: unavailable because no supported browser surface is connected.

**Implemented Alignment**

- Reduced desktop vertical padding and set explicit compact line-heights to remove the oversized band height.
- Replaced the loose 50/50 composition with an 880px metrics track and adjacent proof cluster so the avatars no longer sit against the far edge.
- Aligned the inner content to the shared navigation and footer's authoritative 1340px rail and 26px desktop gutter; the navy surface remains full width.
- Refined the statistic dividers to muted lime, increased avatar size, added bright rings, and tightened proof-copy width and leading.
- Preserved the existing responsive stacked treatment below the desktop breakpoint.

**Verification**

- [x] Changed-file ESLint.
- [x] TypeScript strict check.
- [x] Local route response.
- [x] Whitespace validation.
- [ ] Same-viewport rendered comparison.

final result: blocked

---

# Professional Growth Section Design QA

**Comparison Target**

- Source visual truth: the user-provided "Built for professionals who want to grow" mockup.
- Implementation: `/become-a-professional`, signed-out state.
- Target desktop composition: three landscape work scenes with outward-overlapping UI panels and compact icon-led supporting copy.
- Implementation screenshot: unavailable because no supported browser surface is connected.

**Implemented Alignment**

- Replaced unrelated room, portrait, and booking imagery with section-specific plumber, work-management, and reputation scenes matching the mockup's subjects and focal placement.
- Rebuilt the three media compositions so the UI panels overhang the outer and inner image edges at widths of 1360px and above, while remaining safely inset at narrower widths.
- Matched the mockup's compact vertical rhythm, stronger section headline, larger supporting titles and descriptions, rounded media corners, subtle panel borders/shadows, and lime icon medallions.
- Preserved semantic headings, descriptive image alternatives, and real icon-library assets.

**Verification**

- [x] Changed-file ESLint.
- [x] TypeScript strict check.
- [x] 82-route Next.js production build.
- [x] Local `/become-a-professional` response and all three generated image references.
- [x] Whitespace validation.
- [ ] Same-viewport screenshot comparison at desktop and mobile widths.

**Finding**

- [P2, blocked] Optical comparison of crops, overhang, and responsive stacking remains unavailable until a supported browser surface is connected.

**Follow-up Screenshot Correction**

- The supplied implementation screenshot showed the section forcing a white background instead of inheriting the page backdrop.
- The page-level horizontal clipping boundary cut off the first floating panel, while the middle panel used a smaller overhang than the two outer panels.
- The section now inherits the page backdrop and the redundant clipping boundary is removed. At wide desktop widths, the two outer panels offset by the image's 16px inset so their outside edges terminate exactly on the shared navigation/footer rail; the dashboard panel uses the mockup's shallow 20px overhang so it cannot touch the neighbouring card.
- The dashboard panel no longer inherits the page's 22px body line-height: its miniature rows use a compact 16px rhythm and its width now matches the two outer panels, keeping it vertically contained and visually consistent.
- Focused lint, typecheck, local route, and whitespace checks pass after the correction. A fresh rendered after-screenshot remains unavailable because no browser surface is connected.

final result: blocked

---

# Become a Professional Page Design QA

**Comparison Target**

- Source visual truth: user-provided crops of the Become a Professional page.
- Implementation: `/become-a-professional`, signed-out state.
- Implementation screenshot: unavailable because neither supported browser surface is connected.
- Viewport and density normalization: unavailable without a browser-rendered capture.

**Focused Evidence**

- The hero's fixed-color overlay was replaced by an image mask so the page backdrop remains continuous.
- Duplicate hero padding was removed so the section uses the same horizontal rail as the public navigation.
- The testimonial image is the left-hand black panel shown in the final crop. A single continuous opacity mask now softens its top, right, bottom, and left edges into the navy card surface.

**Findings**

- [P2, blocked] Rendered confirmation is unavailable.
  Location: hero transition, navigation alignment, and testimonial image perimeter.
  Evidence: the route responds successfully, but no browser-rendered after capture can be produced.
  Fix: capture the route at matching responsive widths when a supported browser is connected.

**Implementation Checklist**

- [x] Keep the hero backdrop transition continuous.
- [x] Align the hero with the navigation rail.
- [x] Use one continuous all-edge mask for the testimonial image.
- [x] Remove corner-specific radius treatment from the testimonial image.
- [x] Run code and route checks.
- [ ] Complete screenshot-backed responsive comparison.

final result: blocked
