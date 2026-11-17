# Personal Agentic Workbench

Reusable OpenCode-native personal agentic orchestration and workflow system.

## Project

Personal Agentic Workbench is a multi-agent orchestration foundation for managing agentic workflows across related projects (scholars, resource-centre, serena, ai-video-factory). It is designed to be operated through OpenCode and provides agent specifications, workflow definitions, and project configurations.

## Relationship to OpenCode

This repository is OpenCode-native. It ships with:

- `opencode.json` — minimal OpenCode configuration defining agents, workflows, projects, and security boundaries
- `agents/` — OpenCode agent specifications (orchestrator, researcher, planner, developer, qa-engineer, reviewer)
- `skills/` — OpenCode skills directory (no skills installed)
- `workflows/` — workflow definitions (development, debugging, auditing, research, documentation, modification)
- `AGENTS.md` — operating instructions for OpenCode and human operators

## Agents

| Agent | Purpose | Status |
|-------|---------|--------|
| Orchestrator | Coordinates multi-agent workflows, decomposes tasks, delegates to specialists, enforces approval gates | Implemented |
| Researcher | Investigates codebases, researches solutions, produces evidence-based reports | Implemented |
| Planner | Converts requirements into implementation plans with acceptance criteria | Implemented |
| Developer | Implements approved changes on isolated branches | Implemented |
| QA Engineer | Runs tests, validates behaviour, produces test evidence | Implemented |
| Reviewer | Independently inspects changes, reviews security and maintainability | Implemented |

## Workflows

| Workflow | Purpose | Status |
|----------|---------|--------|
| development | New project development | Implemented |
| debugging | Bug investigation and resolution | Implemented |
| auditing | Technical and security auditing | Implemented |
| research | Research and technology evaluation | Implemented |
| documentation | Documentation and reporting | Implemented |
| modification | Existing project modification | Implemented |

## Registered projects

| Project | Repository | Status |
|---------|------------|--------|
| scholars | ImperioKDB/Scholars | Registered |
| resource-centre | ImperioKDB/Scholars-Resource-Centre | Registered |
| serena | ImperioKDB/Serena | Registered |
| ai-video-factory | ImperioKDB/AI-Video-Factory | Registered |

## Repository isolation

This repository is independent of the `ImperioKDB/Scholars`, `ImperioKDB/Updates`, and `ImperioKDB/Scholars-Resource-Centre` repositories. No cross-repository writes are performed by this project.

## Milestones

| Milestone | Description | Status |
|-----------|-------------|--------|
| Task 002 | Repository creation and verification | Complete |
| Task 003 | Multi-agent orchestration foundation | In progress |

## Security

No authentication tokens, API keys, passwords, or secrets are committed to this repository. `gh auth token` is not executed. Human approval is required for consequential implementation, production changes, PR merges, and deployment. See `docs/SECURITY.md` for the full security model.
