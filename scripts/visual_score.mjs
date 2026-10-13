import fs from "node:fs/promises";
import path from "node:path";

const screenshot = process.argv[2] || "test-results/screenshots/main.png";

async function readPngDimensions(buf) {
  if (buf.length >= 24 && buf.toString("ascii", 1, 4) === "PNG") {
    return {
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
      format: "png",
    };
  }
  return null;
}

async function readJpegDimensions(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3].includes(marker)) {
      return {
        height: buf.readUInt16BE(i + 5),
        width: buf.readUInt16BE(i + 7),
        format: "jpeg",
      };
    }
    i += 2 + len;
  }
  return null;
}

async function maybeJson(p) {
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const notes = [];
  const checks = {};
  let score = 1;
  let metadata = null;
  let st = null;

  try {
    const buf = await fs.readFile(screenshot);
    st = await fs.stat(screenshot);
    metadata = (await readPngDimensions(buf)) ||
      (await readJpegDimensions(buf)) || { format: "unknown" };
    checks.screenshot_exists = true;
    checks.file_size_bytes = st.size;
    checks.dimensions = metadata;

    if ((metadata.width || 0) >= 900 && (metadata.height || 0) >= 500)
      score += 1;
    else
      notes.push(
        "Screenshot dimensions are below the expected game preview size.",
      );

    if (st.size > 80_000) score += 1;
    else
      notes.push(
        "Screenshot file size is small; scene may be visually sparse.",
      );

    if (st.size > 180_000) score += 1;
    if (st.size > 320_000) score += 1;
  } catch (err) {
    checks.screenshot_exists = false;
    notes.push(`Could not read screenshot: ${err}`);
  }

  const qa = await maybeJson("qa_report.json");
  if (qa) {
    checks.build_passed = Boolean(qa.build_passed);
    checks.playwright_passed = Boolean(qa.playwright_passed);
    if (!qa.build_passed) notes.push("Build did not pass in qa_report.json.");
    if (!qa.playwright_passed)
      notes.push("Playwright did not pass in qa_report.json.");
  }

  const assets =
    (await maybeJson("asset_validation_report.json")) ||
    (await maybeJson("asset_generation_report.json"));
  if (assets?.ready_assets || assets?.outputs?.length)
    checks.assets_present = true;
  else {
    checks.assets_present = false;
    notes.push("No asset report found or no generated assets were detected.");
  }

  if (
    qa?.build_passed &&
    qa?.playwright_passed &&
    checks.screenshot_exists &&
    checks.assets_present
  ) {
    score = Math.max(score, 4);
  }
  score = Math.min(5, Math.max(1, score));

  const report = {
    screenshot,
    visual_score: score,
    passed: score >= 4,
    notes,
    checks,
    method:
      "v10 heuristic visual gate: screenshot existence + dimensions + file size + QA + asset report. Replace with vision-model rubric for production.",
  };
  await fs.writeFile("visual_score.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
