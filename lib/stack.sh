#!/usr/bin/env bash
# lib/stack.sh — Project stack detection + auto-install + sandbox preview

source "$CHINNA_LIB/notify.sh" 2>/dev/null

# ─── Colors (inherited from main) ─────────────────────────────
R='\033[0;31m'; G='\033[0;32m'; Y='\033[0;33m'; C='\033[0;36m'
ORANGE='\033[38;5;208m'; BOLD='\033[1m'; D='\033[2m'; RESET='\033[0m'

ok()   { echo -e "  ${G}✓${RESET} $1"; }
warn() { echo -e "  ${Y}!${RESET} $1"; }
fail() { echo -e "  ${R}✗${RESET} $1"; }
info() { echo -e "  ${C}ℹ${RESET} $1"; }

progress() {
    local msg="$1"
    local pct="${2:-50}"
    local filled=$(( pct * 30 / 100 ))
    local bar=""
    for ((i=0;i<filled;i++)); do bar+="█"; done
    for ((i=filled;i<30;i++)); do bar+="░"; done
    local color="$G"
    [ "$pct" -gt 70 ] && color="$Y"
    [ "$pct" -gt 85 ] && color="$R"
    printf "\r  ${color}%s${RESET} %3d%%  %s" "$bar" "$pct" "$msg"
}

# ─── Ensure tool is installed via brew ────────────────────────
ensure_tool() {
    local tool="$1"
    local brew_pkg="${2:-$tool}"
    if ! command -v "$tool" >/dev/null 2>&1; then
        warn "$tool not found — installing via brew..."
        brew install "$brew_pkg" >/dev/null 2>&1 && ok "$tool installed" || fail "Could not install $tool"
    else
        ok "$tool ready"
    fi
}

ensure_brew_service() {
    local svc="$1"
    if ! brew services list 2>/dev/null | grep -q "^$svc.*started"; then
        warn "Starting $svc..."
        brew services start "$svc" >/dev/null 2>&1 && ok "$svc started"
    else
        ok "$svc already running"
    fi
}

# ═══════════════════════════════════════════════════════════════
# Godspeed-style Stack Detection (enhanced for Chinna)
# ═══════════════════════════════════════════════════════════════

