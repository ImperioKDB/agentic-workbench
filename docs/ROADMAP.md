# Roadmap

**Status:** Implemented (Task 003 in progress).

## Milestones

| Milestone | Description | Status |
|-----------|-------------|--------|
| Task 002 | Repository creation and verification | Complete |
| Task 003 | Multi-agent orchestration foundation | In progress |

## Task 003 stages

1. **Agent specifications** — Implement six agent specifications (orchestrator, researcher, planner, developer, qa-engineer, reviewer) with responsibilities, permissions, inputs, outputs, and handoff rules. ✅ Complete (registered in `.opencode/agents/` with YAML frontmatter)
2. **Workflow definitions** — Implement six workflow definitions (development, debugging, auditing, research, documentation, modification) with agent handoffs and approval gates. ✅ Complete
3. **Project configuration** — Implement reusable project registration for scholars, resource-centre, serena, and ai-video-factory. ✅ Complete
4. **Documentation** — Update README, AGENTS.md, ARCHITECTURE, SECURITY, ROADMAP with implemented content. ✅ Complete
5. **Testing** — Create controlled test environment and verify agent workflows. ✅ Complete (all 6 agents discovered; all 6 individually invoked; delegation verified; end-to-end workflow completed)
6. **Reporting** — Publish implementation report to `ImperioKDB/Updates`. 🔄 In progress

## Test results (Task 003C runtime verification)

OpenCode version: **v2.3.0**  
Test fixture: `/tmp/opencode/task-003c-test-fixture/` (disposable, outside production repos)

| Test | Scenario | Result |
|------|----------|--------|
| A | Agent discovery — OpenCode discovers all 6 agents from `.opencode/agents/` | ✅ VERIFIED PASS (6/6) |
| B | Individual invocation — all 6 agents invoked by name via `opencode run --agent` | ✅ VERIFIED PASS (6/6) |
| C | Delegation — Orchestrator → Researcher → Planner (custom agents) | ✅ VERIFIED PASS |
| D | Permission enforcement — read-only agents attempting writes | ❌ NOT ENFORCED natively (see SECURITY.md) |
| E | Human approval — agent write without approval pause | ❌ NOT ENFORCED natively (see SECURITY.md) |
| F | End-to-end workflow — Research → Plan → Approve → Develop → QA → Report | ✅ VERIFIED PASS |

## Known limitations

1. **Permission enforcement:** OpenCode v2.3.0 does NOT natively enforce custom agent permissions. Read-only agents (Researcher, Planner, Reviewer) were able to write files when asked directly. Permission boundaries exist only as Markdown text in agent specifications, not as system-enforced rules.
2. **Human approval boundary:** OpenCode v2.3.0 does NOT natively pause for human approval before write operations. Agents proceeded with file modifications without requesting approval.
3. **Agent mode:** All 6 custom agents run with `mode: primary` (no `mode: subagent` distinction visible in custom agent frontmatter).

## Boundaries

- Task 003 implementation must not modify `ImperioKDB/Scholars` or `ImperioKDB/Scholars-Resource-Centre`.
- No agent merges or deploys.
- No credential printing or secret handling.
- No external orchestration frameworks are installed.
