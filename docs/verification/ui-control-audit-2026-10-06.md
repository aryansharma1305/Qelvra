# UI control audit — final release-blocker resolution

The owner requested a narrow cleanup on October 6, 2026 after the initial screenshot audit found disconnected controls. The implementation preserves the existing layout/theme and working Goal/zoom/operative-selection flows. No major product feature was added.

## Every audited control and final state

| Control                | Final state   | User-visible and accessible behavior                                                                                                                                 |
| ---------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autonomous Delegations | Disabled      | Native disabled switch, checked=false, descriptive name/help. Per-agent delegation is future work; the explanation explicitly preserves approved Goal orchestration. |
| Episodic Vector Memory | Informational | Static Not available yet / Coming later; no editable field, click handler or implied vector/enclave implementation.                                                  |
| Lo-Fi Play             | Disabled      | Native disabled button named Play Studio audio — coming later; associated playback/volume explanation.                                                               |
| Lo-Fi Volume           | Disabled      | Native disabled slider with a meaningful name, help text and future-playback explanation. It can no longer move independently of audio.                              |
| Zone controls          | Informational | Plain Sample zones labels; no button role, active selection, hover styling or state-only click handler.                                                              |
| Command View           | Disabled      | Native disabled button with Command View — coming later and a planned-feature explanation. Meaningless selection state removed.                                      |
| Isometric 3D           | Disabled      | Fixed visual-preview indicator, with an accessible explanation that the isometric drawing is fixed. Zoom remains available.                                          |
| Plan 2D                | Disabled      | Native disabled button named Plan 2D — coming later, with a top-down-view explanation. Superficial perspective transform/state removed.                              |
| Midnight Pulse         | Informational | Static decorative atmosphere copy, without a button/select role, dropdown or hover behavior.                                                                         |
| Attach files           | Disabled      | Native disabled button; accessible label/help says file attachments are coming in a future release.                                                                  |
| Voice                  | Disabled      | Native disabled button with name/help explaining future availability. No microphone permission or capture code is introduced.                                        |
| Home Project           | Informational | Isolated workspaces chip; dropdown arrow and hover affordance removed. No project subsystem added.                                                                   |
| Home Orchestrator      | Informational | Choose in Goals instruction; dropdown arrow and hover affordance removed. The real picker remains in Goals.                                                          |
| Create Goal            | Functional    | Preserves text transfer from Home into both goal fields. Saving, planning and running remain explicit operations.                                                    |
| Zoom                   | Functional    | Sample scene scales in ten-point steps within the existing 60–160% range.                                                                                            |
| Fit / Reset Zoom       | Functional    | Renamed Reset Zoom, with an accessible name/title; restores 100%, without claiming viewport fitting.                                                                 |

Studio View is also a disabled fixed-preview indicator. Sample-operative selection still changes the inspector. Static workspace/profile header chrome loses false dropdown arrows. Preview mesh/airflow values say Not measured.

## Implementation and accessibility

No unavailable subsystem was implemented. The only behavior changes remove misleading selection/transform handlers and prevent disconnected slider input. Existing goal transfer, actual preview scaling and operative inspection are preserved.

Disabled controls use native disabled semantics, meaningful accessible names and explicit help through title and/or aria-describedby. They cannot be activated through keyboard or pointer input; disabled states do not depend solely on opacity. Informational labels have no interactive role or handler. Workspace field labels are spans rather than labels for nonexistent inputs; the folder icon no longer advertises clicking.

## Regression coverage and evidence

The existing Studio browser check now verifies real zoom/reset and operative inspection while requiring unavailable views/audio to be disabled. Two additional checks cover Home draft transfer and the disabled per-agent delegation explanation. The release flagship still exercises Home → Goals → draft → plan → approved run. No existing browser case was removed.

The initial targeted Home test exposed a locator issue: exact label matching included the textarea's initial child text. The rendered goal values were correct; selecting by the accessible textbox role/name resolves the check. No application timeout or retry was changed.

Opt-in local captures cover Home, Studio, Workspace and replacement avatars at 1440 and 390 pixels. The design references apply only the [documented owner-approved changes](../release/pr17-blocker-cleanup.md), without new masks or wider limits. The incumbent heading gradient is the detector's sole finding; it is preserved as an existing design choice under the no-redesign brief.

## Distribution assets

All seven unverified artwork entries are REPLACED. Five original abstract avatars and one original Qelvra mark replace their slots; both old logo entries map to that mark. [Asset audit](../release/asset-audit.md) and [exact provenance/hashes](../release/asset-audit.json) identify every decision. The retired files and remote image references are removed; no dependency/font license is altered.

Full test, design, production, release-check results and final commit/CI receipt are recorded in [PR17 verification](pr17-release-hardening.md) and the final handoff. No release tag is created by this cleanup.
