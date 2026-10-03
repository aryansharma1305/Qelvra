# PR 7 terminal layout verification

## Measured regression

Measured the original, unmodified Stitch markup and live `/terminal` using the same
Chromium browser, 900px viewport height, loaded fonts, and six registered agents.

| Viewport | Pane x | Reference y | Before y | Pane width | Pane height | Context width | Command bar reference y |
| -------- | ------ | ----------- | -------- | ---------- | ----------- | ------------- | ----------------------- |
| 1280     | 248    | 335         | 285      | 328        | 460         | 328           | 807                     |
| 1440     | 248    | 305         | 255      | 381.328125 | 460         | 381.34375     | 777                     |
| 1920     | 248    | 255         | 255      | 541.328125 | 460         | 541.34375     | 727                     |

The grid and horizontal dimensions were already correct: 24px outer padding,
12px grid gaps, eight terminal columns and four context columns, a 48px app header,
14px pane-body insets, and 410px terminal bodies. No new borders were involved.
At the two smaller sizes, short real statuses collapsed the tab row from 80px to
60px, and the short task/provider text let the telemetry strip stop wrapping,
collapsing it from 68px to 38px. The combined reduction moved everything below up
50px. The title bar also collapsed from 44px to 32px in those viewports.

## Fix

Reserve the compact and expanded tab/title rows according to workspace capacity,
not agent text length. Retain the task and telemetry content budgets with flex
bases so the original two-row strip wraps naturally. Keep the approved outer grid
and the full-width single view within its eight-column terminal region. Bound
pane and xterm dimensions; truncate titles and keep errors scrollable inside the
terminal body. Re-measurement confirms the pane, body, context, command bar, root,
header, tabs and strip rectangles match at all three requested widths.

## Difference classification

The three original diffs were inspected at 1280, 1440 and 1920 before edits.

| Area                                                                                     | Classification                  | Treatment                                                   |
| ---------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------- |
| Active session count, tab runtime summaries, CPU/PID/activity text and state dots        | Dynamic runtime data            | Normalize specific content during capture only              |
| Agent names, roles and order                                                             | Deterministic product data      | Seed the reference agents through the real API              |
| Task assignment label/description, provider/model and context usage                      | Dynamic assignment/runtime data | Normalize specific strings, usage tint and fill percentage  |
| Update timer                                                                             | Dynamic runtime data            | Normalize its text; production clock continues running      |
| Shell name, cwd, connection status and dimensions                                        | Dynamic runtime data            | Normalize only metadata fields/badge contents               |
| Shell output and stopped/loading/error notices inside the terminal viewport              | Dynamic runtime data            | Mask viewport interiors only                                |
| Tab close glyphs, new-session label, name/role wrapping, font weights and role accents   | Static chrome                   | Restore production chrome; leave unmasked                   |
| Second-pane traffic lights, title colour, badge background/padding and header height     | Static chrome                   | Restore production chrome; leave unmasked                   |
| Grid/pane/header/body coordinates and dimensions, padding, gaps, borders and backgrounds | Static layout/chrome            | Check against independent reference measurements and pixels |
| Command bar and context panel                                                            | Static/deferred design mock     | Compare unchanged, unmasked                                 |

## Deterministic fixture

Design setup registers exactly these five agents, in this order, through the real
REST API: Nova (Frontend), Scout (QA / E2E), Michael (Orchestrator), Atlas (Backend),
and Pixel (Design System). They remain stopped: the fictional CPU/task states in
the export cannot be achieved without implementing deferred provider/task work.
The developer shell still connects to a real PTY.

`AgentRegistry.list()` orders by `createdAt`, then `id`; sequential registration
uses the registry's monotonic timestamp contract. The test parses the real list
response with `AgentListResponseSchema` and asserts the exact IDs, names, roles and
order, including when another design worker received 409 for an existing fixture.
No API or WebSocket response is mocked. Production contains no fixture names.

