---
name: visual-polish
description: Improve game visual quality using generated assets, reference media, screenshots, HUD rules, and a concrete arcade readability rubric.
compatibility: opencode
---

# Visual Polish Skill

## Goal

Make the generated game look like a coherent playable arcade game, not a raw programming demo.

## Rubric

Score visual quality from 1 to 5:

1. broken/blank/unreadable
2. raw demo, mostly rectangles, weak layout
3. playable but simple, basic HUD and effects
4. polished enough for demo, coherent style and readable UI
5. strong presentation, consistent assets, effects, spacing, and feedback

## Improve These Areas

- background depth and contrast
- player/enemy sprite clarity
- HUD readability
- start/game-over screen polish
- button styling
- score/health/progress display
- particle effects and feedback
- animation timing
- spacing and alignment
- style consistency with generated/reference assets

## Asset Usage Rule

If `public/assets/generated/*` contains image assets, use them or document why not. Do not leave the game drawing only primitive rectangles when generated sprites exist.

## Text Rule

All text must be rendered by Canvas/HTML/CSS. Do not rely on generated images for score, health, labels, or buttons.

## Reference Media Rule

Use images/video frames for:

- palette
- mood
- silhouette category
- layout pattern
- camera feel
- effect density

Do not copy exact protected objects, logos, or commercial UI.

## Screenshot-Based Improvement

If `test-results/screenshots/main.png` exists:

1. Use it to infer current visual weaknesses.
2. Improve only the highest-impact areas first.
3. Re-run build and QA.
4. Update `visual_score.json` or `report.json` notes when relevant.

## Avoid

- unreadable neon-on-neon text
- overly busy backgrounds that hide gameplay
- tiny player/enemy sprites
- default browser buttons in the final presentation
- visual effects that obscure controls or collisions
