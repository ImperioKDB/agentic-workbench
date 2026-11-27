# Development Workflow — New Project Development

**Status:** Implemented (Task 003).

## Purpose

Defines the end-to-end workflow for developing a new project within the Personal Agentic Workbench. This workflow creates new functionality, new directories, or new project configurations from scratch.

## Workflow Steps

```text
User request
    ↓
Orchestrator
    ↓
Researcher (when investigation needed)
    ↓
Planner
    ↓
User approval for consequential implementation
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

### 1. User request

The orchestrator receives a user request to develop a new project. The orchestrator clarifies the objective, scope, and constraints, and confirms which project configuration (from `projects/`) applies.

### 2. Orchestrator

The orchestrator decomposes the request into subtasks, determines whether investigation is needed, and selects the appropriate specialist agents. It records the task state and dependencies.

### 3. Researcher (when needed)

If the orchestrator determines that investigation is needed before planning, the researcher:
- Investigates the relevant codebase and documentation
- Researches technical solutions and compares implementation approaches
- Identifies constraints and dependencies
- Produces an evidence-based research report distinguishing verified facts from assumptions
- Returns findings to the orchestrator

### 4. Planner

The planner converts requirements and research findings into an implementation plan:
- Identifies affected files and systems
- Defines acceptance criteria for each stage
- Identifies risks and dependencies
- Breaks work into independently verifiable stages
- Returns the plan to the orchestrator

### 5. User approval for consequential implementation

The orchestrator submits the implementation plan for human approval. No implementation proceeds until a human approves the plan.

### 6. Developer

The developer implements the approved changes:
- Creates an isolated feature branch
- Implements changes following project conventions
- Avoids unrelated modifications
- Returns the change summary to the orchestrator

### 7. QA Engineer

The QA engineer validates the implementation:
- Runs relevant tests and builds
- Validates expected behaviour against acceptance criteria
- Detects regressions
- Produces test evidence with pass/fail status
- Returns results to the orchestrator

### 8. Independent Reviewer

The reviewer independently inspects the changes:
- Reviews security, architecture, and maintainability
- Verifies acceptance criteria are satisfied
- Identifies regressions and incomplete requirements
- Flags credential exposure and cross-repository violations
- Returns a review report (approve / request changes / reject)

### 9. Execution report

The orchestrator compiles execution evidence from all participating agents, records actual subagent invocations and handoff results, and delegates report production to the Reporter. The Reporter produces a structured Markdown execution report summarizing:
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

The report is stored under `reports/TASK-ID-descriptive-title.md`.

### 10. Reporter publication preparation

The Reporter prepares the execution report for authorized GitHub publication. Publication to the designated reporting branch requires explicit human authorization; no agent may publish autonomously.

### 11. Mandatory reporting protocol

Every substantive task must conclude with a Markdown execution report. For Workbench assignments, reports are stored at `reports/TASK-ID-descriptive-title.md`. Authorization to implement a substantive task includes authorization to publish its sanitized report and approved changes to the designated feature branch. This does not authorize direct pushes to main, merges, deployments, production changes, or unrelated repository writes.

### 11. Pull request

The orchestrator creates a pull request from the feature branch to `main` with the execution report as the PR description. The PR must not be merged by any agent.

### 12. Human review and merge

A human reviews the pull request and decides whether to merge. No agent may merge a pull request.

### 13. Deployment only when separately authorized

Deployment to production occurs only when separately authorized by a human. No agent may trigger a deployment.

## Approval Gates

| Gate | Required Approver | When |
|------|-------------------|------|
| Consequential implementation | Human | Before developer starts work |
| Report publication | Human | Before report is published to GitHub |
| Production changes | Human | Before any production change |
| PR merge | Human | Before any merge to main |
| Deployment | Human | Separately authorized, after merge |

## Boundaries

- No autonomous execution. All steps require orchestrator delegation.
- No agent merges or deploys.
- No credential printing or secret handling.
- Does not modify `ImperioKDB/Scholars` or `ImperioKDB/Scholars-Resource-Centre`.
- Human approval is required where specified in `AGENTS.md`.
