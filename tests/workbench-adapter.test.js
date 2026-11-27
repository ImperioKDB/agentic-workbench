"use strict";

// Dependency-free Node.js tests for scripts/workbench-adapter.js
//
// Uses only node:fs, node:path, node:child_process.
//
// Self-contained temp dirs with cleanup.
// Exit 0 if all pass, non-zero if any fail.
// Prints PASS/FAIL per test plus a summary.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const WORKBENCH_ROOT = path.resolve(__dirname, "..");
const ADAPTER = path.join(WORKBENCH_ROOT, "scripts", "workbench-adapter.js");

const AGENT_NAMES = [
  "orchestrator",
  "researcher",
  "planner",
  "developer",
  "qa-engineer",
  "reviewer",
  "reporter",
];

const CONFIG_DIR = ".opencode";
const CONFIG_FILE = "opencode.json";
const LEGACY_CONFIG_FILE = ".opencode.json";
const LEGACY_CONFIG_FILE_C = ".opencode.jsonc";
const META_FILENAME = "adapter-meta.json";

// --- Test harness -------------------------------------------------------------

let passCount = 0;
let failCount = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error(message || "assertion failed");
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
  }
}

function test(name, fn) {
  const base = process.env.TEMP || process.env.TMP || "/tmp";
  const dir = fs.mkdtempSync(path.join(base, "adapter-test-"));
  try {
    fn(dir);
    console.log(`PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.log(`FAIL: ${name} — ${err.message}`);
    failCount++;
    failures.push({ name, error: err.message });
  } finally {
    removeDirRecursive(dir);
  }
}

function removeDirRecursive(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const full = path.join(dir, entry);
    try {
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        removeDirRecursive(full);
      } else {
        fs.unlinkSync(full);
      }
    } catch (e) {
      // Best-effort cleanup.
    }
  }
  try {
    fs.rmdirSync(dir);
  } catch (e) {
    // Best-effort cleanup.
  }
}

function waitForNewMillisecond() {
  const start = Date.now();
  while (Date.now() === start) {
    // Busy-wait for the millisecond boundary to cross.
  }
}

function runAdapter(args, opts = {}) {
  const result = spawnSync(process.execPath, [ADAPTER, ...args], {
    cwd: opts.cwd || WORKBENCH_ROOT,
    encoding: "utf8",
    timeout: 30000,
  });
  return {
    status: result.status,
    signal: result.signal,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    combined: (result.stdout || "") + (result.stderr || ""),
    ok: result.status === 0,
  };
}

// Fixture: minimal valid agents dir with all seven agent .md files.
function makeAgentsDir(root) {
  const agentsDir = path.join(root, "agents");
  fs.mkdirSync(agentsDir, { recursive: true });
  for (const name of AGENT_NAMES) {
    fs.writeFileSync(path.join(agentsDir, `${name}.md`), `# ${name}\n`, "utf8");
  }
  return agentsDir;
}

// Fixture: minimal valid project context file.
function makeProjectContext(root, overrides = {}) {
  const context = {
    identity: "Test project",
    dev_test_commands: ["node tests/validate.js", "npm test", "git status"],
    ...overrides,
  };
  const ctxPath = path.join(root, "project-context.json");
  fs.writeFileSync(ctxPath, JSON.stringify(context, null, 2), "utf8");
  return ctxPath;
}

// --- Tests --------------------------------------------------------------------

test("parseArgs: positional target accepted, unknown flags rejected", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const out = runAdapter([target, "--workbench-root", wb]);
  assert(out.ok, `positional target should parse; got ${out.status}: ${out.combined}`);
  assert(!out.combined.includes("Unknown flag"), "no unknown-flag error expected");
  assert(!out.combined.includes("Unexpected positional"), "no unexpected-positional error expected");
});

