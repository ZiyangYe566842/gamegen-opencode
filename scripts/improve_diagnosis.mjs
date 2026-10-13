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
async function exists(p) {
  try {
    await fs.access(path.join(cwd, p));
    return true;
  } catch {
    return false;
  }
}
function linesAround(text, regex, radius = 6) {
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      const start = Math.max(0, i - radius);
      const end = Math.min(lines.length, i + radius + 1);
      out.push({
        line: i + 1,
        excerpt: lines
          .slice(start, end)
          .map((l, j) => `${start + j + 1}: ${l}`)
          .join("\n"),
      });
    }
  }
  return out.slice(0, 8);
}
function feedbackType(feedback) {
  const lower = String(feedback || "").toLowerCase();
  return {
    projectile: /(missile|projectile|bullet|rocket|warhead)/.test(lower),
    polish: /(polish|polished|visual|ui|beautiful|better|style)/.test(lower),
    asset: /(asset|sprite|image|icon|shape|silhouette)/.test(lower),
  };
}

async function main() {
  const acceptance = (await maybeJson("feedback_acceptance.json")) || {
    feedback: process.argv.slice(2).join(" "),
  };
  const feedback = acceptance.feedback || process.argv.slice(2).join(" ");
  const type = feedbackType(feedback);
  const src = await maybeRead("src/main.ts");
  const css = await maybeRead("src/style.css");
  const projectileSvgExists = await exists(
    "public/assets/generated/projectile.svg",
  );
  const projectileSvg = projectileSvgExists
    ? await maybeRead("public/assets/generated/projectile.svg")
    : "";
  const manifest = await maybeJson("asset_manifest.json");

  const projectileRefs = linesAround(
    src,
    /projectile|missile|bullet|rocket|warhead|fillRect|roundRect/i,
  );
  const styleRefs = linesAround(
    css,
    /hud|panel|button|background|shadow|glow|gradient|canvas/i,
  );
  const likelyFiles = [];

  if (type.projectile) {
    likelyFiles.push("src/main.ts");
    if (projectileSvgExists)
      likelyFiles.push("public/assets/generated/projectile.svg");
    likelyFiles.push("asset_manifest.json");
  }
  if (type.polish) {
    likelyFiles.push(
      "src/style.css",
      "index.html",
      "src/main.ts",
      "asset_manifest.json",
    );
  }

  const shapeSignals = {
    source_has_rect_drawing: /fillRect|roundRect|<rect/i.test(
      src + "\n" + projectileSvg,
    ),
    source_has_path_drawing:
      /beginPath|moveTo|lineTo|quadraticCurveTo|bezierCurveTo|Path2D|<path|<polygon|<polyline/i.test(
        src + "\n" + projectileSvg,
      ),
    source_mentions_warhead_shape:
      /warhead|pointed|taper|nose|fin|rocket|missile/i.test(
        src + "\n" + projectileSvg,
      ),
  };

  const report = {
    schema_version: "v10.2-improve-diagnosis",
    feedback,
    detected_feedback_type: type,
    likely_target_files: [...new Set(likelyFiles)],
    evidence: {
      projectile_svg_exists: projectileSvgExists,
      projectile_svg_shape_hint: projectileSvg
        ? projectileSvg.slice(0, 600)
        : null,
      projectile_source_refs: projectileRefs,
      style_source_refs: styleRefs,
      asset_manifest_projectile:
        manifest?.assets?.find?.(
          (a) => a.id === "projectile" || a.role === "projectile",
        ) || null,
      shape_signals: shapeSignals,
    },
    recommended_action: type.projectile
      ? "Update projectile rendering or projectile.svg so the projectile has a pointed/tapered warhead silhouette, not a rectangle. Then update asset_manifest.json/report.json and run build."
      : "Make concrete source, style, asset, or manifest changes tied to the feedback. Then run build and QA.",
    generated_at: new Date().toISOString(),
  };
  await fs.writeFile(
    path.join(cwd, "improve_diagnosis.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
