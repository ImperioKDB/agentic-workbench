# Modification Workflow — Existing Project Modification

**Status:** Implemented (Task 003).

## Purpose

Defines the workflow for modifying an existing project registered in the Personal Agentic Workbench. This workflow handles changes to existing code, configuration, or documentation without creating new project directories.

## Workflow Steps

```text
Modification request
    ↓
Orchestrator
    ↓
Researcher (when impact investigation needed)
    ↓
Planner
    ↓
User approval for modification
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

### 1. Modification request

A user requests a modification to an existing project. The orchestrator receives the request, identifies the affected project configuration (from `projects/`), and records the scope.

### 2. Orchestrator

The orchestrator decomposes the request and determines whether impact investigation is needed.

### 3. Researcher (when needed)

The researcher investigates the existing project:
- Examines current code, configuration, and documentation
- Identifies constraints, dependencies, and integration points
- Produces an evidence-based report
- Returns findings to the orchestrator

### 4. Planner

The planner creates a modification plan:
- Identifies affected files and systems within the target project
- Defines acceptance criteria
- Identifies risks and dependencies
- Breaks work into independently verifiable stages

### 5. User approval for modification

The orchestrator submits the plan for human approval. No modification proceeds until approved.

### 6. Developer through human merge and deployment

Follows the Developer → QA Engineer → Independent Reviewer → Execution report → Pull request → Human review and merge → Deployment authorization steps from the Development Workflow.

## Boundaries

- No autonomous execution.
- No agent merges or deploys.
- Does not modify `ImperioKDB/Scholars` or `ImperioKDB/Scholars-Resource-Centre` without explicit human approval.
- Human approval required where specified in `AGENTS.md`.
