---
name: game-spec
description: Convert a user request and optional media references into strict game_spec.json acceptance criteria for a playable browser game.
compatibility: opencode
---

# Game Spec Skill

## Purpose

Create or update `game_spec.json` so the rest of the workflow has a concrete contract. The spec is not a prose summary. It is the authoritative product requirement for the generated game.

## Required JSON Shape

`game_spec.json` must include:

- `game_type`
- `title`
- `target_platform`
- `engine`
- `art_style`
- `input_media_summary`
- `controls`
- `core_mechanics`
- `entities`
- `scoring`
- `health_or_lives`
- `win_condition`
- `lose_condition`
- `screens`
- `assets_required`
- `qa_acceptance_criteria`
- `visual_acceptance_criteria`
- `iteration_budget`
- `known_risks`

## Defaults

Use these defaults unless the user says otherwise:

- `target_platform`: `browser`
- `engine`: `vite-typescript-canvas`
- `input`: keyboard + mouse/touch when practical
- `screens`: title, playing, game-over/restart
- `visual_style`: clear arcade readability over decorative complexity

## Media-Aware Spec Rules

If `analysis/visual_reference.json` exists, summarize how images affect:

- art style
- palette
- player/enemy/background references
- UI/HUD expectations
- do-not-copy constraints

If `analysis/video_summary.json` exists, summarize how video frames affect:

- camera angle
- pacing
- movement style
- UI layout
- gameplay loop
- enemy/wave behavior

Do not copy exact logos, commercial characters, or unique protected artwork. Convert reference media into high-level mechanics and visual constraints.

## Minimum Playability Rules

Every spec must require:

- a visible start or restart control
- a clear score/progress display if the game has scoring
- a fail or end condition where relevant
- responsive input that does not crash
- readable HUD text rendered by Canvas/HTML/CSS, not inside generated images
- gameplay that begins without requiring the user to inspect source code

## Acceptance Criteria

`qa_acceptance_criteria` must include:

- `npm run build` succeeds
- Playwright smoke test succeeds
- screenshot exists at `test-results/screenshots/main.png`
- no blocking browser console errors
- start/restart works
- primary input works

`visual_acceptance_criteria` must include:

- not plain rectangles only when generated assets exist
- clear foreground/background contrast
- readable HUD
- recognizable player/enemy/item objects
- consistent style with generated/reference media

## Output Discipline

Prefer a compact JSON spec. Do not include long essays inside `game_spec.json`. Put implementation details in source code, not in the spec.