detect_stack() {
    local dir="${1:-.}"
    pushd "$dir" >/dev/null 2>&1 || return 1

    # 1. Node.js ecosystem (improved Godspeed-style detection)
    if [ -f package.json ]; then
        if command -v jq >/dev/null 2>&1; then
            # Modern frameworks first
            if jq -e '.dependencies.next // .devDependencies.next' package.json >/dev/null 2>&1; then
                popd >/dev/null; echo "node-next"; return 0
            fi
            if jq -e '.dependencies.expo // .devDependencies.expo' package.json >/dev/null 2>&1; then
                popd >/dev/null; echo "expo"; return 0
            fi
            if jq -e '.dependencies["@sveltejs/kit"] // .devDependencies["@sveltejs/kit"]' package.json >/dev/null 2>&1; then
                popd >/dev/null; echo "sveltekit"; return 0
            fi
            if jq -e '.dependencies.astro // .devDependencies.astro' package.json >/dev/null 2>&1; then
                popd >/dev/null; echo "astro"; return 0
            fi
            if jq -e '.dependencies["@remix-run/dev"] // .devDependencies["@remix-run/dev"]' package.json >/dev/null 2>&1; then
                popd >/dev/null; echo "remix"; return 0
            fi
            if jq -e '.dependencies.nuxt // .devDependencies.nuxt' package.json >/dev/null 2>&1; then
                popd >/dev/null; echo "node-nuxt"; return 0
            fi
            if jq -e '.dependencies.vite // .devDependencies.vite' package.json >/dev/null 2>&1; then
                popd >/dev/null; echo "node-vite"; return 0
            fi
            if jq -e '.dependencies.express // .devDependencies.express' package.json >/dev/null 2>&1; then
                popd >/dev/null; echo "node-express"; return 0
            fi
            if jq -e '.dependencies.electron // .devDependencies.electron' package.json >/dev/null 2>&1; then
                popd >/dev/null; echo "electron"; return 0
            fi
            if jq -e '.dependencies["@solidjs/start"] // .devDependencies["@solidjs/start"]' package.json >/dev/null 2>&1; then
                popd >/dev/null; echo "solidstart"; return 0
            fi
        fi
        popd >/dev/null; echo "node"; return 0
    fi

    # 2. Python
    if [ -f requirements.txt ] || [ -f pyproject.toml ] || [ -f manage.py ] || [ -f app.py ] || [ -f main.py ]; then
        if rg -q "from fastapi|import fastapi" . 2>/dev/null; then
            popd >/dev/null; echo "python-fastapi"; return 0
        fi
        if rg -q "from flask|import flask" . 2>/dev/null; then
            popd >/dev/null; echo "python-flask"; return 0
        fi
        if rg -q "import streamlit|from streamlit" . 2>/dev/null; then
            popd >/dev/null; echo "python-streamlit"; return 0
        fi
        if [ -f manage.py ]; then
            popd >/dev/null; echo "python-django"; return 0
        fi
        popd >/dev/null; echo "python"; return 0
    fi

    # 3. Other stacks
    [ -f composer.json ] && { popd >/dev/null; echo "php-laravel"; return 0; }
    [ -f Cargo.toml ]    && { popd >/dev/null; echo "rust"; return 0; }
    [ -f pubspec.yaml ]  && { popd >/dev/null; echo "flutter"; return 0; }
    [ -f go.mod ]        && { popd >/dev/null; echo "go"; return 0; }

    popd >/dev/null
    echo "unknown"
}

detect_pm() {
    local dir="${1:-.}"
    pushd "$dir" >/dev/null 2>&1 || { echo "npm"; return; }

    if [ -f bun.lockb ] || [ -f bun.lock ]; then
        popd >/dev/null; echo "bun"; return
    fi
    if [ -f pnpm-lock.yaml ]; then
        popd >/dev/null; echo "pnpm"; return
    fi
    if [ -f yarn.lock ]; then
        popd >/dev/null; echo "yarn"; return
    fi
    popd >/dev/null
    echo "npm"
}

# ─── Generate mock .env from .env.example ─────────────────────
generate_env() {
    local dir="${1:-.}"
    local env_example=""
    for f in .env.example .env.sample .env.template env.example; do
        [ -f "$dir/$f" ] && env_example="$dir/$f" && break
    done

    if [ -f "$dir/.env" ]; then
        info ".env already exists — skipping"
        return 0
    fi

    if [ -n "$env_example" ]; then
        cp "$env_example" "$dir/.env"
        # Replace placeholder values with mock values
        sed -i '' \
            's|=your_.*|=mock_dev_key_chinna|g;
             s|=<.*>|=mock_dev_key_chinna|g;
             s|=REPLACE_ME|=mock_dev_key_chinna|g;
             s|=YOUR_.*|=mock_dev_key_chinna|g;
             s|=sk-.*|=sk-mock-chinna-dev-key-000000000000000|g;
             s|=http://localhost:\([0-9]*\)|=http://localhost:\1|g' \
            "$dir/.env" 2>/dev/null
        ok "Generated .env from $env_example (mock keys injected)"
    else
        # Create minimal .env
        cat > "$dir/.env" <<'ENV'
# Generated by Chinna — replace with real values for production
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://localhost:5432/dev_db
API_KEY=mock_dev_key_chinna
SECRET_KEY=mock_secret_chinna_dev
NEXT_PUBLIC_API_URL=http://localhost:3000
ENV
        ok "Created minimal .env with mock keys"
    fi
}

