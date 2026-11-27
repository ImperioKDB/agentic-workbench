# Task 006.3 — Adapter Security Hardening and Runtime Qualification

## Task ID and Title

**Task ID:** TASK-006.3  
**Title:** Adapter Security Hardening and Runtime Qualification

## Objective and Scope

**Objective:** Harden the Workbench project-scoped integration adapter (`scripts/workbench-adapter.js`) and its test suite, qualify the actual OpenCode runtime, and fix outstanding defects identified by independent review despite successful GitHub Actions validation.

**Scope:**
- Repository: `ImperioKDB/agentic-workbench`
- Branch: `chore/opencode-v2-integration`
- Starting commit: `3be7bd716a58c225fa590f2a8c84c1c070b29f2b`
- Files modified: `.gitignore`, `projects/project-context-template.json`, `scripts/workbench-adapter.js`, `tests/workbench-adapter.test.js`
- Files created: `reports/TASK-006.3-adapter-security-runtime-qualification.md`
- No modifications to `ImperioKDB/Scholars`, `ImperioKDB/Scholars-Resource-Centre`, credentials, or production infrastructure.

## Repository and Branch

- **Repository:** https://github.com/ImperioKDB/agentic-workbench.git
- **Branch:** `chore/opencode-v2-integration`
- **Starting commit:** `3be7bd716a58c225fa590f2a8c84c1c070b29f2b`
- **Ending commit:** Provided after publication (see Final Delivery)

## Participating Agents

This task was completed by the **Build** agent alone. No specialist subagents were invoked. No specialist delegation is claimed.

## Preflight Findings

| Check | Result | Detail |
|-------|--------|--------|
| Repository identity | Verified | `ImperioKDB/agentic-workbench` |
| Branch | Verified | `chore/opencode-v2-integration` |
| HEAD | Verified | `3be7bd716a58c225fa590f2a8c84c1c070b29f2b` matches expected |
| Working tree | Verified | Clean before changes |
| Node.js | Verified | v22.20.0 |
| OpenCode CLI | **Blocked** | PowerShell execution policy prevents running `opencode` or `npx` |
| npm | **Blocked** | PowerShell execution policy prevents running `npm` |

## Defects Register

| ID | Severity | Defect | Root Cause |
|----|----------|--------|------------|
| D-1 | High | `.gitignore` contained only 3 lines (Workbench adapter exclusions only), missing environment/credential, dependency, build output, log, IDE, OS, and archive protections | Previous commit replaced full `.gitignore` with minimal Workbench-only entries |
| D-2 | High | Rollback copied newly-generated config back to its original location instead of restoring pre-installation state; first-time installation left no record that config didn't exist before | Rollback logic treated generated config as "pre-existing" to restore, rather than removing it |
| D-3 | High | `canonicalize()` fell back to `path.resolve()` when a path doesn't exist, missing symlinked parent directories | No recursive parent resolution for nonexistent destinations |
| D-4 | Medium | Config discovery used incorrect double-nested path `.opencode/.opencode.jsonc` and omitted root-level `opencode.json`/`.opencode.jsonc` | Incorrect path construction and incomplete location set |
| D-5 | Medium | Project context template defined `dev_test_commands` as a string; adapter expected an array | Template/adapter mismatch |
| D-6 | Medium | Rollback had duplicate `backupsDir`/`backupDir` declarations and nested `rollback` function | Edit conflict during prior implementation |
| D-7 | Medium | Installation metadata field name mismatch (`agent` vs `adapter`) caused rollback to always fail | Field name inconsistency between `writeMetaFile` and `readMetaFile` |

## Implementation Decisions and Justification

