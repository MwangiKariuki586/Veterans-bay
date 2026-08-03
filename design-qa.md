# Landing Hero Design QA

**Comparison Target**

- Source composition: `C:/Users/ADMINI~1/AppData/Local/Temp/codex-clipboard-12ed3e66-fd0e-45db-92ab-ec4a64f7f371.png`
- Supplied professional asset: `C:/Users/ADMINI~1/AppData/Local/Temp/codex-clipboard-eb87d96e-d7f6-4465-9ebf-cdf8a7932540.png`
- Desktop implementation screenshot: `artifacts/design-qa/landing-desktop-refined-hero.png`
- Focused hero crop: `artifacts/design-qa/refined-hero-card.png`
- Side-by-side comparison: `artifacts/design-qa/refined-hero-comparison.png`
- Mobile evidence: `artifacts/design-qa/landing-mobile-refined-hero.png`
- Narrow-width evidence: `artifacts/design-qa/landing-320-refined-hero.png`
- CTA focused comparison: `artifacts/design-qa/hero-cta-nowrap-comparison.png`
- Tablet CTA evidence: `artifacts/design-qa/hero-cta-tablet-wrap.png`
- Mobile CTA evidence: `artifacts/design-qa/hero-cta-mobile-nowrap.png`
- Simplified desktop hero: `artifacts/design-qa/landing-desktop-hero-without-social-arrows.png`
- Simplified mobile hero: `artifacts/design-qa/landing-mobile-hero-without-social-arrows.png`

**Viewport And Normalization**

- Desktop browser viewport: 1440 x 1000 CSS px at device density 1.
- Rendered hero: 866.82 x 594 CSS px; captured as 867 x 594 px.
- Source composition: 1071 x 734 px, normalized to 867 x 594 px for the focused comparison.
- Responsive checks: 390 x 844 CSS px and 320 x 700 CSS px.
- State: guest landing page, light theme, default hero state.

**Findings**

- No actionable P0, P1, or P2 differences remain.
- Fonts and typography: Poppins, navy hierarchy, three-line headline, supporting copy, CTA labels, assurance copy, and social labels retain the approved source hierarchy. Small-screen sizes step down below 640 px to protect readability beside the image.
- Spacing and layout rhythm: the left content column and right photo layer preserve the source landscape composition. The asset overlaps the hero surface through a broad fade rather than a sharp panel boundary, and the navigation controls remain anchored at the lower right.
- Colors and visual tokens: the warm-neutral hero surface blends into the supplied room photography while retaining the approved navy, lime, white controls, subtle border, and restrained shadows.
- Image quality and asset fidelity: the supplied 1024 x 1536 professional-in-room asset is used directly through Next Image. Responsive object positioning keeps the professional on the right and the content readable on the left without stretching or substituting the asset.
- Copy and content: approved hero wording, CTAs, and assurance copy are unchanged. The social row and decorative carousel arrows are intentionally removed per the latest user direction.
- CTA behavior: both labels use `nowrap`; desktop keeps the two controls on one row, while tablet and mobile layouts move the complete secondary button below the primary rather than wrapping either label or overlapping following content.
- Content distribution: after removing the lower controls, the remaining hero content is vertically centred so the card no longer ends with a large unused region. Desktop and mobile captures retain balanced top and bottom spacing.
- Responsive behavior: the full-bleed right-side image treatment remains active at desktop, 390 px, and 320 px. The hero itself has no horizontal overflow at the narrow breakpoint.
- P3: the supplied asset intentionally introduces a real room background and embedded wall branding where the original composition used a transparent professional cutout. This is the requested asset change, not unresolved design drift.

**Full-View And Focused Evidence**

- Full-view desktop review confirms the hero remains aligned with the three supporting cards and the following content row.
- The focused side-by-side comparison verifies headline scale, content placement, CTA geometry, image crop, and the continuous blend at readable size.
- Mobile and narrow-width captures verify readable copy, visible CTAs, contained hero content, and responsive subject positioning.

**Comparison History**

1. The initial asset placement used the supplied room photo as a full-bleed right-side layer and removed the separate mobile image block.
2. The first mobile pass placed the professional too far beneath the headline, reducing contrast. The small-screen crop shifted right and the fade widened while the desktop crop remained unchanged.
3. The second pass reduced small-screen headline sizing and narrowed the image layer, preserving hierarchy while separating the subject from the copy at 390 px and 320 px.
4. User review identified CTA labels wrapping inside their controls. Both buttons now preserve single-line labels, and the responsive row wraps whole controls at intermediate widths; focused desktop, tablet, and mobile evidence confirms there is no label or content overlap.
5. User review removed the social links and decorative hero arrows. Their supporting icon code was deleted, and the main content changed from edge distribution to vertical centring; the resulting desktop and mobile captures show balanced spacing without dead controls or a large empty lower region.

**Interaction And Runtime Checks**

- `Find Services` and `Become a Professional` retain their existing routes.
- Guest navigation and surrounding landing-page content remain unchanged; the non-functional hero carousel controls are intentionally absent.
- Final-code runtime review reported zero browser console errors.
- Focused component tests, TypeScript, file-scoped ESLint, and `git diff --check` passed.

**Implementation Checklist**

- [x] Use the supplied professional-in-room asset.
- [x] Keep the hero landscape composition at every breakpoint.
- [x] Blend the photo into one continuous hero surface.
- [x] Preserve approved copy, CTAs, and assurance while removing the rejected social and arrow controls.
- [x] Verify desktop, mobile, narrow-width, runtime console, and focused automated gates.

**Follow-up Polish**

- None required for the selected asset direction.

final result: passed
