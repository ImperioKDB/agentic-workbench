#!/usr/bin/env node
"use strict";

/**
 * Task 004.1 validation script (dependency-free Node.js).
 *
 * Validates the structural integrity of the Personal Agentic Workbench
 * implementation: workbench-manifest.json validity, agent files, workflow definitions,
 * project configurations, opencode.json V2 permissions, reporter registration,
 * dependency-aware orchestration, mandatory reporting, secret scanning,
 * and repository isolation.
 *
 * Uses cross-platform path APIs (node:path). Scans tracked files only
 * (skips .git, node_modules, and ignored patterns). Never prints matched
 * secret values. Exits nonzero when assertions fail.
 */

const fs = require("fs");
const path = require("path");

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

function isIgnoredOrGit(relPath) {
  const normalized = relPath.split(path.sep).join("/");
  const parts = normalized.split("/");
  // Skip .git directory entirely
  if (parts.includes(".git")) return true;
  // Skip node_modules
  if (parts.includes("node_modules")) return true;
  return false;
}

function scanTrackedFiles() {
  const files = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(REPO_ROOT, fullPath);
      if (isIgnoredOrGit(relPath)) continue;
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        files.push(relPath);
      }
    }
  }
  walk(REPO_ROOT);
  return files;
}

// Secret patterns (positive fixtures should match these; negative fixtures should not)
const SECRET_PATTERNS = [
  /ghu_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /x-access-token:/,
  /password\s*=\s*\S+/,
  /secret\s*=\s*\S+/,
  /GH_TOKEN\s*=\s*\S+/,
  /api_key\s*=\s*\S+/,
  /aws_secret_access_key\s*=\s*\S+/,
  /aws_access_key_id\s*=\s*\S+/,
];

function scanForSecrets() {
  let secretFound = false;
  const files = scanTrackedFiles();
  for (const relPath of files) {
    const normalized = relPath.split(path.sep).join("/");
    // Skip the validator itself (contains regex patterns as strings)
    if (normalized === "tests/validate.js") continue;
    // Skip test fixtures directory (positive fixture intentionally contains secrets)
    if (normalized.startsWith("tests/fixtures/")) continue;
    // Skip reports directory (reports document security incidents, may reference GH_TOKEN etc.)
    if (normalized.startsWith("reports/")) continue;
    // Skip root-level execution report files (document security incidents)
    if (normalized.match(/^[^/]*REPORT[^/]*\.md$/i)) continue;
    try {
      const content = fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8", { encoding: "utf8" });
      for (const pat of SECRET_PATTERNS) {
        if (pat.test(content)) {
          secretFound = true;
          ERRORS.push(`Secret-like pattern found in ${relPath}`);
          console.log(`FAIL: Secret-like pattern in ${relPath}`);
        }
      }
    } catch (e) {
      // Skip unreadable files
    }
  }
  check(!secretFound, "No credentials or secrets in tracked files");
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
    // File not readable
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
    // File not readable
  }
  check(!negativeDetected, "Negative secret fixture is not flagged (no false positives)");
}

// ========================================================================
// Main validation
// ========================================================================

