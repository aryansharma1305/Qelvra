# Projects surface contract

Mode: Operate. Ordinary extension of Qelvra's existing Files and Settings surfaces.

Preserve the dark shell, existing headline/body/code type tokens, violet actions,
cyan secondary accents, native labelled form controls and keyboard focus rings.
The information hierarchy is registration → registered repository list → selected
repository inspection. Use a list/detail composition on desktop; stack on mobile.
No invented hero metrics, graph, project execution controls or promotional claims.

Persistent values only: canonical server path, last inspection time, availability,
HEAD state, tracked staged/unstaged counts and bounded local branch names. State
explicitly that untracked files/submodule worktrees are excluded, GET is cached,
and existing agents remain isolated. Errors supply recovery; unregister requires
inline confirmation and removes metadata only. No polling Git inspections.

Entry: Projects link from Files. No global shell redesign. Mobile must have no
horizontal document overflow; long paths/branches wrap within the detail pane.

## Finished extension evidence

Checked `apps/web/src/pages/projects/ProjectsPage.tsx`, the Projects entry link in
`apps/web/src/pages/files/FilesPage.tsx`, incumbent Files and Settings components,
`apps/web/tailwind.config.ts`, and `apps/web/src/index.css`. Visually inspected
`.impeccable/review/projects/desktop.png` and `mobile.png`, captured for 1440 × 900
and 390 × 844 viewports by `tests/design/projects.spec.ts`.

The available-repository captures show registration before the registered list
and selected details. Desktop uses list/detail columns; mobile stacks the form,
list and details. The long canonical path and commit wrap inside the detail
panel, and the focused display-name field has the existing violet outline.
The capture test asserts document width, detail-pane width, action text color
and keyboard-focus outline. This documentation pass inspected its source and
saved output; it did not rerun the test or open a browser.

Source inspection confirms labelled native inputs, loading/status and error
announcements, retry/reload actions, explicit snapshot freshness, manual
inspection refresh, exclusion copy, unavailable-repository recovery and inline
unregister confirmation. These states are not all represented in the two saved
captures. The supplied fresh review disposition is **ship**, with no material
issues; the supplied detector result is `[]`.

## Comparison with the incumbent system

Projects preserves the existing shell and token source. It reuses Geist
headline/body roles, JetBrains Mono repository values, dark tonal panels and
fields, violet primary actions, muted supporting text, error color, compact
button corners and panel corners. Cyan remains in the incumbent shell rather
than becoming a new decoration in repository details. Labelled inputs and
focus/disabled behavior follow Files; metadata and explanatory copy follow
Settings. The Files entry link uses the existing violet link treatment.

Page-local differences serve the registration and inspection task: a wider
desktop detail column, a separate registration panel, a selected repository
row, and borderless tonal panels rather than Settings' outlined panels.
They do not establish new global tokens or replace the application's visual
identity.

## Existing documentation and token gaps

`PRODUCT.md` and `DESIGN.md` are absent. Existing Tailwind and font comments
reference `DESIGN.md`; that documentation gap predates this extension. The
incumbent Analytics and Network surfaces use `text-title-md`, but the Tailwind
configuration defines no matching title role. Projects' Local branches heading uses the defined body size and medium weight
utilities; no new title token is introduced. This records pre-existing drift
without repairing unrelated pages.

This ordinary Operate extension preserves the global system files and records
its direction and finished evidence only in this surface contract.
