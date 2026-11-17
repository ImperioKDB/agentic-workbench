# Personal Agentic Workbench

Reusable OpenCode-native personal agentic orchestration and workflow system.

## Project

Personal Agentic Workbench is a multi-agent orchestration foundation for managing
agentic workflows across related projects (scholars, resource-centre, serena,
ai-video-factory). It is designed to be operated through OpenCode and provides
agent specifications, workflow definitions, and project configurations.

## Relationship to OpenCode

This repository is OpenCode-native. It ships with:

- `opencode.json` — minimal OpenCode configuration
- `agents/` — OpenCode agent specifications (orchestrator, researcher, planner,
  developer, qa-engineer, reviewer)
- `skills/` — OpenCode skill definitions
- `workflows/` — workflow definitions for development, debugging, auditing,
  research, and documentation
- `AGENTS.md` — operating instructions for OpenCode and human operators

## Supported configurations

| Component | Purpose | Status |
|-----------|---------|--------|
| `agents/orchestrator.md` | Multi-agent orchestration agent | Placeholder |
| `agents/researcher.md` | Research agent | Placeholder |
| `agents/planner.md` | Planning agent | Placeholder |
| `agents/developer.md` | Development agent | Placeholder |
| `agents/qa-engineer.md` | QA agent | Placeholder |
| `agents/reviewer.md` | Review agent | Placeholder |
| `skills/README.md` | OpenCode skills directory | Placeholder |
| `workflows/*/` | Workflow definitions | Placeholder |
| `projects/*/README.md` | Project-specific configurations | Placeholder |
| `docs/ARCHITECTURE.md` | Architecture documentation | Placeholder |
| `docs/SECURITY.md` | Security documentation | Placeholder |
| `docs/ROADMAP.md` | Development roadmap | Placeholder |

## Repository isolation

This repository is independent of the `ImperioKDB/Scholars`,
`ImperioKDB/Updates`, and `ImperioKDB/Scholars-Resource-Centre` repositories.
No cross-repository writes are performed by this project.

## Milestones

- Task 002 — Repository creation and verification (this repository)
- Task 003 — Multi-agent orchestration foundation (planned, not started)
