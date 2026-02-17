#!/usr/bin/env bash
set -euo pipefail

# ─── ANSI Colors ─────────────────────────────────────────────────────────────

if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BLUE='\033[0;34m'
  CYAN='\033[0;36m'
  BOLD='\033[1m'
  NC='\033[0m'
else
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  CYAN=''
  BOLD=''
  NC=''
fi

# ─── Helper Functions ────────────────────────────────────────────────────────

info()    { printf "${BLUE}[INFO]${NC} %s\n" "$1"; }
success() { printf "${GREEN}[OK]${NC}   %s\n" "$1"; }
warn()    { printf "${YELLOW}[WARN]${NC} %s\n" "$1"; }
error()   { printf "${RED}[ERR]${NC}  %s\n" "$1" >&2; }
step()    { printf "\n${BOLD}${CYAN}>> %s${NC}\n" "$1"; }

# ─── Variables ───────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODE=""
NON_INTERACTIVE=false
SKIP_SYSTEM_PACKAGES=false
OS_TYPE=""
PKG_MANAGER=""

# Checklist tracking (v=done, -=skipped, !=warning)
CK_SYSTEM_PACKAGES="-"
CK_NPM_INSTALL="-"
CK_ENV_FILE="-"
CK_AGENT_CONFIG="-"
CK_AGENT_APIKEY=""

# ─── Usage ───────────────────────────────────────────────────────────────────

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Install and configure IP Stargaze.

Options:
  --mode=MODE               Installation mode: server, agent, or both
  --non-interactive         Auto-accept all prompts with defaults
  --skip-system-packages    Skip system package installation
  --help                    Show this help message

Examples:
  $(basename "$0")
  $(basename "$0") --mode=server
  $(basename "$0") --mode=agent --non-interactive
EOF
  exit 0
}

# ─── CLI Argument Parsing ────────────────────────────────────────────────────

for arg in "$@"; do
  case "$arg" in
    --mode=*)
      MODE="${arg#*=}"
      case "$MODE" in
        server|agent|both) ;;
        *)
          error "Invalid mode: $MODE (must be server, agent, or both)"
          exit 1
          ;;
      esac
      ;;
    --non-interactive)
      NON_INTERACTIVE=true
      ;;
    --skip-system-packages)
      SKIP_SYSTEM_PACKAGES=true
      ;;
    --help)
      usage
      ;;
    *)
      error "Unknown option: $arg"
      usage
      ;;
  esac
done

# ─── OS Detection ────────────────────────────────────────────────────────────

detect_os() {
  if [ -f /etc/debian_version ]; then
    OS_TYPE="debian"
    PKG_MANAGER="apt-get"
  elif [ -f /etc/redhat-release ]; then
    OS_TYPE="rhel"
    if command -v dnf >/dev/null 2>&1; then
      PKG_MANAGER="dnf"
    elif command -v yum >/dev/null 2>&1; then
      PKG_MANAGER="yum"
    else
      error "Neither dnf nor yum found on RHEL-based system"
      exit 1
    fi
  elif [ "$(uname -s)" = "Darwin" ]; then
    OS_TYPE="macos"
    PKG_MANAGER="brew"
  else
    error "Unsupported operating system: $(uname -s)"
    error "Supported: Debian/Ubuntu, RHEL/CentOS/Fedora, macOS"
    exit 1
  fi
  info "Detected OS: ${OS_TYPE} ($(uname -m))"
}

# ─── Project Root Validation ─────────────────────────────────────────────────

validate_project_root() {
  if [ ! -f "${SCRIPT_DIR}/package.json" ]; then
    error "package.json not found in ${SCRIPT_DIR}"
    error "Please run this script from the ip-stargaze project root."
    exit 1
  fi

  if ! grep -q '"name": "ip-stargaze"' "${SCRIPT_DIR}/package.json"; then
    error "This does not appear to be the ip-stargaze project."
    exit 1
  fi

  success "Project root verified: ${SCRIPT_DIR}"
}

# ─── Banner ──────────────────────────────────────────────────────────────────

print_banner() {
  printf "\n"
  printf "${BOLD}========================================${NC}\n"
  printf "${BOLD}  IP Stargaze Installer${NC}\n"
  printf "${BOLD}========================================${NC}\n"
  printf "\n"
}

# ─── Mode Selection ──────────────────────────────────────────────────────────

