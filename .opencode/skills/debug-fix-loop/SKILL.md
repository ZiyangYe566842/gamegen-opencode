---
name: debug-fix-loop
description: Diagnose build, TypeScript, Vite, asset, and Playwright failures and apply minimal safe fixes until validation passes.
compatibility: opencode
---

# Debug Fix Loop Skill

## Goal

When build or tests fail, fix the smallest cause and re-run validation. Do not hide errors by deleting tests or disabling strict checks.

## Build Failure Procedure

1. Run or inspect `npm run build` output.
2. Identify the first root cause, not every downstream error.
3. Classify the error:
   - TypeScript nullability
   - missing import/export
   - wrong asset path
   - Vite/module resolution
   - DOM/canvas initialization
   - strict type mismatch
   - Playwright selector or timing issue
4. Patch the smallest relevant code area.
5. Re-run build.
6. If build passes, run Playwright QA.

## TypeScript Canvas Rules

For Canvas games:

- query the canvas once near initialization
- throw a clear error if the canvas is missing
- call `getContext("2d")` once
- throw if the context is missing
- after that, use a non-null typed context variable

Example pattern:

```ts
const canvas = document.querySelector<HTMLCanvasElement>("#game")
if (!canvas) throw new Error("Missing #game canvas")
const context = canvas.getContext("2d")
if (!context) throw new Error("Could not create 2D context")
const ctx: CanvasRenderingContext2D = context
```

## Asset Failure Rules

If an asset fails to load:

- keep gameplay running
- draw a Canvas fallback
- log only non-blocking diagnostics
- keep collision independent from image pixel data

## Playwright Failure Rules

If Playwright fails:

- read the test failure and screenshot path if available
- fix app behavior before editing tests
- only edit tests if selectors changed intentionally and app behavior is correct

## Do Not

- turn off TypeScript strict mode to pass build
- remove Playwright tests to pass QA
- ignore `npm run build` failures
- rewrite unrelated files when a small patch is enough
- use destructive shell commands