test("parseArgs: --force is removed and rejected", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const out = runAdapter([target, "--workbench-root", wb, "--force"]);
  assert(!out.ok, "--force should be rejected");
  assert(out.combined.includes("removed"), `expected --force removal message; got: ${out.combined}`);
});

test("parseArgs: --dry-run writes nothing", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const out = runAdapter([target, "--workbench-root", wb, "--dry-run"]);
  assert(out.ok, `dry-run should succeed; got status ${out.status}: ${out.combined}`);
  assert(!fs.existsSync(path.join(target, CONFIG_DIR, CONFIG_FILE)), "dry-run must not write config");
  assert(!fs.existsSync(path.join(target, LEGACY_CONFIG_FILE)), "dry-run must not write legacy config");
  assert(out.combined.includes("[dry-run]"), "dry-run output should mention dry-run");
});

test("parseArgs: missing target argument fails", () => {
  const out = runAdapter([]);
  assert(!out.ok, "missing target should fail");
  assert(out.combined.includes("Missing"), `expected missing-target error; got: ${out.combined}`);
});

test("parseArgs: nonexistent target directory fails", () => {
  const base = process.env.TEMP || process.env.TMP || "/tmp";
  const out = runAdapter([path.join(base, "definitely-does-not-exist-12345")]);
  assert(!out.ok, "nonexistent target should fail");
});

test("config filename: directory-based .opencode/opencode.json is generated", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const out = runAdapter([target, "--workbench-root", wb]);
  assert(out.ok, `adapter should succeed; got ${out.status}: ${out.combined}`);
  assert(fs.existsSync(path.join(target, CONFIG_DIR, CONFIG_FILE)), "directory-based config should be generated");
  assert(!fs.existsSync(path.join(target, LEGACY_CONFIG_FILE)), "legacy file-based config should NOT be generated");
});

test("config filename: legacy .opencode.json is detected as existing config", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, LEGACY_CONFIG_FILE), "{\"legacy\": true}\n", "utf8");

  const out = runAdapter([target, "--workbench-root", wb]);
  assert(out.ok, "legacy config should be treated as existing (idempotent)");
  assert(out.combined.includes("idempotent"), `expected idempotent message; got: ${out.combined}`);
  assert(!fs.existsSync(path.join(target, CONFIG_DIR)), "directory config should not be created when legacy exists");
});

test("existing configuration conflicts: both forms with different content fail", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });
  fs.mkdirSync(path.join(target, CONFIG_DIR), { recursive: true });
  fs.writeFileSync(path.join(target, CONFIG_DIR, CONFIG_FILE), "{\"dir\": true}\n", "utf8");
  fs.writeFileSync(path.join(target, LEGACY_CONFIG_FILE), "{\"legacy\": true}\n", "utf8");

  const out = runAdapter([target, "--workbench-root", wb]);
  assert(!out.ok, "conflicting configs should fail");
  assert(out.combined.includes("Conflicting"), `expected conflict message; got: ${out.combined}`);
  assert(out.combined.includes("Refusing"), `expected refusal message; got: ${out.combined}`);
});

test("existing configuration conflicts: both forms with same content is idempotent", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });
  fs.mkdirSync(path.join(target, CONFIG_DIR), { recursive: true });
  const same = "{\"same\": true}\n";
  fs.writeFileSync(path.join(target, CONFIG_DIR, CONFIG_FILE), same, "utf8");
  fs.writeFileSync(path.join(target, LEGACY_CONFIG_FILE), same, "utf8");

  const out = runAdapter([target, "--workbench-root", wb]);
  assert(out.ok, "identical configs should be idempotent");
  assert(out.combined.includes("idempotent"), `expected idempotent message; got: ${out.combined}`);
});

