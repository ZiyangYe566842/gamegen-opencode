---
name: canvas-game-architecture
description: Structure Vite TypeScript Canvas games with clear initialization, game state, update/render loops, input handling, and asset fallbacks.
compatibility: opencode
---

# Canvas Game Architecture Skill

## Purpose

Keep generated Canvas games maintainable and less likely to break TypeScript builds.

## Recommended Structure

Use clear sections or modules for:

- DOM initialization
- asset loading
- type definitions
- game state
- input state
- update loop
- render loop
- collision helpers
- UI/HUD rendering
- reset/start/game-over functions

## Initialization Rule

Do one-time DOM setup near the top:

```ts
const canvas = document.querySelector<HTMLCanvasElement>("#game")
if (!canvas) throw new Error("Missing #game canvas")
const context = canvas.getContext("2d")
if (!context) throw new Error("Missing 2D context")
const ctx: CanvasRenderingContext2D = context
```

Do not repeatedly call `getContext` inside draw functions.

## Game State Rule

Use explicit state values such as:

- `title`
- `playing`
- `paused` optional
- `gameOver`

Avoid mixing title/game-over logic only through booleans scattered across rendering.

## Input Rule

Support at least one keyboard path and one mouse/touch path when feasible. Input should never throw if the game is not yet started.

## Timing Rule

Use `requestAnimationFrame`. Prefer delta time for movement when practical, but simple frame-based movement is acceptable for MVP games if stable.

## Asset Fallback Rule

All image assets must have Canvas fallback rendering. Gameplay should not depend on image load completion.

## Collision Rule

Use simple geometric hitboxes. Do not use exact image pixels for collision in this MVP.
