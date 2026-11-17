# Agent Operating Instructions

This file provides operating instructions for OpenCode agents and human
operators working in the Personal Agentic Workbench repository.

## Scope

This repository is an independent, private OpenCode-native agentic
orchestration foundation. It does not modify `ImperioKDB/Scholars`,
`ImperioKDB/Scholars-Resource-Centre`, or `ImperioKDB/Updates`.

## Human approval requirements

The following operations require explicit human approval before execution:

1. Creating or modifying GitHub repositories under the `ImperioKDB` owner.
2. Merging any pull request in this repository or in `ImperioKDB/Updates`.
3. Beginning Task 003 (multi-agent orchestration foundation implementation).
4. Rotating, revoking, or replacing any GitHub credential.
5. Any write operation against `ImperioKDB/Scholars` or
   `ImperioKDB/Scholars-Resource-Centre`.

## Repository isolation

- This repository (`agentic-workbench`) is isolated from `Scholars` and
  `Scholars-Resource-Centre`. Do not modify those repositories from this context.
- Reporting for this project is published to `ImperioKDB/Updates` on dedicated
  branches (e.g. `report/agentic-workbench-task-002`). Do not merge reporting
  pull requests without human approval.

## Credential boundaries

- No authentication tokens, API keys, passwords, or secrets may be committed to
  this repository.
- `gh auth token` must not be executed.
- Token values must never be printed or written to disk.

## Directory conventions

- `agents/` — OpenCode agent specifications (documentation placeholders).
- `skills/` — OpenCode skill definitions (documentation placeholder).
- `workflows/*/` — Workflow definitions (documentation placeholders).
- `projects/*/` — Project-specific configurations (documentation placeholders).
- `reports/` — Task execution and verification reports (documentation placeholder).
- `docs/` — Architecture, security, and roadmap documentation (placeholders).

## Task 003 boundary

Task 003 (multi-agent orchestration foundation implementation) must not begin
until this repository's initial foundation has been created, committed, pushed,
and remotely verified. See `docs/ROADMAP.md`.