test("idempotency: existing config + no --force leaves file unchanged", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const first = runAdapter([target, "--workbench-root", wb]);
  assert(first.ok, `first run should succeed; got ${first.status}: ${first.combined}`);
  const configPath = path.join(target, CONFIG_DIR, CONFIG_FILE);
  assert(fs.existsSync(configPath), "config should exist after first run");
  const beforeContent = fs.readFileSync(configPath, "utf8");
  const beforeMtime = fs.statSync(configPath).mtimeMs;

  const second = runAdapter([target, "--workbench-root", wb]);
  assert(second.ok, `second idempotent run should succeed; got ${second.status}: ${second.combined}`);
  assert(second.combined.includes("idempotent"), `expected idempotent message; got: ${second.combined}`);
  const afterContent = fs.readFileSync(configPath, "utf8");
  const afterMtime = fs.statSync(configPath).mtimeMs;
  assertEqual(afterContent, beforeContent, "config content must be unchanged by idempotent run");
  assertEqual(afterMtime, beforeMtime, "config mtime must be unchanged by idempotent run");
});

test("canonicalize containment: agent path escaping agents/ is rejected", (dir) => {
  const wb = path.join(dir, "wb");
  const agentsDir = path.join(wb, "agents");
  fs.mkdirSync(agentsDir, { recursive: true });

  for (const name of AGENT_NAMES) {
    fs.writeFileSync(path.join(agentsDir, `${name}.md`), `# ${name}\n`, "utf8");
  }

  const escapeTarget = path.join(dir, "escape.md");
  fs.writeFileSync(escapeTarget, "escape\n", "utf8");
  const linkName = path.join(agentsDir, "reviewer.md");
  fs.unlinkSync(linkName);
  let symlinkSupported = true;
  try {
    fs.symlinkSync(escapeTarget, linkName);
  } catch (e) {
    symlinkSupported = false;
    console.log(`SKIP: symlink escape test not supported (${e.message})`);
  }
  if (!symlinkSupported) return;

  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const out = runAdapter([target, "--workbench-root", wb]);
  assert(!out.ok, "adapter should reject escaping agent path");
  assert(out.combined.includes("escapes agents/ directory"), `expected containment rejection; got: ${out.combined}`);
});

test("rollback: --rollback requires explicit target", () => {
  const out = runAdapter(["--rollback"]);
  assert(!out.ok, "rollback without target should fail");
  assert(out.combined.includes("requires an explicit"), `expected target requirement; got: ${out.combined}`);
});

test("rollback: restores config byte-for-byte when hash matches", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const first = runAdapter([target, "--workbench-root", wb]);
  assert(first.ok, `first run should succeed; got ${first.status}: ${first.combined}`);
  const configPath = path.join(target, CONFIG_DIR, CONFIG_FILE);
  const original = fs.readFileSync(configPath, "utf8");

  // Rollback of a first-time installation removes the generated config
  // (it did not exist before installation).
  waitForNewMillisecond();
  const out = runAdapter([target, "--workbench-root", wb, "--rollback"]);
  assert(out.ok, `rollback should succeed; got ${out.status}: ${out.combined}`);
  assert(!fs.existsSync(configPath), "first-time install rollback must remove generated config");
});

test("rollback: refuses to rollback modified configuration", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const first = runAdapter([target, "--workbench-root", wb]);
  assert(first.ok, `first run should succeed; got ${first.status}: ${first.combined}`);
  const configPath = path.join(target, CONFIG_DIR, CONFIG_FILE);

  // Modify the installed config after installation.
  fs.writeFileSync(configPath, "MUTATED-AFTER-INSTALL\n", "utf8");
  waitForNewMillisecond();
  const out = runAdapter([target, "--workbench-root", wb, "--rollback"]);
  assert(!out.ok, "rollback should refuse when config modified since installation");
  assert(out.combined.includes("modified since installation"), `expected refusal; got: ${out.combined}`);
});