# ─── Stack runners ─────────────────────────────────────────────
run_nextjs() {
    local dir="${1:-.}"
    echo -e "\n  ${ORANGE}▶ Next.js project detected${RESET}\n"
    ensure_tool node node
    ensure_tool npm node
    generate_env "$dir"

    info "Installing dependencies..."
    cd "$dir"
    progress "npm install" 20; npm install >/dev/null 2>&1
    progress "npm install done" 100; echo ""

    local port=3000
    info "Starting dev server on :$port"
    (sleep 2; open "http://localhost:$port") &
    (sleep 2; code "$dir" 2>/dev/null || true) &
    chinna_ok_toast "Next.js Running" "http://localhost:$port — VS Code opened"
    npm run dev
}

run_vite() {
    local dir="${1:-.}"
    echo -e "\n  ${ORANGE}▶ Vite/React project detected${RESET}\n"
    ensure_tool node node
    generate_env "$dir"
    cd "$dir"
    progress "npm install" 20; npm install >/dev/null 2>&1
    progress "done" 100; echo ""
    local port=5173
    (sleep 2; open "http://localhost:$port") &
    (sleep 2; code "$dir" 2>/dev/null || true) &
    chinna_ok_toast "Vite Running" "http://localhost:$port"
    npm run dev
}

run_expo() {
    local dir="${1:-.}"
    echo -e "\n  ${ORANGE}▶ Expo/React Native project detected${RESET}\n"
    ensure_tool node node
    ensure_tool npx node
    generate_env "$dir"
    cd "$dir"
    npm install >/dev/null 2>&1
    (sleep 3; code "$dir" 2>/dev/null || true) &
    chinna_ok_toast "Expo Starting" "Scan QR code in terminal"
    npx expo start
}

run_node() {
    local dir="${1:-.}"
    echo -e "\n  ${ORANGE}▶ Node.js project detected${RESET}\n"
    ensure_tool node node
    generate_env "$dir"
    cd "$dir"
    npm install >/dev/null 2>&1
    local start_cmd="start"
    grep -q '"dev"' package.json 2>/dev/null && start_cmd="dev"
    (sleep 2; code "$dir" 2>/dev/null || true) &
    chinna_ok_toast "Node.js Starting" "npm run $start_cmd"
    npm run "$start_cmd"
}

run_flutter() {
    local dir="${1:-.}"
    echo -e "\n  ${ORANGE}▶ Flutter project detected${RESET}\n"
    ensure_tool flutter flutter
    cd "$dir"
    info "Running flutter pub get..."
    flutter pub get 2>/dev/null
    (sleep 2; code "$dir" 2>/dev/null || true) &
    chinna_ok_toast "Flutter Starting" "flutter run"
    flutter run
}

run_fastapi() {
    local dir="${1:-.}"
    echo -e "\n  ${ORANGE}▶ FastAPI project detected${RESET}\n"
    ensure_tool python3 python@3.12
    generate_env "$dir"
    cd "$dir"
    python3 -m venv .venv >/dev/null 2>&1
    source .venv/bin/activate
    pip install -r requirements.txt -q
    local port=8000
    (sleep 2; open "http://localhost:$port/docs") &
    (sleep 2; code "$dir" 2>/dev/null || true) &
    chinna_ok_toast "FastAPI Running" "http://localhost:$port/docs"
    uvicorn main:app --reload --port "$port" 2>/dev/null || \
    python3 -m uvicorn main:app --reload --port "$port"
}

run_django() {
    local dir="${1:-.}"
    echo -e "\n  ${ORANGE}▶ Django project detected${RESET}\n"
    ensure_tool python3 python@3.12
    generate_env "$dir"
    cd "$dir"
    python3 -m venv .venv >/dev/null 2>&1
    source .venv/bin/activate
    pip install -r requirements.txt -q
    python3 manage.py migrate >/dev/null 2>&1
    local port=8000
    (sleep 2; open "http://localhost:$port") &
    chinna_ok_toast "Django Running" "http://localhost:$port"
    python3 manage.py runserver
}

