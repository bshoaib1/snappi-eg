# Snappi Live design system

This file is the styling contract for every page, pop-up, and connection created inside **Snappi Live**. Build new work from scratch in this folder and reuse the shared classes imported through `styles.css`; do not copy code from older Snappi folders.

## Brand foundation

| Purpose | Value |
|---|---|
| Primary purple | `#8116E0` |
| Deep purple | `#510E8C` |
| Neon lime | `#D4FF3A` |
| Off-white | `#FEFFFC` |
| Page neutral | `#F8F9FA` |
| Primary ink | `#0B0B0B` |
| Typeface | Urbanist, loaded from Google Fonts |

The source variables are at the top of `styles/foundation.css`. Change a token there only when the change should affect the whole website. `styles.css` imports the ordered modules and should remain a small entry file.

## Required public-page color hierarchy

Use this hierarchy for every new public page and section unless a later approved design explicitly replaces it:

- Default page and section background: `#FEFFFC`.
- Main headings and primary copy: `#000000`.
- Supporting copy: a readable neutral grey, normally `#5F5F5F`.
- Purple `#8116E0`: kickers, step numbers, links, focused controls, and selective emphasis.
- Lime `#D4FF3A`: primary actions and limited high-visibility accents.
- Keep large public content surfaces light. Do not introduce full purple, black, or dark section backgrounds without explicit approval.
- Never place white or pale text on an off-white, lime, or similarly light surface.
- Check every text/background combination for clear contrast before completing a page.

The approved closing CTA pattern uses an off-white surface, a purple kicker, a black heading, and matching lime capsule buttons. Reuse `.standard-closing-cta` instead of creating a separate closing style for each new page.

## Page anatomy

Every public page should use this order when applicable:

1. Announcement strip
2. Shared sticky header and navigation
3. One clear page hero
4. Main content in logical sections
5. Support or contact path
6. Shared footer
7. Shared modal markup when that page opens a modal
8. `site.js` loaded with `defer`

Use `.section-pad` for page-width spacing. Use `.section-heading` for the introduction to each section. The required order is kicker, heading, then description.

## Typography

- `.kicker` — small uppercase orientation label, including an optional leading emoji.
- `h1` — one primary page statement.
- `h2` — section heading.
- `h3` — card or component title.
- Body copy should remain concise and use the inherited Urbanist styles.
- Use `.section-heading-center` or `.section-heading-right` only when the section composition requires it.

## Buttons and links

- `.button.button-lime` — primary action.
- `.button.button-dark` — strong secondary action.
- `.button.button-outline-light` — action on dark or purple surfaces.
- `.text-link` — quiet supporting action.
- Add `data-modal-open="campaign"` or `data-modal-open="login"` to open an existing modal.
- Add `data-package="Starter|Growth|Premium"` to preselect a package.
- Use `data-disabled-action` only for a deliberately unavailable action.

## Cards and surfaces

Cards use thin borders, generous rounded corners, light backgrounds, and restrained shadows. Do not add heavy shadows. Hover motion should lift a card by a few pixels and preserve readable contrast. Package-card behavior is grouped under `PACKAGE CARD HOVER` in `styles/public.css`.

## Closing CTA

- Wrap the section with `.standard-closing-cta.section-pad`.
- Use one `.kicker`, followed by one `h2`, followed by the action group.
- Use `.standard-closing-actions` for two or more actions.
- Give every action the same `.button.button-lime` treatment unless one action is intentionally less important.
- Keep action labels short and make the destination or behavior explicit.

## Pop-ups

The approved pop-up is the **Snappi Modal System**:

- Purple panel
- Blurred dark backdrop
- Lime pulse marker and action
- Permanently visible field labels
- Glass text fields
- Native package dropdown
- Circular close control
- Escape and backdrop-click closing
- Scroll lock while open
- Reduced-motion support

Reuse `.snappi-modal`, `.snappi-modal-panel`, `.snappi-modal-form`, `.snappi-input`, and `.snappi-modal-submit`. The animated loading indicator uses `.typing-indicator`, three `.typing-circle` elements, and three `.typing-shadow` elements.

## Motion and accessibility

- Use the existing reveal and component transitions instead of introducing a second animation system.
- Keep transitions near 180–300ms.
- Every interactive control needs a visible focus state.
- Maintain readable contrast between text and background.
- Add meaningful `alt` text to content images; use empty `alt` only for purely decorative images.
- Honor `prefers-reduced-motion` for new motion.
- Pop-ups need an accessible title, labelled close button, and status region for asynchronous actions.

## Responsive behavior

Check at minimum:

- 375px mobile
- 768px tablet
- 1024px small desktop
- 1440px desktop

Avoid fixed text heights. Use `clamp()` for important responsive typography and spacing. Forms become one column on small screens.

## New page procedure

1. Copy `page-template.html.example` to the new lowercase filename.
2. Update title, description, canonical URL, and page-specific content.
3. Keep the shared header, footer, stylesheet, and script references.
4. Reuse shared patterns, including `.standard-closing-cta`, before adding page-specific CSS to the matching file under `styles/`.
5. Add page styling to the matching file in `styles/`, then add page behavior under one clearly named section in `site.js`.
6. Add the page to navigation, footer, `sitemap.xml`, and the 404 recovery path if relevant.
7. Validate HTML, CSS braces, JavaScript syntax, links, mobile layout, focus behavior, and reduced motion.
8. Increment the `?v=` value when changing CSS or JavaScript so published browsers receive the update.