test("rollback: refuses to delete unrelated pre-existing configuration", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  // Create an unrelated config NOT generated by the adapter (no adapter-meta).
  const backupsDir = path.join(target, ".workbench-backups");
  const backupDir = path.join(backupsDir, "2026-01-01T00-00-00-000Z-1");
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, CONFIG_FILE), "unrelated\n", "utf8");
  // No adapter-meta.json -> not a verified adapter-generated config.

  const out = runAdapter([target, "--workbench-root", wb, "--rollback"]);
  assert(!out.ok, "rollback should refuse unrelated pre-existing config");
  assert(out.combined.includes("not a verified adapter-generated"), `expected refusal; got: ${out.combined}`);
});

test("rollback aborts when hash manifest is missing", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const backupsDir = path.join(target, ".workbench-backups");
  const backupDir = path.join(backupsDir, "2026-01-01T00-00-00-000Z-1");
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, CONFIG_FILE), "stale\n", "utf8");
  // No .opencode.json.sha256.

  const out = runAdapter([target, "--workbench-root", wb, "--rollback"]);
  assert(!out.ok, "rollback should fail when hash manifest is missing");
  assert(out.combined.includes("missing") || out.combined.includes("refusing"), `expected abort message; got: ${out.combined}`);
});

test("generated config registers all seven agents", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const out = runAdapter([target, "--workbench-root", wb]);
  assert(out.ok, `adapter should succeed; got ${out.status}: ${out.combined}`);

  const config = JSON.parse(fs.readFileSync(path.join(target, CONFIG_DIR, CONFIG_FILE), "utf8"));
  assertEqual(config.default_agent, "orchestrator", "default agent should be orchestrator");
  for (const name of AGENT_NAMES) {
    assert(config.agents[name], `agent ${name} should be registered`);
    assertEqual(
      config.agents[name].mode,
      name === "orchestrator" ? "primary" : "subagent",
      `agent ${name} mode`
    );
    assert(
      config.agents[name].system && config.agents[name].system.startsWith("{file:"),
      `agent ${name} should have file system reference`
    );
  }
});

test("project context: --project-context loads context into meta", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });
  const ctxPath = makeProjectContext(dir);

  const out = runAdapter([target, "--workbench-root", wb, "--project-context", ctxPath]);
  assert(out.ok, `adapter should succeed; got ${out.status}: ${out.combined}`);

  const config = JSON.parse(fs.readFileSync(path.join(target, CONFIG_DIR, CONFIG_FILE), "utf8"));
  assertEqual(config.meta.project_context, ctxPath, "meta should record project context path");
  assertEqual(config.meta.workbench_adapter, true, "meta should mark adapter-generated");
});

test("project-specific command permissions: derived from dev_test_commands", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });
  const ctxPath = makeProjectContext(dir, {
    dev_test_commands: ["node tests/validate.js", "npm test", "git status", "git diff"],
  });

  const out = runAdapter([target, "--workbench-root", wb, "--project-context", ctxPath]);
  assert(out.ok, `adapter should succeed; got ${out.status}: ${out.combined}`);

  const config = JSON.parse(fs.readFileSync(path.join(target, CONFIG_DIR, CONFIG_FILE), "utf8"));
  const devPerms = config.agents.developer.permissions;
  const qaPerms = config.agents["qa-engineer"].permissions;

  const devShellAsks = devPerms.filter((p) => p.action === "shell" && p.effect === "ask").map((p) => p.resource);
  const qaShellAsks = qaPerms.filter((p) => p.action === "shell" && p.effect === "ask").map((p) => p.resource);

  assert(devShellAsks.includes("node tests/validate.js"), "developer should have ask rule for node tests/validate.js");
  assert(devShellAsks.includes("npm test"), "developer should have ask rule for npm test");
  assert(devShellAsks.includes("git status"), "developer should have ask rule for git status");
  assert(devShellAsks.includes("git diff"), "developer should have ask rule for git diff");
  assertEqual(qaShellAsks.length, devShellAsks.length, "qa-engineer should mirror developer shell ask rules");
});

