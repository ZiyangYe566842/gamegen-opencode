# Validation

Validated on 2026-10-12 (America/New_York).

Environment: Node.js 24.19.0, npm 11.9.0, Python 3.12, local Chromium 133.0.6943.0.

| Check | Result |
| --- | --- |
| CLI/regression tests | 7 passed |
| JavaScript syntax | Passed |
| Starter TypeScript/Vite build | Passed |
| Starter Playwright browser test | 1 passed; no recorded console/page/request errors |
| Default demo command | Passed; installed dependencies and produced six local fallback assets |
| Feedback gate | Rejects unchanged requests and stale evidence from prior improvements |
| Source export | Handles shell-like path characters literally and excludes environment backups |
| Release source check | Passed before packaging |

The browser test used an explicitly supplied local Chromium executable because the default browser download failed in this environment. The supplied browser is an external test prerequisite, not a repository dependency.

To use a locally installed Chromium with the template:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium npm --prefix templates/base-web-game test
```

CI is configured to install the normal Playwright Chromium build. The CI workflow itself has not been run on GitHub yet.

No OpenCode provider session, paid coding request, or OpenAI image request was run. Model IDs and provider options remain configurable; live behavior must be checked with your own account. The screenshot is the bundled starter, not newly generated AI output.
