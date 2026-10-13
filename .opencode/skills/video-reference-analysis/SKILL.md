---
name: video-reference-analysis
description: Analyze extracted video frames for pacing, camera, mechanics, UI layout, and visual rhythm for generated games.
compatibility: opencode
---

# Video Reference Analysis Skill

## Goal

Use video frames to infer high-level gameplay and visual dynamics. Do not clone the source game or exact assets.

## What to Extract

From video frames infer:

- camera perspective: top-down, side-view, fixed arena, scrolling, isometric-like
- pacing: slow, medium, fast, bullet-heavy, strategic, puzzle-like
- control implication: keyboard movement, drag/drop, click-to-place, swipe/tap
- UI layout: top HUD, side panel, wave button, health bar, score area
- entity behavior: enemies, projectiles, towers, collectibles, obstacles
- effects style: explosions, trails, flashes, screen shake, particles
- density: sparse, moderate, busy

## Required Summary

If `analysis/video_summary.json` is missing or too shallow, create/update it:

```json
{
  "camera": "...",
  "pacing": "...",
  "core_mechanics": [],
  "ui_patterns": [],
  "visual_style": [],
  "asset_implications": [],
  "do_not_copy": []
}
```

## Implementation Guidance

Use video analysis to adjust:

- spawn timing
- movement speed
- effect density
- HUD placement
- level/background motion
- enemy wave behavior

Do not use video frames as direct sprites unless the user explicitly owns them and has asked for direct use.

## Frame Volume Rule

If many frames exist, inspect a small representative subset first: beginning, middle, and later frames. Avoid overloading context with all frames.
