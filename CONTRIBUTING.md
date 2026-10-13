# Contributing

Use Node.js 22.12+ and install with `npm ci`. Keep changes focused and describe the behavior they change.

Run `npm run check` and `npm test`. For template changes, also install the template dependencies, build it, install Playwright Chromium, and run its browser test. See README for exact commands.

Run `python3 scripts/check_release.py` before pushing. Do not commit actual environment files, generated games, user references, or dependency folders. Paid provider tests are manual and should be clearly identified; CI must not require API keys.

Open a PR with the problem, resulting behavior, and relevant validation. New model presets should use configurable IDs and avoid unsupported claims about availability or price.