run_python() {
    local dir="${1:-.}"
    echo -e "\n  ${ORANGE}▶ Python project detected${RESET}\n"
    ensure_tool python3 python@3.12
    generate_env "$dir"
    cd "$dir"
    python3 -m venv .venv >/dev/null 2>&1
    source .venv/bin/activate
    pip install -r requirements.txt -q 2>/dev/null || true
    (sleep 1; code "$dir" 2>/dev/null || true) &
    chinna_ok_toast "Python Ready" "venv activated, deps installed"
    local main_file=$(ls main.py app.py run.py server.py 2>/dev/null | head -1)
    if [ -n "$main_file" ]; then
        python3 "$main_file"
    else
        info "No main entry point found. Dropping into venv shell."
        $SHELL
    fi
}

run_go() {
    local dir="${1:-.}"
    echo -e "\n  ${ORANGE}▶ Go project detected${RESET}\n"
    ensure_tool go go
    cd "$dir"
    go mod tidy >/dev/null 2>&1
    chinna_ok_toast "Go Starting" "go run ."
    go run .
}

run_rust() {
    local dir="${1:-.}"
    echo -e "\n  ${ORANGE}▶ Rust project detected${RESET}\n"
    ensure_tool cargo rust
    cd "$dir"
    chinna_ok_toast "Rust Building" "cargo run"
    cargo run
}

# ─── Main stack runner ─────────────────────────────────────────
# Improved Smart Run with better polling, more stacks, and cleaner UX
run_project() {
    local dir="${1:-$(pwd)}"
    local stack pm
    stack=$(detect_stack "$dir")
    pm=$(detect_pm "$dir")

    echo ""
    echo -e "  ${BOLD}${ORANGE}🚀 CHINNA SMART RUN (plugin-aware)${RESET}"
    echo -e "  ${D}Detected:${RESET} ${BOLD}$stack${RESET}  |  Package Manager: ${BOLD}$pm${RESET}"
    echo ""

    # === Plugin Loading ===
    local plugin_name=""
    case "$stack" in
        node*|sveltekit|remix|astro|solidstart) plugin_name="node" ;;
        python*) plugin_name="python" ;;
    esac

    if [ -n "$plugin_name" ]; then
        load_plugin "$plugin_name" 2>/dev/null || true
    fi

    # === 1. Smart Setup Phase (prefer plugin) ===
    if declare -f gs_plugin_prepare >/dev/null; then
        echo "  → Running plugin prepare hook ($plugin_name)..."
        gs_plugin_prepare "$dir"
    else
        case "$stack" in
            node-next|node-vite|node-express|node|electron|sveltekit|remix|astro|solidstart|node-nuxt|expo)
                echo "  → Installing dependencies with $pm..."
                (cd "$dir" && $pm install --silent 2>/dev/null) &
                spinner $! "Installing dependencies"
                ok "Dependencies ready"

                if [ -f "$dir/prisma/schema.prisma" ]; then
                    echo "  → Running Prisma setup..."
                    (cd "$dir" && npx prisma generate --silent && npx prisma migrate deploy 2>/dev/null || true) &
                    spinner $! "Prisma setup"
                fi
                ;;
            python-fastapi|python-flask|python-django|python-streamlit|python)
                echo "  → Setting up Python virtual environment..."
                if [ ! -d "$dir/.venv" ]; then
                    (cd "$dir" && python3 -m venv .venv) &
                    spinner $! "Creating .venv"
                fi
                echo "  → Installing Python dependencies..."
                (cd "$dir" && source .venv/bin/activate && pip install -q -r requirements.txt 2>/dev/null || pip install -q -e . 2>/dev/null || true) &
                spinner $! "Installing requirements"
                ok "Python environment ready"
                ;;
            flutter)
                (cd "$dir" && flutter pub get --suppress-analytics) &
                spinner $! "flutter pub get"
                ;;
            go)
                (cd "$dir" && go mod tidy -e) &
                spinner $! "go mod tidy"
                ;;
            rust)
                (cd "$dir" && cargo fetch --quiet) &
                spinner $! "cargo fetch"
                ;;
        esac
    fi

    # === 2. Intelligent Free Port Selection ===
    local default_port=3000
    case "$stack" in
        python-fastapi|python-flask|python-django) default_port=8000 ;;
        python-streamlit) default_port=8501 ;;
        go) default_port=8080 ;;
        rust) default_port=8080 ;;
    esac

    local port
    port=$(python3 - "$default_port" <<'PY'
import socket, sys
start = int(sys.argv[1])
for p in range(start, start + 200):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.1)
        if s.connect_ex(('127.0.0.1', p)) != 0:
            print(p)
            sys.exit(0)
