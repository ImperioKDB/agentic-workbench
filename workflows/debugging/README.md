# Debugging Workflow — Bug Investigation and Resolution

**Status:** Implemented (Task 003).

## Purpose

Defines the workflow for diagnosing, investigating, and resolving defects in the Personal Agentic Workbench or a registered project.

## Workflow Steps

```text
Defect report
    ↓
Orchestrator
    ↓
Researcher (when root cause investigation needed)
    ↓
Planner
    ↓
User approval for fix
    ↓
Developer
    ↓
QA Engineer
    ↓
Independent Reviewer
    ↓
Orchestrator (consolidate execution evidence, record actual invocations)
    ↓
Reporter (produce execution report)
    ↓
Pull request
    ↓
Human review and merge
    ↓
Deployment only when separately authorized
```

## Step-by-Step Instructions

### 1. Defect report

A defect is reported by a user, the QA engineer, or the reviewer. The orchestrator receives the report, confirms the defect, and records its scope and severity.

### 2. Orchestrator

The orchestrator determines whether root-cause investigation is needed and delegates to the researcher if so. Otherwise, it proceeds to planning.

### 3. Researcher (when needed)

The researcher investigates the defect:
- Reproduces the defect (read-only where possible)
- Identifies root cause and contributing factors
- Identifies constraints and dependencies
- Produces an evidence-based report
- Returns findings to the orchestrator

### 4. Planner

The planner creates a fix plan:
- Identifies affected files and systems
- Defines acceptance criteria (defect resolved, no regressions)
- Identifies risks and dependencies
- Breaks the fix into independently verifiable stages

### 5. User approval for fix

The orchestrator submits the fix plan for human approval. No fix is implemented until a human approves.

### 6. Developer

The developer implements the fix on an isolated branch, following project conventions and avoiding unrelated modifications.

### 7. QA Engineer

The QA engineer validates the fix:
- Confirms the defect is resolved
- Runs tests to detect regressions
- Produces test evidence

### 8. Independent Reviewer

The reviewer inspects the fix for correctness, security, and completeness.

### 9. Execution report through human merge and deployment

The orchestrator compiles execution evidence, records actual subagent invocations and handoff results, and delegates report production to the Reporter. The Reporter produces a structured Markdown execution report stored under `reports/TASK-ID-descriptive-title.md`. Follows the same pull request, human review and merge, and deployment authorization steps as the Development Workflow, including the mandatory reporting protocol.

### 10. Mandatory reporting protocol

Every substantive task must conclude with a Markdown execution report. For Workbench assignments, reports are stored at `reports/TASK-ID-descriptive-title.md`. Authorization to implement a substantive task includes authorization to publish its sanitized report and approved changes to the designated feature branch. This does not authorize direct pushes to main, merges, deployments, production changes, or unrelated repository writes.

## Boundaries

- No autonomous execution.
- No agent merges or deploys.
- Does not modify `ImperioKDB/Scholars` or `ImperioKDB/Scholars-Resource-Centre`.
- Human approval required before implementing any fix.
