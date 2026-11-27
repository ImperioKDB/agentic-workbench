#!/usr/bin/env node
"use strict";

/**
 * Task 004.3 validation script (dependency-free Node.js).
 *
 * Validates the structural integrity of the Personal Agentic Workbench
 * implementation: workbench-manifest.json validity, agent files, workflow definitions,
 * project configurations, opencode.json V2 permissions (including ask rules for
 * approval-gated operations), reporter registration, dependency-aware orchestration,
 * mandatory reporting, secret scanning with Git-tracked inventory,
 * and repository isolation.
 *
 * Uses cross-platform path APIs (node:path). Enumerates Git-tracked files via
 * `git ls-files -z`. Fails with nonzero exit code if Git enumeration fails.
 * Never prints matched secret values. Exits nonzero when assertions fail.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const REPO_ROOT = path.resolve(__dirname, "..");

const ERRORS = [];
const WARNINGS = [];

function check(condition, message) {
  if (!condition) {
    ERRORS.push(message);
    console.log(`FAIL: ${message}`);
  } else {
    console.log(`PASS: ${message}`);
  }
}

function checkFile(relPath) {
  return fs.existsSync(path.join(REPO_ROOT, relPath)) &&
    fs.statSync(path.join(REPO_ROOT, relPath)).isFile();
}

function checkDir(relPath) {
  return fs.existsSync(path.join(REPO_ROOT, relPath)) &&
    fs.statSync(path.join(REPO_ROOT, relPath)).isDirectory();
}

function readFile(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

function isGitTrackedFixture(relPath) {
  const normalized = relPath.split(path.sep).join("/");
  // Exclude only explicitly identified synthetic test fixtures
  return normalized.startsWith("tests/fixtures/secrets/");
}

function getGitTrackedFiles() {
  try {
    const output = execSync("git ls-files -z", {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return output.split("\0").filter((f) => f.length > 0);
  } catch (e) {
    // FAIL: Git enumeration failure must cause validation failure
    ERRORS.push(`Git enumeration failed: ${e.message}`);
    console.log(`FAIL: Git enumeration failed: ${e.message}`);
    return null;
  }
}

// Secret patterns — synthetic test patterns only, never actual credential values
// Distinguishes harmless references to credential names from actual credential values
const SECRET_PATTERNS = [
  /ghu_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /x-access-token:\s*[A-Za-z0-9\-_]{20,}/,
  /password\s*=\s*["']?[^\s"']{8,}["']?/,
  /secret\s*=\s*["']?[^\s"']{8,}["']?/,
  /GH_TOKEN\s*=\s*["']?[^\s"']{8,}["']?/,
  /api_key\s*=\s*["']?[^\s"']{8,}["']?/,
  /aws_secret_access_key\s*=\s*["']?[^\s"']{8,}["']?/,
  /aws_access_key_id\s*=\s*[A-Z0-9]{16,}/,
];

function scanForSecrets() {
  let secretFound = false;
  const files = getGitTrackedFiles();
  if (files === null) {
    // Git enumeration failed - already recorded error
    check(false, "Git-tracked file enumeration must succeed for secret scanning");
    return;
  }
  for (const relPath of files) {
    const normalized = relPath.split(path.sep).join("/");
    // Skip the validator itself (contains regex patterns as strings)
    if (normalized === "tests/validate.js") continue;
    // Exclude only explicitly identified synthetic test fixtures
    if (isGitTrackedFixture(normalized)) continue;
    // Include tracked reports in secret scanning (do not exclude reports/)
    try {
      const fullPath = path.join(REPO_ROOT, relPath);
      const content = fs.readFileSync(fullPath, "utf8", { encoding: "utf8" });
      for (const pat of SECRET_PATTERNS) {
        if (pat.test(content)) {
          secretFound = true;
          ERRORS.push(`Secret-like pattern found in ${relPath}`);
          console.log(`FAIL: Secret-like pattern in ${relPath}`);
        }
      }
    } catch (e) {
      // Fail safely on unexpected read errors
      ERRORS.push(`Could not read tracked file ${relPath}: ${e.message}`);
      console.log(`FAIL: Could not read tracked file ${relPath}: ${e.message}`);
    }
  }
  check(!secretFound, "No credentials or secrets in Git-tracked files");
}

function validateSecretFixtures() {
  // Positive fixture should be detected by at least one pattern
  let positiveDetected = false;
  try {
    const positiveContent = fs.readFileSync(
      path.join(REPO_ROOT, "tests/fixtures/secrets/positive.env"),
      "utf8"
    );
    for (const pat of SECRET_PATTERNS) {
      if (pat.test(positiveContent)) {
        positiveDetected = true;
        break;
      }
    }
  } catch (e) {
    ERRORS.push("Could not read positive secret fixture");
    console.log("FAIL: Could not read positive secret fixture");
  }
  check(positiveDetected, "Positive secret fixture is detected by secret patterns");

  // Negative fixture should NOT be detected by any pattern
  let negativeDetected = false;
  try {
    const negativeContent = fs.readFileSync(
      path.join(REPO_ROOT, "tests/fixtures/secrets/negative.env"),
      "utf8"
    );
    for (const pat of SECRET_PATTERNS) {
      if (pat.test(negativeContent)) {
        negativeDetected = true;
        break;
      }
    }
  } catch (e) {
    ERRORS.push("Could not read negative secret fixture");
    console.log("FAIL: Could not read negative secret fixture");
  }
  check(!negativeDetected, "Negative secret fixture is not flagged (no false positives)");
}

// Helper: check if a specific permission rule exists
function findPermission(agentPerms, effect, action, resource) {
  return agentPerms.some(
    (p) => p.effect === effect && p.action === action && p.resource === resource
  );
}

// Helper: determine effective permission for an action+resource pair
// using OpenCode V2 last-match precedence semantics
function getEffectivePermission(agentPerms, action, resource) {
  // Find all rules matching this action, sorted by index (last match wins)
  let effective = null;
  for (let i = 0; i < agentPerms.length; i++) {
    const p = agentPerms[i];
    if (p.action === action && (p.resource === resource || p.resource === "*")) {
      effective = p.effect;
    }
  }
  return effective; // "allow", "deny", "ask", or null
}

// ========================================================================
// Main validation
// ========================================================================

function main() {
  console.log("=== Task 004.3 Validation ===\n");

  // 1. workbench-manifest.json valid JSON
  let config;
  try {
    config = JSON.parse(readFile("workbench-manifest.json"));
    check(true, "workbench-manifest.json is valid JSON");
  } catch (e) {
    check(false, `workbench-manifest.json invalid: ${e.message}`);
    config = {};
  }

  // 2. Required top-level keys
  for (const key of ["name", "agents", "workflows", "projects", "repository", "boundaries"]) {
    check(key in config, `workbench-manifest.json has '${key}' key`);
  }

  // 3. Seven agents defined and files exist
  const expectedAgents = ["orchestrator", "researcher", "planner", "developer", "qa-engineer", "reviewer", "reporter"];
  const agentsConfig = config.agents || [];
  const agentNames = agentsConfig.map((a) => a.name);
  for (const name of expectedAgents) {
    check(agentNames.includes(name), `Agent '${name}' defined in workbench-manifest.json`);
    check(checkFile(`agents/${name}.md`), `Agent file agents/${name}.md exists`);
  }

  // 4. Agent specs are not placeholders and report implementation status
  for (const name of expectedAgents) {
    const content = readFile(`agents/${name}.md`);
    check(!content.includes("Placeholder — not implemented"), `Agent '${name}' is implemented (not placeholder)`);
    check(content.includes("**Status:** Implemented"), `Agent '${name}' status is Implemented`);
  }

  // 5. Workflows defined and files exist
  const expectedWorkflows = ["development", "debugging", "auditing", "research", "documentation", "modification"];
  const workflowsConfig = config.workflows || [];
  const workflowNames = workflowsConfig
    .filter((w) => typeof w === "string")
    .map((w) => {
      const normalized = w.replace(/\/+$/, "").split("/").pop();
      return normalized.split(path.sep).pop();
    });
  for (const name of expectedWorkflows) {
    check(workflowNames.includes(name), `Workflow '${name}' defined in workbench-manifest.json`);
    check(checkFile(`workflows/${name}/README.md`), `Workflow file workflows/${name}/README.md exists`);
  }

  // 6. Workflow specs are not placeholders
  for (const name of expectedWorkflows) {
    const content = readFile(`workflows/${name}/README.md`);
    check(!content.includes("Placeholder — not implemented"), `Workflow '${name}' is implemented (not placeholder)`);
    check(content.includes("**Status:** Implemented"), `Workflow '${name}' status is Implemented`);
  }

  // 7. Four project configs + registry exist
  const expectedProjects = ["scholars", "resource-centre", "serena", "ai-video-factory"];
  for (const name of expectedProjects) {
    check(checkFile(`projects/${name}/config.json`), `Project config projects/${name}/config.json exists`);
    check(checkFile(`projects/${name}/README.md`), `Project README projects/${name}/README.md exists`);
  }
  check(checkFile("projects/registry.json"), "Project registry projects/registry.json exists");

  // 8. Project configs are valid JSON
  for (const name of expectedProjects) {
    try {
      const pcfg = JSON.parse(readFile(`projects/${name}/config.json`));
      for (const key of ["name", "repository", "purpose", "main_technologies", "boundaries"]) {
        check(key in pcfg, `Project '${name}' config has '${key}' key`);
      }
    } catch (e) {
      check(false, `Project '${name}' config is valid JSON`);
    }
  }

  // 9. Documentation files updated (not placeholders)
  const docs = ["docs/ARCHITECTURE.md", "docs/SECURITY.md", "docs/ROADMAP.md"];
  for (const doc of docs) {
    const content = readFile(doc);
    check(!content.includes("Placeholder"), `${doc} is not a placeholder`);
    check(content.includes("Implemented") || content.includes("In progress"), `${doc} reflects implementation status`);
  }

  // 10. README and AGENTS.md updated
  const readme = readFile("README.md");
  const agentsMd = readFile("AGENTS.md");
  check(!readme.includes("Placeholder"), "README.md is not a placeholder");
  check(/[Ss]even agents/.test(agentsMd), "AGENTS.md reflects seven agents");
  check(agentsMd.includes("Reporter"), "AGENTS.md mentions Reporter agent");
  check(agentsMd.includes("reports/"), "AGENTS.md references reports directory");
  check(agentsMd.includes("Mandatory Reporting Protocol"), "AGENTS.md documents mandatory reporting protocol");
  check(agentsMd.includes("Dependency-Aware Orchestration"), "AGENTS.md documents dependency-aware orchestration");
  check(!agentsMd.includes("private OpenCode-native"), "AGENTS.md does not describe repository as private");
  // Reporting protocol: creation → sanitization → commit → push → verify → SHA → links
  check(agentsMd.includes("Create the report."), "AGENTS.md documents report creation step");
  check(agentsMd.includes("Verify its contents."), "AGENTS.md documents report verification step");
  check(agentsMd.includes("Commit only authorized files."), "AGENTS.md documents commit step");
  check(agentsMd.includes("Push to the designated branch."), "AGENTS.md documents push step");
  check(agentsMd.includes("Independently verify the remote commit."), "AGENTS.md documents remote verification step");
  check(agentsMd.includes("full commit SHA"), "AGENTS.md documents commit SHA requirement");
  check(agentsMd.includes("direct GitHub commit URL"), "AGENTS.md documents commit URL requirement");
  check(agentsMd.includes("direct GitHub report URL"), "AGENTS.md documents report URL requirement");
  // No conflicting separate-publication-approval requirement
  check(!/requires separate publication approval/i.test(agentsMd), "AGENTS.md does not require separate publication approval");
  check(!/requires additional approval for publication/i.test(agentsMd), "AGENTS.md does not require repeat publication approval");
  // No outdated ImperioKDB/Updates exclusive publishing requirement
  check(!/exclusive.*ImperioKDB\/Updates|ImperioKDB\/Updates.*exclusive/i.test(agentsMd), "AGENTS.md does not require exclusive ImperioKDB/Updates publishing");

  // 11. Secret scan — Git-based file inventory, includes reports, excludes only synthetic fixtures
  scanForSecrets();
  validateSecretFixtures();

  // 12. Approval gates defined
  const boundaries = config.boundaries || {};
  const approvalGates = boundaries.approval_gates || config.approval_gates || {};
  check(typeof approvalGates === "object" && Object.keys(approvalGates).length > 0, "Approval gates defined in workbench-manifest.json");

  // 13. No autonomous merge/deploy
  check(boundaries.no_autonomous_merge === true, "no_autonomous_merge is true");
  check(boundaries.no_autonomous_deploy === true, "no_autonomous_deploy is true");

  // 14. opencode.json validity and permission configuration
  let opencodeConfig;
  try {
    opencodeConfig = JSON.parse(readFile("opencode.json"));
    check(true, "opencode.json is valid JSON");
  } catch (e) {
    check(false, `opencode.json invalid: ${e.message}`);
    opencodeConfig = {};
  }

  // 15. All seven agents registered in opencode.json
  const opencodeAgents = opencodeConfig.agents || {};
  const opencodeAgentNames = Object.keys(opencodeAgents);
  for (const name of expectedAgents) {
    check(opencodeAgentNames.includes(name), `Agent '${name}' registered in opencode.json`);
  }

  // 16. Orchestrator has subagent delegation to all six specialists including reporter
  const orchestratorPerms = (opencodeAgents.orchestrator && opencodeAgents.orchestrator.permissions) || [];
  const subagentResources = orchestratorPerms
    .filter((p) => p.action === "subagent")
    .map((p) => p.resource);
  for (const specialist of ["researcher", "planner", "developer", "qa-engineer", "reviewer", "reporter"]) {
    check(subagentResources.includes(specialist), `Orchestrator can delegate to '${specialist}' subagent`);
  }

  // 17. Orchestrator has no edit/write/shell permissions (read-only source access)
  const orchAllowActions = orchestratorPerms.filter((p) => p.effect === "allow").map((p) => p.action);
  check(!orchAllowActions.includes("edit"), "Orchestrator does NOT have edit permission (read-only source)");
  check(!orchAllowActions.includes("write"), "Orchestrator does NOT have write permission");
  check(!orchAllowActions.includes("shell"), "Orchestrator does NOT have shell permission");

  // 18. Developer uses correct native edit action with ask (not allow)
  const developerPerms = (opencodeAgents.developer && opencodeAgents.developer.permissions) || [];
  const developerAllowActions = developerPerms
    .filter((p) => p.effect === "allow")
    .map((p) => p.action);
  const developerAskActions = developerPerms
    .filter((p) => p.effect === "ask")
    .map((p) => p.action);
  check(developerAskActions.includes("edit"), "Developer asks for edit permission (approval-gated)");
  check(!developerAllowActions.includes("write"), "Developer does NOT use invalid 'write' action");
  check(!developerAllowActions.includes("create_branch"), "Developer does NOT use invalid 'create_branch' action");

  // 19. Developer edit: ordinary file edits resolve to "ask" (approval-gated)
  const developerEditEffect = getEffectivePermission(developerPerms, "edit", "*");
  check(developerEditEffect === "ask", "Developer ordinary file edits resolve to 'ask' (approval-gated)");

  // 20. Developer credential file edits resolve to "deny"
  const developerEnvEditEffect = getEffectivePermission(developerPerms, "edit", "*.env*");
  const developerCredEditEffect = getEffectivePermission(developerPerms, "edit", "credentials.json");
  const developerSecretEditEffect = getEffectivePermission(developerPerms, "edit", "*.secret*");
  check(developerEnvEditEffect === "deny", "Developer credential file edits (*.env*) resolve to 'deny'");
  check(developerCredEditEffect === "deny", "Developer credential file edits (credentials.json) resolve to 'deny'");
  check(developerSecretEditEffect === "deny", "Developer credential file edits (*.secret*) resolve to 'deny'");

  // 21. Developer shell: deny on "*" precedes ask for specific commands
  const developerShellDeny = developerPerms.find((p) => p.effect === "deny" && p.action === "shell" && p.resource === "*");
  const developerShellAsks = developerPerms.filter((p) => p.effect === "ask" && p.action === "shell");
  check(!!developerShellDeny, "Developer denies shell on '*' (approval-gated)");
  check(developerShellAsks.length > 0, "Developer asks for specific shell commands only");
  const developerShellAskResources = developerShellAsks.map((p) => p.resource);
  const harmlessCommands = ["node tests/validate.js", "npm test", "git status", "git diff"];
  for (const cmd of harmlessCommands) {
    check(developerShellAskResources.includes(cmd), `Developer shell asks for '${cmd}'`);
  }
  check(!developerShellAskResources.includes("*"), "Developer does NOT have blanket shell ask on '*'");

  // Verify deny precedes ask (last-match precedence: ask wins for specific commands, deny wins for arbitrary)
  const denyShellIdx = developerPerms.findIndex((p) => p.effect === "deny" && p.action === "shell" && p.resource === "*");
  const firstAskShellIdx = developerPerms.findIndex((p) => p.effect === "ask" && p.action === "shell");
  check(denyShellIdx >= 0 && firstAskShellIdx >= 0 && denyShellIdx < firstAskShellIdx, "Developer shell deny precedes ask (last-match precedence)");

  // 22. Developer denies autonomous merge, push, deploy, credential_retrieval
  check(developerPerms.some((p) => p.effect === "deny" && p.action === "merge"), "Developer denies merge");
  check(developerPerms.some((p) => p.effect === "deny" && p.action === "push"), "Developer denies push");
  check(developerPerms.some((p) => p.effect === "deny" && p.action === "deploy"), "Developer denies deploy");
  check(developerPerms.some((p) => p.effect === "deny" && p.action === "credential_retrieval"), "Developer denies credential_retrieval");

  // 23. Reporter uses correct native edit action (not write)
  const reporterPerms = (opencodeAgents.reporter && opencodeAgents.reporter.permissions) || [];
  const reporterAllowActions = reporterPerms.filter((p) => p.effect === "allow").map((p) => p.action);
  check(reporterAllowActions.includes("edit"), "Reporter has edit permission in opencode.json");
  check(!reporterAllowActions.includes("write"), "Reporter does NOT use invalid 'write' action");
  check(!reporterAllowActions.includes("shell"), "Reporter does NOT have shell permission");

  // 24. Reporter report edits are permitted
  const reporterReportEditEffect = getEffectivePermission(reporterPerms, "edit", "reports/*");
  check(reporterReportEditEffect === "allow", "Reporter report edits are permitted (reports/*)");

  // 25. Reporter edits outside reports/ are denied
  const reporterOutsideEditEffect = getEffectivePermission(reporterPerms, "edit", "*");
  check(reporterOutsideEditEffect === "deny", "Reporter edits outside reports/ are denied");

  // 26. Reporter denies shell, merge, push, deploy, credential_retrieval
  check(reporterPerms.some((p) => p.effect === "deny" && p.action === "shell"), "Reporter denies shell");
  check(reporterPerms.some((p) => p.effect === "deny" && p.action === "merge"), "Reporter denies merge");
  check(reporterPerms.some((p) => p.effect === "deny" && p.action === "push"), "Reporter denies push");
  check(reporterPerms.some((p) => p.effect === "deny" && p.action === "deploy"), "Reporter denies deploy");
  check(reporterPerms.some((p) => p.effect === "deny" && p.action === "credential_retrieval"), "Reporter denies credential_retrieval");

  // 27. QA Engineer shell commands resolve to "ask" (approval-gated)
  const qaPerms = (opencodeAgents["qa-engineer"] && opencodeAgents["qa-engineer"].permissions) || [];
  const qaShellAsks = qaPerms.filter((p) => p.effect === "ask" && p.action === "shell");
  check(qaShellAsks.length > 0, "QA Engineer asks for specific shell commands only");
  const qaShellAskResources = qaShellAsks.map((p) => p.resource);
  const qaHarmlessCommands = ["node tests/validate.js", "npm test"];
  for (const cmd of qaHarmlessCommands) {
    check(qaShellAskResources.includes(cmd), `QA Engineer shell asks for '${cmd}'`);
  }
  check(!qaShellAskResources.includes("*"), "QA Engineer does NOT have blanket shell ask on '*'");

  // QA Engineer shell deny precedes ask
  const qaShellDenyIdx = qaPerms.findIndex((p) => p.effect === "deny" && p.action === "shell" && p.resource === "*");
  const qaFirstAskShellIdx = qaPerms.findIndex((p) => p.effect === "ask" && p.action === "shell");
  check(qaShellDenyIdx >= 0 && qaFirstAskShellIdx >= 0 && qaShellDenyIdx < qaFirstAskShellIdx, "QA Engineer shell deny precedes ask (last-match precedence)");

  // 28. QA Engineer denies credential file edits and autonomous operations
  check(qaPerms.some((p) => p.effect === "deny" && p.action === "merge"), "QA Engineer denies merge");
  check(qaPerms.some((p) => p.effect === "deny" && p.action === "push"), "QA Engineer denies push");
  check(qaPerms.some((p) => p.effect === "deny" && p.action === "deploy"), "QA Engineer denies deploy");
  check(qaPerms.some((p) => p.effect === "deny" && p.action === "credential_retrieval"), "QA Engineer denies credential_retrieval");
  check(qaPerms.every((p) => !(p.effect === "allow" && p.action === "edit")), "QA Engineer does NOT have edit permission (no source modifications)");

  // 29. Unauthorized specialist shell operations are denied
  const unauthenticatedAgents = ["researcher", "planner", "reviewer"];
  for (const name of unauthenticatedAgents) {
    const agentPerms = (opencodeAgents[name] && opencodeAgents[name].permissions) || [];
    check(agentPerms.some((p) => p.effect === "deny" && p.action === "shell"), `Agent '${name}' denies shell`);
    check(agentPerms.some((p) => p.effect === "deny" && p.action === "edit"), `Agent '${name}' denies edit`);
  }

  // 30. No agent has external_directory access
  for (const name of expectedAgents) {
    const agentPerms = (opencodeAgents[name] && opencodeAgents[name].permissions) || [];
    const externalDeny = agentPerms.filter((p) => p.action === "external_directory" && p.effect === "deny");
    check(externalDeny.length > 0, `Agent '${name}' denies external_directory access`);
  }

  // 31. No agent can read .env* files
  for (const name of expectedAgents) {
    const agentPerms = (opencodeAgents[name] && opencodeAgents[name].permissions) || [];
    const envDeny = agentPerms.filter((p) => p.resource === "*.env*" && p.effect === "deny");
    check(envDeny.length > 0, `Agent '${name}' denies .env* file reads`);
  }

  // 32. Orchestrator mode is primary, all others are subagent
  check(opencodeAgents.orchestrator && opencodeAgents.orchestrator.mode === "primary", "Orchestrator mode is primary");
  for (const name of ["researcher", "planner", "developer", "qa-engineer", "reviewer", "reporter"]) {
    check(opencodeAgents[name] && opencodeAgents[name].mode === "subagent", `Agent '${name}' mode is subagent`);
  }

  // 33. Dependency-aware orchestration: orchestrator spec mentions dependency tracking and invocation recording
  const orchestratorSpec = readFile("agents/orchestrator.md");
  check(/dependenc/i.test(orchestratorSpec), "Orchestrator spec mentions dependency tracking");
  check(/invocation/i.test(orchestratorSpec), "Orchestrator spec mentions invocation recording");
  check(/failed handoff/i.test(orchestratorSpec), "Orchestrator spec mentions failed handoff recording");

  // 34. Reporter spec: restricted edit path, no shell, no autonomous operations
  const reporterSpec = readFile("agents/reporter.md");
  check(/reports\//.test(reporterSpec), "Reporter spec references reports/ directory");
  check(/no autonomous/i.test(reporterSpec), "Reporter spec restricts autonomous operations");
  check(/shell/.test(reporterSpec), "Reporter spec addresses shell restrictions");

  // 35. QA Engineer spec: shell permission, no source edits
  const qaSpec = readFile("agents/qa-engineer.md");
  check(/shell/.test(qaSpec), "QA Engineer spec addresses shell permissions");
  check(/no direct application source/i.test(qaSpec), "QA Engineer spec restricts direct source modification");

  // 36. Developer spec: edit permission, credential denial, approval-gated shell
  const developerSpec = readFile("agents/developer.md");
  check(/edit/.test(developerSpec), "Developer spec references edit operations");
  check(/credential/i.test(developerSpec), "Developer spec addresses credential restrictions");
  check(/per-command/.test(developerSpec) || /per.command/.test(developerSpec), "Developer spec mentions per-command shell approval");

  // 37. Repository isolation: no Scholars directory in workbench root
  check(!checkDir("Scholars"), "No Scholars directory in workbench root");
  check(!checkDir("Scholars-Resource-Centre"), "No Scholars-Resource-Centre directory in workbench root");

  // 38. Cross-platform path handling: validator uses node:path
  const validatorContent = readFile("tests/validate.js");
  check(/path\.(join|resolve|sep|relative)/.test(validatorContent), "Validator uses node:path APIs for cross-platform path handling");

  // 39. Reports directory exists
  check(checkDir("reports"), "reports/ directory exists");

  // 40. Task 004 boundary acknowledged
  check("task_004" in boundaries || "task_004.1" in boundaries || "task_004.2" in boundaries, "Task 004 boundary declared in workbench-manifest.json");

  // 41. Mandatory reporting: workflows reference Reporter and reports/TASK-ID
  for (const wf of expectedWorkflows) {
    const content = readFile(`workflows/${wf}/README.md`);
    check(/Reporter/.test(content), `Workflow '${wf}' references Reporter`);
    check(/reports\/TASK-ID/.test(content), `Workflow '${wf}' references reports/TASK-ID report path`);
  }

  // 42. GitHub Actions workflow exists and is configured correctly
  check(checkFile(".github/workflows/validation.yml"), "GitHub Actions validation workflow exists");
  const ciContent = readFile(".github/workflows/validation.yml");
  check(ciContent.includes("runs-on: ${{ matrix.os }}") || ciContent.includes("runs-on: ubuntu-latest") || ciContent.includes("runs-on: windows-latest"), "GitHub Actions specifies runner OS");
  check(ciContent.includes("node"), "GitHub Actions uses Node.js");
  check(ciContent.includes("22"), "GitHub Actions pins Node.js major version 22");
  check(ciContent.includes("pull_request"), "GitHub Actions triggers on pull_request");
  check(ciContent.includes("main"), "GitHub Actions includes main branch targeting");
  check(ciContent.includes("contents: read"), "GitHub Actions uses least-privilege permissions");

  // 43. No hardcoded passing assertions outside JSON validation
  const hardcodedPasses = validatorContent.match(/check\(true,/g) || [];
  const jsonValidationPasses = (validatorContent.match(/check\(true, "[^"]*(?:JSON|json)[^"]*"/g) || []).length;
  check(hardcodedPasses.length <= jsonValidationPasses, "Validator has no hardcoded passing assertions outside JSON validation");

  // ========================================================================
  // Summary
  // ========================================================================
  console.log(`\n=== Results: ${ERRORS.length} error(s) ===`);
  if (WARNINGS.length > 0) {
    console.log(`Warnings: ${WARNINGS.length}`);
    for (const w of WARNINGS) {
      console.log(`  WARN: ${w}`);
    }
  }
  if (ERRORS.length > 0) {
    console.log("FAILED — errors above must be resolved before Task 004.3 is considered complete.");
    return 1;
  }
  console.log("PASSED — all validation checks passed.");
  return 0;
}

process.exit(main());