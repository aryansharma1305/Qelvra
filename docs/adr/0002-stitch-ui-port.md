# ADR 0002: Porting the Stitch design into React

- Status: accepted
- Date: 2026-10-02

## Context

The approved UI is a Stitch export: 14 static HTML screens (plus a brand mark) that each
inline the Tailwind Play CDN, a theme config and small demo scripts. The product must stay
visually identical to it while becoming a routed React app with real behaviour.

## Decision

- **Source of truth lives in the repo** at `design/stitch/` (each screen's `code.html` and
  the design system `DESIGN.md`). Screenshots are not committed (18 MB).
- **Tailwind is pinned to 3.4.17**, the version the Play CDN serves, with the export's
  theme copied verbatim into `apps/web/tailwind.config.ts`. Tailwind 4 renders the same
  class names differently (default border colour, `ring` width, shadow/radius scales, the
  overridden `rounded-full`), which would break visual parity. This replaces the v4 setup
  from ADR 0001.
- **Mechanical HTML→JSX conversion** preserved every class, inline style, SVG attribute and
  render-relevant whitespace. Pages were split into section components; shared chrome became
  `AppShell` (header + sidebar) and `OnboardingShell`.
- **One canonical sidebar**: the export has two sidebar styles. We use the icon style with
  the filled active pill (Home/Swarm screens). "AI Studio" (icon `view_in_ar`) and
  "Agent Network" (from the network screen) are included so every designed screen is
  reachable.
- **Fonts**: the onboarding screens request `JetBrains Mono:wght@100..900`, which Google
  Fonts silently drops (the family stops at 800), so their monospace text rendered in a serif
  fallback. DESIGN.md specifies JetBrains Mono, so the app uses the app screens' working
  weights everywhere.
- **Fonts are self-hosted** (`apps/web/src/assets/fonts`, `src/styles/fonts.css`): the exact
  WOFF2 files Google Fonts serves for those stylesheets (Geist and JetBrains Mono under OFL
  1.1, Material Symbols under Apache 2.0), so the local-first app needs no network and cannot
  drift from what was verified. ~1.2 MB, mostly the Material Symbols icon font.
- **Remote images** (googleusercontent URLs that may expire) were downloaded to
  `apps/web/public/stitch/`; byte-identical duplicates were merged.
- **Behaviour**: the export's demo scripts were re-implemented as React state only where they
  express real UI behaviour (filters, tabs, drawers, wizard steps, selection, zoom). Scripts
  that faked backend activity (fake command output, tickers, "provisioned!" toasts, timers)
  were not ported; the real features replace them in later milestones.
- **Mock data is centralised** in `apps/web/src/mocks/` (`agents.tsx`, `tasks.tsx`,
  `activity.tsx`), typed against `@qelvra/shared` (`AgentId`, `TaskStatus`). Repeated design
  markup (agent cards on Agents/Home/Swarm, Kanban cards, activity items) was extracted into
  components rendered from that data. Per-item visual differences in the design (status
  colours, bar widths) are kept as explicit `tone` tokens so rendering stays identical. The
  extraction was verified by comparing every route's DOM before and after (identical apart
  from added link/ARIA attributes). Single bespoke widgets (e.g. the orchestrator card, the
  three distinct Working-column cards) keep their designed markup.
- Each remaining mock is marked with a `TODO(PR n)` naming the milestone that replaces it.

## Verification

`npm run test:design` renders each Stitch screen and its route in the same browser, at
1280, 1440 and 1920 px wide, and fails if a region differs by more than 300 pixels
(residual antialiasing is ≤ ~160). The
sidebar column is excluded on app screens because of the canonical-sidebar decision.

## Consequences

- Section components are large static markup until their data is wired; that is expected
  and shrinks as features land (e.g. six static agent cards → one `AgentCard` in PR 6).
- UI changes should be checked with `npm run test:design`; intentional design changes need
  the corresponding `design/stitch` source updated.
