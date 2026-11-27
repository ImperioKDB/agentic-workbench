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

// Wait until the wall-clock millisecond changes so that separately-spawned
// adapter processes produce distinct timestamp-based backup directory names.
// The adapter's timestamp() uses ISO milliseconds plus a per-process counter
// that resets on every spawn, so without this, rapid successive runs can
// collide on the same backup directory name.
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

test("parseArgs: --dry-run writes nothing", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const out = runAdapter([target, "--workbench-root", wb, "--dry-run"]);
  assert(out.ok, `dry-run should succeed; got status ${out.status}: ${out.combined}`);
  assert(!fs.existsSync(path.join(target, ".opencode.json")), "dry-run must not write config");
  assert(out.combined.includes("[dry-run]"), "dry-run output should mention dry-run");
});

test("parseArgs: --workbench-root and --force flags accepted", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const out = runAdapter([target, "--workbench-root", wb, "--force"]);
  assert(out.ok, `adapter should succeed with --force and --workbench-root; got ${out.status}: ${out.combined}`);
  assert(fs.existsSync(path.join(target, ".opencode.json")), "config should be generated");
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

test("canonicalize containment: valid agent path contained", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const out = runAdapter([target, "--workbench-root", wb]);
  assert(out.ok, `adapter should succeed for valid containment; got ${out.status}: ${out.combined}`);
  assert(fs.existsSync(path.join(target, ".opencode.json")), "config should be generated");
});

test("canonicalize containment: agent path escaping agents/ is rejected", (dir) => {
  const wb = path.join(dir, "wb");
  const agentsDir = path.join(wb, "agents");
  fs.mkdirSync(agentsDir, { recursive: true });

  for (const name of AGENT_NAMES) {
    fs.writeFileSync(path.join(agentsDir, `${name}.md`), `# ${name}\n`, "utf8");
  }

  // Replace reviewer.md with a symlink pointing outside agents/.
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

test("idempotency: existing config + no --force leaves file unchanged", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const first = runAdapter([target, "--workbench-root", wb]);
  assert(first.ok, `first run should succeed; got ${first.status}: ${first.combined}`);
  const configPath = path.join(target, ".opencode.json");
  assert(fs.existsSync(configPath), "config should exist after first run");
  const beforeContent = fs.readFileSync(configPath, "utf8");
  const beforeMtime = fs.statSync(configPath).mtimeMs;

  const second = runAdapter([target, "--workbench-root", wb]);
  assert(second.ok, `second idempotent run should succeed; got ${second.status}: ${second.combined}`);
  assert(second.combined.includes("idempotent"), `expected idempotent message; got: ${second.combined}`);
  assert(fs.existsSync(configPath), "config should still exist");
  const afterContent = fs.readFileSync(configPath, "utf8");
  const afterMtime = fs.statSync(configPath).mtimeMs;
  assertEqual(afterContent, beforeContent, "config content must be unchanged by idempotent run");
  assertEqual(afterMtime, beforeMtime, "config mtime must be unchanged by idempotent run");
});

test("idempotency: existing config + --force overwrites", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const first = runAdapter([target, "--workbench-root", wb]);
  assert(first.ok, `first run should succeed; got ${first.status}: ${first.combined}`);

  const configPath = path.join(target, ".opencode.json");
  fs.writeFileSync(configPath, "MUTATED\n", "utf8");

  const second = runAdapter([target, "--workbench-root", wb, "--force"]);
  assert(second.ok, `forced run should succeed; got ${second.status}: ${second.combined}`);
  assert(fs.readFileSync(configPath, "utf8") !== "MUTATED\n", "config should be overwritten by --force");
});

