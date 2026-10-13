# GameGen · OpenCode

**Turn game ideas into playable browser projects, then improve them through build checks, browser tests, and feedback.**

[中文说明](README.zh-CN.md) · [CLI guide](docs/CLI.md) · [Architecture](docs/ARCHITECTURE.md) · [Publishing](docs/PUBLISH_TO_GITHUB.md) · [MIT license](LICENSE)

![Bundled starter game in Chromium](docs/images/starter-demo.png)

GameGen is a local CLI that coordinates OpenCode agents around a Vite + TypeScript + Canvas game. Text prompts, images, and extracted video frames can guide generation. Projects remain ordinary source files that you can inspect, edit, preview, and export.

**Status:** local MVP, version 0.10.3. The screenshot shows the bundled starter demo; it is not evidence of a paid AI generation run.

## What it does

- Create game projects from natural-language prompts.
- Attach images and videos with roles such as player, background, UI, and pacing.
- Route planning, coding, assets, QA, and visual polish through configurable agent roles.
- Generate fallback SVG assets locally, or request OpenAI image assets explicitly.
- Run build/browser checks and repeat repair or polish within a bounded number of rounds.
- Track jobs, improve a selected project, and export source without credentials or uploaded references.

The starter demo works without OpenCode, credentials, or paid API calls. AI generation requires your own configured provider.

## Try the starter demo

Requirements: **Node.js 22.12+**, npm, and Git. AI generation also needs OpenCode; video references need FFmpeg; source export needs `zip`. macOS and Linux are supported; use WSL2 on Windows.

From this repository's root:

```bash
npm ci
npm run demo
npm run preview
```

Open **http://127.0.0.1:5173**. Click Start; move with arrows/WASD and fire with Space or a mouse click.

The demo copies the included starter, installs its locked dependencies, and creates local SVG assets. It does not generate a new game using AI. Generated jobs live in `generated/job_<timestamp>/project` and are ignored by Git.

For browser QA:

```bash
npx --no-install playwright install chromium
npm run qa
```

On Linux, Playwright may need OS libraries: `npx --no-install playwright install --with-deps chromium`.

## Generate a game with AI

Install [OpenCode](https://opencode.ai/docs/) and configure a provider. This repository does not bundle OpenCode.

```bash
npm install -g opencode-ai
cp .env.example .env
opencode auth login
opencode models --refresh
```

Review `config/model-profiles.json` and replace any model IDs unavailable to your account. The presets are examples, not promises about provider availability or pricing.

```bash
node bin/gamegen.mjs render-config
node bin/gamegen.mjs auth-check
node bin/gamegen.mjs create "Make a neon space shooter with score and a restart button" --type shooter --title "Neon Space"
node bin/gamegen.mjs preview
```

OpenCode manages coding-provider authentication. The image pipeline reads `OPENAI_API_KEY` from the environment or local `.env`. Request paid image generation with `--use-openai-images`; otherwise assets use local SVG fallbacks.

An optional convenience installer is available:

```bash
./install-gamegen.sh
```

It installs local dependencies and Chromium, creates `.env` only when absent, and adds a symlink under `~/.local/bin` when that name is free. It does not install system packages, change your shell profile, or overwrite another `gamegen` command.

## Examples

```bash
# Reference-guided generation
node bin/gamegen.mjs create "A space shooter inspired by these references"   --image-role "player=$HOME/Pictures/player.png"   --video-role "pacing=$HOME/Movies/pacing.mp4"

# Select and improve an existing job
node bin/gamegen.mjs list
node bin/gamegen.mjs improve --job job_1234567890123 "Make the HUD easier to read"

# Source export
node bin/gamegen.mjs export
```

Replace the example job ID with one from `list`. See the [CLI guide](docs/CLI.md) for profiles, job selection, and iteration controls.

## How validation works

Build success, browser checks, runtime errors, asset paths, and feedback evidence are recorded in JSON reports. A failed asset or feedback check cannot pass merely because another numerical score is high. The CLI returns a failing exit status when QA or final acceptance fails.

Visual scoring and feedback acceptance are **heuristics**. They do not establish that a game is enjoyable or that every visual request was satisfied. Generated code and model output still need review.

## Development

```bash
npm ci
npm run check
npm test
npm --prefix templates/base-web-game ci
npm --prefix templates/base-web-game run build
npx --no-install playwright install chromium
npm --prefix templates/base-web-game test
python3 scripts/check_release.py
```

GitHub Actions runs the corresponding checks without model credentials. See [validation notes](docs/VALIDATION.md), [contributing](CONTRIBUTING.md), and [changelog](CHANGELOG.md).

## Scope and next steps

This release uses one starter template and a local synchronous CLI. It has no hosted service, billing, isolated execution sandbox, reliable vision-model judge, or real usage-cost accounting. Game type flags guide prompts; they do not select a library of specialized game templates.

Future work: specialized templates and gameplay checks; better visual evaluation; isolated workers for untrusted generation.

Original project by **Ziyang Ye**. Licensed under [MIT](LICENSE); dependencies and external services retain their own terms, summarized in [NOTICE](NOTICE.md).
