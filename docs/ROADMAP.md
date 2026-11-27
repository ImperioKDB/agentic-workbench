# Roadmap

**Status:** Implemented (Task 003 in progress).

## Milestones

| Milestone | Description | Status |
|-----------|-------------|--------|
| Task 002 | Repository creation and verification | Complete |
| Task 003 | Multi-agent orchestration foundation | Complete |
| Task 004 | Runtime hardening and persistent reporting | In progress |

## Task 003 stages

1. **Agent specifications** — Implement six agent specifications (orchestrator, researcher, planner, developer, qa-engineer, reviewer) with responsibilities, permissions, inputs, outputs, and handoff rules. ✅ Complete
2. **Workflow definitions** — Implement six workflow definitions (development, debugging, auditing, research, documentation, modification) with agent handoffs and approval gates. ✅ Complete
3. **Project configuration** — Implement reusable project registration for scholars, resource-centre, serena, and ai-video-factory. ✅ Complete
4. **Documentation** — Update README, AGENTS.md, ARCHITECTURE, SECURITY, ROADMAP with implemented content. ✅ Complete
5. **Testing** — Create controlled test environment and verify agent workflows. ✅ Complete (tests/validate.py expanded for Task 004)
6. **Reporting** — Publish implementation report to `ImperioKDB/Updates`. ✅ Complete (RUNTIME_VALIDATION_REPORT.md published)

## Task 004 stages

1. **Reporter agent** — Implement seventh agent for structured reporting and task history. ✅ Complete
2. **Native OpenCode V2 integration** — Register Reporter in `opencode.json` and `workbench-manifest.json`; fix developer write/create_branch permissions. ✅ Complete
3. **Dependency-aware orchestration** — Correct sequencing weakness; dependent tasks wait for required inputs. ✅ Complete
4. **Least-privilege permissions** — Developer write/create_branch with repo isolation; Reporter write restricted to `reports/*`. ✅ Complete
5. **Secret scanning** — Expanded secret patterns in validate.py; Git internals and validator fixtures excluded. ✅ Complete
6. **Mandatory reporting** — Every substantive task concludes with `reports/TASK-004-descriptive-title.md`. ✅ Complete
7. **Documentation reconciliation** — Update all docs for seven agents, V2 integration, reporting protocol. ✅ Complete
8. **Testing** — Expanded validate.py with 29 checks covering all seven agents, permissions, reporting, isolation. ✅ Complete

## Boundaries

- Task 004 implementation must not modify `ImperioKDB/Scholars`, `ImperioKDB/Scholars-Resource-Centre`, Serena, Collective, or any other project.
- No agent merges or deploys.
- No credential printing or secret handling.
- Human approval required for consequential implementation, production changes, PR merges, credential rotation, and report publication.
- No external orchestration frameworks are installed.
