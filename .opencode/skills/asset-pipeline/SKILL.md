---
name: asset-pipeline
description: Define and validate game asset manifests, generated image assets, fallbacks, usage constraints, and runtime binding rules.
compatibility: opencode
---

# Asset Pipeline Skill

## Purpose

Maintain `asset_manifest.json` as the source of truth for all generated and uploaded assets. Assets should improve the game visually but must not make gameplay fragile.

## Required Manifest Fields

Each asset entry should include:

- `id`
- `type`
- `role`
- `file`
- `fallback`
- `used_by`
- `prompt`
- `style_constraints`
- `dimensions_hint`
- `hitbox_hint` when relevant
- `must_not_contain`

Recommended asset roles:

- `background`
- `player`
- `enemy`
- `projectile`
- `collectible`
- `effect`
- `ui_panel`
- `button_panel`

## Generated Image Rules

For `gpt-image-2` or any image model:

- do not generate UI text, score numbers, labels, or instructions inside images
- render all text through Canvas/HTML/CSS
- use consistent style across all assets
- use fallback Canvas drawings if an image fails to load
- do not block gameplay waiting for images
- never assume transparent background unless verified

## Runtime Binding Rules

If generated assets exist:

- background image should be used as scene background or layered backdrop
- player image should be used for player sprite or strong silhouette reference
- enemy image should be used for enemy sprites or fallback shape style
- asset paths should be relative to `/assets/generated/...` or `/assets/processed/...`
- code must work even when images fail to load

## Validation Checklist

Before finishing:

- `asset_manifest.json` references files that exist or have fallbacks
- generated assets are actually used by code or explicitly documented as unused
- game remains playable without image assets
- visual style is consistent with `game_spec.json`
- no generated asset contains important readable UI text

## Common Failure Modes

If images are generated but the game still draws only rectangles:

1. Add image loading with fallback.
2. Bind images to player/enemy/background draw functions.
3. Keep collision based on simple hitboxes, not image pixels.
4. Re-run build and Playwright QA.
