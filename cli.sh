#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
print_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
print_warn()  { echo -e "${YELLOW}[WARN]${NC} $1" >&2; }
print_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

repo_root() {
  local src="${BASH_SOURCE[0]}"
  while [ -h "$src" ]; do
    local dir
    dir="$(cd -P "$(dirname "$src")" && pwd)"
    src="$(readlink "$src")"
    [[ "$src" != /* ]] && src="$dir/$src"
  done
  cd -P "$(dirname "$src")" && pwd
}

ROOT_DIR="$(repo_root)"
cd "$ROOT_DIR"

prompt() {
  local label="$1"
  local def="${2:-}"
  local v=""
  if [[ -n "$def" ]]; then
    read -r -p "$label [$def]: " v
    v="${v:-$def}"
  else
    read -r -p "$label: " v
  fi
  echo "$v"
}

confirm() {
  local label="$1"
  local def="${2:-n}"
  local v=""
  local hint="y/N"
  if [[ "$def" == "y" || "$def" == "Y" ]]; then
    hint="Y/n"
  fi
  read -r -p "$label ($hint): " v
  v="${v:-$def}"
  v="$(echo "$v" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
  [[ "$v" == "y" || "$v" == "yes" ]]
}

detect_user_data_dir() {
  local mac_dev_dir="$HOME/Library/Application Support/DevToolBox-dev"
  local mac_dir="$HOME/Library/Application Support/DevToolBox"
  local linux_dev_dir="$HOME/.config/DevToolBox-dev"
  local linux_dir="$HOME/.config/DevToolBox"
  if [[ -d "$mac_dev_dir" ]]; then
    echo "$mac_dev_dir"
    return 0
  fi
  if [[ -d "$mac_dir" ]]; then
    echo "$mac_dir"
    return 0
  fi
  if [[ -d "$linux_dev_dir" ]]; then
    echo "$linux_dev_dir"
    return 0
  fi
  if [[ -d "$linux_dir" ]]; then
    echo "$linux_dir"
    return 0
  fi
  echo "$mac_dev_dir"
}

usage() {
  cat <<'EOF'
Usage:
  ./cli.sh <command> [args...]

Commands:
  dev [vite args...]             Run desktop dev server (auto-selects a free Vite port)
  build                         Build renderer + main/preload
  clear                         Clear local user data / marketplace artifacts (interactive)
  plugin create                  Create a marketplace plugin template (interactive)
  plugin <market-id>             Build + pack a marketplace plugin into a local registry zip (interactive)
  package <macos|windows|all> [arch]   Package installers (.dmg/.exe)
  check                          Run local quality/security checks (lint + typecheck + test)
  tool new                       Create a new built-in tool template (delegates to pnpm new:tool)
  doctor                         Print environment info
  help
EOF
}

ensure_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    print_error "Missing command: $1"
    exit 1
  fi
}

required_node_major() {
  if [[ -f "$ROOT_DIR/.nvmrc" ]]; then
    sed -E 's/^v?([0-9]+).*/\1/' < "$ROOT_DIR/.nvmrc" | tr -d '[:space:]'
    return 0
  fi
  echo "20"
}

check_node_version() {
  local required_major
  local current_major
  required_major="$(required_node_major)"
  current_major="$(node -p "process.versions.node.split('.')[0]")"
  if [[ -n "$required_major" && "$current_major" -lt "$required_major" ]]; then
    if [[ "${DEVTOOLBOX_ALLOW_UNSUPPORTED_NODE:-0}" == "1" ]]; then
      print_warn "Unsupported Node.js $(node -v). Expected Node.js >= $required_major; continuing because DEVTOOLBOX_ALLOW_UNSUPPORTED_NODE=1."
      return 0
    fi
    print_error "Unsupported Node.js $(node -v). DevToolBox requires Node.js >= $required_major."
    print_error "Use Node $required_major or newer before running this command."
    return 1
  fi
}

check_pnpm_version() {
  local current_major
  current_major="$(pnpm -v | awk -F. '{print $1}')"
  if [[ "$current_major" -lt "10" ]]; then
    if [[ "${DEVTOOLBOX_ALLOW_UNSUPPORTED_PNPM:-0}" == "1" ]]; then
      print_warn "Unsupported pnpm $(pnpm -v). Expected pnpm >= 10; continuing because DEVTOOLBOX_ALLOW_UNSUPPORTED_PNPM=1."
      return 0
    fi
    print_error "Unsupported pnpm $(pnpm -v). DevToolBox requires pnpm >= 10."
    print_error "Install pnpm 10 or newer, for example: corepack enable && corepack prepare pnpm@10.10.0 --activate"
    return 1
  fi
}

human_bytes() {
  local bytes="${1:-0}"
  awk -v b="$bytes" 'BEGIN {
    if (b <= 0) { print "unknown"; exit }
    printf "%.1f GiB", b / 1024 / 1024 / 1024
  }'
}

disk_available_bytes() {
  df -Pk "$ROOT_DIR" 2>/dev/null | awk 'NR == 2 { printf "%.0f", $4 * 1024 }'
}

memory_total_bytes() {
  if command -v sysctl >/dev/null 2>&1; then
    sysctl -n hw.memsize 2>/dev/null && return 0
  fi
  if [[ -r /proc/meminfo ]]; then
    awk '/^MemTotal:/ { printf "%.0f", $2 * 1024 }' /proc/meminfo
    return 0
  fi
  echo 0
}

memory_available_bytes() {
  if command -v memory_pressure >/dev/null 2>&1; then
    local mp
    mp="$(memory_pressure -Q 2>/dev/null || true)"
    local total
    local percent
    total="$(awk '/The system has/ { print $4 }' <<<"$mp")"
    percent="$(awk -F': ' '/free percentage/ { gsub(/%/, "", $2); print $2 }' <<<"$mp")"
    if [[ "$total" =~ ^[0-9]+$ && "$percent" =~ ^[0-9]+$ ]]; then
      awk -v t="$total" -v p="$percent" 'BEGIN { printf "%.0f", t * p / 100 }'
      return 0
    fi
  fi
  if command -v vm_stat >/dev/null 2>&1; then
    vm_stat 2>/dev/null | awk '
      /page size of/ { page = $8; gsub(/[^0-9]/, "", page) }
      /Pages free/ { free = $3; gsub(/\./, "", free) }
      /Pages inactive/ { inactive = $3; gsub(/\./, "", inactive) }
      /Pages speculative/ { speculative = $3; gsub(/\./, "", speculative) }
      END {
        if (page > 0) printf "%.0f", (free + inactive + speculative) * page;
      }'
    return 0
  fi
  if [[ -r /proc/meminfo ]]; then
    awk '/^MemAvailable:/ { printf "%.0f", $2 * 1024 }' /proc/meminfo
    return 0
  fi
  echo 0
}

print_system_summary() {
  local total_mem
  local available_mem
  local disk_available
  total_mem="$(memory_total_bytes)"
  available_mem="$(memory_available_bytes)"
  disk_available="$(disk_available_bytes)"
  print_info "OS: $(uname -s) $(uname -m)"
  print_info "Memory: $(human_bytes "$available_mem") available / $(human_bytes "$total_mem") total"
  print_info "Disk: $(human_bytes "$disk_available") available at $ROOT_DIR"
}

port_in_use() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi
  if command -v nc >/dev/null 2>&1; then
    nc -z 127.0.0.1 "$port" >/dev/null 2>&1
    return $?
  fi
  node - "$port" <<'NODE'
const net = require('node:net');
const port = Number(process.argv[2]);
const server = net.createServer();
server.once('error', () => process.exit(0));
server.once('listening', () => server.close(() => process.exit(1)));
server.listen(port, '127.0.0.1');
NODE
}

