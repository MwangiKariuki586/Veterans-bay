# UI System — Veterans Bay

## Primary Design Authority

The approved homepage mockup must be placed at:

```txt
context/design-reference/homepage.png
```

It is the permanent visual reference for the platform.

All new pages must inherit its:

- Typography
- Colour hierarchy
- Navigation treatment
- Search and control styling
- Surface treatment
- Border radii
- Shadow softness
- Spacing rhythm
- Image quality
- Responsive standard
- Overall level of polish

A page may use a layout that better fits its workflow, but it must not introduce a competing design direction or look like an unrelated template.

When an approved feature-specific mockup exists, it controls that page's layout while the homepage continues to control the shared visual language.

## Source Order

```txt
Explicit approved design direction or feature mockup
→ context/design-reference/homepage.png
→ existing implemented shared components
→ authoritative global tokens
→ this document
→ nearby established patterns
```

## Global Style Authority

`src/app/globals.css` or the repository's actual global stylesheet owns shared tokens and global base styles.

It may contain:

- Semantic colours
- Typography variables
- Shared radii
- Shared shadows
- Application backgrounds
- Global resets and base rules
- Tailwind theme configuration

It must not become a dumping ground for page-specific layouts, one-off card classes, or component-specific workarounds.

## Visual Direction

Veterans Bay should feel:

- Premium
- Calm
- Spacious
- Trustworthy
- Modern
- Practical
- Polished
- Softly futuristic
- Business-ready

Use neutral backgrounds, white surfaces, selective large rounded containers, broad diffused shadows, bright lime primary actions, deep navy strong controls, teal trust indicators, supporting blue, restrained category colours, strong typography, and service-relevant imagery.

Avoid generic admin templates, electronics-marketplace aesthetics, excessive glass effects, excessive lime, identical card grids, nested cards, random visual values, and copying the homepage composition onto operational pages.

## Layout Guidance

Default maximum width: 1440px.

```txt
Desktop horizontal padding: 32px
Tablet horizontal padding: 24px
Mobile horizontal padding: 16px
```

Use larger 1600px operational canvases only when the workflow genuinely requires it.

### Public Pages

May use expressive composition, imagery, large search, bento-like sections, and acquisition CTAs.

### Client Pages

Prioritise required action, current status, next step, essential details, communication, history, then statistics.

### Professional Pages

Prioritise enquiries, quotations, bookings, jobs, follow-up, balances, warranties, assignments, and customer operations.

### Administration Pages

Prioritise evidence, decisions, queues, risk, history, and traceability over decoration.

## Component Reuse

Before creating a component:

1. Search by purpose and interaction pattern.
2. Inspect existing props and variants.
3. Reuse when suitable.
4. Extend for a legitimate shared variant.
5. Create new only when necessary.

Primitive components belong in the shared UI layer. Domain compositions belong with their domain.

Do not duplicate buttons, status badges, cards, filters, tables, pagination, skeletons, empty states, error states, timelines, drawers, dialogs, or marketplace cards.

The component source is the component registry. Do not maintain a duplicated Markdown component inventory.

## Page Composition

Every page should have a clear purpose and one obvious next action.

Do not force all content into cards. Use sections, lists, tables, timelines, split views, drawers, calendars, or forms according to the workflow.

## Forms

- Use visible labels.
- Mark required fields clearly.
- Place validation errors next to the field.
- Preserve valid input after recoverable failure.
- Group related fields meaningfully.
- Use multi-step flows only when genuinely sequential.
- Use single-column mobile forms.
- Keep primary actions predictable.
- Do not rely on toast-only validation.
- Make immutable records visually read-only.

## Lists, Filters, and Tables

- Use URL state when it improves navigation and shareability.
- Reset pagination after search/filter changes.
- Show active filters.
- Use a mobile sheet for complex filters.
- Default to 10 records per page unless the feature says otherwise.
- Provide loading, empty, no-result, error, and permission states.
- Convert unusable mobile tables into cards or compact lists.

## Feedback States

Every relevant surface deliberately handles:

```txt
Loading
Empty
Filtered no result
Error
Permission restricted
Stale conflict where applicable
Suspended or unavailable where applicable
Success
```

Use Sonner for supplemental global feedback, inline errors for critical problems, skeletons for structural loading, and a compact spinner for short processing.

Consequential actions require confirmation. Success appears only after authoritative success.

## Responsive Priority

```txt
Required action
→ current status
→ essential details
→ communication
→ history
→ statistics
→ decorative imagery
```

Mobile requires intentional layouts, reachable primary actions, 44px touch targets where practical, filter sheets, full-screen complex drawers, and no horizontal overflow.

## Navigation

Use one public navigation system and one authenticated workspace shell. Workspace switching should be visible when relevant.

Team members use permission-limited professional navigation rather than a duplicated shell.

Navigation visibility is not authorization.

## Accessibility

Preserve semantic HTML, logical headings, keyboard access, visible focus, accessible labels, contrast, focus trapping and restoration, associated errors, table headers, busy states, reduced motion, understandable disabled states, text status, and assistive-technology-readable updates.

## Review Policy

Explicit user review is required for:

- The first homepage implementation
- The first public shell
- The first authenticated shell
- A new shared interaction pattern
- A feature-specific mockup that has not yet been validated
- Any material design deviation requested by implementation constraints

Routine pages that correctly inherit approved components and patterns do not automatically require a separate design decision. Misalignment should be raised only when real.
