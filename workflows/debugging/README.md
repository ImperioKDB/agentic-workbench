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
Execution report
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

Follows the same execution report, pull request, human review and merge, and deployment authorization steps as the Development Workflow.

## Boundaries

- No autonomous execution.
- No agent merges or deploys.
- Does not modify `ImperioKDB/Scholars` or `ImperioKDB/Scholars-Resource-Centre`.
- Human approval required before implementing any fix.
