# Documentation Workflow — Documentation and Reporting

**Status:** Implemented (Task 003).

## Purpose

Defines the workflow for creating and maintaining project documentation and task execution reports within the Personal Agentic Workbench.

## Workflow Steps

```text
Documentation request
    ↓
Orchestrator
    ↓
Author (draft documentation)
    ↓
Reviewer
    ↓
Human approval
    ↓
Merge
    ↓
Orchestrator (consolidate execution evidence, record actual invocations)
    ↓
Reporter (produce execution report)
    ↓
Publication (separately authorized)
```

## Step-by-Step Instructions

### 1. Documentation request

A user or the orchestrator requests documentation creation or update. The orchestrator defines the scope, target files, and audience.

### 2. Orchestrator

The orchestrator assigns the work and determines whether research is needed before drafting.

### 3. Author (draft documentation)

The orchestrator (or a designated agent acting as author) drafts the documentation following project conventions.

### 4. Reviewer

The reviewer inspects the documentation for accuracy, boundary compliance, and maintainability.

### 5. Human approval

Human approval is required before documentation is merged.

### 6. Merge through publication

Follows the pull request, human review and merge, and publication authorization steps from the Development Workflow. The orchestrator delegates report production to the Reporter, which produces a structured Markdown execution report stored under `reports/TASK-ID-descriptive-title.md`. The mandatory reporting protocol applies: every substantive task must conclude with a Markdown execution report.

## Boundaries

- No autonomous publication. Human approval required for merges.
- No agent merges or deploys.
- Does not modify `ImperioKDB/Scholars` or `ImperioKDB/Scholars-Resource-Centre`.
