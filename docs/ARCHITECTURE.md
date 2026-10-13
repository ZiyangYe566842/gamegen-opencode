# Architecture

## Generation flow

1. The CLI renders a provider/agent configuration and creates an isolated project directory under `generated`.
2. It seeds a game spec and asset manifest, copies optional references, and extracts video frames with FFmpeg.
3. The asset script writes SVG fallbacks or explicitly requested provider images.
4. `opencode run` receives the prompt, selected agent, project directory, and attachments.
5. The outer loop runs build/browser checks, asset validation, visual heuristics, and feedback checks. It asks the configured agent to repair or polish when necessary.

Projects are separate directories, but this is not an operating-system security boundary.

## Agent roles

| Role | Responsibility |
| --- | --- |
| game-orchestrator | Coordinate generation/improvement |
| game-planner | Write the structured game specification |
| game-coder | Implement gameplay and fix code |
| asset-agent | Maintain assets and their manifest |
| qa-agent | Inspect build/browser results |
| visual-polisher | Improve visual presentation |

Roles are available to OpenCode; every operation does not necessarily invoke every role.

## Source map

| Path | Responsibility |
| --- | --- |
| `bin/gamegen.mjs` | CLI, jobs, media input, generation, repair loop, export |
| `config/model-profiles.json` | Model and image-generation presets |
| `.opencode/agents` | Agent definitions |
| `.opencode/skills` | Project-specific workflow instructions |
| `scripts` | Config rendering, assets, QA, validation, and release checks |
| `templates/base-web-game` | Starter game, TypeScript/Vite build, Playwright test |
| `tests` | CLI and acceptance regression tests |

## Limits

Feedback acceptance relies on file-change evidence and source heuristics. Asset validation checks file existence and manifest metadata; it does not prove that rendered assets match the request. Visual scoring is heuristic. The tool does not collect exact token usage or enforce a monetary budget.

OpenCode is an external dependency. See its [CLI documentation](https://opencode.ai/docs/cli/) for authentication and model listing.
