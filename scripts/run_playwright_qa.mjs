import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

function run(cmd, args) {
  const res = spawnSync(cmd, args, {
    stdio: "pipe",
    encoding: "utf8",
    shell: false,
  });
  return {
    command: [cmd, ...args].join(" "),
    status: res.status,
    stdout: res.stdout,
    stderr: res.stderr,
  };
}

async function maybeJson(p) {
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const build = run("npm", ["run", "build"]);
  let test = run("npx", ["playwright", "test", "--project=chromium"]);
  if (
    test.status !== 0 &&
    String(test.stderr).includes('Project(s) "chromium" not found')
  ) {
    test = run("npx", ["playwright", "test"]);
  }
  let screenshotExists = false;
  try {
    await fs.access(
      path.join(process.cwd(), "test-results/screenshots/main.png"),
    );
    screenshotExists = true;
  } catch {}

  const runtime = (await maybeJson("test-results/runtime_errors.json")) || {
    console_errors: [],
    page_errors: [],
    request_failed: [],
    warning_count: 0,
    source:
      "missing runtime_errors.json; update tests/game.spec.ts if runtime details are needed",
  };

  const report = {
    schema_version: "v10.2-qa-report",
    build_passed: build.status === 0,
    playwright_passed: test.status === 0,
    screenshot_exists: screenshotExists,
    runtime_error_count:
      (runtime.console_errors?.length || 0) +
      (runtime.page_errors?.length || 0) +
      (runtime.request_failed?.length || 0),
    runtime,
    build,
    test,
  };
  await fs.writeFile("qa_report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (
    !report.build_passed ||
    !report.playwright_passed ||
    report.runtime_error_count > 0
  )
    process.exit(1);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
