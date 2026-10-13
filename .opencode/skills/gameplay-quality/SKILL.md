---
name: gameplay-quality
description: Improve core gameplay feel, feedback, controls, scoring, difficulty, and replayability without requiring per-game templates.
compatibility: opencode
---

# Gameplay Quality Skill

## Purpose

Make the game feel intentionally designed rather than just visually rendered.

## General Gameplay Requirements

A playable arcade game should usually include:

- immediate understandable objective
- start/restart flow
- responsive controls
- visible feedback for success/failure
- score/progress tracking when relevant
- clear fail condition or completion condition
- increasing challenge or pacing variation
- short loop that is fun within 10–30 seconds

## Feedback Rules

Add feedback for important actions:

- projectile fired
- enemy hit
- player damaged
- score gained
- game over
- restart

Feedback can be visual effects, screen shake, particles, color flash, sound placeholder comments, or HUD animation.

## Difficulty Rules

Use simple difficulty scaling:

- spawn rate increases over time
- enemy speed increases with score/time
- waves become denser gradually
- player gets enough health/lives to learn the game

Avoid impossible difficulty at start.

## Readability Rules

Gameplay clarity is more important than decorative visuals:

- player must stand out from background
- enemies/projectiles must be visible
- HUD must not overlap critical gameplay
- effects must not obscure collisions

## Validation

After gameplay changes, run build and Playwright QA. If possible, update `report.json` with what changed in mechanics, difficulty, and feedback.
