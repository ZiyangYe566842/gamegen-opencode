---
name: image-reference-analysis
description: Analyze uploaded image references for style, object roles, palette, UI ideas, and safe high-level asset constraints.
compatibility: opencode
---

# Image Reference Analysis Skill

## Goal

Use image references to guide style and asset direction without copying exact protected content.

## Analysis Steps

For each image:

1. Identify probable role: player, enemy, UI, background, style, map sketch, or unknown.
2. Extract high-level visual properties: palette, contrast, silhouette, camera angle, material feel, mood.
3. Extract gameplay-relevant implications: object size, movement style, UI hierarchy, readability.
4. Record do-not-copy constraints.
5. Convert into `game_spec.json` and `asset_manifest.json` constraints.

## Output Guidelines

Prefer structured summaries such as:

```json
{
  "file": "uploads/raw/warship.jpg",
  "role": "player_reference",
  "usable_for": ["player silhouette", "ship color palette", "arcade sprite prompt"],
  "style": ["neon", "metallic", "space combat"],
  "do_not_copy": ["exact logo", "exact markings", "readable text"]
}
```

## Prompting Generated Assets

When using an image as style reference for `gpt-image-2`, describe the desired output as a new game asset. Avoid language like "copy exactly" or "same as this image".

Good:

- "A new arcade player spaceship inspired by the uploaded warship's broad silhouette and neon color mood."

Bad:

- "Recreate this exact warship."

## Rendering Rule

Never rely on generated images for text labels. Render text in Canvas/HTML/CSS.
