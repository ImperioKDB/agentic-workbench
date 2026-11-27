#!/usr/bin/env node
"use strict";

/**
 * workbench-adapter.js
 *
 * Project-scoped OpenCode Workbench integration adapter.
 *
 * Generates a directory-based OpenCode configuration at
 * <target>/.opencode/opencode.json that registers the seven Workbench agents
 * (system: {file:<ABS>/agents/<name>.md}) against a target project directory.
 *
 * Designed as a dependency-free Node.js script using only Node built-ins.
 *
 * Usage:
 *   node scripts/workbench-adapter.js <target> [--workbench-root <root>] [--dry-run] [--rollback] [--project-context <path>]
 *
 * Stages:
 *   1. Validate Workbench root contains all seven agent files.
 *   2. Validate each agent path canonicalizes within --workbench-root/agents/.
 *   3. Detect existing configs in BOTH .opencode/opencode.json and legacy
 *      .opencode.json. If both exist with different content, fail (no silent
 *      override or merge).
 *   4. Load optional --project-context file; derive approval-gated shell
 *      permissions from validated project-specific command entries; load
 *      project context into agent instructions.
 *   5. Generate .opencode/opencode.json (deny-* baseline preserved; ask rules
 *      for Developer/QA shell/edit; Reporter edit restricted to reports/*; no
 *      credentials, no provider settings, no machine-specific paths).
 *   6. Record ownership + SHA-256 hash of generated config for rollback
 *      verification; back up any pre-existing config to
 *      <target>/.workbench-backups/<ts>/.
 *   7. Rollback restores prior config byte-for-byte after verifying hash and
 *      ownership; refuses to remove unrelated pre-existing configs; refuses to
 *      overwrite configs modified since installation; removes only verified
 *      adapter-generated files; preserves unrelated project files/settings;
 *      restores atomically; requires explicit target directory.
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

const CONFIG_DIR_NAME = ".opencode";
const CONFIG_FILE_NAME = "opencode.json";
const LEGACY_CONFIG_FILE = ".opencode.json";
const LEGACY_CONFIG_FILE_C = ".opencode.jsonc";
const META_FILENAME = "adapter-meta.json";

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function currentOwner() {
  return process.env.USERNAME || process.env.USER || "unknown";
}

function log(message) {
  console.log(message);
}

// --- Argument parsing ---------------------------------------------------------

function parseArgs(argv) {
  const args = {
    target: null,
    workbenchRoot: DEFAULT_WORKBENCH_ROOT,
    dryRun: false,
    rollback: false,
    projectContext: null,
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
    } else if (a === "--project-context") {
      args.projectContext = argv[++i];
    } else if (a === "--force") {
      fail("--force has been removed; it cannot be implemented safely.");
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
  log("  --project-context <path> Project-specific context file");
  log("");
  log("Generates a directory-based .opencode/opencode.json registering the seven");
  log("Workbench agents for the target project directory.");
}

// --- Path helpers -------------------------------------------------------------

function canonicalize(dir) {
  try {
    return fs.realpathSync(dir);
  } catch (e) {
    return path.resolve(dir);
  }
}

function isContained(child, parent) {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function configDirPath(targetDir) {
  return path.join(targetDir, CONFIG_DIR_NAME);
}

function configPath(targetDir) {
  return path.join(targetDir, CONFIG_DIR_NAME, CONFIG_FILE_NAME);
}

function legacyConfigPath(targetDir) {
  return path.join(targetDir, LEGACY_CONFIG_FILE);
}

function legacyConfigPathC(targetDir) {
  return path.join(targetDir, LEGACY_CONFIG_FILE_C);
}

function dirConfigPathC(targetDir) {
  return path.join(targetDir, CONFIG_DIR_NAME, LEGACY_CONFIG_FILE_C);
}

// --- Workbench validation -----------------------------------------------------

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

// --- Project context loading --------------------------------------------------

function loadProjectContext(projectContextPath) {
  if (!projectContextPath) {
    return null;
  }

  const resolved = path.resolve(projectContextPath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    fail(`Project context file does not exist or is not a file: ${resolved}`);
  }

  let raw;
  try {
    raw = fs.readFileSync(resolved, "utf8");
  } catch (e) {
    fail(`Could not read project context file: ${e.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    fail(`Project context file is not valid JSON: ${e.message}`);
  }

  // Support both flat context files and { context: {...} } wrapped files.
  const ctx = parsed.context && typeof parsed.context === "object" ? parsed.context : parsed;

  // Validate project context structure.
  if (ctx.dev_test_commands !== undefined) {
    const raw = ctx.dev_test_commands;
    const cmdList = Array.isArray(raw) ? raw : String(raw).split(/\s+/);
    for (const cmd of cmdList) {
      const trimmed = cmd.trim();
      if (!trimmed) continue;
      if (typeof trimmed !== "string") {
        fail(`Project context 'dev_test_commands' entries must be strings; got: ${typeof trimmed}`);
      }
      // Reject shell metacharacters
      if (/[&|;<>$(){}[\]]/.test(trimmed)) {
        fail(`Project context command contains shell metacharacters: ${cmd}`);
      }
    }
  }

  return { path: resolved, context: ctx };
}

// --- Config generation --------------------------------------------------------

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

function deriveShellCommandsFromContext(context) {
  if (!context) {
    return [];
  }
  const raw = context.dev_test_commands;
  if (raw === undefined || raw === null) {
    return [];
  }
  // dev_test_commands must be an array of command strings.
  if (!Array.isArray(raw)) {
    return [];
  }
  const commands = [];
  const seen = new Set();
  for (const rawCmd of raw) {
    if (typeof rawCmd !== "string") continue;
    const cmd = rawCmd.trim();
    if (!cmd || seen.has(cmd)) continue;
    seen.add(cmd);
    // Reject wildcard permission patterns.
    if (cmd === "*") continue;
    // Reject shell metacharacters and ambiguous syntax.
    if (/[&|;<>$(){}[\]]/.test(cmd)) continue;
    // Reject destructive rm -rf patterns.
    if (/\brm\s+-rf\b/.test(cmd)) continue;
    commands.push({ effect: "ask", resource: cmd, action: "shell" });
  }
  return commands;
}

function buildProjectConfig(agentsDirAbs, projectContext, shellCommands) {
  const agents = {};
  for (const name of AGENT_NAMES) {
    const agentFileAbs = path.join(agentsDirAbs, `${name}.md`);
    const agentEntry = {
      description: agentDescription(name),
      permissions: agentPermissions(name, shellCommands),
      mode: name === "orchestrator" ? "primary" : "subagent",
      system: `{file:${agentFileAbs}}`,
    };
    // Load project context into agent instructions (not just stored JSON).
    if (projectContext && projectContext.context) {
      const ctx = projectContext.context;
      agentEntry.instructions = {
        identity: ctx.identity || null,
        tech_stack: ctx.tech_stack || null,
        architectural_constraints: ctx.architectural_constraints || null,
        dev_test_commands: ctx.dev_test_commands || null,
        production_safety_boundaries: ctx.production_safety_boundaries || null,
        approved_file_modification_scope: ctx.approved_file_modification_scope || null,
        existing_skills: ctx.existing_skills || null,
        reporting_destination: ctx.reporting_destination || null,
        human_approval_requirements: ctx.human_approval_requirements || null,
      };
    }
    agents[name] = agentEntry;
  }

  const now = new Date().toISOString();
  const config = {
    $schema: OPENAI_SCHEMA,
    default_agent: "orchestrator",
    agents,
    meta: {
      workbench_adapter: true,
      generated_at: now,
      source: "agentic-workbench/scripts/workbench-adapter.js",
      project_context: projectContext ? projectContext.path : null,
      owner: currentOwner(),
    },
  };

  return config;
}

function agentPermissions(name, shellCommands) {
  const baseline = [
    { effect: "deny", resource: "*", action: "*" },
    { effect: "allow", resource: "*", action: "read" },
    { effect: "allow", resource: "*", action: "glob" },
    { effect: "allow", resource: "*", action: "grep" },
    { effect: "deny", resource: "*.env*", action: "read" },
    { effect: "deny", resource: "*", action: "external_directory" },
  ];

  const shellAskRules = shellCommands;

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
      // OpenCode V2 uses last-match-wins precedence. A broad deny-* rule for
      // "shell" is immediately followed by ask rules, so shell operations are
      // approval-gated rather than flatly denied. Do not reorder these rules
      // without re-verifying the resulting effective permission.
      { effect: "deny", resource: "*", action: "shell" },
      ...shellAskRules,
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
      ...shellAskRules,
      { effect: "deny", resource: "*", action: "merge" },
      { effect: "deny", resource: "*", action: "push" },
      { effect: "deny", resource: "*", action: "deploy" },
      { effect: "deny", resource: "*", action: "credential_retrieval" },
    ];
  }

  if (name === "reporter") {
    return [
      ...baseline,
      // OpenCode V2 uses last-match-wins precedence. A broad deny-* rule for
      // "edit" is immediately followed by an ask rule, so edit operations are
      // approval-gated rather than flatly denied. Do not reorder these rules
      // without re-verifying the resulting effective permission.
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

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest("hex");
}

function sha256String(str) {
  const hash = crypto.createHash("sha256");
  hash.update(str, "utf8");
  return hash.digest("hex");
}

// --- Existing configuration detection ----------------------------------------

function readConfigFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) return null;
  return fs.readFileSync(filePath, "utf8");
}

function detectExistingConfigurations(targetDir) {
  // Returns { dirConfig, legacyConfig, jsoncConfig, dirConfigC, conflict }
  // where conflict is true when any two configs exist with different content.
  const dirCfg = readConfigFileIfExists(configPath(targetDir));
  const legacyCfg = readConfigFileIfExists(legacyConfigPath(targetDir));
  const jsoncCfg = readConfigFileIfExists(legacyConfigPathC(targetDir));
  const dirCfgC = readConfigFileIfExists(dirConfigPathC(targetDir));
  let conflict = false;
  const cfgs = [dirCfg, legacyCfg, jsoncCfg, dirCfgC].filter((c) => c !== null);
  for (let i = 0; i < cfgs.length; i++) {
    for (let j = i + 1; j < cfgs.length; j++) {
      if (cfgs[i] !== cfgs[j]) {
        conflict = true;
        break;
      }
    }
    if (conflict) break;
  }
  return { dirConfig: dirCfg, legacyConfig: legacyCfg, jsoncConfig: jsoncCfg, dirConfigC: dirCfgC, conflict };
}

// --- Backup / rollback --------------------------------------------------------

let backupSequence = 0;

function timestamp() {
  const now = new Date();
  const iso = now.toISOString().replace(/[:.]/g, "-");
  return `${iso}-${++backupSequence}`;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function ensureGitignoreEntries(targetDir, dryRun) {
  const gitignorePath = path.join(targetDir, ".gitignore");
  const entries = [".opencode/", ".workbench-backups/"];
  let existing = "";
  if (fs.existsSync(gitignorePath)) {
    existing = fs.readFileSync(gitignorePath, "utf8");
  }
  const missing = entries.filter((e) => !existing.split("\n").includes(e));
  if (missing.length === 0) return;
  if (dryRun) {
    log(`[dry-run] Would append to ${gitignorePath}: ${missing.join(", ")}`);
    return;
  }
  const append = existing.endsWith("\n") ? "" : "\n";
  fs.appendFileSync(gitignorePath, append + missing.join("\n") + "\n", "utf8");
  log(`Updated ${gitignorePath} with workbench-generated path exclusions.`);
}

function backupExistingConfig(configPathTarget, backupsDir, dryRun) {
  if (dryRun) {
    log(`[dry-run] Would back up ${configPathTarget} to ${backupsDir}/`);
    return { backupsDir, wouldBackup: true };
  }
  ensureDir(backupsDir);
  fs.copyFileSync(configPathTarget, path.join(backupsDir, CONFIG_FILE_NAME));
  const hash = sha256File(configPathTarget);
  fs.writeFileSync(
    path.join(backupsDir, `${CONFIG_FILE_NAME}.sha256`),
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

function writeMetaFile(backupsDir, targetDir, workbenchRoot, configHash) {
  const meta = {
    adapter: "workbench-adapter",
    target_dir: targetDir,
    workbench_root: workbenchRoot,
    config_file: CONFIG_FILE_NAME,
    config_hash: configHash,
    owner: currentOwner(),
    created_at: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(backupsDir, META_FILENAME),
    JSON.stringify(meta, null, 4) + "\n",
    "utf8"
  );
}

function readMetaFile(backupsDir) {
  const metaPath = path.join(backupsDir, META_FILENAME);
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf8"));
  } catch (e) {
    return null;
  }
}

function rollback(targetDir, dryRun) {
  const backupsDir = path.join(targetDir, ".workbench-backups");
  const backupDir = findLatestBackup(targetDir);

  if (!backupDir) {
    log(`No backup found for ${targetDir}; nothing to roll back.`);
    return;
  }

  const meta = readMetaFile(backupDir);
  // Refuse to remove unrelated pre-existing configs: only act on
  // adapter-generated files verified by meta + hash.
  if (!meta || !meta.adapter || meta.adapter !== "workbench-adapter") {
    fail(
      `Refusing to roll back: backup ${backupDir} is not a verified adapter-generated config (missing adapter meta).`
    );
  }

  // Verify adapter ownership: only the adapter owner can roll back its own config.
  if (meta.owner && meta.owner !== currentOwner()) {
    fail(
      `Refusing to roll back: config was installed by ${meta.owner}, current owner is ${currentOwner()}.`
    );
  }

  // Verify canonical target identity: the backup must belong to this target.
  if (meta.target_dir && meta.target_dir !== canonicalize(targetDir)) {
    fail(
      `Refusing to roll back: backup target ${meta.target_dir} does not match current target ${canonicalize(targetDir)}.`
    );
  }

  const backupConfig = path.join(backupDir, CONFIG_FILE_NAME);
  const backupHashFile = path.join(backupDir, `${CONFIG_FILE_NAME}.sha256`);

  if (!fs.existsSync(backupConfig)) {
    fail(`Backup directory exists but ${CONFIG_FILE_NAME} is missing: ${backupDir}`);
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

  // Refuse to overwrite configs modified since installation: compare the
  // installed config's current hash against the recorded config hash.
  const installedCfg = configPath(targetDir);
  if (fs.existsSync(installedCfg)) {
    const installedHash = sha256File(installedCfg);
    if (installedHash !== meta.config_hash) {
      fail(
        `Refusing to roll back: installed config at ${installedCfg} has been modified since installation (recorded hash ${meta.config_hash}, current ${installedHash}).`
      );
    }
  }

  if (dryRun) {
    log(`[dry-run] Would restore ${backupConfig} to ${installedCfg}`);
    return;
  }

  // Restore atomically: write to temp file then rename.
  const tempPath = installedCfg + ".tmp";
  fs.copyFileSync(backupConfig, tempPath);
  fs.renameSync(tempPath, installedCfg);

  log(`Rolled back ${installedCfg} from ${backupConfig}`);
}

// --- Main flow ----------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.rollback) {
    if (!args.target) {
      fail("--rollback requires an explicit <target> directory.");
    }
    const targetAbs = canonicalize(args.target);
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

  // Reject symlink or junction escapes: the canonical config destination must
  // be contained within the canonical target directory.
  const canonicalConfigPath = canonicalize(configPath(targetAbs));
  if (!isContained(canonicalConfigPath, targetAbs)) {
    fail(
      `Refusing to write config: ${canonicalConfigPath} escapes target directory ${targetAbs} via symlink or junction.`
    );
  }

  const agentsDir = validateWorkbenchRoot(workbenchRootAbs);

  const projectContext = loadProjectContext(args.projectContext);
  const shellCommands = projectContext
    ? deriveShellCommandsFromContext(projectContext.context)
    : [];

  // Detect existing configurations in all known locations.
  const { dirConfig, legacyConfig, jsoncConfig, dirConfigC, conflict } = detectExistingConfigurations(targetAbs);

  if (conflict) {
    fail(
      `Conflicting OpenCode configurations detected in ${targetAbs}: multiple OpenCode config locations exist with different content (${CONFIG_DIR_NAME}/${CONFIG_FILE_NAME}, ${CONFIG_DIR_NAME}/${LEGACY_CONFIG_FILE_C}, legacy ${LEGACY_CONFIG_FILE}, legacy ${LEGACY_CONFIG_FILE_C}). Refusing to silently override or merge. Remove conflicting configs manually to proceed.`
    );
  }

  const existingConfig = dirConfig !== null ? dirConfig : legacyConfig !== null ? legacyConfig : jsoncConfig !== null ? jsoncConfig : dirConfigC;
  const configExists = existingConfig !== null;

  if (configExists) {
    log(`Existing OpenCode configuration detected at ${targetAbs}; exiting cleanly (idempotent).`);
    return;
  }

  const projectConfig = buildProjectConfig(
    canonicalize(agentsDir),
    projectContext,
    shellCommands
  );

  const configJson = JSON.stringify(projectConfig, null, 4) + "\n";
  const configHash = sha256String(configJson);

  if (args.dryRun) {
    log(`[dry-run] Would write ${configPath(targetAbs)}:`);
    log(configJson);
    return;
  }

  const targetConfigDir = configDirPath(targetAbs);
  ensureDir(targetConfigDir);

  // Back up any existing config before writing (legacy .opencode.json).
  if (legacyConfig !== null) {
    const backupsDir = path.join(targetAbs, ".workbench-backups", timestamp());
    backupExistingConfig(legacyConfigPath(targetAbs), backupsDir, false);
    writeMetaFile(backupsDir, targetAbs, workbenchRootAbs, configHash);
  }

  // Write to temp file then rename for atomicity.
  const finalConfigPath = configPath(targetAbs);
  const tempPath = finalConfigPath + ".tmp";
  fs.writeFileSync(tempPath, configJson, "utf8");
  fs.renameSync(tempPath, finalConfigPath);

  // Record ownership + SHA-256 hash alongside the generated config for
  // future rollback verification. Back up the generated config itself so
  // rollback can restore it byte-for-byte.
  const backupsDir = path.join(targetAbs, ".workbench-backups", timestamp());
  ensureDir(backupsDir);
  fs.copyFileSync(finalConfigPath, path.join(backupsDir, CONFIG_FILE_NAME));
  fs.writeFileSync(
    path.join(backupsDir, `${CONFIG_FILE_NAME}.sha256`),
    configHash + "\n",
    "utf8"
  );
  writeMetaFile(backupsDir, targetAbs, workbenchRootAbs, configHash);

  log(`Generated project-scoped config: ${finalConfigPath}`);
  log(`Registered ${AGENT_NAMES.length} agents (orchestrator primary, specialists subagent).`);
  if (shellCommands.length > 0) {
    log(`Derived ${shellCommands.length} approval-gated shell permission(s) from project context.`);
  }

  // Prevent accidental publication of machine-specific generated files in the
  // target project's Git repository. Preserve existing project ignore rules.
  ensureGitignoreEntries(targetAbs, args.dryRun);
}

main();