select_mode() {
  if [ -n "$MODE" ]; then
    info "Installation mode: ${MODE} (from --mode flag)"
    return
  fi

  if [ "$NON_INTERACTIVE" = true ]; then
    MODE="server"
    info "Installation mode: server (non-interactive default)"
    return
  fi

  printf "Select installation mode:\n\n"
  printf "  ${BOLD}1)${NC} Main Server    - Central monitoring server (port 15118)\n"
  printf "  ${BOLD}2)${NC} Agent          - Remote traffic collector (port 15119)\n"
  printf "  ${BOLD}3)${NC} Both           - Server + Agent on same machine\n"
  printf "\n"

  local attempts=0
  while [ $attempts -lt 3 ]; do
    printf "Enter your choice [1-3]: "
    read -r choice
    case "$choice" in
      1) MODE="server"; break ;;
      2) MODE="agent";  break ;;
      3) MODE="both";   break ;;
      *)
        attempts=$((attempts + 1))
        if [ $attempts -ge 3 ]; then
          error "Too many invalid attempts. Exiting."
          exit 1
        fi
        warn "Invalid choice. Please enter 1, 2, or 3."
        ;;
    esac
  done

  info "Installation mode: ${MODE}"
}

# ─── Node.js Version Check ──────────────────────────────────────────────────

check_node() {
  step "Checking Node.js"

  if ! command -v node >/dev/null 2>&1; then
    error "Node.js is not installed."
    printf "\n"
    printf "  Install Node.js 20+ using one of these methods:\n\n"
    case "$OS_TYPE" in
      debian)
        printf "    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -\n"
        printf "    sudo apt-get install -y nodejs\n"
        ;;
      rhel)
        printf "    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -\n"
        printf "    sudo ${PKG_MANAGER} install -y nodejs\n"
        ;;
      macos)
        printf "    brew install node@20\n"
        printf "    # or use nvm: nvm install 20\n"
        ;;
    esac
    printf "\n"
    exit 1
  fi

  local node_version
  node_version="$(node --version)"
  local major
  major="$(echo "$node_version" | sed 's/^v//' | cut -d. -f1)"

  if [ "$major" -lt 20 ]; then
    error "Node.js ${node_version} detected. Version 20+ is required."
    printf "\n"
    printf "  Please upgrade Node.js to version 20 or later.\n\n"
    exit 1
  fi

  success "Node.js ${node_version}"

  if ! command -v npm >/dev/null 2>&1; then
    error "npm is not installed. It usually comes with Node.js."
    error "Please reinstall Node.js to include npm."
    exit 1
  fi

  success "npm $(npm --version)"
}

# ─── System Package Installation ─────────────────────────────────────────────

check_cmd() {
  command -v "$1" >/dev/null 2>&1
}

check_dpkg() {
  dpkg -s "$1" >/dev/null 2>&1
}

check_rpm() {
  rpm -q "$1" >/dev/null 2>&1
}

