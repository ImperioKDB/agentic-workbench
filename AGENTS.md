# Agent Operating Instructions

This file provides operating instructions for OpenCode agents and human operators working in the Personal Agentic Workbench repository.

## Scope

This repository is an independent, private OpenCode-native agentic orchestration foundation. It does not modify `ImperioKDB/Scholars`, `ImperioKDB/Scholars-Resource-Centre`, or `ImperioKDB/Updates`.

## Agents

Six agents are registered in `.opencode/agents/` as OpenCode-native custom agent specifications with YAML frontmatter:

- **Orchestrator** (`.opencode/agents/orchestrator.md`) — coordinates workflows, decomposes tasks, delegates to specialists, enforces approval gates
- **Researcher** (`.opencode/agents/researcher.md`) — investigates codebases, researches solutions, produces evidence-based reports
- **Planner** (`.opencode/agents/planner.md`) — converts requirements into implementation plans with acceptance criteria
- **Developer** (`.opencode/agents/developer.md`) — implements approved changes on isolated branches
- **QA Engineer** (`.opencode/agents/qa-engineer.md`) — runs tests, validates behaviour, produces test evidence
- **Reviewer** (`.opencode/agents/reviewer.md`) — independently inspects changes, reviews security and maintainability

Each agent specification contains YAML frontmatter (`name`, `description`, `mode`, `permissions`) and defines its role, responsibilities, permissions, inputs, outputs, handoff rules, and safety boundaries.

### Agent Modes and Permissions

| Agent | Mode | Permissions Summary |
|-------|------|---------------------|
| Orchestrator | primary | Can invoke all 5 specialists as subagents; no edit/shell |
| Researcher | subagent | Read-only; edit/shell/subagent denied |
| Planner | subagent | Read-only; edit/shell/subagent denied |
| Developer | subagent | Read all; edit/shell require approval; git push/commit denied |
| QA Engineer | subagent | Read all; shell node requires approval; edit/shell/subagent denied |
| Reviewer | subagent | Read-only; edit/shell/subagent denied |

Permissions are natively enforced by OpenCode v2.3.0 through `opencode.jsonc` and each agent's frontmatter. The `ask` effect pauses for human approval; `deny` blocks the operation; `allow` permits without prompting.

### Agent Invocation

Agents are invoked via OpenCode's native command:

```bash
opencode run --agent <agent-name> "<message>"
```

Example:
```bash
opencode run --agent researcher "Inspect the repository and report on the agent configuration."
```

Available agent names: `orchestrator`, `researcher`, `planner`, `developer`, `qa-engineer`, `reviewer`.

## Workflows

Six workflows are implemented in `workflows/`:

- **development** — new project development
- **debugging** — bug investigation and resolution
- **auditing** — technical and security auditing
- **research** — research and technology evaluation
- **documentation** — documentation and reporting
- **modification** — existing project modification

Every development workflow follows:
User request → Orchestrator → Researcher (when needed) → Planner → User approval → Developer → QA Engineer → Independent Reviewer → Execution report → Pull request → Human review and merge → Deployment only when separately authorized.

## Human approval requirements

The following operations require explicit human approval before execution:

1. Creating or modifying GitHub repositories under the `ImperioKDB` owner.
2. Merging any pull request in this repository or in `ImperioKDB/Updates`.
3. Beginning Task 003 implementation stages that modify production projects.
4. Rotating, revoking, or replacing any GitHub credential.
5. Any write operation against `ImperioKDB/Scholars` or `ImperioKDB/Scholars-Resource-Centre`.

## Repository isolation

- This repository (`agentic-workbench`) is isolated from `Scholars` and `Scholars-Resource-Centre`. Do not modify those repositories from this context.
- Reporting for this project is published to `ImperioKDB/Updates` on dedicated branches (e.g. `report/agentic-workbench-task-002`). Do not merge reporting pull requests without human approval.

## Credential boundaries

- No authentication tokens, API keys, passwords, or secrets may be committed to this repository.
- `gh auth token` must not be executed.
- Token values must never be printed or written to disk.
- Environment-variable contents containing credentials must never be inspected or printed.

## Directory conventions

- `.opencode/agents/` — OpenCode native agent specifications (implemented; six agents registered with YAML frontmatter)
- `skills/` — OpenCode skills directory (no skills installed).
- `workflows/*/` — Workflow definitions (implemented).
- `projects/*/` — Project-specific configurations (implemented; descriptive only).
- `reports/` — Task execution and verification reports.
- `docs/` — Architecture, security, and roadmap documentation (implemented).

## Task 003 boundary

Task 003 (multi-agent orchestration foundation implementation) is in progress. The repository's initial foundation has been created, committed, pushed, and remotely verified. Agent specifications, workflow definitions, and project configurations are implemented. Documentation, testing, and reporting remain pending.

Do not modify `ImperioKDB/Scholars` or `ImperioKDB/Scholars-Resource-Centre` without explicit human approval.
