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
6. Publishing execution reports to GitHub (including `ImperioKDB/Updates` reporting branches).

## Repository isolation

- This repository (`agentic-workbench`) is isolated from `Scholars` and `Scholars-Resource-Centre`. Do not modify those repositories from this context.
- Reporting for this project is published to `ImperioKDB/Updates` on dedicated branches (e.g. `report/agentic-workbench-task-002`). Do not merge reporting pull requests without human approval.

## Credential boundaries

- No authentication tokens, API keys, passwords, or secrets may be committed to this repository.
- `gh auth token` must not be executed.
- Token values must never be printed or written to disk.
- Environment-variable contents containing credentials must never be inspected or printed.

## Directory conventions

- `agents/` — OpenCode agent specifications (implemented).
- `skills/` — OpenCode skills directory (no skills installed).
- `workflows/*/` — Workflow definitions (implemented).
- `projects/*/` — Project-specific configurations (implemented; descriptive only).
- `reports/` — Task execution and verification reports.
- `docs/` — Architecture, security, and roadmap documentation (implemented).

## Task 003 boundary

Task 003 (multi-agent orchestration foundation implementation) is complete. The repository's initial foundation has been created, committed, pushed, and remotely verified. Agent specifications, workflow definitions, project configurations, documentation, testing, and reporting are implemented.

## Task 004 boundary

Task 004 (runtime hardening and persistent reporting) is complete. Seven agents are implemented. Native OpenCode V2 integration, dependency-aware orchestration, least-privilege permissions, expanded secret scanning, mandatory reporting, and documentation reconciliation are implemented.

Task 004.1 (audit remediation) is complete. Native OpenCode V2 permissions corrected (edit/shell/actions), validator repaired as dependency-free Node.js script, mandatory persistent reporting established, orchestration sequencing corrected, automated verification via GitHub Actions added.

Task 004.2 (final security and runtime readiness corrections) is in progress. Correcting unrestricted shell permissions (approval-gated with last-match precedence), repairing secret scanning with git ls-files -z inventory, strengthening validation with rule precedence testing, reconciling reporting instructions, and preparing runtime readiness documentation.

Do not modify `ImperioKDB/Scholars` or `ImperioKDB/Scholars-Resource-Centre` without explicit human approval.
