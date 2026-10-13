---
name: cost-control
description: Keep GameGen generation bounded by profile, image count, media frame count, iteration budget, and practical API-cost awareness.
compatibility: opencode
---

# Cost Control Skill

## Purpose

Keep generation useful without uncontrolled API usage. This is an MVP-level cost discipline skill, not a billing system.

## Read First

Inspect when available:

- `current_model_profile.json`
- `game_spec.json`
- `asset_manifest.json`
- `asset_generation_report.json`
- `analysis/video_summary.json`

## Budget Signals

Respect:

- `iteration_budget.max_coding_rounds`
- `iteration_budget.max_visual_rounds`
- `iteration_budget.max_image_generations`
- profile name: `cheap`, `balanced`, `deep`, `experimental`
- image generation quality: low/medium/high
- number of attached video frames

## Practical Rules

- Prefer fixing build errors before adding new features.
- Prefer using existing generated assets before requesting more images.
- Do not regenerate assets unless current assets are missing, broken, or strongly inconsistent.
- For long videos, reason from selected frames rather than asking for all frames.
- Keep final changes bounded and report what was done.

## Report Fields

When updating `report.json`, include:

```json
{
  "model_profile": "...",
  "image_model": "...",
  "generated_assets": 0,
  "attached_media": {
    "images": 0,
    "video_frames": 0
  },
  "iterations": {
    "build_fixes": 0,
    "visual_fixes": 0
  }
}
```

## Do Not

- loop indefinitely trying cosmetic improvements
- regenerate images repeatedly without a clear reason
- use deep profile behavior for trivial QA-only fixes unless configured
