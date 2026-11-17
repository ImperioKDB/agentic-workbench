# Security

**Status:** Implemented (Task 003).

## Purpose

Documents credential handling, least-privilege principles, tool boundaries, human approval requirements, and repository isolation for the Personal Agentic Workbench.

## Credential handling

- No authentication tokens, API keys, passwords, or secrets may be committed to this repository.
- `gh auth token` must not be executed.
- Token values must never be printed or written to disk.
- `gh auth status` may be used to verify authentication safely (read-only; no token values printed).
- Environment-variable contents containing credentials must never be inspected or printed.

## Least-privilege access

| Agent | Default Access | Write Boundary |
|-------|---------------|----------------|
| Orchestrator | Read all workbench files | Cannot write to Scholars / Resource Centre; cannot merge |
| Researcher | Read-only | No writes to any repository |
| Planner | Read-only | No implementation, no commits |
| Developer | Read all workbench files | Feature branches only in agentic-workbench; no Scholars writes |
| QA Engineer | Read all workbench files | Test evidence reports only; no code changes |
| Reviewer | Read all workbench files | Review reports only; no merges |

## Tool boundaries

- Read-only defaults for research and planning agents.
- Explicit write boundaries for the developer agent (isolated branches only).
- No automatic merging (`no_autonomous_merge: true` in `opencode.json`).
- No automatic deployments (`no_autonomous_deploy: true` in `opencode.json`).
- No destructive database operations without explicit approval.
- No silent authentication switching.

### Permission enforcement — OpenCode v2.3.0 native capability

**OpenCode v2.3.0 DOES natively enforce custom agent permissions** through `opencode.jsonc` with `permissions` arrays and `agents.<id>.permissions`. Runtime verification (Task 003D Tests A–E) confirmed:

- Researcher (declared read-only): `edit: deny *` — write attempts are blocked with `permission.rejected`
- Planner (declared read-only): `edit: deny *` — write attempts are blocked with `permission.rejected`
- Reviewer (declared review-only): `edit: deny *` — write attempts are blocked with `permission.rejected`
- Developer: `edit: ask` — write attempts pause and request human approval; auto-rejected in non-interactive mode
- QA Engineer: `edit: deny *`, `shell: deny *` (with `shell: node * -> ask`) — writes and non-test shell commands denied
- Orchestrator: `edit: deny *`, `shell: deny *`, `subagent: researcher/planner/developer/qa-engineer/reviewer -> allow`, `subagent: * -> deny`

Permissions are configured in `opencode.jsonc` (global rules) and in each agent's `.opencode/agents/<name>.md` frontmatter (agent-specific rules). Agent rules are appended after global rules and use each agent's own permission set — they are NOT inherited from a parent agent.

## Native permission enforcement — verified test results

| Test | Scenario | Result |
|------|----------|--------|
| A | Researcher write denial | ✅ VERIFIED PASS — `permission.rejected` |
| B | Planner write denial | ✅ VERIFIED PASS — `permission.rejected` |
| C | Reviewer write denial | ✅ VERIFIED PASS — `permission.rejected` |
| D | Developer scope restriction | ✅ VERIFIED PASS — `permission.rejected` |
| E2 | QA implementation modification denial | ✅ VERIFIED PASS — refused write |
| F1 | Human approval denied (no --auto) | ✅ VERIFIED PASS — `permission.rejected`, auto-rejecting |
| F2 | Human approval granted (--auto) | ✅ VERIFIED PASS — edit applied |
| I | Git commit restriction | ✅ VERIFIED PASS — `Permission denied: shell` |


**Mitigation:** Until OpenCode adds native permission enforcement for custom agents, rely on:
1. Human review of agent outputs before accepting any file changes.
2. PR-based workflow — all changes go through pull requests with human review before merge.
3. Branch protection on `main` (where available) to prevent direct pushes.
4. Git history inspection to detect unauthorized modifications.


## Human approval requirements

The following operations require explicit human approval:
1. Creating or modifying GitHub repositories under the `ImperioKDB` owner.
2. Merging any pull request in this repository or in `ImperioKDB/Updates`.
3. Beginning Task 003 implementation stages that modify production projects.
4. Rotating, revoking, or replacing any GitHub credential.
5. Any write operation against `ImperioKDB/Scholars` or `ImperioKDB/Scholars-Resource-Centre`.

## Repository isolation

- This repository (`agentic-workbench`) is isolated from `Scholars` and `Scholars-Resource-Centre`.
- Reporting for this project is published to `ImperioKDB/Updates` on dedicated branches.
- Reporting pull requests are not merged without human approval.
- Project configurations in `projects/` are descriptive only; they do not confer write access.

## Credential exposure incident (historical)

During Task 001, a `GH_TOKEN` credential was exposed in plaintext via `gh auth token`. The token was later re-verified as valid and did not require rotation. This session did not rotate credentials without authorization.

To prevent recurrence:
- `gh auth token` is prohibited.
- No credential values are printed in terminal output.
- No credential values are committed to any file.
- All authentication checks use `gh auth status` (read-only) only.

## Reporting security

- No authentication tokens, API keys, passwords, or secrets are included in reports.
- No sensitive terminal output is reproduced.
- No private connection strings are included.
- No secrets are committed to `ImperioKDB/agentic-workbench` or `ImperioKDB/Updates`.
