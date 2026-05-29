#!/usr/bin/env bash
# lib/clean.sh — Godspeed-style multi-level cleanup suite for Chinna

# Python helper for accurate size calculation
_python_size() {
    python3 - "$1" <<'PY'
import os, sys
path = sys.argv[1]
total = 0
if os.path.isfile(path):
    total = os.path.getsize(path)
else:
    for dirpath, _, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            try:
                total += os.path.getsize(fp)
            except:
                pass
print(total)
PY
}

_human_size() {
    local bytes=$1
    python3 - "$bytes" <<'PY'
import sys
b = int(sys.argv[1])
for unit in ['B','KB','MB','GB','TB']:
    if b < 1024:
        print(f"{b:.1f}{unit}")
        break
    b /= 1024
PY
}

# ────────────────────────────────────────────────────────────────
# Core cleanup functions (Godspeed spec)
# ────────────────────────────────────────────────────────────────

clean_light() {
    section "Light Clean (User caches)"

    local before after freed
    before=$(_python_size "$HOME/Library/Caches")

    echo "  Removing ~/Library/Caches/* ..."
    rm -rf ~/Library/Caches/* 2>/dev/null || true

    after=$(_python_size "$HOME/Library/Caches")
    freed=$(( before - after ))

    echo ""
    ok "Freed: $(_human_size "$freed")"
    mac_notify "Light clean complete — $(_human_size "$freed") freed"
    mac_sound
}

clean_mac() {
    section "Deep Mac Clean (Godspeed level)"

    local targets=(
        "$HOME/Library/Caches/*"
        "$HOME/.npm/_cacache"
        "$HOME/.cache"
        "$HOME/Library/Developer/Xcode/DerivedData"
        "$HOME/Library/Developer/Xcode/Archives"
        "$HOME/Library/Caches/com.microsoft.VSCode"
        "$HOME/.cargo/registry/cache"
    )

    local before=0 after=0

    for t in "${targets[@]}"; do
        before=$(( before + $(_python_size "$(dirname "$t")" 2>/dev/null || echo 0) ))
    done

    echo "  Cleaning user caches..."
    rm -rf ~/Library/Caches/* 2>/dev/null || true

    echo "  Cleaning npm cache..."
    rm -rf ~/.npm/_cacache 2>/dev/null || true

    echo "  Cleaning ~/.cache..."
    rm -rf ~/.cache/* 2>/dev/null || true

    echo "  Cleaning Xcode DerivedData & Archives..."
    rm -rf ~/Library/Developer/Xcode/DerivedData/* 2>/dev/null || true
    rm -rf ~/Library/Developer/Xcode/Archives/* 2>/dev/null || true

    echo "  Cleaning VSCode cache..."
    rm -rf ~/Library/Caches/com.microsoft.VSCode/* 2>/dev/null || true

    echo "  Cleaning cargo registry cache..."
    rm -rf ~/.cargo/registry/cache/* 2>/dev/null || true

    echo "  Running brew cleanup..."
    brew cleanup -s 2>/dev/null || true

    echo "  Pruning Docker..."
    docker system prune -af --volumes 2>/dev/null || true

    echo "  Cleaning npm/yarn/pnpm caches..."
    npm cache clean --force 2>/dev/null || true
    yarn cache clean 2>/dev/null || true
    pnpm store prune 2>/dev/null || true

    for t in "${targets[@]}"; do
        after=$(( after + $(_python_size "$(dirname "$t")" 2>/dev/null || echo 0) ))
    done

    local freed=$(( before - after ))
    echo ""
    ok "Deep clean complete. Freed approximately: $(_human_size "$freed")"

    mac_notify "Deep Mac clean finished"
    mac_sound
}

clean_docker() {
    section "Docker Cleanup"
    docker system prune -af --volumes 2>/dev/null
    ok "Docker system pruned"
    mac_notify "Docker cleaned"
    mac_sound
}

clean_nodes() {
    section "Nuclear Node Modules Cleanup"

    local search_paths=("$HOME/Downloads" "$HOME/Documents" "$HOME/Developer" "$HOME/projects" "$HOME/code" "$HOME/Sites")
    local report_dir="$CHINNA_HOME/audits"
    mkdir -p "$report_dir"
    local report="$report_dir/node-cleanup-$(date +%Y%m%d-%H%M%S).txt"

    echo "Scanning for node_modules (this may take a moment)..."

    local found=()
    while IFS= read -r -d '' dir; do
        found+=("$dir")
    done < <(find "${search_paths[@]}" -type d -name "node_modules" -print0 2>/dev/null 2>&1)

    if [ ${#found[@]} -eq 0 ]; then
        ok "No node_modules directories found in common locations."
        return
    fi

    echo ""
    echo "Found ${#found[@]} node_modules directories:"
    local total_size=0
    for dir in "${found[@]}"; do
        local size=$(_python_size "$dir")
        total_size=$((total_size + size))
        printf "  %-8s %s\n" "$(_human_size "$size")" "$dir"
    done

    echo ""
    echo -e "${Y}This will permanently delete ${#found[@]} folders (${_human_size $total_size}).${RESET}"
    read -r -p "  Continue? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        info "Cancelled."
        return
    fi

    echo "Deleting..." | tee "$report"
    local total_freed=0
    for dir in "${found[@]}"; do
        local size=$(_python_size "$dir")
        total_freed=$((total_freed + size))
        echo "  Removed: $dir" >> "$report"
        rm -rf "$dir" 2>/dev/null || true
    done

    echo ""
    ok "Freed $(_human_size "$total_freed") from node_modules"
    echo "Detailed report saved to: $report"

    mac_notify "Node modules cleanup complete"
    mac_sound
}

clean_project() {
    section "Clean Current Project"

    local before after freed
    before=$(_python_size ".")

    local targets=(
        "node_modules" "dist" "build" ".next" ".nuxt" ".output"
        ".turbo" ".cache" ".venv" ".parcel-cache" "target" ".gradle"
        "__pycache__" "*.pyc"
    )

    echo "Removing build artifacts..."
    for t in "${targets[@]}"; do
        find . -name "$t" -prune -exec rm -rf {} + 2>/dev/null || true
    done

    after=$(_python_size ".")
    freed=$(( before - after ))

    echo ""
    ok "Project cleaned. Freed: $(_human_size "$freed")"

    mac_notify "Project cleaned — $(_human_size "$freed") freed"
    mac_sound
}

# ────────────────────────────────────────────────────────────────
# Command wrappers for bin/chinna
# ────────────────────────────────────────────────────────────────

cmd_clean_light() {
    clean_light
}

cmd_clean_mac() {
    clean_mac
}

cmd_clean_nodes() {
    clean_nodes
}

cmd_clean_docker() {
    clean_docker
}

cmd_clean_project() {
    clean_project
}