print_port_owner() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | sed 's/^/  /' >&2 || true
  else
    print_warn "Install lsof to inspect the process that owns port $port."
  fi
}

select_dev_port() {
  local desired="$1"
  if ! port_in_use "$desired"; then
    echo "$desired"
    return 0
  fi

  print_warn "Port $desired is already in use." >&2
  print_port_owner "$desired"
  if [[ "${DEVTOOLBOX_STRICT_PORT:-0}" == "1" ]]; then
    print_error "DEVTOOLBOX_STRICT_PORT=1 is set, so the dev server will not auto-select another port."
    return 1
  fi

  local port
  for ((port = desired + 1; port <= desired + 50; port += 1)); do
    if ! port_in_use "$port"; then
      print_info "Using free dev port $port instead. Set DEVTOOLBOX_STRICT_PORT=1 to fail on conflicts." >&2
      echo "$port"
      return 0
    fi
  done

  print_error "No free dev port found in range $desired-$((desired + 50))."
  return 1
}

package_diagnostics_file() {
  echo "$ROOT_DIR/.devtoolbox-diagnostics/package-preflight.txt"
}

write_package_diagnostics() {
  local platform="$1"
  local arch="$2"
  local file
  file="$(package_diagnostics_file)"
  mkdir -p "$(dirname "$file")"
  {
    echo "DevToolBox package diagnostics"
    echo "Generated: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    echo "Platform target: $platform"
    echo "Arch target: ${arch:-default}"
    echo "Repository: $ROOT_DIR"
    echo "Git branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
    echo "Git commit: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
    echo "OS: $(uname -a)"
    echo "Node: $(node -v 2>/dev/null || echo missing)"
    echo "pnpm: $(pnpm -v 2>/dev/null || echo missing)"
    echo "Memory available: $(human_bytes "$(memory_available_bytes)")"
    echo "Memory total: $(human_bytes "$(memory_total_bytes)")"
    echo "Disk available: $(human_bytes "$(disk_available_bytes)")"
    echo "NODE_OPTIONS: ${NODE_OPTIONS:-<empty>}"
  } >"$file"
  echo "$file"
}

