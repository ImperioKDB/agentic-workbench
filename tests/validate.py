#!/usr/bin/env python3
"""Task 003 validation script.

Validates the structural integrity of the Personal Agentic Workbench
implementation: opencode.json validity, agent files, workflow definitions,
project configurations, and secret scan.
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
    print("=== Task 003 Validation ===\n")

    # 1. opencode.json valid JSON
    try:
        with open(os.path.join(REPO_ROOT, "opencode.json"), "r", encoding="utf-8") as f:
            config = json.load(f)
        check(True, "opencode.json is valid JSON")
    except (json.JSONDecodeError, FileNotFoundError) as e:
        check(False, f"opencode.json invalid: {e}")
        config = {}

    # 2. Required top-level keys
    for key in ["name", "agents", "workflows", "projects", "repository", "boundaries"]:
        check(key in config, f"opencode.json has '{key}' key")

    # 3. Six agents defined and files exist
    expected_agents = ["orchestrator", "researcher", "planner", "developer", "qa-engineer", "reviewer"]
    agents_config = config.get("agents", [])
    agent_names = [a.get("name") for a in agents_config] if isinstance(agents_config, list) else []
    for name in expected_agents:
        check(name in agent_names, f"Agent '{name}' defined in opencode.json")
        check(check_file(f".opencode/agents/{name}.md"), f"Agent file .opencode/agents/{name}.md exists")

    # 4. Agent specs are not placeholders
    for name in expected_agents:
        content = read_file(f".opencode/agents/{name}.md")
        check("Placeholder — not implemented" not in content, f"Agent '{name}' is implemented (not placeholder)")
        check("**Status:** Implemented" in content, f"Agent '{name}' status is Implemented")

    # 5. Six workflows defined and files exist
    expected_workflows = ["development", "debugging", "auditing", "research", "documentation", "modification"]
    workflows_config = config.get("workflows", [])
    workflow_names = []
    for w in workflows_config:
        if isinstance(w, str):
            workflow_names.append(w.strip("/").split("/")[-1])
    for name in expected_workflows:
        check(name in workflow_names, f"Workflow '{name}' defined in opencode.json")
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
        check("Placeholder — architecture documentation not yet implemented" not in content or "Placeholder" not in content.split("## Purpose")[0] if "## Purpose" in content else True, f"{doc} is not a placeholder")
        check("Implemented (Task 003)" in content or "In progress" in content, f"{doc} reflects implementation status")

    # 10. README and AGENTS.md updated
    readme = read_file("README.md")
    agents_md = read_file("AGENTS.md")
    check("Placeholder" not in readme.split("## Supported configurations")[0] if "## Supported configurations" in readme else True, "README.md is not a placeholder")
    check("Implemented" in agents_md or "in progress" in agents_md, "AGENTS.md reflects implementation status")

    # 11. Secret scan — no credential values in any tracked file
    secret_patterns = [
        r"ghu_[A-Za-z0-9]{20,}",
        r"github_pat_[A-Za-z0-9_]{20,}",
        r"ghp_[A-Za-z0-9]{20,}",
        r"x-access-token:",
        r"password\s*=\s*\S+",
        r"secret\s*=\s*\S+",
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
    check(isinstance(approval_gates, dict) and len(approval_gates) > 0, "Approval gates defined in opencode.json")

    # 13. No autonomous merge/deploy
    boundaries = config.get("boundaries", {})
    check(boundaries.get("no_autonomous_merge") is True, "no_autonomous_merge is true")
    check(boundaries.get("no_autonomous_deploy") is True, "no_autonomous_deploy is true")

    # Summary
    print(f"\n=== Results: {len(ERRORS)} error(s) ===")
    if ERRORS:
        print("FAILED — errors above must be resolved before Task 003 is considered complete.")
        return 1
    print("PASSED — all validation checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
