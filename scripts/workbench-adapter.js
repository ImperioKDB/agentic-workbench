#!/usr/bin/env node
"use strict";

/**
 * workbench-adapter.js
 *
 * Project-scoped OpenCode Workbench integration adapter.
 *
 * Generates a project-level `.opencode.json` that registers the seven
 * Workbench agents (system: {file:<ABS>/agents/<name>.md}) against a target
 * project directory. Designed as a dependency-free Node.js script using only
 * Node built-ins.
 *
 * Usage:
 *   node scripts/workbench-adapter.js <target> [--workbench-root <root>] [--dry-run] [--rollback] [--force]
 *
 * Stages:
 *   1. Validate Workbench root contains all seven agent files.
 *   2. Validate each agent path canonicalizes within --workbench-root/agents/.
 *   3. Detect existing <target>/.opencode.json; refuse unless --force.
 *   4. Generate project-scoped .opencode.json (deny-* baseline preserved;
 *      ask rules for Developer/QA shell/edit; Reporter edit restricted to
 *      reports/*; no credentials, no provider settings, no machine-specific
 *      paths).
 *   5. Back up any pre-existing config to <target>/.workbench-backups/<ts>/.
 *   6. Idempotent: re-run without --force detects existing config and exits
 *      cleanly.
 *   7. Rollback restores prior config byte-for-byte from timestamped backup.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const AGENT_NAMES = [
  "orchestrator",
  "researcher",
  "planner",
  "developer",
  "qa-engineer",
  "reviewer",
  "reporter",
];

const DEFAULT_WORKBENCH_ROOT = path.resolve(__dirname, "..");

const OPENAI_SCHEMA = "https://opencode.ai/config.json";

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function log(message) {
  console.log(message);
}

// --- Argument parsing -------------------------------------------------------

function parseArgs(argv) {
  const args = {
    target: null,
    workbenchRoot: DEFAULT_WORKBENCH_ROOT,
    dryRun: false,
    rollback: false,
    force: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--target" || a === "-t") {
      args.target = argv[++i];
    } else if (a === "--workbench-root") {
      args.workbenchRoot = argv[++i];
    } else if (a === "--dry-run") {
      args.dryRun = true;
    } else if (a === "--rollback") {
      args.rollback = true;
    } else if (a === "--force") {
      args.force = true;
    } else if (a === "--help" || a === "-h") {
      printUsage();
      process.exit(0);
    } else if (!a.startsWith("--")) {
      if (args.target === null) {
        args.target = a;
      } else {
        fail(`Unexpected positional argument: ${a}`);
      }
    } else {
      fail(`Unknown flag: ${a}`);
    }
  }

  return args;
}

function printUsage() {
  log("Usage: node scripts/workbench-adapter.js <target> [options]");
  log("");
  log("Options:");
  log("  --workbench-root <root>  Path to the Workbench repository root");
  log("                           (default: parent of this script's directory)");
  log("  --dry-run                Print planned actions; write nothing");
  log("  --rollback               Restore prior config from timestamped backup");
  log("  --force                  Overwrite existing <target>/.opencode.json");
  log("");
  log("Generates a project-scoped .opencode.json registering the seven");
  log("Workbench agents for the target project directory.");
}

// --- Path helpers -----------------------------------------------------------

function canonicalize(dir) {
  try {
    // fs.realpathSync resolves symlinks to their real on-disk path, which is
    // required for the containment check to defeat symlink escapes. Fall back
    // to path.resolve (lexical normalization only) when the path does not yet
    // exist on disk or realpath is unavailable.
    return fs.realpathSync(dir);
  } catch (e) {
    return path.resolve(dir);
  }
}

function isContained(child, parent) {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

// --- Workbench validation ---------------------------------------------------

function validateWorkbenchRoot(workbenchRoot) {
  if (!fs.existsSync(workbenchRoot) || !fs.statSync(workbenchRoot).isDirectory()) {
    fail(`Workbench root does not exist or is not a directory: ${workbenchRoot}`);
  }

  const agentsDir = path.join(workbenchRoot, "agents");
  if (!fs.existsSync(agentsDir) || !fs.statSync(agentsDir).isDirectory()) {
    fail(`Workbench root does not contain an agents/ directory: ${agentsDir}`);
  }

  const missing = [];
  for (const name of AGENT_NAMES) {
    const agentFile = path.join(agentsDir, `${name}.md`);
    if (!fs.existsSync(agentFile) || !fs.statSync(agentFile).isFile()) {
      missing.push(agentFile);
    }
  }

  if (missing.length > 0) {
    fail(`Workbench root is missing required agent files:\n  ${missing.join("\n  ")}`);
  }

  // Validate each agent path canonicalizes and is contained within agents/.
  const canonicalAgentsDir = canonicalize(agentsDir);
  for (const name of AGENT_NAMES) {
    const agentFile = path.join(agentsDir, `${name}.md`);
    const canonicalAgent = canonicalize(agentFile);
    if (!isContained(canonicalAgent, canonicalAgentsDir)) {
      fail(`Agent path escapes agents/ directory: ${agentFile}`);
    }
  }

  log(`Validated Workbench root: ${workbenchRoot}`);
  log(`Found all ${AGENT_NAMES.length} agent files in agents/`);
  return agentsDir;
}

// --- Config generation ------------------------------------------------------

function buildProjectConfig(agentsDirAbs) {
  const agents = {};
  for (const name of AGENT_NAMES) {
    const agentFileAbs = path.join(agentsDirAbs, `${name}.md`);
    agents[name] = {
      description: agentDescription(name),
      permissions: agentPermissions(name),
      mode: name === "orchestrator" ? "primary" : "subagent",
      system: `{file:${agentFileAbs}}`,
    };
  }

  return {
    $schema: OPENAI_SCHEMA,
    default_agent: "orchestrator",
    agents,
  };
}

function agentDescription(name) {
  const descriptions = {
    orchestrator:
      "Coordinates multi-agent orchestration workflows, decomposes tasks, delegates to specialists, enforces approval gates, and produces final execution summaries.",
    researcher:
      "Investigates codebases and documentation, researches technical solutions, compares implementation approaches, and produces evidence-based research reports.",
    planner:
      "Converts requirements into implementation plans, identifies affected files and systems, defines acceptance criteria, and breaks work into independently verifiable stages.",
    developer:
      "Implements approved changes following project conventions, creates isolated branches, writes maintainable code, and avoids unrelated modifications.",
    "qa-engineer":
      "Runs relevant tests, validates expected behaviour, detects regressions, verifies builds and configurations, and produces test evidence.",
    reviewer:
      "Independently inspects implementation changes, reviews security architecture and maintainability, identifies regressions and incomplete requirements, and verifies acceptance criteria.",
    reporter:
      "Receives execution evidence from the Orchestrator and specialist agents, produces structured Markdown reports, maintains persistent task histories, and prepares reports for authorized GitHub publication.",
  };
  return descriptions[name];
}

function agentPermissions(name) {
  const baseline = [
    { effect: "deny", resource: "*", action: "*" },
    { effect: "allow", resource: "*", action: "read" },
    { effect: "allow", resource: "*", action: "glob" },
    { effect: "allow", resource: "*", action: "grep" },
    { effect: "deny", resource: "*.env*", action: "read" },
    { effect: "deny", resource: "*", action: "external_directory" },
  ];

  if (name === "orchestrator") {
    return [
      ...baseline,
      { effect: "allow", resource: "researcher", action: "subagent" },
      { effect: "allow", resource: "planner", action: "subagent" },
      { effect: "allow", resource: "developer", action: "subagent" },
      { effect: "allow", resource: "qa-engineer", action: "subagent" },
      { effect: "allow", resource: "reviewer", action: "subagent" },
      { effect: "allow", resource: "reporter", action: "subagent" },
    ];
  }

  if (name === "developer") {
    return [
      ...baseline,
      // OpenCode V2 uses last-match-wins precedence. A broad deny-* rule for
      // "edit" is immediately followed by an ask rule, so edit operations are
      // approval-gated rather than flatly denied. Do not reorder these rules
      // without re-verifying the resulting effective permission.
      { effect: "deny", resource: "*", action: "edit" },
      { effect: "ask", resource: "*", action: "edit" },
      { effect: "deny", resource: "*.env*", action: "edit" },
      { effect: "deny", resource: "credentials.json", action: "edit" },
      { effect: "deny", resource: "*.secret*", action: "edit" },
      // OpenCode V2 uses last-match-wins precedence. The broad deny-* rule for
      // "shell" is followed by ask rules for specific safe commands, so those
      // operations are approval-gated rather than flatly denied.
      { effect: "deny", resource: "*", action: "shell" },
      { effect: "ask", resource: "node tests/validate.js", action: "shell" },
      { effect: "ask", resource: "npm test", action: "shell" },
      { effect: "ask", resource: "git status", action: "shell" },
      { effect: "ask", resource: "git diff", action: "shell" },
      { effect: "deny", resource: "*", action: "merge" },
      { effect: "deny", resource: "*", action: "push" },
      { effect: "deny", resource: "*", action: "deploy" },
      { effect: "deny", resource: "*", action: "credential_retrieval" },
    ];
  }

  if (name === "qa-engineer") {
    return [
      ...baseline,
      { effect: "deny", resource: "*", action: "edit" },
      { effect: "deny", resource: "*.env*", action: "edit" },
      { effect: "deny", resource: "credentials.json", action: "edit" },
      { effect: "deny", resource: "*.secret*", action: "edit" },
      { effect: "deny", resource: "*", action: "shell" },
      { effect: "ask", resource: "node tests/validate.js", action: "shell" },
      { effect: "ask", resource: "npm test", action: "shell" },
      { effect: "deny", resource: "*", action: "merge" },
      { effect: "deny", resource: "*", action: "push" },
      { effect: "deny", resource: "*", action: "deploy" },
      { effect: "deny", resource: "*", action: "credential_retrieval" },
    ];
  }

  if (name === "reporter") {
    return [
      ...baseline,
      // OpenCode V2 uses last-match-wins precedence. The broad deny-* rule for
      // "edit" is followed by a scoped allow rule for reports/*, so report
      // editing is permitted while all other edits remain denied. Do not
      // reorder these rules without re-verifying the resulting permission.
      { effect: "deny", resource: "*", action: "edit" },
      { effect: "allow", resource: "reports/*", action: "edit" },
      { effect: "deny", resource: "*", action: "shell" },
      { effect: "deny", resource: "*", action: "subagent" },
      { effect: "deny", resource: "*", action: "merge" },
      { effect: "deny", resource: "*", action: "push" },
      { effect: "deny", resource: "*", action: "deploy" },
      { effect: "deny", resource: "*", action: "credential_retrieval" },
    ];
  }

  // researcher, planner, reviewer: read-only specialists
  return [
    ...baseline,
    { effect: "deny", resource: "*", action: "edit" },
    { effect: "deny", resource: "*", action: "shell" },
    { effect: "deny", resource: "*", action: "subagent" },
    { effect: "deny", resource: "*", action: "merge" },
    { effect: "deny", resource: "*", action: "push" },
    { effect: "deny", resource: "*", action: "deploy" },
    { effect: "deny", resource: "*", action: "credential_retrieval" },
  ];
}

// --- Backup / rollback ------------------------------------------------------

// Monotonic counter used by timestamp() to guarantee unique backup directory
// names for rapid successive runs within the same millisecond.
let backupSequence = 0;

function timestamp() {
  const now = new Date();
  const iso = now.toISOString().replace(/[:.]/g, "-");
  // Sub-second precision: ISO retains milliseconds; the monotonic counter
  // guarantees unique directory names for backups within the same millisecond.
  return `${iso}-${++backupSequence}`;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest("hex");
}

function backupExistingConfig(configPath, dryRun) {
  const backupsDir = path.join(path.dirname(configPath), ".workbench-backups", timestamp());
  if (dryRun) {
    log(`[dry-run] Would back up ${configPath} to ${backupsDir}/`);
    return { backupsDir, wouldBackup: true };
  }
  ensureDir(backupsDir);
  fs.copyFileSync(configPath, path.join(backupsDir, ".opencode.json"));
  const hash = sha256File(configPath);
  fs.writeFileSync(
    path.join(backupsDir, ".opencode.json.sha256"),
    hash + "\n",
    "utf8"
  );
  log(`Backed up existing config to ${backupsDir}/ (sha256: ${hash})`);
  return { backupsDir, hash };
}

function findLatestBackup(targetDir) {
  const backupsDir = path.join(targetDir, ".workbench-backups");
  if (!fs.existsSync(backupsDir) || !fs.statSync(backupsDir).isDirectory()) {
    return null;
  }
  const entries = fs
    .readdirSync(backupsDir)
    .filter((e) => fs.statSync(path.join(backupsDir, e)).isDirectory())
    .sort()
    .reverse();
  if (entries.length === 0) {
    return null;
  }
  return path.join(backupsDir, entries[0]);
}

function rollback(targetDir, dryRun) {
  const configPath = path.join(targetDir, ".opencode.json");
  const backupDir = findLatestBackup(targetDir);

  if (!backupDir) {
    log(`No backup found for ${targetDir}; nothing to roll back.`);
    if (dryRun) {
      log("[dry-run] Would remove generated .opencode.json if present.");
    }
    if (!dryRun && fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
      log(`Removed generated ${configPath} (no prior config to restore).`);
    }
    return;
  }

  const backupConfig = path.join(backupDir, ".opencode.json");
  const backupHashFile = path.join(backupDir, ".opencode.json.sha256");

  if (!fs.existsSync(backupConfig)) {
    fail(`Backup directory exists but .opencode.json is missing: ${backupDir}`);
  }

  if (!fs.existsSync(backupHashFile)) {
    fail("Backup hash manifest missing — refusing to restore unverified backup");
  }
  const expectedHash = fs.readFileSync(backupHashFile, "utf8").trim();
  const actualHash = sha256File(backupConfig);
  if (expectedHash !== actualHash) {
    fail(
      `Backup hash mismatch for ${backupConfig}: expected ${expectedHash}, got ${actualHash}. Refusing to restore.`
    );
  }

  if (dryRun) {
    log(`[dry-run] Would restore ${backupConfig} to ${configPath}`);
    return;
  }

  fs.copyFileSync(backupConfig, configPath);
  log(`Rolled back ${configPath} from ${backupConfig}`);
}

// --- Main flow --------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.rollback) {
    const targetAbs = canonicalize(args.target || process.cwd());
    rollback(targetAbs, args.dryRun);
    return;
  }

  if (!args.target) {
    fail("Missing <target> argument. Usage: node scripts/workbench-adapter.js <target> [options]");
  }

  const targetAbs = canonicalize(args.target);
  const workbenchRootAbs = canonicalize(args.workbenchRoot);

  if (!fs.existsSync(targetAbs)) {
    fail(`Target directory does not exist: ${targetAbs}`);
  }

  const agentsDir = validateWorkbenchRoot(workbenchRootAbs);

  const configPath = path.join(targetAbs, ".opencode.json");
  const configExists = fs.existsSync(configPath);

  if (configExists && !args.force) {
    log(`Existing .opencode.json detected at ${configPath}; exiting cleanly (idempotent). Use --force to overwrite.`);
    return;
  }

  if (configExists && args.force) {
    log(`Existing .opencode.json detected at ${configPath}; --force specified, will overwrite.`);
  }

  const projectConfig = buildProjectConfig(canonicalize(agentsDir));

  const configJson = JSON.stringify(projectConfig, null, 4) + "\n";

  if (args.dryRun) {
    log(`[dry-run] Would write ${configPath}:`);
    log(configJson);
    return;
  }

  // Back up any existing config before writing.
  if (configExists) {
    backupExistingConfig(configPath, false);
  }

  // Write to temp file then rename for atomicity.
  const tempPath = configPath + ".tmp";
  fs.writeFileSync(tempPath, configJson, "utf8");
  fs.renameSync(tempPath, configPath);

  log(`Generated project-scoped config: ${configPath}`);
  log(`Registered ${AGENT_NAMES.length} agents (orchestrator primary, specialists subagent).`);
}

main();
