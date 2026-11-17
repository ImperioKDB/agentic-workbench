# Architecture

**Status:** Implemented (Task 003).

## System overview

The Personal Agentic Workbench is a reusable, OpenCode-native agentic orchestration foundation. It coordinates specialist agents (orchestrator, researcher, planner, developer, qa-engineer, reviewer) through defined workflows to manage agentic development across multiple registered projects.

The system is repository-centric: all agent specifications, workflow definitions, project configurations, and documentation live in this repository (`ImperioKDB/agentic-workbench`). Registered projects (scholars, resource-centre, serena, ai-video-factory) are described descriptively in `projects/`; this repository does not write to them without explicit human approval.

## Agent communication model

Agents communicate through the orchestrator, which acts as the central coordination point:

```
User request → Orchestrator → Specialist agents → Orchestrator → Human review
```

Specialist agents (researcher, planner, developer, qa-engineer, reviewer) report back to the orchestrator, never directly to each other. The orchestrator sequences handoffs according to the applicable workflow definition and tracks task state and dependencies.

Handoff rules are defined in each agent specification (`agents/*.md`). Key handoffs:
- Orchestrator → Researcher (investigation needed)
- Orchestrator → Planner (planning needed)
- Orchestrator → Developer (approved implementation ready)
- Developer → QA Engineer (implementation ready for validation)
- QA Engineer → Reviewer (validation complete)
- Reviewer → Orchestrator (review complete)

## Workflow execution model

Six workflows are defined in `workflows/`:
1. **development** — new project development
2. **debugging** — bug investigation and resolution
3. **auditing** — technical and security auditing
4. **research** — research and technology evaluation
5. **documentation** — documentation and reporting
6. **modification** — existing project modification

Every development workflow follows the same agent sequence:
User request → Orchestrator → Researcher (when needed) → Planner → User approval → Developer → QA Engineer → Independent Reviewer → Execution report → Pull request → Human review and merge → Deployment only when separately authorized.

## Approval gates

The following operations require explicit human approval:
- Consequential implementation (before developer starts work)
- Production changes (before any production change)
- PR merge (before any merge to main)
- Deployment (separately authorized, after merge)
- Repository creation
- Credential rotation

No agent may bypass these gates. `opencode.json` records `no_autonomous_merge: true` and `no_autonomous_deploy: true`.

## Repository isolation model

This repository (`ImperioKDB/agentic-workbench`) is independent of:
- `ImperioKDB/Scholars`
- `ImperioKDB/Scholars-Resource-Centre`

No cross-repository writes are performed by this project. Project configurations in `projects/` are descriptive only and do not confer write access. The `boundaries.do_not_modify` list in `opencode.json` enforces this at the configuration level.

## Configuration

`opencode.json` is the central OpenCode configuration. It defines:
- Agent specifications and their file locations
- Workflow definitions and their directory locations
- Registered projects and their configurations
- Repository metadata (owner, name, visibility, default branch)
- Security boundaries and approval gates

Agent specifications live in `agents/*.md`. Workflow definitions live in `workflows/*/README.md`. Project configurations live in `projects/*/config.json` with a registry at `projects/registry.json`.