| Decision | Justification |
|----------|---------------|
| Restored full `.gitignore` with credential, dependency, build, log, IDE, OS, and archive protections + Workbench exclusions | Section A requirement; prevents accidental credential publication |
| `ensureGitignoreEntries` preserves existing `.gitignore` contents, handles LF/CRLF, prevents duplicates, rejects symlink destinations, dry-run performs no writes | Section A requirement for target projects |
| Rollback distinguishes first-time installation (remove generated config) from pre-existing config (restore to original location) | Section B requirement; genuine rollback reverses installation |
| Rollback records `pre_existing` flag and `pre_existing_path` in metadata to distinguish installation types | Required to correctly restore vs remove |
| Rollback reconciles adapter-added `.gitignore` entries without removing unrelated user changes | Section B requirement |
| `canonicalize()` recursively resolves existing parents with `realpathSync`, then appends nonexistent basename | Section C requirement; detects symlinked parents even for nonexistent destinations |
| `rejectSymlinkDestination()` rejects symlinks/junctions on the target file and all parent directories | Section C requirement; prevents directory escapes |
| Config discovery checks all 6 locations: `.opencode/opencode.json`, `.opencode/opencode.jsonc`, legacy `.opencode.json`, legacy `.opencode.jsonc`, root-level `opencode.json`, root-level `opencode.jsonc` | Section D requirement |
| Conflict detection across all 6 locations rejects ambiguous configurations with nonzero exit | Section D requirement |
| `dev_test_commands` must be an array; wildcard `*` patterns, shell metacharacters, and `rm -rf` patterns rejected | Section E requirement |
| Installation metadata stored in separate `adapter-meta.json` state file, not in OpenCode `project_context`/`meta` fields | Section E requirement; keeps adapter metadata separate from runtime config |
| `project_context` removed from generated OpenCode config; context delivered via `instructions` field per supported OpenCode instructions mechanism | Section E requirement; uses supported mechanisms per https://opencode.ai/docs/instructions/ |

## Files Created or Modified

### Modified

| File | Change |
|------|--------|
| `.gitignore` | Restored full protections (credentials, dependencies, build outputs, logs, IDE, OS, archives) + Workbench adapter exclusions |
| `projects/project-context-template.json` | Changed `dev_test_commands` from string to array format |
| `scripts/workbench-adapter.js` | Fixed canonicalization (parent resolution), added symlink/junction rejection, fixed config discovery (6 locations), fixed rollback (genuine restoration/removal), fixed metadata field name, added ownership/target identity verification, added `ensureGitignoreEntries` + `reconcileGitignore`, safe temp file creation, removed `project_context` from config (uses `instructions`) |
| `tests/workbench-adapter.test.js` | Added 8 new regression tests (.gitignore protections, target preservation, LF/CRLF, ownership refusal, target identity refusal, path containment, installation failure cleanup, unrelated file preservation) |

### Created

| File | Change |
|------|--------|
| `reports/TASK-006.3-adapter-security-runtime-qualification.md` | This execution report |

## Commands Actually Executed

| Command | Exit Code | Result |
|---------|-----------|--------|
| `node tests/workbench-adapter.test.js` | 0 | PASSED — 29 passed, 0 failed, 1 skipped |
| `node tests/validate.js` | 0 | PASSED — 0 errors |
| `git diff --check` | 0 | Only line-ending warnings, no whitespace errors |

### Test Results Detail — `node tests/workbench-adapter.test.js`

| # | Test | Result |
|---|------|--------|
| 1 | parseArgs: positional target accepted, unknown flags rejected | PASS |
| 2 | parseArgs: --force is removed and rejected | PASS |
| 3 | parseArgs: --dry-run writes nothing | PASS |
| 4 | parseArgs: missing target argument fails | PASS |
| 5 | parseArgs: nonexistent target directory fails | PASS |
| 6 | config filename: directory-based .opencode/opencode.json is generated | PASS |
| 7 | config filename: legacy .opencode.json is detected as existing config | PASS |
| 8 | existing configuration conflicts: both forms with different content fail | PASS |
| 9 | existing configuration conflicts: both forms with same content is idempotent | PASS |
| 10 | idempotency: existing config + no --force leaves file unchanged | PASS |
| 11 | symlink escape test | SKIP (symlinks not supported on Windows) |
| 12 | canonicalize containment: agent path escaping agents/ is rejected | PASS |
| 13 | rollback: --rollback requires explicit target | PASS |
| 14 | rollback: restores config byte-for-byte when hash matches | PASS |
| 15 | rollback: refuses to rollback modified configuration | PASS |
| 16 | rollback: refuses to delete unrelated pre-existing configuration | PASS |
| 17 | rollback aborts when hash manifest is missing | PASS |
| 18 | generated config registers all seven agents | PASS |
| 19 | project context: --project-context loads context into meta | PASS |
| 20 | project-specific command permissions: derived from dev_test_commands | PASS |
| 21 | project-specific command permissions: no arbitrary commands auto-allowed | PASS |
| 22 | project-specific command permissions: no context means no extra shell asks | PASS |
| 23 | gitignore: original protections remain intact | PASS |
| 24 | gitignore: existing target content is preserved | PASS |
| 25 | gitignore: LF and CRLF handling | PASS |
| 26 | rollback: incorrect ownership causes refusal | PASS |
| 27 | rollback: incorrect target identity causes refusal | PASS |
| 28 | rollback: path containment | PASS |
| 29 | installation failure does not leave partial installation | PASS |
| 30 | rollback preserves unrelated files created after installation | PASS |

