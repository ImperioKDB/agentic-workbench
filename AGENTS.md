# Agent Operating Instructions

This file provides operating instructions for OpenCode agents and human operators working in the Personal Agentic Workbench repository.

## Scope

This repository is an independent, public OpenCode-native agentic orchestration foundation. It does not modify `ImperioKDB/Scholars`, `ImperioKDB/Scholars-Resource-Centre`, or `ImperioKDB/Updates`.

## Agents

Seven agents are implemented in `agents/`:

- **Orchestrator** (`agents/orchestrator.md`) — coordinates workflows, decomposes tasks, delegates to specialists, enforces approval gates
- **Researcher** (`agents/researcher.md`) — investigates codebases, researches solutions, produces evidence-based reports
- **Planner** (`agents/planner.md`) — converts requirements into implementation plans with acceptance criteria
- **Developer** (`agents/developer.md`) — implements approved changes on isolated branches
- **QA Engineer** (`agents/qa-engineer.md`) — runs tests, validates behaviour, produces test evidence
- **Reviewer** (`agents/reviewer.md`) — independently inspects changes, reviews security and maintainability
- **Reporter** (`agents/reporter.md`) — receives execution evidence, produces structured Markdown reports, maintains persistent task histories

Each agent specification defines its role, responsibilities, permissions, inputs, outputs, handoff rules, and safety boundaries.

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

## Mandatory Reporting Protocol

Every substantive task must conclude with a Markdown execution report containing:
- Task ID and title
- Objective and scope
- Repository and branch
- Starting and ending commit references, where applicable
- Participating agents
- Actual delegation and handoff evidence
- Files inspected
- Files created or modified
- Decisions and their justification
- Implementation summary
- Tests performed and actual results
- Security and regression findings
- Unresolved issues
- Limitations and blockers
- Outstanding human approvals
- Recommended next steps
- Final completion verdict

For Workbench assignments, store reports at `reports/TASK-ID-descriptive-title.md`.
Unless explicitly restricted by the user, authorization to implement a substantive task includes authorization to publish its sanitized report and approved changes to the designated feature branch. This does not authorize direct pushes to main, merges, deployments, production changes, or unrelated repository writes.

Every completed assignment must:
1. Create the report.
2. Verify its contents.
3. Commit only authorized files.
4. Push to the designated branch.
5. Independently verify the remote commit.
6. Provide the full commit SHA.
7. Provide the direct GitHub commit URL.
8. Provide the direct GitHub report URL.

Reporter produces the report. Git publication must occur through a narrowly authorized human-controlled operation or a properly restricted mechanism.

Do not require the user to repeat publication approval when that authorization is already explicitly included in the task.

Never claim completion when required publication is incomplete.

If publication is blocked, retain the local report and report the exact blocker.

## Dependency-Aware Orchestration

- Independent tasks may run concurrently.
- Dependent tasks must not start until required outputs are actually received.
- Planner must receive Researcher findings where research is required.
- Developer must receive an approved implementation plan.
- QA must receive implementation evidence and acceptance criteria.
- Reviewer must receive the implementation and QA evidence.
- Reporter must receive the final execution evidence.
- Orchestrator must record actual subagent invocations and failed handoffs. Specialist responses must not be simulated.

## Human approval requirements

The following operations require explicit human approval before execution:

1. Creating or modifying GitHub repositories under the `ImperioKDB` owner.
2. Merging any pull request in this repository or in `ImperioKDB/Updates`.
3. Beginning Task 003 implementation stages that modify production projects.
4. Rotating, revoking, or replacing any GitHub credential.
5. Any write operation against `ImperioKDB/Scholars` or `ImperioKDB/Scholars-Resource-Centre`.
6. Publishing execution reports to GitHub.

## Repository isolation

- This repository (`agentic-workbench`) is isolated from `Scholars` and `Scholars-Resource-Centre`. Do not modify those repositories from this context.
- Reporting for this project is published to the designated feature branch on dedicated reporting branches. Do not merge reporting pull requests without human approval.

## Credential boundaries

- No authentication tokens, API keys, passwords, or secrets may be committed to this repository.
- `gh auth token` must not be executed.
- Token values must never be printed or written to disk.
- Environment-variable contents containing credentials must never be inspected or printed.

## Directory conventions

- `agents/` — OpenCode agent specifications (implemented).
- `skills/` — OpenCode skills directory (no skills installed).
- `workflows/*/` — Workflow definitions (implemented).
- `projects/*/` — Project-specific configurations and templates (implemented; descriptive only).
- `projects/project-context-template.json` — Template for project-scoped Workbench integration context.
- `reports/` — Task execution and verification reports.
- `docs/` — Architecture, security, and roadmap documentation (implemented).
- `scripts/` — Reusable scripts, including the Workbench adapter.