install_system_packages() {
  step "System Packages"

  if [ "$SKIP_SYSTEM_PACKAGES" = true ]; then
    warn "Skipping system packages (--skip-system-packages)"
    CK_SYSTEM_PACKAGES="-"
    return
  fi

  local packages_to_install=""
  local need_sudo=false

  case "$OS_TYPE" in
    debian)
      info "Checking Debian/Ubuntu packages..."

      if check_dpkg build-essential; then
        success "build-essential [SKIP]"
      else
        packages_to_install="${packages_to_install} build-essential"
      fi

      if check_cmd python3; then
        success "python3 [SKIP]"
      else
        packages_to_install="${packages_to_install} python3"
      fi

      if check_dpkg libpcap-dev; then
        success "libpcap-dev [SKIP]"
      else
        packages_to_install="${packages_to_install} libpcap-dev"
      fi
      ;;

    rhel)
      info "Checking RHEL/CentOS/Fedora packages..."

      if check_cmd gcc; then
        success "gcc [SKIP]"
      else
        packages_to_install="${packages_to_install} gcc"
      fi

      if check_rpm gcc-c++ 2>/dev/null || check_cmd g++; then
        success "gcc-c++ [SKIP]"
      else
        packages_to_install="${packages_to_install} gcc-c++"
      fi

      if check_cmd make; then
        success "make [SKIP]"
      else
        packages_to_install="${packages_to_install} make"
      fi

      if check_cmd python3; then
        success "python3 [SKIP]"
      else
        packages_to_install="${packages_to_install} python3"
      fi

      if check_rpm libpcap-devel 2>/dev/null; then
        success "libpcap-devel [SKIP]"
      else
        packages_to_install="${packages_to_install} libpcap-devel"
      fi
      ;;

    macos)
      info "Checking macOS prerequisites..."

      if xcode-select -p >/dev/null 2>&1; then
        success "Xcode CLI Tools [SKIP]"
      else
        warn "Xcode Command Line Tools not found."
        printf "\n"
        printf "  Run the following command to install:\n\n"
        printf "    xcode-select --install\n\n"
        printf "  After installation completes, re-run this script.\n\n"
        CK_SYSTEM_PACKAGES="!"
        exit 1
      fi

      if check_cmd python3; then
        success "python3 [SKIP]"
      else
        warn "python3 not found (usually included with macOS)"
      fi

      # libpcap is included with macOS
      success "libpcap (system built-in) [SKIP]"

      CK_SYSTEM_PACKAGES="v"
      return
      ;;
  esac

  # Remove leading whitespace
  packages_to_install="$(echo "$packages_to_install" | sed 's/^ *//')"

  if [ -z "$packages_to_install" ]; then
    success "All system packages already installed"
    CK_SYSTEM_PACKAGES="v"
    return
  fi

  need_sudo=true
  info "Packages to install: ${packages_to_install}"

  if [ "$NON_INTERACTIVE" = false ]; then
    printf "\nInstall these packages with sudo? [Y/n]: "
    read -r confirm
    case "$confirm" in
      [nN]*)
        warn "Skipping system package installation"
        CK_SYSTEM_PACKAGES="-"
        return
        ;;
    esac
  fi

  if [ "$need_sudo" = true ]; then
    info "Running: sudo ${PKG_MANAGER} install ${packages_to_install}"
    case "$OS_TYPE" in
      debian)
        sudo apt-get update -qq
        sudo apt-get install -y --no-install-recommends $packages_to_install
        ;;
      rhel)
        sudo $PKG_MANAGER install -y $packages_to_install
        ;;
    esac
  fi

  success "System packages installed"
  CK_SYSTEM_PACKAGES="v"
}

# ─── npm Install ─────────────────────────────────────────────────────────────

install_npm_packages() {
  step "npm Packages"

  cd "$SCRIPT_DIR"

  if [ -d "node_modules" ]; then
    if [ "$NON_INTERACTIVE" = true ]; then
      info "node_modules exists, skipping reinstall (non-interactive)"
      CK_NPM_INSTALL="v"
      return
    fi

    printf "node_modules already exists. Reinstall? [y/N]: "
    read -r confirm
    case "$confirm" in
      [yY]*)
        info "Removing node_modules..."
        rm -rf node_modules
        ;;
      *)
        info "Keeping existing node_modules"
        CK_NPM_INSTALL="v"
        return
        ;;
    esac
  fi

  local npm_cmd
  if [ -f "package-lock.json" ]; then
    npm_cmd="npm ci"
  else
    npm_cmd="npm install"
  fi

  info "Running: ${npm_cmd}"

  if $npm_cmd; then
    success "npm packages installed"
    CK_NPM_INSTALL="v"
  else
    error "npm install failed."
    printf "\n"
    printf "  Possible causes:\n"
    printf "  - Missing system packages (build-essential, python3, libpcap-dev)\n"
    printf "    Re-run without --skip-system-packages\n"
    printf "  - Network connectivity issues\n"
    printf "  - Incompatible Node.js version\n"
    printf "\n"
    CK_NPM_INSTALL="!"
    exit 1
  fi
}

# ─── Config File: .env (Server) ─────────────────────────────────────────────

setup_server_env() {
  step "Server Configuration (.env)"

  local env_file="${SCRIPT_DIR}/.env"
  local env_example="${SCRIPT_DIR}/.env.example"

  if [ -f "$env_file" ]; then
    success ".env already exists, preserving"
    CK_ENV_FILE="v"
    printf "\n"
    printf "  Current settings:\n"
    while IFS= read -r line; do
      case "$line" in
        ""|\#*) ;;
        *) printf "    %s\n" "$line" ;;
      esac
    done < "$env_file"
    printf "\n"
    return
  fi

  if [ ! -f "$env_example" ]; then
    warn ".env.example not found, creating default .env"
    printf "MODE=simulation\nPORT=15118\nINTERFACE=eth0\nEVENTS_PER_SECOND=10\n" > "$env_file"
  else
    cp "$env_example" "$env_file"
  fi

  success ".env created from .env.example"
  CK_ENV_FILE="v"
  printf "\n"
  printf "  Configuration file: .env\n"
  printf "  Available settings:\n"
  printf "    MODE              simulation or capture (default: simulation)\n"
  printf "    PORT              Server port (default: 15118)\n"
  printf "    HOST              Bind address (default: 0.0.0.0)\n"
  printf "    INTERFACE         Network interface for capture mode (default: eth0)\n"
  printf "    EVENTS_PER_SECOND Simulation speed (default: 10)\n"
  printf "\n"
}

