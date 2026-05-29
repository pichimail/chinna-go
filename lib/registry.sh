#!/usr/bin/env bash
# lib/registry.sh — Godspeed-style Project Registry for Chinna

CHINNA_REGISTRY="$CHINNA_HOME/state/projects.json"

_ensure_registry() {
    mkdir -p "$(dirname "$CHINNA_REGISTRY")"
    [ -f "$CHINNA_REGISTRY" ] || echo '{"projects": {}}' > "$CHINNA_REGISTRY"
}

chinna_record_project() {
    local path="$1"
    local stack="$2"
    local port="$3"
    local url="$4"
    local status="${5:-running}"

    _ensure_registry

    python3 - "$CHINNA_REGISTRY" "$path" "$stack" "$port" "$url" "$status" <<'PY'
import json, sys, time, os
reg_file, path, stack, port, url, status = sys.argv[1:7]

try:
    with open(reg_file) as f:
        data = json.load(f)
except:
    data = {"projects": {}}

if "projects" not in data:
    data["projects"] = {}

abs_path = os.path.abspath(path)
now = int(time.time())

entry = {
    "stack": stack,
    "port": int(port) if str(port).isdigit() else port,
    "url": url,
    "status": status,
    "updated": now
}

if abs_path not in data["projects"]:
    data["projects"][abs_path] = {
        "stack": stack,
        "history": []
    }

proj = data["projects"][abs_path]
proj["stack"] = stack  # update latest stack
proj["port"] = entry["port"]
proj["url"] = url
proj["status"] = status
proj["updated"] = now

# Keep history of last 10 runs
if "history" not in proj:
    proj["history"] = []

proj["history"].insert(0, {
    "timestamp": now,
    "port": entry["port"],
    "status": status
})
proj["history"] = proj["history"][:10]  # keep last 10

with open(reg_file, "w") as f:
    json.dump(data, f, indent=2)
PY
}

chinna_project_status() {
    _ensure_registry

    python3 - "$CHINNA_REGISTRY" <<'PY'
import json, sys
from datetime import datetime

reg_file = sys.argv[1]
try:
    with open(reg_file) as f:
        data = json.load(f)
except:
    data = {"projects": {}}

projects = data.get("projects", {})
if not projects:
    print("  No projects registered yet.")
    print("  Run projects with 'chinna run' to populate the registry.")
    sys.exit(0)

print("\n  " + "═" * 95)
print("  %-14s %-18s %-7s %-12s %s" % ("STATUS", "STACK", "PORT", "LAST ACTIVE", "PROJECT PATH"))
print("  " + "═" * 95)

sorted_projects = sorted(projects.items(), key=lambda x: -x[1].get("updated", 0))

for path, info in sorted_projects:
    status = info.get("status", "unknown")
    stack = str(info.get("stack", "?"))[:17]
    port = str(info.get("port", "?"))
    updated = info.get("updated", 0)
    age = datetime.fromtimestamp(updated).strftime("%m/%d %H:%M")

    if status == "running":
        status_str = "\033[0;32m● running\033[0m"
    else:
        status_str = f"\033[2m○ {status}\033[0m"

    display_path = path.replace(os.path.expanduser("~"), "~")[:55]
    print("  %-22s %-18s %-7s %-12s %s" % (status_str, stack, port, age, display_path))

print("  " + "═" * 95)
print("  Commands:  chinna projects clean     → Remove old entries")
print("             chinna projects list      → Show this table")
PY
}

chinna_clear_old_projects() {
    _ensure_registry
    python3 - "$CHINNA_REGISTRY" <<'PY'
import json, time, sys
f = sys.argv[1]
cutoff = time.time() - (45 * 86400)  # 45 days
try:
    with open(f) as fp: data = json.load(fp)
except: data = {"projects": {}}

original = len(data.get("projects", {}))
cleaned = {k:v for k,v in data.get("projects",{}).items() if v.get("updated",0) > cutoff}
data["projects"] = cleaned
with open(f, "w") as fp: json.dump(data, fp, indent=2)
print(f"  Removed {original - len(cleaned)} old projects. Kept {len(cleaned)}.")
PY
}

chinna_project_history() {
    local target_path="${1:-}"
    if [ -z "$target_path" ]; then
        fail "Usage: chinna projects history <path-or-partial-path>"
        return 1
    fi

    _ensure_registry

    python3 - "$CHINNA_REGISTRY" "$target_path" <<'PY'
import json, sys, os
from datetime import datetime

reg_file, search = sys.argv[1:3]
try:
    with open(reg_file) as f:
        data = json.load(f)
except:
    data = {"projects": {}}

projects = data.get("projects", {})
abs_search = os.path.abspath(search)

match = None
for p in projects:
    if p == abs_search or search.lower() in p.lower():
        match = p
        break

if not match:
    print("Project not found in registry.")
    sys.exit(1)

proj = projects[match]
print(f"\nHistory for: {match}")
print("═" * 60)

history = proj.get("history", [])
if not history:
    print("No run history recorded yet.")
else:
    for h in history:
        ts = datetime.fromtimestamp(h["timestamp"]).strftime("%Y-%m-%d %H:%M")
        print(f"  {ts}   port:{h.get('port','?')}   status:{h.get('status','?')}")
PY
}

chinna_project_set_note() {
    local path="$1"; shift
    local note="$*"
    if [ -z "$path" ]; then
        fail "Usage: chinna projects note <path> <text>"
        return 1
    fi

    python3 - "$CHINNA_REGISTRY" "$path" "$note" <<'PY'
import json, sys, os
reg_file, path, note = sys.argv[1:4]
abs_path = os.path.abspath(path)

try:
    with open(reg_file) as f: data = json.load(f)
except: data = {"projects": {}}

proj = data.setdefault("projects", {}).setdefault(abs_path, {})
proj["notes"] = note[:3000]

with open(reg_file, "w") as f: json.dump(data, f, indent=2)
print("Note saved.")
PY
}

chinna_project_add_tag() {
    local path="$1" tag="$2"
    if [ -z "$path" ] || [ -z "$tag" ]; then
        fail "Usage: chinna projects tag <path> <tag>"
        return 1
    fi

    python3 - "$CHINNA_REGISTRY" "$path" "$tag" <<'PY'
import json, sys, os
reg_file, path, tag = sys.argv[1:4]
abs_path = os.path.abspath(path)

try:
    with open(reg_file) as f: data = json.load(f)
except: data = {"projects": {}}

proj = data.setdefault("projects", {}).setdefault(abs_path, {})
tags = proj.setdefault("tags", [])
if tag not in tags:
    tags.append(tag[:40])
    proj["tags"] = tags[:8]

with open(reg_file, "w") as f: json.dump(data, f, indent=2)
print("Tag added.")
PY
}