test("backup SHA-256 generation: backup dir contains config + matching hash", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const first = runAdapter([target, "--workbench-root", wb]);
  assert(first.ok, `first run should succeed; got ${first.status}: ${first.combined}`);

  const configPath = path.join(target, ".opencode.json");
  const preBackupContent = '{"existing": true}\n';
  fs.writeFileSync(configPath, preBackupContent, "utf8");

  const second = runAdapter([target, "--workbench-root", wb, "--force"]);
  assert(second.ok, `forced run should succeed; got ${second.status}: ${second.combined}`);

  const backupsDir = path.join(target, ".workbench-backups");
  assert(fs.existsSync(backupsDir) && fs.statSync(backupsDir).isDirectory(), "backups dir not created");
  const entries = fs
    .readdirSync(backupsDir)
    .filter((e) => fs.statSync(path.join(backupsDir, e)).isDirectory());
  assert(entries.length >= 1, "no backup directory created");

  const backupDir = path.join(backupsDir, entries[entries.length - 1]);
  assert(fs.existsSync(path.join(backupDir, ".opencode.json")), "backup config missing");
  assert(fs.existsSync(path.join(backupDir, ".opencode.json.sha256")), "sha256 manifest missing");

  const backupConfig = fs.readFileSync(path.join(backupDir, ".opencode.json"), "utf8");
  const manifestHash = fs.readFileSync(path.join(backupDir, ".opencode.json.sha256"), "utf8").trim();
  assert(/^[0-9a-f]{64}$/.test(manifestHash), `sha256 manifest should be 64-char hex, got: ${manifestHash}`);
  assertEqual(backupConfig, preBackupContent, "backed-up content must match pre-backup content");
});

test("rollback aborts when hash manifest is missing", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const backupsDir = path.join(target, ".workbench-backups");
  const backupDir = path.join(backupsDir, "2026-01-01T00-00-00-000Z-1");
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, ".opencode.json"), "stale\n", "utf8");
  // Intentionally no .opencode.json.sha256.

  const out = runAdapter([target, "--workbench-root", wb, "--rollback"]);
  assert(!out.ok, "rollback should fail when hash manifest is missing");
  assert(out.combined.includes("missing") || out.combined.includes("refusing"), `expected abort message; got: ${out.combined}`);
});

test("rollback restores config byte-for-byte when hash matches", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const first = runAdapter([target, "--workbench-root", wb]);
  assert(first.ok, `first run should succeed; got ${first.status}: ${first.combined}`);
  const configPath = path.join(target, ".opencode.json");
  const original = fs.readFileSync(configPath, "utf8");

  // Second run backs up the original, then rewrites (same content).
  const second = runAdapter([target, "--workbench-root", wb, "--force"]);
  assert(second.ok, `second run should succeed; got ${second.status}: ${second.combined}`);

  // Mutate config, then rollback must restore the backed-up original.
  fs.writeFileSync(configPath, "MUTATED\n", "utf8");
  const out = runAdapter([target, "--workbench-root", wb, "--rollback"]);
  assert(out.ok, `rollback should succeed; got ${out.status}: ${out.combined}`);
  assertEqual(fs.readFileSync(configPath, "utf8"), original, "config must be restored byte-for-byte");
});

test("timestamp uniqueness: successive runs create distinct backup dirs", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const init = runAdapter([target, "--workbench-root", wb]);
  assert(init.ok, `initial run should succeed; got ${init.status}: ${init.combined}`);

  const configPath = path.join(target, ".opencode.json");
  for (let i = 0; i < 5; i++) {
    waitForNewMillisecond();
    fs.writeFileSync(configPath, `{"n": ${i}}\n`, "utf8");
    const r = runAdapter([target, "--workbench-root", wb, "--force"]);
    assert(r.ok, `run ${i} should succeed; got ${r.status}: ${r.combined}`);
  }

  const backupsDir = path.join(target, ".workbench-backups");
  assert(fs.existsSync(backupsDir), "backups dir should exist");
  const entries = fs
    .readdirSync(backupsDir)
    .filter((e) => fs.statSync(path.join(backupsDir, e)).isDirectory());
  assert(entries.length >= 5, `expected at least 5 backup dirs, got ${entries.length}`);
  const uniq = new Set(entries);
  assertEqual(uniq.size, entries.length, "all backup directory names must be unique");
});

test("generated config registers all seven agents", (dir) => {
  const wb = path.join(dir, "wb");
  makeAgentsDir(wb);
  const target = path.join(dir, "target");
  fs.mkdirSync(target, { recursive: true });

  const out = runAdapter([target, "--workbench-root", wb]);
  assert(out.ok, `adapter should succeed; got ${out.status}: ${out.combined}`);

  const config = JSON.parse(fs.readFileSync(path.join(target, ".opencode.json"), "utf8"));
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

// --- Summary ------------------------------------------------------------------

console.log("");
console.log(`=== Results: ${passCount} passed, ${failCount} failed ===`);
for (const f of failures) {
  console.log(`  - ${f.name}: ${f.error}`);
}

process.exit(failCount === 0 ? 0 : 1);