# ─── Config File: agent.config.json (Agent) ──────────────────────────────────

prompt_or_default() {
  local prompt_text="$1"
  local default_val="$2"
  local result=""

  if [ "$NON_INTERACTIVE" = true ]; then
    echo "$default_val"
    return
  fi

  printf "  %s [%s]: " "$prompt_text" "$default_val"
  read -r result
  if [ -z "$result" ]; then
    echo "$default_val"
  else
    echo "$result"
  fi
}

validate_port() {
  local port="$1"
  if ! echo "$port" | grep -qE '^[0-9]+$'; then
    return 1
  fi
  if [ "$port" -lt 1024 ] || [ "$port" -gt 65535 ]; then
    return 1
  fi
  return 0
}

validate_buffer_capacity() {
  local cap="$1"
  if ! echo "$cap" | grep -qE '^[0-9]+$'; then
    return 1
  fi
  if [ "$cap" -lt 1000 ]; then
    return 1
  fi
  return 0
}

mask_apikey() {
  local key="$1"
  local len=${#key}
  if [ "$len" -le 4 ]; then
    echo "****"
  else
    local visible="${key:0:4}"
    local masked=""
    local i=4
    while [ $i -lt $len ]; do
      masked="${masked}*"
      i=$((i + 1))
    done
    echo "${visible}${masked}"
  fi
}

setup_agent_config() {
  step "Agent Configuration (agent.config.json)"

  local config_file="${SCRIPT_DIR}/agent.config.json"
  local config_example="${SCRIPT_DIR}/agent.config.json.example"

  if [ -f "$config_file" ]; then
    success "agent.config.json already exists, preserving"
    CK_AGENT_CONFIG="v"
    return
  fi

  local configure_now="Y"
  if [ "$NON_INTERACTIVE" = false ]; then
    printf "Configure agent now? [Y/n]: "
    read -r configure_now
    case "$configure_now" in
      [nN]*)
        if [ -f "$config_example" ]; then
          cp "$config_example" "$config_file"
          success "agent.config.json created from example (unconfigured)"
        fi
        CK_AGENT_CONFIG="v"
        return
        ;;
    esac
  fi

  local default_hostname
  default_hostname="$(hostname)"

  local agent_id
  agent_id="$(prompt_or_default "Agent ID" "$default_hostname")"

  local agent_port
  while true; do
    agent_port="$(prompt_or_default "Port" "15119")"
    if validate_port "$agent_port"; then
      break
    fi
    warn "Invalid port. Must be 1024-65535."
  done

  local agent_mode
  while true; do
    agent_mode="$(prompt_or_default "Mode (simulation/capture)" "simulation")"
    case "$agent_mode" in
      simulation|capture) break ;;
      *) warn "Invalid mode. Must be 'simulation' or 'capture'." ;;
    esac
  done

  local agent_interface
  agent_interface="$(prompt_or_default "Network interface" "eth0")"

  local agent_apikey
  agent_apikey="$(prompt_or_default "API Key (empty=no auth)" "")"

  if [ -z "$agent_apikey" ]; then
    warn "No API key set. Agent will accept unauthenticated requests."
    CK_AGENT_APIKEY="!"
  fi

  local agent_buffer
  while true; do
    agent_buffer="$(prompt_or_default "Buffer capacity" "100000")"
    if validate_buffer_capacity "$agent_buffer"; then
      break
    fi
    warn "Invalid buffer capacity. Must be 1000 or more."
  done

  # Generate JSON without jq
  printf '{\n' > "$config_file"
  printf '  "agentId": "%s",\n' "$agent_id" >> "$config_file"
  printf '  "port": %s,\n' "$agent_port" >> "$config_file"
  printf '  "host": "0.0.0.0",\n' >> "$config_file"
  printf '  "mode": "%s",\n' "$agent_mode" >> "$config_file"
  printf '  "interface": "%s",\n' "$agent_interface" >> "$config_file"
  printf '  "apiKey": "%s",\n' "$agent_apikey" >> "$config_file"
  printf '  "bufferCapacity": %s,\n' "$agent_buffer" >> "$config_file"
  printf '  "logLevel": "info"\n' >> "$config_file"
  printf '}\n' >> "$config_file"

  success "agent.config.json created"
  CK_AGENT_CONFIG="v"

  printf "\n"
  printf "  Agent configuration summary:\n"
  printf "    Agent ID  : %s\n" "$agent_id"
  printf "    Port      : %s\n" "$agent_port"
  printf "    Mode      : %s\n" "$agent_mode"
  printf "    Interface : %s\n" "$agent_interface"
  if [ -n "$agent_apikey" ]; then
    printf "    API Key   : %s\n" "$(mask_apikey "$agent_apikey")"
  else
    printf "    API Key   : (none)\n"
  fi
  printf "    Buffer    : %s\n" "$agent_buffer"
  printf "\n"
}

