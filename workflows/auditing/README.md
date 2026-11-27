# Auditing Workflow — Technical and Security Auditing

**Status:** Implemented (Task 003).

## Purpose

Defines the workflow for auditing the Personal Agentic Workbench or a registered project for compliance with security boundaries, architectural consistency, and operational requirements.

## Workflow Steps

```text
Audit request
    ↓
Orchestrator
    ↓
Reviewer (audit lead)
    ↓
Researcher (evidence collection)
    ↓
Planner (remediation plan, if findings require changes)
    ↓
User approval for remediation
    ↓
Developer (remediation, if approved)
    ↓
QA Engineer
    ↓
Independent Reviewer
    ↓
Orchestrator (consolidate execution evidence, record actual invocations)
    ↓
Reporter (produce execution report)
    ↓
Audit report
    ↓
Human review
    ↓
Remediation tracking to closure
```

## Step-by-Step Instructions

### 1. Audit request

A user or the reviewer requests an audit. The orchestrator receives the request, defines the audit scope, and records it.

### 2. Orchestrator

The orchestrator assigns the reviewer as audit lead and determines whether evidence collection is needed.

### 3. Reviewer (audit lead)

The reviewer leads the audit:
- Independently inspects implementation changes or the current state
- Reviews security, architecture, and maintainability
- Identifies regressions, incomplete requirements, and boundary violations
- Flags credential exposure and cross-repository violations

### 4. Researcher (evidence collection)

The researcher collects evidence:
- Examines code, documentation, and configuration
- Produces evidence-based findings distinguishing verified facts from assumptions

### 5. Planner (remediation plan)

If the audit findings require changes, the planner creates a remediation plan with affected files, acceptance criteria, risks, and stage breakdown.

### 6. User approval for remediation

Human approval is required before any remediation is implemented.

### 7. Developer through human review

If remediation is approved, follow the Developer → QA Engineer → Independent Reviewer → Execution report → Pull request → Human review steps from the Development Workflow.

### 8. Audit report

The orchestrator compiles execution evidence, records actual subagent invocations and handoff results, and delegates report production to the Reporter. The Reporter produces a structured Markdown audit report summarizing findings, evidence, remediation actions (if any), and outstanding items, stored under `reports/TASK-ID-descriptive-title.md`. The mandatory reporting protocol applies: every substantive task must conclude with a Markdown execution report.

### 9. Remediation tracking to closure

Any remediation items are tracked until closure. The auditor reports findings; remediation is advisory unless approved and implemented.

## Boundaries

- Auditing is read-only and advisory. No autonomous remediation.
- No agent merges or deploys.
- Does not modify `ImperioKDB/Scholars` or `ImperioKDB/Scholars-Resource-Centre`.
