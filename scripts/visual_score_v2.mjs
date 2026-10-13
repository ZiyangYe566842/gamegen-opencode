import fs from "node:fs/promises";
import path from "node:path";

const cwd = process.cwd();
async function maybeJson(p) {
  try {
    return JSON.parse(await fs.readFile(path.join(cwd, p), "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const visual = (await maybeJson("visual_score.json")) || {
    visual_score: 1,
    notes: ["missing visual_score.json"],
  };
  const qa = (await maybeJson("qa_report.json")) || {};
  const acceptance = await maybeJson("feedback_acceptance_report.json");
  const assets = (await maybeJson("asset_validation_report.json")) || {};
  const notes = [...(visual.notes || [])];
  let score = Number(visual.visual_score || 1);

  if (!qa.build_passed) {
    score -= 2;
    notes.push("Build did not pass.");
  }
  if (!qa.playwright_passed) {
    score -= 2;
    notes.push("Playwright did not pass.");
  }
  if ((qa.runtime_error_count || 0) > 0) {
    score -= 1;
    notes.push(`Runtime errors detected: ${qa.runtime_error_count}`);
  }
  if (assets.ok === false || (assets.missing_assets || []).length) {
    score -= 1;
    notes.push("Asset validation found missing assets.");
  }
  if (acceptance && !acceptance.passed) {
    score -= 2;
    notes.push("Feedback acceptance check did not pass.");
  }
  if (acceptance?.passed) {
    score = Math.max(score, 4);
  }

  score = Math.max(1, Math.min(5, Math.round(score)));
  const report = {
    schema_version: "v10.2-visual-score-v2",
    visual_score: score,
    passed: score >= 4,
    notes,
    checks: {
      base_visual_score: visual.visual_score,
      build_passed: Boolean(qa.build_passed),
      playwright_passed: Boolean(qa.playwright_passed),
      runtime_error_count: qa.runtime_error_count || 0,
      assets_ok: assets.ok !== false,
      feedback_acceptance_passed: acceptance
        ? Boolean(acceptance.passed)
        : null,
      feedback_acceptance_score: acceptance?.acceptance_score ?? null,
    },
    method:
      "v10.2 composite visual gate: base screenshot heuristic + QA/runtime + asset validation + feedback acceptance. Replace with vision-model rubric for production-grade visual judgment.",
    generated_at: new Date().toISOString(),
  };
  await fs.writeFile(
    path.join(cwd, "visual_score_v2.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