check_package_resources() {
  local min_mem=$((3 * 1024 * 1024 * 1024))
  local recommended_mem=$((4 * 1024 * 1024 * 1024))
  local min_disk=$((8 * 1024 * 1024 * 1024))
  local recommended_disk=$((12 * 1024 * 1024 * 1024))
  local available_mem
  local available_disk
  available_mem="$(memory_available_bytes)"
  available_disk="$(disk_available_bytes)"

  print_system_summary

  if [[ "$available_mem" =~ ^[0-9]+$ && "$available_mem" -gt 0 ]]; then
    if (( available_mem < min_mem )); then
      print_error "Packaging needs at least $(human_bytes "$min_mem") available memory; current: $(human_bytes "$available_mem")."
      print_error "Close memory-heavy apps and retry, or set DEVTOOLBOX_SKIP_RESOURCE_CHECK=1 if you want to force it."
      return 1
    fi
    if (( available_mem < recommended_mem )); then
      print_warn "Available memory is below the recommended $(human_bytes "$recommended_mem") for packaging."
    fi
  else
    print_warn "Could not determine available memory."
  fi

  if [[ "$available_disk" =~ ^[0-9]+$ && "$available_disk" -gt 0 ]]; then
    if (( available_disk < min_disk )); then
      print_error "Packaging needs at least $(human_bytes "$min_disk") free disk space; current: $(human_bytes "$available_disk")."
      return 1
    fi
    if (( available_disk < recommended_disk )); then
      print_warn "Free disk space is below the recommended $(human_bytes "$recommended_disk") for packaging."
    fi
  else
    print_warn "Could not determine available disk space."
  fi
}

run_package_preflight() {
  local platform="$1"
  local arch="$2"
  local status=0
  print_info "Running package preflight..."
  check_node_version || status=1
  check_pnpm_version || status=1
  if [[ "${DEVTOOLBOX_SKIP_RESOURCE_CHECK:-0}" != "1" ]]; then
    check_package_resources || status=1
  else
    print_warn "Skipping memory/disk resource checks because DEVTOOLBOX_SKIP_RESOURCE_CHECK=1."
  fi

  if [[ "$(uname -s)" == "Darwin" && ( "$platform" == "windows" || "$platform" == "all" ) ]]; then
    if ! command -v wine >/dev/null 2>&1 || ! command -v mono >/dev/null 2>&1; then
      print_error "Windows packaging on macOS requires wine + mono."
      print_error "Install: brew install --cask wine-stable && brew install mono"
      print_error "Or run packaging on Windows / GitHub Actions."
      status=1
    fi
  fi

  local diag
  diag="$(write_package_diagnostics "$platform" "$arch")"
  print_info "Package diagnostics: $diag"

  if (( status != 0 )); then
    print_error "Package preflight failed. Fix the issues above and retry."
    return "$status"
  fi
  print_ok "Package preflight passed"
}