print(start + 200)
PY
)
    echo -e "  ${G}→ Using port:${RESET} $port"

    # === 3. Start Dev Server (strongly prefer plugin) ===
    local log_file="/tmp/chinna-run-$$.log"
    local pid

    if declare -f gs_plugin_run >/dev/null; then
        echo "  → Running via plugin hook (gs_plugin_run)..."
        (cd "$dir" && gs_plugin_run "$dir" "$port" > "$log_file" 2>&1) &
        pid=$!
    else
        local cmd=""
        case "$stack" in
            node-next)          cmd="$pm run dev -- --port $port" ;;
            node-vite|sveltekit|remix|astro|solidstart|node-nuxt) cmd="$pm run dev -- --port $port --host" ;;
            expo)               cmd="npx expo start --web --port $port" ;;
            node-express|node|electron)  cmd="$pm run dev" ;;
            python-fastapi)     cmd=".venv/bin/uvicorn main:app --reload --port $port --host 0.0.0.0" ;;
            python-flask)       cmd=".venv/bin/flask --app app run --port $port --reload" ;;
            python-streamlit)   cmd=".venv/bin/streamlit run app.py --server.port $port --server.headless true" ;;
            python-django)      cmd=".venv/bin/python manage.py runserver 0.0.0.0:$port" ;;
            flutter)            cmd="flutter run -d chrome --web-port=$port" ;;
            go)                 cmd="go run . --port $port" ;;
            rust)               cmd="cargo run -- --port $port" ;;
            *)                  cmd="echo 'Unknown stack'" ;;
        esac

        echo "  → Starting: $cmd"
        (cd "$dir" && eval "$cmd" > "$log_file" 2>&1) &
        pid=$!
    fi

    # === 4. Improved Port Readiness Polling (with visual progress) ===
    echo -n "  → Waiting for server to become ready "
    local ready=false
    for i in {1..60}; do
        if python3 -c "
import socket
try:
    with socket.create_connection(('127.0.0.1', $port), timeout=0.5):
        print('READY')
except:
    pass
" 2>/dev/null | grep -q READY; then
            ready=true
            break
        fi
        printf "."
        sleep 1
    done
    echo ""

    local url="http://localhost:$port"

    if $ready; then
        echo -e "  ${G}✓ Server is live!${RESET} → $url"
        
        # Record in registry
        chinna_record_project "$dir" "$stack" "$port" "$url" "running" 2>/dev/null || true

        # Open browser
        open "$url" 2>/dev/null || true

        mac_notify "Chinna: $stack running on port $port"
        mac_sound

        echo ""
        echo -e "  ${D}Log file:${RESET} tail -f $log_file"
        echo -e "  ${D}Stop with:${RESET} kill $pid"
    else
        warn "Server did not respond on port $port within 60 seconds."
        echo "Check logs: tail -f $log_file"
    fi
}

