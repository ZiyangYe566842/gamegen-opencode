#!/usr/bin/env bash
set -euo pipefail
task_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for task_command in node npm git zip unzip; do
  command -v "$task_command" >/dev/null 2>&1 || { echo "Missing $task_command. See README.md." >&2; exit 1; }
done
node --input-type=module -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 12)) { console.error("Node.js 22.12 or later is required"); process.exit(1); }'
cd "$task_root"
npm ci --no-audit --no-fund
if [[ ! -f .env ]]; then cp .env.example .env; fi
node scripts/render_opencode_config.mjs
npx --no-install playwright install chromium

task_bin_dir="${GAMEGEN_BIN_DIR:-$HOME/.local/bin}"
mkdir -p "$task_bin_dir"
if [[ -e "$task_bin_dir/gamegen" || -L "$task_bin_dir/gamegen" ]]; then
  if [[ ! -L "$task_bin_dir/gamegen" || "$(readlink "$task_bin_dir/gamegen")" != "$task_root/bin/gamegen.mjs" ]]; then
    echo "An existing gamegen command was preserved. Use: node $task_root/bin/gamegen.mjs" >&2
  fi
else
  chmod +x bin/gamegen.mjs
  ln -s "$task_root/bin/gamegen.mjs" "$task_bin_dir/gamegen"
fi
echo "GameGen is ready in $task_root."
echo "Add $task_bin_dir to PATH to use gamegen."
echo "Try: node bin/gamegen.mjs demo"
echo "For AI generation, install OpenCode and run opencode auth login; see README.md."