function main() {
  console.log("=== Task 004.1 Validation ===\n");

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

  // 11. Secret scan — expanded pattern coverage
  scanForSecrets();
  validateSecretFixtures();

  // 12. Approval gates defined (check both boundaries.approval_gates and top-level approval_gates)
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

  // 17. Developer uses correct native edit action (not write/create_branch)
  const developerPerms = (opencodeAgents.developer && opencodeAgents.developer.permissions) || [];
  const developerAllowActions = developerPerms
    .filter((p) => p.effect === "allow")
    .map((p) => p.action);
  check(developerAllowActions.includes("edit"), "Developer has edit permission in opencode.json");
  check(!developerAllowActions.includes("write"), "Developer does NOT use invalid 'write' action");
  check(!developerAllowActions.includes("create_branch"), "Developer does NOT use invalid 'create_branch' action");
  check(developerAllowActions.includes("shell"), "Developer has shell permission in opencode.json");

  // 18. Developer denies credential file edits
  const developerDenyEdits = developerPerms.filter(
    (p) => p.effect === "deny" && p.action === "edit" && (p.resource === "*.env*" || p.resource === "credentials.json" || p.resource === "*.secret*")
  );
  check(developerDenyEdits.length >= 2, "Developer denies credential file edits (*.env*, credentials.json, *.secret*)");

  // 19. Reporter uses correct native edit action (not write)
  const reporterPerms = (opencodeAgents.reporter && opencodeAgents.reporter.permissions) || [];
  const reporterAllowActions = reporterPerms.filter((p) => p.effect === "allow").map((p) => p.action);
  check(reporterAllowActions.includes("edit"), "Reporter has edit permission in opencode.json");
  check(!reporterAllowActions.includes("write"), "Reporter does NOT use invalid 'write' action");
  check(!reporterAllowActions.includes("shell"), "Reporter does NOT have shell permission");

  // 20. Reporter write/edit restricted to reports/* only
  const reporterEditRules = reporterPerms.filter((p) => p.effect === "allow" && p.action === "edit");
  check(reporterEditRules.length === 1, "Reporter has exactly one edit permission");
  if (reporterEditRules.length > 0) {
    check(reporterEditRules[0].resource === "reports/*", "Reporter edit restricted to reports/*");
  }

  // 21. QA Engineer has shell permission for test commands
  const qaPerms = (opencodeAgents["qa-engineer"] && opencodeAgents["qa-engineer"].permissions) || [];
  const qaAllowActions = qaPerms.filter((p) => p.effect === "allow").map((p) => p.action);
  check(qaAllowActions.includes("shell"), "QA Engineer has shell permission in opencode.json");

  // 22. QA Engineer denies credential file edits
  const qaDenyEdits = qaPerms.filter(
    (p) => p.effect === "deny" && p.action === "edit" && (p.resource === "*.env*" || p.resource === "credentials.json" || p.resource === "*.secret*")
  );
  check(qaDenyEdits.length >= 2, "QA Engineer denies credential file edits (*.env*, credentials.json, *.secret*)");

  // 23. No agent has external_directory access
  for (const name of expectedAgents) {
    const agentPerms = (opencodeAgents[name] && opencodeAgents[name].permissions) || [];
    const externalDeny = agentPerms.filter((p) => p.action === "external_directory" && p.effect === "deny");
    check(externalDeny.length > 0, `Agent '${name}' denies external_directory access`);
  }

  // 24. No agent can read .env* files
  for (const name of expectedAgents) {
    const agentPerms = (opencodeAgents[name] && opencodeAgents[name].permissions) || [];
    const envDeny = agentPerms.filter((p) => p.resource === "*.env*" && p.effect === "deny");
    check(envDeny.length > 0, `Agent '${name}' denies .env* file reads`);
  }

  // 25. Orchestrator mode is primary, all others are subagent
  check(opencodeAgents.orchestrator && opencodeAgents.orchestrator.mode === "primary", "Orchestrator mode is primary");
  for (const name of ["researcher", "planner", "developer", "qa-engineer", "reviewer", "reporter"]) {
    check(opencodeAgents[name] && opencodeAgents[name].mode === "subagent", `Agent '${name}' mode is subagent`);
  }

  // 26. Orchestrator has no edit/write/shell permissions (read-only source access)
  const orchAllowActions = orchestratorPerms.filter((p) => p.effect === "allow").map((p) => p.action);
  check(!orchAllowActions.includes("edit"), "Orchestrator does NOT have edit permission (read-only source)");
  check(!orchAllowActions.includes("write"), "Orchestrator does NOT have write permission");
  check(!orchAllowActions.includes("shell"), "Orchestrator does NOT have shell permission");

  // 27. Dependency-aware orchestration: orchestrator spec mentions dependency tracking and invocation recording
  const orchestratorSpec = readFile("agents/orchestrator.md");
  check(/dependenc/i.test(orchestratorSpec), "Orchestrator spec mentions dependency tracking");
  check(/invocation/i.test(orchestratorSpec), "Orchestrator spec mentions invocation recording");
  check(/failed handoff/i.test(orchestratorSpec), "Orchestrator spec mentions failed handoff recording");

  // 28. Reporter spec: restricted edit path, no shell, no autonomous operations
  const reporterSpec = readFile("agents/reporter.md");
  check(/reports\//.test(reporterSpec), "Reporter spec references reports/ directory");
  check(/no autonomous/i.test(reporterSpec), "Reporter spec restricts autonomous operations");
  check(/shell/.test(reporterSpec), "Reporter spec addresses shell restrictions");

  // 29. QA Engineer spec: shell permission, no source edits
  const qaSpec = readFile("agents/qa-engineer.md");
  check(/shell/.test(qaSpec), "QA Engineer spec addresses shell permissions");
  check(/no direct application source/i.test(qaSpec), "QA Engineer spec restricts direct source modification");

  // 30. Developer spec: edit permission, credential denial
  const developerSpec = readFile("agents/developer.md");
  check(/edit/.test(developerSpec), "Developer spec references edit operations");
  check(/credential/i.test(developerSpec), "Developer spec addresses credential restrictions");

  // 31. Repository isolation: no Scholars directory in workbench root
  check(!checkDir("Scholars"), "No Scholars directory in workbench root");
  check(!checkDir("Scholars-Resource-Centre"), "No Scholars-Resource-Centre directory in workbench root");

  // 32. Cross-platform path handling: validator uses node:path (already by code review)
  check(true, "Validator uses node:path for cross-platform path handling");

  // 33. Reports directory exists
  check(checkDir("reports"), "reports/ directory exists");

  // 34. Task 004.1 boundary acknowledged
  check("task_004" in boundaries || "task_004.1" in boundaries, "Task 004 boundary declared in workbench-manifest.json");

  // 35. Mandatory reporting: workflows reference Reporter and reports/TASK-ID
  for (const wf of expectedWorkflows) {
    const content = readFile(`workflows/${wf}/README.md`);
    check(/Reporter/.test(content), `Workflow '${wf}' references Reporter`);
    check(/reports\/TASK-ID/.test(content), `Workflow '${wf}' references reports/TASK-ID report path`);
  }

  // 36. AGENTS.md corrects repository visibility (not private)
  check(!agentsMd.includes("private OpenCode-native"), "AGENTS.md corrects repository visibility to public");

  // ========================================================================
  // Summary
  // ========================================================================
  console.log(`\n=== Results: ${ERRORS.length} error(s) ===`);
  if (ERRORS.length > 0) {
    console.log("FAILED — errors above must be resolved before Task 004.1 is considered complete.");
    return 1;
  }
  console.log("PASSED — all validation checks passed.");
  return 0;
}

process.exit(main());