run_project_by_name() {
    local name="$1"; local dir="${2:-.}"
    case "$name" in
        nextjs|next)  run_nextjs "$dir" ;;
        vite|react)   run_vite "$dir" ;;
        expo|rn)      run_expo "$dir" ;;
        flutter)      run_flutter "$dir" ;;
        fastapi|api)  run_fastapi "$dir" ;;
        django)       run_django "$dir" ;;
        python|py)    run_python "$dir" ;;
        go)           run_go "$dir" ;;
        rust)         run_rust "$dir" ;;
        node)         run_node "$dir" ;;
        *) fail "Unknown stack: $name" ;;
    esac
}

# ─── Smart deploy ──────────────────────────────────────────────
deploy_project() {
    local dir="${1:-.}"
    echo -e "\n  ${BOLD}${ORANGE}🚀 DEPLOY${RESET}\n"

    # Detect platform from project files
    if [ -f "$dir/vercel.json" ] || [ -f "$dir/.vercel/project.json" ]; then
        info "Vercel project detected"
        ensure_tool vercel vercel
        cd "$dir" && vercel --prod
        chinna_ok_toast "Deployed to Vercel" "Check vercel.app dashboard"
    elif [ -f "$dir/netlify.toml" ]; then
        info "Netlify project detected"
        ensure_tool netlify netlify-cli
        cd "$dir" && netlify deploy --prod
    elif [ -f "$dir/railway.json" ] || [ -f "$dir/.railway" ]; then
        info "Railway project detected"
        ensure_tool railway railway
        cd "$dir" && railway up
    else
        warn "No deployment config found (vercel.json / netlify.toml / railway.json)"
        echo -ne "  Deploy to (vercel/netlify/railway): "
        read -r platform
        case "$platform" in
            vercel)  ensure_tool vercel vercel; cd "$dir" && vercel --prod ;;
            netlify) ensure_tool netlify netlify-cli; cd "$dir" && netlify deploy --prod ;;
            railway) ensure_tool railway railway; cd "$dir" && railway up ;;
        esac
    fi
}

# ─── AI git commit ─────────────────────────────────────────────
git_ai_commit() {
    local api_key="${OPENROUTER_API_KEY:-}"
    local diff
    diff=$(git diff --cached 2>/dev/null || git diff 2>/dev/null | head -200)

    if [ -z "$diff" ]; then
        warn "Nothing staged. Running: git add -A"
        git add -A
        diff=$(git diff --cached | head -200)
    fi

    if [ -z "$api_key" ]; then
        echo -ne "  ${C}Commit message:${RESET} "
        read -r msg
        git commit -m "$msg"
        return
    fi

    info "Generating commit message with AI..."
    local msg
    msg=$(curl -s "https://openrouter.ai/api/v1/chat/completions" \
        -H "Authorization: Bearer $api_key" \
        -H "Content-Type: application/json" \
        -d "$(jq -n --arg diff "$diff" '{
            model: "meta-llama/llama-3.3-70b-instruct:free",
            max_tokens: 80,
            messages: [{
                role: "user",
                content: ("Write a concise git commit message (max 72 chars) for this diff. Reply with ONLY the message, no quotes, no explanation:\n\n" + $diff)
            }]
        }')" 2>/dev/null | jq -r '.choices[0].message.content // "chore: update"')

    msg=$(echo "$msg" | head -1 | cut -c1-72)
    echo -e "  ${G}Suggested:${RESET} $msg"
    echo -ne "  ${Y}Use this? [Y/n/edit]:${RESET} "
    read -r yn
    case "$yn" in
        n|N) echo -ne "  Commit message: "; read -r msg ;;
        e|E) echo -ne "  Edit: "; read -r msg ;;
    esac
    git commit -m "$msg"
    echo -ne "  ${Y}Push now? [Y/n]:${RESET} "
    read -r push_yn
    [[ ! "$push_yn" =~ ^[Nn]$ ]] && git push && chinna_ok_toast "Pushed" "$msg"
}