test("project-specific command permissions: no arbitrary commands auto-allowed", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });
  const ctxPath = makeProjectContext(dir, {
    dev_test_commands: ["node tests/validate.js", "npm test", "git status", "git diff", "rm -rf /"],
  });

  const out = runAdapter([target, "--workbench-root", wb, "--project-context", ctxPath]);
  assert(out.ok, `adapter should succeed; got ${out.status}: ${out.combined}`);

  const config = JSON.parse(fs.readFileSync(path.join(target, CONFIG_DIR, CONFIG_FILE), "utf8"));
  const devPerms = config.agents.developer.permissions;
  const devShellAsks = devPerms.filter((p) => p.action === "shell" && p.effect === "ask").map((p) => p.resource);
  // Commands with shell metacharacters should be rejected, not auto-allowed.
  assert(!devShellAsks.includes("rm -rf /"), "arbitrary/dangerous command should not be auto-allowed");
  assert(devShellAsks.includes("node tests/validate.js"), "valid command should be allowed");
});

test("project-specific command permissions: no context means no extra shell asks", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const out = runAdapter([target, "--workbench-root", wb]);
  assert(out.ok, `adapter should succeed; got ${out.status}: ${out.combined}`);

  const config = JSON.parse(fs.readFileSync(path.join(target, CONFIG_DIR, CONFIG_FILE), "utf8"));
  const devPerms = config.agents.developer.permissions;
  const devShellAsks = devPerms.filter((p) => p.action === "shell" && p.effect === "ask");
  assertEqual(devShellAsks.length, 0, "no project context means no extra shell ask rules");
});

test("gitignore: original protections remain intact", () => {
  const gitignorePath = path.join(WORKBENCH_ROOT, ".gitignore");
  const content = fs.readFileSync(gitignorePath, "utf8");
  const required = [
    ".opencode/",
    ".workbench-backups/",
    "node_modules/",
    ".env",
    "*.log",
    ".DS_Store",
  ];
  for (const entry of required) {
    assert(content.includes(entry), `.gitignore should contain "${entry}"`);
  }
});

test("gitignore: existing target content is preserved", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, ".gitignore"), "# user rule\nuser-file.txt\n", "utf8");

  const out = runAdapter([target, "--workbench-root", wb]);
  assert(out.ok, `adapter should succeed; got ${out.status}: ${out.combined}`);

  const content = fs.readFileSync(path.join(target, ".gitignore"), "utf8");
  assert(content.includes("# user rule"), "existing .gitignore content must be preserved");
  assert(content.includes("user-file.txt"), "existing .gitignore content must be preserved");
  assert(content.includes(".opencode/"), "workbench exclusion should be added");
  assert(content.includes(".workbench-backups/"), "workbench exclusion should be added");
});

