# PR 23 Automations surface audit

Automations extends Operate with persistent scheduled agent tasks and inspectable human
review. It inherits Qelvra's existing shell and visual system; it establishes no new
global tokens or component rules.

## Surface contract

- Save a disabled task template, then explicitly enable its schedule or use Run now.
- Show the local-server requirement, skipped missed/busy occurrences and human-review
  outcome near the heading and actions.
- On desktop, place the saved list beside the selected template, cadence and run history;
  stack these sections on mobile. Forms use native inputs, selects and UTC date/time fields.
- Link recorded outcomes to generated tasks. Give failures a recovery explanation and
  provider-status link. After interruption, require acknowledgement before new admission.
- Keep enabled, disabled, failed and awaiting-review states distinct in wording.

## Documentation audit

Checked `AutomationsPage.tsx` and `AutomationForm.tsx` against Settings, Memory,
NetworkHeader, Network presentation controls, AppShell, `index.css`, `fonts.css` and
`apps/web/tailwind.config.ts`. The surface reuses the runtime purple primary, dark tonal
surfaces, muted text, error color, inherited Geist/JetBrains Mono typography, focus
outlines, wrapped actions and existing rounded controls. Its buttons retain Network's
44px minimum height; its form panel follows Settings' low surface, border and spacing.

Inspected all four local verification captures in `.impeccable/review/automations/`:
`desktop.png`, `mobile.png`, `desktop-form.png` and `mobile-form.png`. They show a real
failed Fake-provider run, recovery guidance, generated-task link and native edit form.
`tests/design/automations.spec.ts` owns separate disposable storage, renders real API
responses after a Fake failure, and checks desktop/mobile overflow and primary text
color. The final captures show “Up to 500 run records retained”. They are verification
evidence, not shipped imagery.

There is no root/app `PRODUCT.md` or `DESIGN.md`. Existing reference material lives in
`design/stitch/DESIGN.md`, `DESIGN.variant-2.md` and ADR 0002. Pre-existing reference drift
remains: DESIGN.md's prose primary/button colors and radii differ from its frontmatter
and the runtime Tailwind overrides; variant-2 uses a separate palette. Existing shell
eyebrows and Material Symbols are inherited context, not new recommendations. None of
these differences is canonized or repaired by this ordinary extension.

Reviewer disposition supplied to this audit: **ship**, with the recovery finding resolved.
Documentation disposition: preserve the incumbent system and retain this surface contract.