print_package_failure_hint() {
  local status="$1"
  local diag
  diag="$(package_diagnostics_file)"
  print_error "Package step failed with exit code $status."
  if [[ "$status" == "137" || "$status" == "143" ]]; then
    print_error "This often means the process was killed by the OS because of memory pressure."
  fi
  print_error "Diagnostics: $diag"
  print_error "Run ./cli.sh doctor for environment details."
}

run_package_step() {
  local label="$1"
  shift
  print_info "$label..."
  if "$@"; then
    print_ok "$label completed"
  else
    local status=$?
    print_package_failure_hint "$status"
    exit "$status"
  fi
}

cmd_doctor() {
  ensure_cmd node
  ensure_cmd pnpm
  local status=0
  if check_node_version; then
    print_ok "Node $(node -v) | pnpm $(pnpm -v)"
  else
    status=1
  fi
  check_pnpm_version || status=1
  if command -v git >/dev/null 2>&1; then
    print_ok "Git $(git --version | awk '{print $3}')"
  fi
  print_system_summary
  local dev_port="${DEVTOOLBOX_DEV_PORT:-5173}"
  if port_in_use "$dev_port"; then
    print_warn "Dev port $dev_port is in use:"
    print_port_owner "$dev_port"
  else
    print_ok "Dev port $dev_port is free"
  fi
  return "$status"
}

cmd_dev() {
  ensure_cmd node
  ensure_cmd pnpm
  check_node_version
  check_pnpm_version
  unset NODE_OPTIONS
  export DEVTOOLBOX_DEBUG="${DEVTOOLBOX_DEBUG:-1}"
  local -a vite_args=()
  if [[ "$#" -gt 0 ]]; then
    vite_args=("$@")
  fi

  local has_port_arg=0
  local arg
  for arg in "$@"; do
    if [[ "$arg" == "--port" || "$arg" == "-p" || "$arg" == --port=* ]]; then
      has_port_arg=1
      break
    fi
  done
  if (( has_port_arg == 0 )); then
    local selected_port
    selected_port="$(select_dev_port "${DEVTOOLBOX_DEV_PORT:-5173}")"
    vite_args+=(--port "$selected_port")
  fi

  if [[ "${#vite_args[@]}" -gt 0 ]]; then
    pnpm exec vite "${vite_args[@]}"
  else
    pnpm exec vite
  fi
}

cmd_build() {
  ensure_cmd node
  ensure_cmd pnpm
  check_node_version
  check_pnpm_version
  pnpm build
}