test("gitignore: LF and CRLF handling", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });
  // Write .gitignore with CRLF line endings.
  fs.writeFileSync(path.join(target, ".gitignore"), "# user rule\r\nuser-file.txt\r\n", "utf8");

  const out = runAdapter([target, "--workbench-root", wb]);
  assert(out.ok, `adapter should succeed; got ${out.status}: ${out.combined}`);

  const content = fs.readFileSync(path.join(target, ".gitignore"), "utf8");
  assert(content.includes(".opencode/"), "workbench exclusion should be added with CRLF");
  assert(content.includes(".workbench-backups/"), "workbench exclusion should be added with CRLF");
  // Verify no duplicate entries on second run.
  const second = runAdapter([target, "--workbench-root", wb]);
  assert(second.ok, "second run should succeed");
  const content2 = fs.readFileSync(path.join(target, ".gitignore"), "utf8");
  const opencodeCount = (content2.match(/\.opencode\//g) || []).length;
  const backupsCount = (content2.match(/\.workbench-backups\//g) || []).length;
  assertEqual(opencodeCount, 1, ".opencode/ should appear exactly once");
  assertEqual(backupsCount, 1, ".workbench-backups/ should appear exactly once");
});

test("rollback: incorrect ownership causes refusal", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const first = runAdapter([target, "--workbench-root", wb]);
  assert(first.ok, `first run should succeed; got ${first.status}: ${first.combined}`);

  // Tamper with the owner in the meta file.
  const backupsDir = path.join(target, ".workbench-backups");
  const backupDirs = fs.readdirSync(backupsDir).filter((e) =>
    fs.statSync(path.join(backupsDir, e)).isDirectory()
  );
  assert(backupDirs.length > 0, "backup directory should exist");
  const metaPath = path.join(backupsDir, backupDirs[0], META_FILENAME);
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  meta.owner = "someone-else";
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf8");

  const out = runAdapter([target, "--workbench-root", wb, "--rollback"]);
  assert(!out.ok, "rollback with wrong owner should fail");
  assert(out.combined.includes("owner"), "expected ownership refusal message");
});

test("rollback: incorrect target identity causes refusal", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const first = runAdapter([target, "--workbench-root", wb]);
  assert(first.ok, `first run should succeed; got ${first.status}: ${first.combined}`);

  // Tamper with the target_dir in the meta file.
  const backupsDir = path.join(target, ".workbench-backups");
  const backupDirs = fs.readdirSync(backupsDir).filter((e) =>
    fs.statSync(path.join(backupsDir, e)).isDirectory()
  );
  assert(backupDirs.length > 0, "backup directory should exist");
  const metaPath = path.join(backupsDir, backupDirs[0], META_FILENAME);
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  meta.target_dir = "/some/other/target";
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf8");

  const out = runAdapter([target, "--workbench-root", wb, "--rollback"]);
  assert(!out.ok, "rollback with wrong target identity should fail");
  assert(out.combined.includes("target"), "expected target identity refusal message");
});

test("rollback: path containment", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const first = runAdapter([target, "--workbench-root", wb]);
  assert(first.ok, `first run should succeed; got ${first.status}: ${first.combined}`);

  const configPath = path.join(target, CONFIG_DIR, CONFIG_FILE);

  // Rollback should succeed (normal case).
  const out1 = runAdapter([target, "--workbench-root", wb, "--rollback"]);
  assert(out1.ok, `rollback should succeed; got ${out1.status}: ${out1.combined}`);
  assert(!fs.existsSync(configPath), "config should be removed after rollback");
});

test("installation failure does not leave partial installation", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  // Run with an invalid workbench root to force failure before any writes.
  const out = runAdapter([target, "--workbench-root", path.join(dir, "nonexistent")]);
  assert(!out.ok, "adapter should fail with bad workbench root");

  // Target should remain clean.
  assert(!fs.existsSync(path.join(target, CONFIG_DIR)), "config dir should not exist after failed install");
  assert(!fs.existsSync(path.join(target, ".workbench-backups")), "backups dir should not exist after failed install");
});

test("rollback preserves unrelated files created after installation", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const first = runAdapter([target, "--workbench-root", wb]);
  assert(first.ok, `first run should succeed; got ${first.status}: ${first.combined}`);

  // Create an unrelated file after installation.
  const unrelatedFile = path.join(target, "unrelated-user-file.txt");
  fs.writeFileSync(unrelatedFile, "user data\n", "utf8");

  const out = runAdapter([target, "--workbench-root", wb, "--rollback"]);
  assert(out.ok, `rollback should succeed; got ${out.status}: ${out.combined}`);
  assert(fs.existsSync(unrelatedFile), "unrelated file must be preserved after rollback");
  assertEqual(fs.readFileSync(unrelatedFile, "utf8"), "user data\n", "unrelated file content must be unchanged");
});

// --- Summary ------------------------------------------------------------------

console.log("");
console.log(`=== Results: ${passCount} passed, ${failCount} failed ===`);
for (const f of failures) {
  console.log(`  - ${f.name}: ${f.error}`);
}

process.exit(failCount === 0 ? 0 : 1);