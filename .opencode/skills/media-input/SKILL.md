---
name: media-input
description: Convert uploaded images and extracted video frames into structured high-level game references without copying protected content.
compatibility: opencode
---

# Media Input Skill

## Purpose

Treat uploaded media as references, not assets to clone exactly. The goal is to extract high-level gameplay, visual, layout, and pacing constraints.

## Inputs

Possible files:

- `uploads/raw/*` original user images/videos
- `media/frames/**/frame_*.jpg` extracted video frames
- `analysis/visual_reference.json`
- `analysis/video_summary.json`

## Required Behavior

When media exists:

1. Read available `analysis/*.json` first.
2. Use attached images/frames as high-level references.
3. Summarize reference impact in `game_spec.json`.
4. Reflect asset needs in `asset_manifest.json`.
5. Do not copy logos, exact character designs, commercial UI, or readable image text.

## Image Role Categories

Infer roles if the user did not provide them:

- `player_reference`
- `enemy_reference`
- `background_reference`
- `ui_reference`
- `map_or_level_sketch`
- `style_reference`
- `mechanic_reference`

## Video Role Categories

Infer:

- camera angle
- game pacing
- movement style
- enemy wave behavior
- UI layout
- visual density
- effects style
- control implication

## Required Output Fields

If updating media analysis, use compact JSON:

```json
{
  "media_summary": "...",
  "inferred_roles": [],
  "style_constraints": [],
  "gameplay_constraints": [],
  "asset_implications": [],
  "do_not_copy": []
}
```

## Safety and Design Constraints

Allowed:

- palette
- mood
- silhouette category
- camera angle
- pacing
- layout idea
- general mechanics

Not allowed:

- exact logo reproduction
- exact commercial character copying
- exact game clone
- copying readable text from images into generated assets
