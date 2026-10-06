# Contributing

Use Node 22 (`nvm use` if installed), `npm ci`, then `npm run dev`. Follow the top-level README for provider setup and supported local execution. Work against disposable DATA_DIR values in tests; never reset a developer's persistent state.

Before a PR: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and zero-retry browser/design checks from README. Validate affected lifecycle/security contracts and report exact commands/results. Native paid-provider checks are local-only and require a configured account.

Keep API/persistence Zod contracts in `packages/shared`, UI access through the existing API/store layers, and executable/path policy on the server. Preserve the approved desktop design: document intentional truth/copy changes; do not replace design references or increase pixel tolerance to hide regressions. Use meaningful public-interface tests for behavioral changes.

Do not add cloud accounts, a database, shared workspace merging, new providers or packaging as incidental release hardening. Preserve failed state; never silently migrate/reset user data. The license decision and public release remain blocked until the repository owner chooses a license.
