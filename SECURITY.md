# Security in the local beta

Qelvra assumes a trusted single user on a trusted local machine. It binds to `127.0.0.1` by default and has **no API authentication**. Do not expose it to the internet or an untrusted network. Non-local HOST settings produce a warning; CORS/origin checks are not authentication.

HTTP browser origins are validated before route handlers. Terminal and Activity WebSockets require an exact allowed origin and enforce bounded frames/protocols. Loopback deployments reject non-loopback Host headers. API responses use no-store, nosniff, DENY framing and no-referrer defaults. Only deliberately configured WEB_ORIGIN values are trusted. A local CLI without an Origin is trusted under this machine-local model.

Qelvra runs local AI tooling with access to its assigned workspace. **Workspace cwd is not a full OS sandbox.** Providers determine their own filesystem/network permissions and approval policies. Browser input cannot choose executables/args/cwd; task and goal text is provider input. Path checks refuse traversal and symlink escapes for Qelvra-managed files, but cannot constrain every operation a third-party CLI performs.

Provider credentials remain provider-owned. Qelvra stores local agent/task/goal/result state under DATA_DIR. Task descriptions and result summaries can contain sensitive information. Terminal data is streamed to its viewer; it is not stored in Activity. Activity uses bounded metadata and omits prompt bodies, terminal output, provider credentials and environment dumps. Routine request URLs/headers are not logged. Server errors retain controlled codes and unexpected technical details for local diagnostics; treat DATA_DIR and your terminal as sensitive.

External AI provider data handling depends on the chosen provider. Qelvra does not make third-party requests private or guarantee zero egress. Default file permissions protect new local state; the machine's account/OS permissions and backups remain your responsibility.

Server source maps are retained alongside local server bundles for debugging and are not served over HTTP. The web build does not publish source maps. Test fixtures and reset routes are not production features; Fake agent is disabled in production.

For suspected vulnerabilities, use the repository's GitHub **private vulnerability reporting** feature if enabled. If unavailable, contact the repository owner privately through an existing channel. No dedicated security mailbox has been configured; do not put credentials, sensitive reproductions or exploit details in a public issue. Report the affected commit, platform and a minimal disposable reproduction. This focused release audit is not a penetration-test certification or a guarantee against unknown vulnerabilities.

## Development dependency advisory

The October 6 audit reports five high-severity dependency entries, all arising from one unpatched `braces` issue in the pinned Tailwind 3 development toolchain: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The advisory lists no patched braces version. Deeply nested attacker-supplied glob patterns can exhaust the stack. Qelvra's Tailwind content globs are fixed in the checked-in configuration; tasks, goal text and workspace files do not supply those patterns. The runtime server uses Chokidar 4, which has no braces dependency. `npm audit --omit=dev` reports zero advisories on this candidate.

This is a P2 development-tooling limitation, not a clean full-audit claim. Only run builds with trusted configuration. A Tailwind major migration is deferred because it changes the approved rendering toolchain; no blind `npm audit fix --force` or unsupported dependency override is applied. Reassess when an upstream compatible fix exists.
