---
name: playwright-qa
description: Run and interpret browser smoke tests, screenshots, console errors, and generated QA reports for GameGen projects.
compatibility: opencode
---

# Playwright QA Skill

## Required Checks

A generated game passes QA only if:

- `npm run build` succeeds
- Playwright test succeeds
- `#app` exists
- `canvas#game` or the configured game surface exists
- start/restart control is visible or keyboard start works
- basic keyboard/mouse input does not crash
- screenshot exists at `test-results/screenshots/main.png`
- no blocking browser console errors are reported

## Preferred Commands

Use existing scripts when available:

```bash
node scripts/run_playwright_qa.mjs
node scripts/visual_score.mjs
```

If directly testing:

```bash
npm run build
npx playwright test --project=chromium
```

## Failure Interpretation

Common failures:

- project `chromium` not found: check `playwright.config.ts` projects section
- timeout waiting for `#app`: app failed to load or selector changed
- console error: inspect browser error and source file
- screenshot missing: Playwright test did not reach screenshot step

## Test Editing Rule

Do not weaken tests just to pass. Only update selectors if the app intentionally changed DOM structure and still satisfies QA requirements.

## Report Update

After QA, ensure `qa_report.json` or `report.json` includes:

- build status
- Playwright status
- screenshot path
- known warnings
- next recommended fix if not passed
