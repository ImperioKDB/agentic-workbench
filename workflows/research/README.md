# Research Workflow — Research and Technology Evaluation

**Status:** Implemented (Task 003).

## Purpose

Defines the workflow for information gathering, evidence collection, and technology evaluation to support orchestration workflows.

## Workflow Steps

```text
Research request
    ↓
Orchestrator
    ↓
Researcher
    ↓
Orchestrator (incorporate findings into planning)
    ↓
Planner (if implementation follows)
    ↓
Human approval (if implementation follows)
```

## Step-by-Step Instructions

### 1. Research request

A user or the orchestrator requests research on a specific topic. The orchestrator defines the research questions, scope, and expected outputs.

### 2. Orchestrator

The orchestrator delegates the research task to the researcher and records the task state.

### 3. Researcher

The researcher:
- Investigates codebases and documentation
- Researches technical solutions
- Compares implementation approaches with tradeoffs
- Identifies constraints and dependencies
- Produces an evidence-based research report distinguishing verified facts from assumptions
- Returns findings to the orchestrator

### 4. Orchestrator

The orchestrator incorporates the research findings into planning or the current task context.

### 5. Planner (if implementation follows)

If the research leads to implementation, the planner converts findings into an implementation plan.

### 6. Human approval (if implementation follows)

Human approval is required before any implementation based on research findings.

## Boundaries

- Read-only research. No autonomous writes to production repositories.
- No agent merges or deploys.
- No credential printing or secret handling.
