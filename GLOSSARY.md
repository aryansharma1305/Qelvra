# Qelvra

Qelvra coordinates agents that work in individual workspaces, exchange messages,
and return results for review.

## Language

**Goal**: A user-requested outcome coordinated through a plan of concrete tasks.

**Plan**: A bounded task breakdown with preferred agent roles and prerequisites.

**Orchestrator**: The agent that proposes plans, reviews task results, and summarizes a goal.

**Worker task**: A concrete piece of a goal performed in the assigned agent's workspace.

**Decision task**: A task whose result proposes a plan, review decision, or final summary.

**Execution attempt**: One provider invocation for a task, with its own correlated result.

**Review**: An assessment of a returned result that approves it, requests rework, or rejects it.

**Artifact claim**: A result's reported file path in its agent's workspace, without independent diff verification.