cmd_clear() {
  local candidates=()
  local p0="$HOME/Library/Application Support/DevToolBox-dev"
  local p1="$HOME/Library/Application Support/DevToolBox"
  local p2="$HOME/Library/Application Support/cross-platform-toolbox"
  local p3="$HOME/.config/DevToolBox"
  local p4="$HOME/.config/DevToolBox-dev"
  [[ -d "$p0" ]] && candidates+=("$p0")
  [[ -d "$p1" ]] && candidates+=("$p1")
  [[ -d "$p2" ]] && candidates+=("$p2")
  [[ -d "$p3" ]] && candidates+=("$p3")
  [[ -d "$p4" ]] && candidates+=("$p4")

  local user_data=""
  if [[ "${#candidates[@]}" -eq 0 ]]; then
    user_data="$(detect_user_data_dir)"
  elif [[ "${#candidates[@]}" -eq 1 ]]; then
    user_data="${candidates[0]}"
  else
    print_info "Found multiple user data directories:"
    local idx=1
    for d in "${candidates[@]}"; do
      echo "  [$idx] $d"
      idx=$((idx + 1))
    done
    local picked
    picked="$(prompt 'Select a directory index to clear' '1')"
    if [[ ! "$picked" =~ ^[0-9]+$ ]] || [[ "$picked" -lt 1 ]] || [[ "$picked" -gt "${#candidates[@]}" ]]; then
      print_error "Invalid selection: $picked"
      exit 1
    fi
    user_data="${candidates[$((picked - 1))]}"
  fi

  print_info "User data dir: $user_data"
  if [[ ! -d "$user_data" ]]; then
    print_error "User data dir not found: $user_data"
    print_info "Launch the app once (./cli.sh dev) to create it, then retry."
    exit 1
  fi

  print_info "This command deletes local files. Close DevToolBox before continuing."
  if ! confirm "Continue" "n"; then
    print_info "Cancelled"
    return 0
  fi

  if confirm "1) Clear saved app info (Local Storage / Session / Cookies / Preferences / Cache)" "n"; then
    rm -rf "$user_data/Local Storage" "$user_data/Session Storage" "$user_data/Cache" "$user_data/Code Cache" "$user_data/GPUCache" "$user_data/blob_storage" "$user_data/DawnGraphiteCache" "$user_data/DawnWebGPUCache" 2>/dev/null || true
    rm -f "$user_data/Preferences" "$user_data/Cookies" "$user_data/Cookies-journal" "$user_data/Network Persistent State" "$user_data/SharedStorage" "$user_data/SharedStorage-wal" 2>/dev/null || true
    print_ok "Saved app info cleared"
  fi

  if confirm "2) Clear marketplace-installed plugins (uninstall all)" "n"; then
    rm -rf "$user_data/modules" "$user_data/plugins" 2>/dev/null || true
    rm -f "$user_data/plugin-kv.json" 2>/dev/null || true
    mkdir -p "$user_data/modules" "$user_data/plugins"
    printf '{\n  \"installed\": {}\n}\n' >"$user_data/marketplace-state.json"
    print_ok "Marketplace plugins cleared"
  fi

  if confirm "3) Clear marketplace cache (registries/download cache)" "n"; then
    rm -rf "$user_data/marketplace-cache" 2>/dev/null || true
    mkdir -p "$user_data/marketplace-cache"
    print_ok "Marketplace cache cleared"
  fi

  if confirm "4) Clear plugin KV storage (plugin-kv.json)" "n"; then
    rm -f "$user_data/plugin-kv.json" 2>/dev/null || true
    print_ok "Plugin KV cleared"
  fi

  if confirm "5) Reset device-id (affects device-bound backup encryption)" "n"; then
    rm -f "$user_data/device-id.txt" 2>/dev/null || true
    print_ok "device-id reset (will be regenerated on next run)"
  fi

  if confirm "6) Init marketplace/registry.local.json and clear marketplace/.local-dist" "n"; then
    mkdir -p "$ROOT_DIR/marketplace/.local-dist"
    rm -rf "$ROOT_DIR/marketplace/.local-dist"/* 2>/dev/null || true
    printf '{\n  \"schemaVersion\": 1,\n  \"plugins\": []\n}\n' >"$ROOT_DIR/marketplace/registry.local.json"
    print_ok "Local registry initialized"
  fi

  if confirm "7) Clear build artifacts (dist / dist-electron / release)" "n"; then
    rm -rf "$ROOT_DIR/dist" "$ROOT_DIR/dist-electron" "$ROOT_DIR/release" 2>/dev/null || true
    print_ok "Build artifacts cleared"
  fi

  print_ok "Done"
}

cmd_plugin() {
  ensure_cmd pnpm
  ensure_cmd node
  check_node_version
  check_pnpm_version
  local action="${1:-}"
  shift || true

  if [[ "$action" == "create" ]]; then
    local plugin_id=""
    plugin_id="$(prompt 'Plugin ID (e.g. market-hello-tool)' '')"
    plugin_id="$(echo "$plugin_id" | tr -d '[:space:]')"
    if [[ -z "$plugin_id" ]]; then
      print_error "Plugin ID is required"
      exit 1
    fi
    if [[ ! "$plugin_id" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
      print_error "Invalid plugin id: $plugin_id (expected kebab-case)"
      exit 1
    fi
    if [[ ! "$plugin_id" =~ ^market- ]]; then
      print_error "Invalid plugin id: $plugin_id (must start with market-)"
      exit 1
    fi

    local name
    name="$(prompt 'Plugin Name' "$plugin_id")"
    local description
    description="$(prompt 'Description' 'A marketplace plugin for DevToolBox')"
    local version
    version="$(prompt 'Version' '0.1.0')"
    local sdk_version
    sdk_version="$(prompt 'SDK Version' '1.0')"
    local category_id
    category_id="$(prompt 'categoryId (dev-tools/text-tools/network-tools/security-tools/other-tools)' 'dev-tools')"
    local author
    author="$(prompt 'Author' 'DevToolBox')"
    local license
    license="$(prompt 'License' 'Apache-2.0')"
    local homepage
    homepage="$(prompt 'Homepage' 'https://example.com')"
    local repository
    repository="$(prompt 'Repository' 'https://example.com')"
    local permissions_raw
    permissions_raw="$(prompt 'Permissions (comma separated)' 'storage:kv,system:getInfo,system:notifications')"

    name="${name//$'\n'/ }"
    description="${description//$'\n'/ }"
    author="${author//$'\n'/ }"
    homepage="${homepage//$'\n'/ }"
    repository="${repository//$'\n'/ }"
    name="${name//\\/\\\\}"; name="${name//\"/\\\"}"
    description="${description//\\/\\\\}"; description="${description//\"/\\\"}"
    author="${author//\\/\\\\}"; author="${author//\"/\\\"}"
    homepage="${homepage//\\/\\\\}"; homepage="${homepage//\"/\\\"}"
    repository="${repository//\\/\\\\}"; repository="${repository//\"/\\\"}"

    local module_dir="marketplace/modules/$plugin_id"
    if [[ -e "$module_dir" ]]; then
      print_error "Target already exists: $module_dir"
      exit 1
    fi

    mkdir -p "$module_dir/src"

    local permissions_json="[]"
    if [[ -n "${permissions_raw// /}" ]]; then
      IFS=',' read -r -a perms <<<"$permissions_raw"
      local arr=""
      for p in "${perms[@]}"; do
        p="$(echo "$p" | tr -d '[:space:]')"
        [[ -z "$p" ]] && continue
        p="${p//\\/\\\\}"; p="${p//\"/\\\"}"
        if [[ -z "$arr" ]]; then
          arr="\"$p\""
        else
          arr="$arr, \"$p\""
        fi
      done
      permissions_json="[$arr]"
    fi

    cat >"$module_dir/manifest.json" <<EOF
{
  "id": "$plugin_id",
  "name": "$name",
  "description": "$description",
  "version": "$version",
  "sdkVersion": "$sdk_version",
  "entry": "package/index.html",
  "categoryId": "$category_id",
  "author": "$author",
  "license": "$license",
  "homepage": "$homepage",
  "repository": "$repository",
  "permissions": $permissions_json
}
EOF

    cat >"$module_dir/package.json" <<EOF
{
  "name": "@devtoolbox/plugin-$plugin_id",
  "private": true,
  "version": "$version",
  "type": "module",
  "scripts": {
    "dev": "vite --config ../../shared/vite.config.ts",
    "build": "tsc -p tsconfig.json --noEmit && vite build --config ../../shared/vite.config.ts"
  },
  "dependencies": {
    "@devtoolbox/plugin-sdk": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.6.3",
    "vite": "^6.0.5"
  }
}
EOF

    cat >"$module_dir/tsconfig.json" <<'EOF'
{
  "extends": "../../tsconfig.plugin.json",
  "include": ["src"]
}
EOF

    cat >"$module_dir/index.html" <<'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DevToolBox Plugin</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

    cat >"$module_dir/src/main.tsx" <<'EOF'
import App from './App';
import { mountPlugin } from '@devtoolbox/plugin-sdk/react';
import './style.css';

mountPlugin(<App />);
EOF

    cat >"$module_dir/src/App.tsx" <<EOF
import { useEffect, useState } from 'react';
import { sdk } from '@devtoolbox/plugin-sdk';

type Info = { platform?: string; arch?: string; appVersion?: string };

export default function App() {
  const [info, setInfo] = useState<Info | null>(null);
  const [kv, setKv] = useState('');

  useEffect(() => {
    void (async () => {
      const res = await sdk.system.getInfo();
      if (res.ok) setInfo((res.data ?? null) as any);
    })();
  }, []);

  const writeSample = async () => {
    await sdk.storage.set('sample.key', { ts: Date.now(), msg: 'hello' });
    const v = await sdk.storage.get('sample.key');
    setKv(JSON.stringify(v, null, 2));
  };

  return (
    <div className="app">
      <h1>$name</h1>
      <div className="muted">$description</div>
      <div className="card">
        <div className="row">
          <button onClick={() => void writeSample()}>Storage Sample</button>
          <button
            onClick={() =>
              void sdk.system.notify({ title: 'DevToolBox', body: 'Hello from marketplace plugin', level: 'info' })
            }
          >
            Notify
          </button>
        </div>
        <pre className="pre">{kv || 'Click "Storage Sample" to test sdk.storage'}</pre>
      </div>
      <div className="card">
        <div className="label">system.getInfo</div>
        <pre className="pre">{info ? JSON.stringify(info, null, 2) : 'Loading...'}</pre>
      </div>
    </div>
  );
}
EOF

    cat >"$module_dir/src/style.css" <<'EOF'
html,
body {
  margin: 0;
  padding: 0;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  background: #0e1116;
  color: #e9eef5;
}

.app {
  padding: 16px;
}

.muted {
  color: rgba(233, 238, 245, 0.7);
  font-size: 13px;
  margin-top: 6px;
}

.card {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
}

.row {
  display: flex;
  gap: 10px;
}

button {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: #e9eef5;
  cursor: pointer;
}

button:hover {
  border-color: rgba(74, 163, 255, 0.6);
}

.label {
  font-size: 12px;
  color: rgba(233, 238, 245, 0.7);
  margin-bottom: 6px;
}

.pre {
  margin: 10px 0 0 0;
  padding: 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.25);
  overflow: auto;
  font-size: 12px;
}
EOF

    print_ok "Created marketplace plugin template: $module_dir"
    print_info "Next:"
    print_info "  pnpm install"
    print_info "  pnpm --filter @devtoolbox/plugin-$plugin_id dev"
    print_info "  ./cli.sh plugin $plugin_id"
    return
  fi

  local plugin_id="$action"
  if [[ "$plugin_id" == "all" ]]; then
    local ids=()
    while IFS= read -r d; do
      local base
      base="$(basename "$d")"
      [[ -z "$base" ]] && continue
      ids+=("$base")
    done < <(find marketplace/modules -maxdepth 1 -type d -name 'market-*' -print)

    if [[ ${#ids[@]} -eq 0 ]]; then
      print_error "No marketplace plugins found under marketplace/modules"
      exit 1
    fi

    print_info "Building Plugin SDK release output"
    pnpm --filter @devtoolbox/plugin-sdk build

    print_info "Building plugins: ${#ids[@]}"
    for id in "${ids[@]}"; do
      print_info "  build: $id"
      pnpm --filter "@devtoolbox/plugin-$id" build
    done
    print_ok "All plugin builds completed"

    print_info "Packing plugins into local registry zip (merge)"
    node marketplace/scripts/pack-local.mjs --merge "${ids[@]}"
    print_ok "Plugin pack completed"
    return
  fi
  if [[ -z "$plugin_id" ]]; then
    plugin_id="$(prompt 'Plugin ID (e.g. market-hello-tool)' '')"
  fi
  plugin_id="$(echo "$plugin_id" | tr -d '[:space:]')"
  if [[ -z "$plugin_id" ]]; then
    print_error "Plugin ID is required"
    exit 1
  fi
  if [[ ! "$plugin_id" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
    print_error "Invalid plugin id: $plugin_id (expected kebab-case)"
    exit 1
  fi
  if [[ ! "$plugin_id" =~ ^market- ]]; then
    print_error "Invalid plugin id: $plugin_id (must start with market-)"
    exit 1
  fi
  if [[ ! -d "marketplace/modules/$plugin_id" ]]; then
    print_error "Plugin not found: marketplace/modules/$plugin_id"
    exit 1
  fi

  print_info "Building Plugin SDK release output"
  pnpm --filter @devtoolbox/plugin-sdk build

  print_info "Building plugin: $plugin_id"
  pnpm --filter "@devtoolbox/plugin-$plugin_id" build
  print_ok "Plugin build completed"

  print_info "Packing plugin into local registry zip (merge): $plugin_id"
  node marketplace/scripts/pack-local.mjs --merge "$plugin_id"
  print_ok "Plugin pack completed"
}

cmd_package() {
  local platform="${1:-}"
  local arch="${2:-}"
  if [[ -z "$platform" ]]; then
    platform="$(prompt 'Platform (macos/windows/all)' 'macos')"
  fi
  case "$platform" in
    macos|windows|all) ;;
    *) print_error "Invalid platform: $platform"; exit 1 ;;
  esac

  if [[ "$platform" == "macos" && -z "$arch" ]]; then
    arch="$(prompt 'Arch (arm64/x64/universal, empty for default)' '')"
  fi
  if [[ -n "$arch" ]]; then
    case "$arch" in
      arm64|x64|universal) ;;
      *) print_error "Invalid arch: $arch"; exit 1 ;;
    esac
  fi

  ensure_cmd node
  ensure_cmd pnpm

  local builder_args=()
  case "$platform" in
    macos) builder_args+=(--mac) ;;
    windows) builder_args+=(--win) ;;
    all) builder_args+=(--mac --win) ;;
  esac

  if [[ "$platform" == "macos" || "$platform" == "all" ]]; then
    case "$arch" in
      arm64) builder_args+=(--arm64) ;;
      x64) builder_args+=(--x64) ;;
      universal) builder_args+=(--universal) ;;
      "") ;;
    esac
  fi

  unset NODE_OPTIONS
  run_package_preflight "$platform" "$arch"
  export npm_config_jobs="${npm_config_jobs:-1}"

  run_package_step "Installing dependencies" pnpm install --frozen-lockfile --child-concurrency=1

  run_package_step "Building" pnpm build
  run_package_step "Checking bundle budget" pnpm bundle:check
  run_package_step "Generating supply-chain reports" pnpm supply-chain:generate

  if ! (node -p "require('electron/package.json').version" >/dev/null 2>&1); then
    print_error "Cannot resolve electron from node_modules. Run pnpm install in devToolBox."
    exit 1
  fi
  run_package_step "Validating esbuild binary" node -e "require('esbuild').transformSync('const ok = true', { minify: true })"

  run_package_step "Packaging ($platform${arch:+/$arch})" pnpm exec electron-builder "${builder_args[@]}" --publish never

  if [[ -d release ]]; then
    find release -maxdepth 1 -type f -name '*.zip*' -delete 2>/dev/null || true
  fi

  local output_dir="release"
  if [[ -d "$output_dir" ]]; then
    print_info "Artifacts:"
    case "$platform" in
      macos) find "$output_dir" -name "*.dmg" -type f ;;
      windows) find "$output_dir" -name "*.exe" -type f ;;
      all) find "$output_dir" \( -name "*.dmg" -o -name "*.exe" \) -type f ;;
    esac
  fi
}

cmd_check() {
  ensure_cmd node
  ensure_cmd pnpm
  check_node_version
  check_pnpm_version
  pnpm lint
  pnpm typecheck
  pnpm test
  print_ok "Checks passed"
}

cmd_tool_new() {
  ensure_cmd node
  ensure_cmd pnpm
  check_node_version
  check_pnpm_version
  pnpm new:tool
}

main() {
  local cmd="${1:-help}"
  shift || true

  case "$cmd" in
    help|-h|--help) usage ;;
    doctor) cmd_doctor ;;
    dev) cmd_dev "$@" ;;
    build) cmd_build ;;
    clear) cmd_clear ;;
    plugin) cmd_plugin "$@" ;;
    package) cmd_package "$@" ;;
    check) cmd_check ;;
    tool)
      local sub="${1:-}"
      shift || true
      case "$sub" in
        new) cmd_tool_new ;;
        *) print_error "Unknown tool subcommand: ${sub:-}"; usage; exit 1 ;;
      esac
      ;;
    *) print_error "Unknown command: $cmd"; usage; exit 1 ;;
  esac
}

if [[ "${DEVTOOLBOX_CLI_SOURCE_ONLY:-0}" != "1" ]]; then
  main "$@"
fi