## Normalization policy

The original Stitch files remain an independent source of truth and are not
regenerated. They use static demonstration data; production uses real agent/runtime
data. `tests/design/terminal-parity.ts` normalizes only the following capture data:

1. The toolbar active-count span (its dot, background, font and padding remain).
2. `[data-terminal-summary]` descendants: the reference CPU/PID/activity strings and
   their state indicators. The surrounding row, tab, role badge, avatar, close glyph,
   font classes, spacing, shadow and background are never replaced or masked.
3. The task-state label (`Task in Flight` becomes the neutral `Task`) and description
   span. The task badge's icon, style and resulting deterministic dimensions remain
   pixel-compared.
4. `#elapsed-counter` text. A capture-only observer keeps this exact text stable
   while React's clock keeps running. No production clock is frozen.
5. The provider/model text, context usage text/usage tint, and percentage fill inside
   the existing track. Track bounds, colour, radius, typography, memory/schedule
   icons, separators and enclave badge remain compared.
6. Pane title/cwd text (neutral `agent`/`shell` and `workspace`), first-pane runtime
   label/state tint/dot and grid dimensions (`PTY`, `80x24`), and developer-session
   badge contents (`PTY`). No outer header, class list or style sheet is copied from
   the reference into the app. Badge background/padding/radius and traffic lights
   remain compared.
7. Reference demonstration output is cleared inside each body after reserving its
   independently declared `max-height: 410px` viewport. This prevents scrolled demo
   log fragments from painting into the unmasked bottom padding. Short neutral
   metadata keeps the reference header's original measured height; only reference
   sizing is retained, never live sizing copied into the expected image.

Only the interiors of `#nova-terminal-body` and `#dev-shell-body` are pixel-masked,
with a 14px inset on every edge. The previous entire-agent-pane mask is removed.
Viewport bounds are compared before masking, and all viewport padding remains
visible. No toolbar, tab, badge, row, pane/header, command bar or context panel is
masked. The pre-existing global header live-count text mask is unchanged.

Before and after normalization, 15 independently measured reference surfaces are
checked for x/y/width/height and padding; terminal grids also retain gap/column
checks. These include both pane frames/headers, the first viewport, the app header,
workspace, toolbar, tabs, task strip, main/split grids, command bar and context.
Both viewport bounds are checked by the pixel harness. The original 0.5px geometry
tolerance, 300-pixel mismatch ceiling and pixelmatch threshold 0.1 are unchanged.
There is no new clipping, skipped viewport, or reference replacement.

Design tests verify visual structure; functional/E2E tests verify truthful runtime
data, lifecycle actions, output isolation and attachment ownership. Any new
normalization must identify a real runtime field and retain its enclosing chrome.

## Verification

Focused terminal parity passes 3/3. The resulting compared screenshots were
inspected once at all three widths. A temporary capture-time CSS mutation reduced
`#live-terminal-pane` width by 10px at 1440; the geometry assertion rejected it
(`Received: 10`, allowed 0.5). The test file was restored byte-for-byte immediately
in a `finally` block; no mutation hook is shipped.

Final verification passed:

- Focused terminal parity: 3/3 at 1280, 1440 and 1920.
- Full design suite: 42/42, with unchanged references and thresholds.
- Unit/integration suite: 287/287 across 21 files.
- Browser E2E suite: 61/61, including the eight agent-terminal flows.
- Formatting, lint, type checking and production build: passed.

The first full browser run exposed two test readiness races: shell input before
the first prompt and an onboarding shortcut before route controls mounted. Tests
now wait for the actual prompt/focus and route controls before sending input;
output, isolation, lifecycle and navigation assertions remain intact. The final
full browser run passed without retries. Post-suite process inspection found no
remaining test servers, Playwright browsers or test PTY shell/foreground processes.

PR 7's functional and design verification is complete. PR 8 remains out of scope.
