# v0.1 beta limitations

Agents currently operate in isolated workspaces. Qelvra coordinates their tasks and results but does not yet automatically merge edits into one shared project repository.

- Local-first, single trusted user; filesystem storage, no authentication, database, cloud hosting or multi-user authorization.
- Real provider availability depends on local installation, compatible CLI flags, configuration and authentication. Only Codex supports real task/goal automation in this beta; other detected CLIs have narrower support described in [providers](providers.md).
- Messaging is at least once. A crash between publication and acknowledgement can recover an existing message; downstream tools must avoid irreversible duplicate actions. Execution retry may repeat partially applied edits. Goal resume preserves completed work but is not a rollback or exactly-once guarantee.
- Workspace cwd is not a full OS sandbox. Provider tools can have broader filesystem/network permissions; review their policies and your results.
- Desktop-first interface; 1280px or wider recommended. Smaller screens expose navigation and core forms but dense previews/terminal panes remain constrained.
- macOS/Linux are the tested beta targets. Windows, non-local hosting and all provider/platform combinations are unverified.
- Studio, Swarm and the older onboarding tour are visual previews. Hardware/context metrics, productivity estimates, terminal steering, shared repositories/automatic merges, backup UI, scheduled goals, cron, event triggers and integrations are coming later. Local scheduled agent tasks are available in v0.2 development; they require a running server and explicit human review.
- Activity memory retention: 10,000 latest events. Disk log stops at 32 MiB with an explicit degraded/capped signal. Snapshots have a 32 MiB startup bound; quarantine has 1,000 entries per agent. Workspace content and preserved deleted-agent data need owner-managed disk/backup maintenance.
- Persistent formats are version 1 and may change before stable release. Unsupported/corrupt snapshots fail startup and remain intact. Keep a stopped-server backup before upgrading.
- Source-run release only. No desktop packaging, installer, npm publishing, telemetry service or production deployment is included.