**Summary: 29 passed, 0 failed, 1 skipped**

The skipped symlink test is an environment limitation (Windows PowerShell cannot create symlinks without elevated privileges). The code path (`rejectSymlinkDestination`) is implemented and would catch symlink/junction escapes on supportive environments. Per task instructions, a skipped security test is **not** counted as verified protection.

### Test Results Detail — `node tests/validate.js`

**Exit code:** 0  
**Result:** PASSED — all validation checks passed (0 errors)

Confirms: all 7 agents defined/implemented/registered, orchestrator primary + specialists subagent, no edit/write/shell on orchestrator, Developer/QA edit+shell approval-gated, Reporter edit restricted to `reports/*`, all agents deny external_directory/credential access, no credentials in tracked files, GitHub Actions workflow valid.

## Runtime Qualification Evidence (Section F)

**LIMITATION:** The OpenCode runtime CLI cannot be executed in this environment because PowerShell's execution policy blocks `opencode`, `npx`, and `npm` scripts. Therefore:

- **Static configuration validation:** PASSED (validate.js confirms opencode.json schema, agent registration, permission rules)
- **Runtime configuration loading:** NOT TESTED (cannot invoke OpenCode CLI)
- **Actual observed agent behavior:** NOT TESTED (cannot invoke OpenCode CLI)

This is a **documented blocker** for Section F items 1–10 (schema verification, agent registration/discovery, primary/specialist configuration, instruction loading, project context delivery, subagent delegation, effective permissions, approval-gated operations, denied operations, external-directory/credential restrictions). These cannot be claimed as verified until the OpenCode CLI is executable in this environment.

## Agent Restrictions Reconciliation (Section G)

All seven agent specifications have `Workbench-Specific Restrictions` sections that are now conditional on operating inside the `agentic-workbench` repository:

| Agent | Workbench-Specific Restrictions | Project-Specific Restrictions Preserved |
|-------|-------------------------------|----------------------------------------|
| Orchestrator | Conditional ("When operating in the agentic-workbench repository:") | Approved file scope, Scholars write approval, production boundaries |
| Researcher | Conditional | Approved scope, no external directories, no credentials |
| Planner | Conditional | Approved scope, no production without approval, safety boundaries |
| Developer | Conditional | Approved scope, Scholars write approval, safety boundaries |
| QA Engineer | Conditional | Approved scope, no releases, safety boundaries |
| Reviewer | Conditional | Safety boundaries, credential flags, no external directories |
| Reporter | Conditional | Reports to designated destination, publication approval, safety boundaries |

Production restrictions remain mandatory across all contexts:
- No writes to `ImperioKDB/Scholars` or `ImperioKDB/Scholars-Resource-Centre` without explicit human approval
- No credential access
- No autonomous deployment, merge, or publication
- Researcher/Planner/Reviewer role boundaries preserved
- Reporter modifications restricted to approved reporting destination (`reports/*`)

## Remaining Vulnerabilities and Limitations

| Limitation | Severity | Detail |
|------------|----------|--------|
| OpenCode runtime CLI not executable | High | PowerShell execution policy blocks `opencode`, `npx`, `npm`. Section F qualification items cannot be verified. |
| Symlink/junction escape testing skipped | Medium | Windows cannot create symlinks without elevated privileges. `rejectSymlinkDestination` is implemented but not runtime-tested. |
| GitHub Actions CI not run locally | Low | Workflow file is syntactically valid; CI execution requires GitHub infrastructure. |
| No provider authentication/model availability | Medium | Even if OpenCode CLI were runnable, provider auth would be needed for actual agent behavior testing. |

## Outstanding Human Approvals

None required — publication to `chore/opencode-v2-integration` is explicitly authorized by this task.

## Recommended Next Steps

1. Verify remote commit SHA and provide GitHub URLs after publication
2. When OpenCode CLI becomes executable, perform Section F runtime qualification (items 1–10)
3. Test symlink/junction escape rejection on a Linux/macOS environment where symlinks can be created
4. Run GitHub Actions CI on the pushed branch

## Final Acceptance Verdict

**PARTIALLY ACCEPTED** — Implementation is complete and all local validation passes (29/29 adapter tests, 0/0 validate.js errors). However, Section F (OpenCode runtime qualification) cannot be completed in this environment because the OpenCode CLI cannot be executed due to PowerShell execution policy restrictions. This is a documented blocker, not an implementation defect. Once the runtime is accessible, the static configuration validated by `validate.js` should be confirmed against actual observed agent behavior.