# ─── Installation Summary ────────────────────────────────────────────────────

print_checklist_item() {
  local status="$1"
  local label="$2"
  case "$status" in
    v) printf "  ${GREEN}[v]${NC} %s\n" "$label" ;;
    -) printf "  ${YELLOW}[-]${NC} %s\n" "$label" ;;
    !) printf "  ${RED}[!]${NC} %s\n" "$label" ;;
    *) printf "  [ ] %s\n" "$label" ;;
  esac
}

print_summary() {
  step "Installation Complete"

  printf "\n"
  printf "${BOLD}Checklist:${NC}\n"
  print_checklist_item "$CK_SYSTEM_PACKAGES" "System packages"
  print_checklist_item "$CK_NPM_INSTALL" "npm packages"

  case "$MODE" in
    server)
      print_checklist_item "$CK_ENV_FILE" ".env configuration"
      ;;
    agent)
      print_checklist_item "$CK_AGENT_CONFIG" "agent.config.json"
      ;;
    both)
      print_checklist_item "$CK_ENV_FILE" ".env configuration"
      print_checklist_item "$CK_AGENT_CONFIG" "agent.config.json"
      ;;
  esac

  if [ "$CK_AGENT_APIKEY" = "!" ]; then
    printf "\n"
    warn "Agent API key is not set. Consider adding one for security."
  fi

  printf "\n"
  printf "${BOLD}Quick Start:${NC}\n\n"

  case "$MODE" in
    server)
      printf "  # Start the server\n"
      printf "  ${CYAN}npm start${NC}\n\n"
      printf "  # Or in development mode (auto-reload)\n"
      printf "  ${CYAN}npm run dev${NC}\n\n"
      printf "  Open ${BOLD}http://localhost:15118${NC} in your browser.\n"
      ;;
    agent)
      printf "  # Start the agent\n"
      printf "  ${CYAN}npm run start:agent${NC}\n\n"
      printf "  # Or in development mode (auto-reload)\n"
      printf "  ${CYAN}npm run dev:agent${NC}\n\n"
      printf "  Then register this agent in the main server's UI.\n"
      ;;
    both)
      printf "  # Start the server\n"
      printf "  ${CYAN}npm start${NC}\n\n"
      printf "  # Start the agent (separate terminal)\n"
      printf "  ${CYAN}npm run start:agent${NC}\n\n"
      printf "  Open ${BOLD}http://localhost:15118${NC} in your browser.\n"
      ;;
  esac

  printf "\n"
  printf "${BOLD}Ports & Firewall:${NC}\n\n"

  case "$MODE" in
    server)
      printf "  Server : TCP ${BOLD}15118${NC} (HTTP + WebSocket)\n"
      ;;
    agent)
      printf "  Agent  : TCP ${BOLD}15119${NC} (REST API)\n"
      ;;
    both)
      printf "  Server : TCP ${BOLD}15118${NC} (HTTP + WebSocket)\n"
      printf "  Agent  : TCP ${BOLD}15119${NC} (REST API)\n"
      ;;
  esac

  printf "\n  Ensure these ports are open in your firewall.\n"

  if [ "$MODE" = "server" ] || [ "$MODE" = "both" ]; then
    if grep -q 'MODE=capture' "${SCRIPT_DIR}/.env" 2>/dev/null; then
      printf "\n"
      warn "Capture mode requires root/sudo or NET_RAW capability for packet sniffing."
    fi
  fi

  printf "\n"
}

# ─── Main ────────────────────────────────────────────────────────────────────

main() {
  detect_os
  validate_project_root
  print_banner
  select_mode
  check_node
  install_system_packages
  install_npm_packages

  case "$MODE" in
    server)
      setup_server_env
      ;;
    agent)
      setup_agent_config
      ;;
    both)
      setup_server_env
      setup_agent_config
      ;;
  esac

  print_summary
}

main
