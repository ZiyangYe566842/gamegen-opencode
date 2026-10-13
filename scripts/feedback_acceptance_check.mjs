import fs from "node:fs/promises";
import path from "node:path";

const cwd = process.cwd();
async function maybeRead(p) {
  try {
    return await fs.readFile(path.join(cwd, p), "utf8");
  } catch {
    return "";
  }
}
async function maybeJson(p) {
  try {
    return JSON.parse(await fs.readFile(path.join(cwd, p), "utf8"));
  } catch {
    return null;
  }
}
function recentMeaningfulChanges(iteration) {
  const rounds = iteration?.rounds || [];
  const start = rounds.findLastIndex((r) => r.phase === "improve_initial");
  const all = [];
  for (const r of start >= 0 ? rounds.slice(start) : rounds.slice(-6)) {
    for (const f of r.meaningful_changed_files || []) all.push(f);
  }
  return [...new Set(all)];
}
function feedbackType(feedback) {
  const lower = String(feedback || "").toLowerCase();
  return {
    projectile: /(missile|projectile|bullet|rocket|warhead)/.test(lower),
    polish: /(polish|polished|visual|ui|beautiful|better|style)/.test(lower),
  };
}
function sourceEvidence(text) {
  return {
    has_rect: /fillRect|roundRect|<rect/i.test(text),
    has_path:
      /beginPath|moveTo|lineTo|quadraticCurveTo|bezierCurveTo|Path2D|<path|<polygon|<polyline/i.test(
        text,
      ),
    has_warhead_words: /warhead|pointed|taper|nose|fin|rocket|missile/i.test(
      text,
    ),
    has_projectile_words: /projectile|missile|bullet|rocket|warhead/i.test(
      text,
    ),
  };
}

async function main() {
  const acceptance = await maybeJson("feedback_acceptance.json");
  const iteration = await maybeJson("iteration_report.json");
  const diagnosis = await maybeJson("improve_diagnosis.json");
  const feedback = acceptance?.feedback || process.argv.slice(2).join(" ");
  const type = feedbackType(feedback);
  const src = await maybeRead("src/main.ts");
  const projectileSvg = await maybeRead(
    "public/assets/generated/projectile.svg",
  );
  const manifest = await maybeJson("asset_manifest.json");
  const recentChanges = recentMeaningfulChanges(iteration);
  const evidence = sourceEvidence(`${src}\n${projectileSvg}`);
  const issues = [];
  const fixes = [];
  let score = 3;

  if (!feedback) {
    issues.push(
      "No feedback_acceptance.json feedback found; acceptance check is informational only.",
    );
  }

  if (!recentChanges.length) {
    issues.push(
      "No recent meaningful source/asset/style/manifest changes were recorded.",
    );
    fixes.push(
      "Make a concrete source, asset, style, or manifest change tied to the feedback.",
    );
    score -= 1;
  }

  if (type.projectile) {
    const changedProjectileRelevant = recentChanges.some((f) =>
      /src\/main\.ts|projectile|asset_manifest\.json|public\/assets/i.test(f),
    );
    if (!changedProjectileRelevant) {
      issues.push(
        "Projectile-related feedback was detected, but recent meaningful changes do not clearly touch projectile rendering, projectile assets, or asset_manifest.json.",
      );
      fixes.push(
        "Modify src/main.ts projectile drawing, public/assets/generated/projectile.svg, or asset_manifest.json.",
      );
      score -= 1;
    }
    if (!evidence.has_path || !evidence.has_warhead_words) {
      issues.push(
        "Could not find strong evidence of a pointed/tapered warhead-like projectile shape in source or projectile.svg.",
      );
      fixes.push(
        "Use Canvas path drawing with moveTo/lineTo, or SVG path/polygon, plus clear nose/fin/tapered body semantics.",
      );
      score -= 1;
    }
    if (evidence.has_rect && !evidence.has_path) {
      issues.push("Projectile rendering still appears rectangle-oriented.");
      fixes.push(
        "Replace fillRect/roundRect-only projectile rendering with a path/polygon silhouette.",
      );
      score -= 1;
    }
  }

  if (
    type.polish &&
    !recentChanges.some((f) =>
      /src\/style\.css|index\.html|src\/main\.ts|asset_manifest\.json|public\/assets/i.test(
        f,
      ),
    )
  ) {
    issues.push(
      "Visual polish feedback was detected, but no style/rendering/asset files changed recently.",
    );
    fixes.push(
      "Improve HUD spacing, background contrast, sprite silhouette, effects, or screen transitions.",
    );
    score -= 1;
  }

  const assetProjectile =
    manifest?.assets?.find?.(
      (a) => a.id === "projectile" || a.role === "projectile",
    ) || null;
  if (
    type.projectile &&
    assetProjectile &&
    !/point|taper|nose|fin|warhead|missile|rocket/i.test(
      JSON.stringify(assetProjectile),
    )
  ) {
    issues.push(
      "asset_manifest.json projectile entry does not describe the shape requirement.",
    );
    fixes.push(
      "Add shape_requirement or constraints for a pointed/tapered warhead-like projectile.",
    );
    score -= 0.5;
  }

  if (issues.length === 0) score = Math.max(score, 4);
  score = Math.max(1, Math.min(5, Math.round(score)));
  const passed = issues.length === 0;
  const report = {
    schema_version: "v10.2-feedback-acceptance-report",
    feedback,
    passed,
    acceptance_score: score,
    issues,
    required_fixes: fixes,
    recent_meaningful_changed_files: recentChanges,
    evidence,
    diagnosis_summary: diagnosis?.recommended_action || null,
    method:
      "v10.2 heuristic acceptance gate: feedback-specific file change + source/asset evidence checks. Use vision-model rubric for final visual judgment.",
    generated_at: new Date().toISOString(),
  };
  await fs.writeFile(
    path.join(cwd, "feedback_acceptance_report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (!passed) process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
