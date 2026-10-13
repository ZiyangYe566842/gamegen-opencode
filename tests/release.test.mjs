import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gamegen-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function runScript(name, dir) {
  return spawnSync(process.execPath, [path.join(root, "scripts", name)], {
    cwd: dir,
    encoding: "utf8",
  });
}

test("feedback gate rejects an unchanged game even when its numeric score is high", (t) => {
  const dir = fixture(t);
  fs.writeFileSync(
    path.join(dir, "feedback_acceptance.json"),
    JSON.stringify({ feedback: "Change the title" }),
  );
  fs.writeFileSync(
    path.join(dir, "iteration_report.json"),
    JSON.stringify({ rounds: [{ meaningful_changed_files: [] }] }),
  );
  const result = runScript("feedback_acceptance_check.mjs", dir);
  const report = JSON.parse(
    fs.readFileSync(path.join(dir, "feedback_acceptance_report.json")),
  );
  assert.equal(report.passed, false);
  assert.notEqual(result.status, 0);
});

test("feedback gate accepts concrete changes for generic feedback", (t) => {
  const dir = fixture(t);
  fs.writeFileSync(
    path.join(dir, "feedback_acceptance.json"),
    JSON.stringify({ feedback: "Change the title" }),
  );
  fs.writeFileSync(
    path.join(dir, "iteration_report.json"),
    JSON.stringify({ rounds: [{ meaningful_changed_files: ["index.html"] }] }),
  );
  assert.equal(runScript("feedback_acceptance_check.mjs", dir).status, 0);
});

test("old improvement changes cannot satisfy a new unchanged request", (t) => {
  const dir = fixture(t);
  fs.writeFileSync(
    path.join(dir, "feedback_acceptance.json"),
    JSON.stringify({ feedback: "Change the title" }),
  );
  fs.writeFileSync(
    path.join(dir, "iteration_report.json"),
    JSON.stringify({
      rounds: [
        { phase: "improve_initial", meaningful_changed_files: ["index.html"] },
        { phase: "complete" },
        { phase: "improve_initial", meaningful_changed_files: [] },
      ],
    }),
  );
  const result = runScript("feedback_acceptance_check.mjs", dir);
  assert.notEqual(result.status, 0);
  assert.equal(
    JSON.parse(
      fs.readFileSync(path.join(dir, "feedback_acceptance_report.json")),
    ).passed,
    false,
  );
});

test("missing assets produce a failing report and process exit status", (t) => {
  const dir = fixture(t);
  const result = runScript("validate_asset_manifest.mjs", dir);
  const report = JSON.parse(
    fs.readFileSync(path.join(dir, "asset_validation_report.json")),
  );
  assert.equal(report.ok, false);
  assert.equal(report.missing_assets.length, 3);
  assert.notEqual(result.status, 0);
});

test("complete asset paths pass validation", (t) => {
  const dir = fixture(t);
  fs.mkdirSync(path.join(dir, "public/assets/generated"), { recursive: true });
  for (const id of ["background", "player", "enemy"]) {
    fs.writeFileSync(
      path.join(dir, `public/assets/generated/${id}.png`),
      "fixture",
    );
  }
  assert.equal(runScript("validate_asset_manifest.mjs", dir).status, 0);
});

test("job selectors cannot escape the generated directory", () => {
  const result = spawnSync(
    process.execPath,
    [path.join(root, "bin/gamegen.mjs"), "where", "--job", "../../private"],
    { encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid job ID/);
});

test("export handles shell-like filenames literally and omits environment backups", (t) => {
  const dir = fixture(t);
  const project = path.join(dir, 'project " $(touch SHOULD_NOT_EXIST)');
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, "index.html"), "<h1>Demo</h1>");
  fs.writeFileSync(path.join(project, ".env"), "TOKEN=test-fixture");
  fs.writeFileSync(path.join(project, ".env.bak"), "TOKEN=test-fixture");
  const result = spawnSync(
    process.execPath,
    [path.join(root, "bin/gamegen.mjs"), "export", "--project", project],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(dir, "SHOULD_NOT_EXIST")), false);
  const entries = spawnSync("unzip", ["-Z1", path.join(dir, "export.zip")], {
    encoding: "utf8",
  });
  assert.equal(entries.status, 0);
  assert.match(entries.stdout, /index.html/);
  assert.doesNotMatch(entries.stdout, /\.env/);
});