## Project-Scoped Workbench Integration

The Workbench supports project-scoped integration: a target project directory can be configured with
its own project-level `.opencode.json` that registers the seven Workbench agents (orchestrator,
researcher, planner, developer, qa-engineer, reviewer, reporter) using `system: {file:<ABS>/agents/<name>.md}`.
Each agent spec is authored in the Workbench repository (`agents/`) and referenced by absolute path from
the generated project config. The orchestrator runs in `primary` mode; all specialists run in `subagent` mode.

### Adapter script (`scripts/workbench-adapter.js`)

The adapter generates a project-scoped `.opencode.json` for a target project directory.

Usage:
```
node scripts/workbench-adapter.js <target> [--workbench-root <root>] [--dry-run] [--rollback] [--force]
```

- `<target>` — Target project directory to configure.
- `--workbench-root <root>` — Path to the Workbench repository root (default: parent of this script).
- `--dry-run` — Print planned actions; write nothing.
- `--rollback` — Restore the prior config from the most recent timestamped backup.
- `--force` — Overwrite an existing `<target>/.opencode.json`.

Behavior:
- Validates the Workbench root contains all seven agent files.
- Validates each agent path canonicalizes and is contained within `--workbench-root/agents/`.
- Detects an existing `<target>/.opencode.json`; refuses to overwrite unless `--force` is given.
- Idempotent: re-running without `--force` detects the existing config and exits cleanly.
- Backs up any pre-existing config to `<target>/.workbench-backups/<timestamp>/` with a SHA-256 manifest.
- Writes to a temp file then renames for atomicity.
- Rollback restores the prior config byte-for-byte and validates the hash before restore.
- Zero npm dependencies (Node built-ins only).
- Preserves the deny-* baseline; ask rules for Developer/QA shell/edit; Reporter edit restricted to `reports/*`.
- No credentials, no provider settings, no machine-specific paths committed to the app repo.

### Project-context template (`projects/project-context-template.json`)

A project deploying the Workbench uses `projects/project-context-template.json` to capture its
project-specific context. It contains nine fields:

1. `identity` — Project name and short description.
2. `tech_stack` — Primary languages, frameworks, libraries, and tooling versions.
3. `architectural_constraints` — Architectural patterns, module boundaries, layering rules, integration points.
4. `dev_test_commands` — Local development, lint, type-check, test, and build commands.
5. `production_safety_boundaries` — Deployment restrictions, production access rules, rollback procedures.
6. `approved_file_modification_scope` — Directories and file patterns the agent may modify.
7. `existing_skills` — Skills already installed or available to the project.
8. `reporting_destination` — Where execution reports are stored for this project.
9. `human_approval_requirements` — Operations requiring explicit human approval.

Each field contains descriptive placeholder text; the file is valid JSON and is descriptive only
(it does not confer write access or modify any project).

### Separation of instruction scopes

Agent specifications separate instructions into four scopes:

- **Universal Responsibilities** — The agent's core role, independent of deployment context.
- **Workbench-Specific Restrictions** — Restrictions that apply only when operating in the Workbench repository.
- **Project-Specific Restrictions** — Restrictions that apply when the agent is deployed to a project context.
- **Explicit Human Authorization** — Operations requiring explicit human approval before execution.

This separation keeps agent behavior consistent across contexts while making context-specific boundaries
explicit and auditable.

## Task 003 boundary

Task 003 (multi-agent orchestration foundation implementation) is complete. The repository's initial foundation has been created, committed, pushed, and remotely verified. Agent specifications, workflow definitions, project configurations, documentation, testing, and reporting are implemented.

## Task 004 boundary

Task 004 (runtime hardening and persistent reporting) is complete. Seven agents are implemented. Native OpenCode V2 integration, dependency-aware orchestration, least-privilege permissions, expanded secret scanning, mandatory reporting, and documentation reconciliation are implemented.

Task 004.1 (audit remediation) is complete. Native OpenCode V2 permissions corrected (edit/shell/actions), validator repaired as dependency-free Node.js script, mandatory persistent reporting established, orchestration sequencing corrected, automated verification via GitHub Actions added.

Task 004.2 (final security and runtime readiness corrections) is complete. Unrestricted shell permissions corrected (approval-gated with ask rules), secret scanning repaired with git ls-files -z inventory, validation strengthened with rule precedence testing, reporting instructions reconciled.

Task 004.3 (targeted permission correction and live acceptance testing) is complete. Developer and QA Engineer edit permissions resolved to ask rules, shell commands resolved to ask rules, Git enumeration failure causes validation failure, reporting policy reconciled.

Do not modify `ImperioKDB/Scholars` or `ImperioKDB/Scholars-Resource-Centre` without explicit human approval.
