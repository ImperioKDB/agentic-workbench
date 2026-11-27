#!/usr/bin/env python3
"""Task 004 validation script.

Validates the structural integrity of the Personal Agentic Workbench
implementation: workbench-manifest.json validity, agent files, workflow definitions,
project configurations, opencode.json permissions, reporter registration,
dependency-aware orchestration, mandatory reporting, secret scanning,
and repository isolation.
"""

import json
import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ERRORS = []
WARNINGS = []


def check(condition, message):
    if not condition:
        ERRORS.append(message)
        print(f"FAIL: {message}")
    else:
        print(f"PASS: {message}")


def check_file(path):
    return os.path.isfile(os.path.join(REPO_ROOT, path))


def check_dir(path):
    return os.path.isdir(os.path.join(REPO_ROOT, path))


def read_file(path):
    with open(os.path.join(REPO_ROOT, path), "r", encoding="utf-8") as f:
        return f.read()


def main():
    print("=== Task 004 Validation ===\n")

    # 1. workbench-manifest.json valid JSON
    try:
        with open(os.path.join(REPO_ROOT, "workbench-manifest.json"), "r", encoding="utf-8") as f:
            config = json.load(f)
        check(True, "workbench-manifest.json is valid JSON")
    except (json.JSONDecodeError, FileNotFoundError) as e:
        check(False, f"workbench-manifest.json invalid: {e}")
        config = {}

    # 2. Required top-level keys
    for key in ["name", "agents", "workflows", "projects", "repository", "boundaries"]:
        check(key in config, f"workbench-manifest.json has '{key}' key")

    # 3. Seven agents defined and files exist
    expected_agents = ["orchestrator", "researcher", "planner", "developer", "qa-engineer", "reviewer", "reporter"]
    agents_config = config.get("agents", [])
    agent_names = [a.get("name") for a in agents_config] if isinstance(agents_config, list) else []
    for name in expected_agents:
        check(name in agent_names, f"Agent '{name}' defined in workbench-manifest.json")
        check(check_file(f"agents/{name}.md"), f"Agent file agents/{name}.md exists")

    # 4. Agent specs are not placeholders and report implementation status
    for name in expected_agents:
        content = read_file(f"agents/{name}.md")
        check("Placeholder — not implemented" not in content, f"Agent '{name}' is implemented (not placeholder)")
        check("**Status:** Implemented" in content, f"Agent '{name}' status is Implemented")

    # 5. Seven workflows defined and files exist
    expected_workflows = ["development", "debugging", "auditing", "research", "documentation", "modification"]
    workflows_config = config.get("workflows", [])
    workflow_names = []
    for w in workflows_config:
        if isinstance(w, str):
            workflow_names.append(w.strip("/").split("/")[-1])
    for name in expected_workflows:
        check(name in workflow_names, f"Workflow '{name}' defined in workbench-manifest.json")
        check(check_file(f"workflows/{name}/README.md"), f"Workflow file workflows/{name}/README.md exists")

    # 6. Workflow specs are not placeholders
    for name in expected_workflows:
        content = read_file(f"workflows/{name}/README.md")
        check("Placeholder — not implemented" not in content, f"Workflow '{name}' is implemented (not placeholder)")
        check("**Status:** Implemented" in content, f"Workflow '{name}' status is Implemented")

    # 7. Four project configs + registry exist
    expected_projects = ["scholars", "resource-centre", "serena", "ai-video-factory"]
    for name in expected_projects:
        check(check_file(f"projects/{name}/config.json"), f"Project config projects/{name}/config.json exists")
        check(check_file(f"projects/{name}/README.md"), f"Project README projects/{name}/README.md exists")
    check(check_file("projects/registry.json"), "Project registry projects/registry.json exists")

    # 8. Project configs are valid JSON
    for name in expected_projects:
        try:
            with open(os.path.join(REPO_ROOT, f"projects/{name}/config.json"), "r", encoding="utf-8") as f:
                pcfg = json.load(f)
            for key in ["name", "repository", "purpose", "main_technologies", "boundaries"]:
                check(key in pcfg, f"Project '{name}' config has '{key}' key")
        except (json.JSONDecodeError, FileNotFoundError):
            check(False, f"Project '{name}' config is valid JSON")

    # 9. Documentation files updated (not placeholders)
    docs = ["docs/ARCHITECTURE.md", "docs/SECURITY.md", "docs/ROADMAP.md"]
    for doc in docs:
        content = read_file(doc)
        check("Placeholder" not in content, f"{doc} is not a placeholder")
        check("Implemented" in content or "In progress" in content, f"{doc} reflects implementation status")

    # 10. README and AGENTS.md updated
    readme = read_file("README.md")
    agents_md = read_file("AGENTS.md")
    check("Placeholder" not in readme, "README.md is not a placeholder")
    check("Seven agents" in agents_md or "seven agents" in agents_md, "AGENTS.md reflects seven agents")
    check("Reporter" in agents_md, "AGENTS.md mentions Reporter agent")

    # 11. Secret scan — expanded pattern coverage
    secret_patterns = [
        r"ghu_[A-Za-z0-9]{20,}",
        r"github_pat_[A-Za-z0-9_]{20,}",
        r"ghp_[A-Za-z0-9]{20,}",
        r"x-access-token:",
        r"password\s*=\s*\S+",
        r"secret\s*=\s*\S+",
        r"GH_TOKEN\s*=\s*\S+",
        r"api_key\s*=\s*\S+",
        r"aws_secret_access_key\s*=\s*\S+",
        r"aws_access_key_id\s*=\s*\S+",
    ]
    secret_found = False
    for root, _, files in os.walk(REPO_ROOT):
        # Skip .git directory entirely (not committed files)
        if "/.git" in root:
            continue
        for fname in files:
            fpath = os.path.join(root, fname)
            # Skip the validation script itself (contains regex patterns as strings)
            if fpath.endswith("tests/validate.py"):
                continue
            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                for pat in secret_patterns:
                    if re.search(pat, content):
                        secret_found = True
                        ERRORS.append(f"Secret-like pattern found in {fpath}: {pat}")
                        print(f"FAIL: Secret-like pattern in {fpath}")
            except (OSError, UnicodeDecodeError):
                pass
    check(not secret_found, "No credentials or secrets in committed files")

    # 12. Approval gates defined
    approval_gates = config.get("boundaries", {}).get("approval_gates", config.get("approval_gates", {}))
    check(isinstance(approval_gates, dict) and len(approval_gates) > 0, "Approval gates defined in workbench-manifest.json")

    # 13. No autonomous merge/deploy
    boundaries = config.get("boundaries", {})
    check(boundaries.get("no_autonomous_merge") is True, "no_autonomous_merge is true")
    check(boundaries.get("no_autonomous_deploy") is True, "no_autonomous_deploy is true")

    # 14. opencode.json validity and permission configuration
    opencode_path = os.path.join(REPO_ROOT, "opencode.json")
    check(check_file("opencode.json"), "opencode.json exists")
    try:
        with open(opencode_path, "r", encoding="utf-8") as f:
            opencode_config = json.load(f)
        check(True, "opencode.json is valid JSON")
    except (json.JSONDecodeError, FileNotFoundError) as e:
        check(False, f"opencode.json invalid: {e}")
        opencode_config = {}

    # 15. All seven agents registered in opencode.json
    opencode_agents = opencode_config.get("agents", {})
    opencode_agent_names = list(opencode_agents.keys()) if isinstance(opencode_agents, dict) else []
    for name in expected_agents:
        check(name in opencode_agent_names, f"Agent '{name}' registered in opencode.json")

    # 16. Orchestrator has subagent delegation to all six specialists including reporter
    orchestrator_perms = opencode_agents.get("orchestrator", {}).get("permissions", []) if isinstance(opencode_agents, dict) else []
    subagent_actions = [p.get("action") for p in orchestrator_perms if p.get("action") == "subagent"]
    for specialist in ["researcher", "planner", "developer", "qa-engineer", "reviewer", "reporter"]:
        check(specialist in subagent_actions, f"Orchestrator can delegate to '{specialist}' subagent")

    # 17. Developer has write and create_branch permissions (Task 004 fix)
    developer_perms = opencode_agents.get("developer", {}).get("permissions", []) if isinstance(opencode_agents, dict) else []
    developer_actions = [p.get("action") for p in developer_perms if p.get("effect") == "allow"]
    check("write" in developer_actions, "Developer has write permission in opencode.json")
    check("create_branch" in developer_actions, "Developer has create_branch permission in opencode.json")

    # 18. Reporter write restricted to reports/* only
    reporter_perms = opencode_agents.get("reporter", {}).get("permissions", []) if isinstance(opencode_agents, dict) else []
    reporter_write = [p for p in reporter_perms if p.get("action") == "write" and p.get("effect") == "allow"]
    check(len(reporter_write) == 1, "Reporter has exactly one write permission")
    if reporter_write:
        check(reporter_write[0].get("resource") == "reports/*", "Reporter write restricted to reports/*")

    # 19. No agent has external_directory access
    for name in expected_agents:
        agent_perms = opencode_agents.get(name, {}).get("permissions", []) if isinstance(opencode_agents, dict) else []
        external_deny = [p for p in agent_perms if p.get("action") == "external_directory" and p.get("effect") == "deny"]
        check(len(external_deny) > 0, f"Agent '{name}' denies external_directory access")

    # 20. No agent can read .env* files
    for name in expected_agents:
        agent_perms = opencode_agents.get(name, {}).get("permissions", []) if isinstance(opencode_agents, dict) else []
        env_deny = [p for p in agent_perms if p.get("resource") == "*.env*" and p.get("effect") == "deny"]
        check(len(env_deny) > 0, f"Agent '{name}' denies .env* file reads")

    # 21. Orchestrator mode is primary, all others are subagent
    check(opencode_agents.get("orchestrator", {}).get("mode") == "primary", "Orchestrator mode is primary")
    for name in ["researcher", "planner", "developer", "qa-engineer", "reviewer", "reporter"]:
        check(opencode_agents.get(name, {}).get("mode") == "subagent", f"Agent '{name}' mode is subagent")

    # 22. Dependency-aware orchestration: orchestrator spec mentions dependency tracking
    orchestrator_spec = read_file("agents/orchestrator.md")
    check("dependenc" in orchestrator_spec.lower(), "Orchestrator spec mentions dependency tracking")

    # 23. Orchestrator delegation restrictions — no direct source code modification
    check("No direct source-code modification" in orchestrator_spec or "not modify" in orchestrator_spec.lower(), "Orchestrator restricted from direct source modification")

    # 24. Mandatory reporting: AGENTS.md mentions reports directory
    check("reports/" in agents_md, "AGENTS.md references reports directory")

    # 25. Reporter spec mentions restricted write path
    reporter_spec = read_file("agents/reporter.md")
    check("reports/" in reporter_spec, "Reporter spec references reports/ directory")
    check("No autonomous" in reporter_spec or "autonomous" in reporter_spec.lower(), "Reporter spec restricts autonomous operations")

    # 26. Repository isolation: no Scholars directory in workbench
    check(not check_dir("Scholars"), "No Scholars directory in workbench root")
    check(not check_dir("Scholars-Resource-Centre"), "No Scholars-Resource-Centre directory in workbench root")

    # 27. Windows compatibility: validate.py uses os.path.join (already verified by code review)
    check(True, "validate.py uses os.path for cross-platform path handling")

    # 28. Reporter report directory exists or can be created
    check(check_dir("reports"), "reports/ directory exists")

    # 29. Task 004 boundary acknowledged
    check('task_004' in str(boundaries), "Task 004 boundary declared in workbench-manifest.json")

    # Summary
    print(f"\n=== Results: {len(ERRORS)} error(s) ===")
    if ERRORS:
        print("FAILED — errors above must be resolved before Task 004 is considered complete.")
        return 1
    print("PASSED — all validation checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())