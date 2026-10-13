#!/usr/bin/env node
import fs from "fs-extra";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");
let parsedEnv = {};
try {
  parsedEnv = dotenv.parse(await fs.readFile(envPath));
} catch {}
for (const [k, v] of Object.entries(parsedEnv))
  if (!(k in process.env)) process.env[k] = v;
process.env.GAMEGEN_ROOT = root;

const generatedRoot = path.join(root, "generated");
const latestLink = path.join(generatedRoot, "latest");

function expandHome(p) {
  if (!p) return p;
  if (p === "~") return process.env.HOME;
  if (p.startsWith("~/")) return path.join(process.env.HOME, p.slice(2));
  return p;
}

function run(cmd, args, opts = {}) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  const res = spawnSync(cmd, args, { stdio: "inherit", shell: false, ...opts });
  if (res.status !== 0 && opts.check !== false) process.exit(res.status ?? 1);
  return res;
}

function capture(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    stdio: "pipe",
    encoding: "utf8",
    shell: false,
    ...opts,
  });
}

function tailText(s, n = 80) {
  return String(s || "")
    .split("\n")
    .slice(-n)
    .join("\n");
}

async function profileName() {
  try {
    const all = await fs.readJson(
      path.join(root, "config/model-profiles.json"),
    );
    return (
      process.env.GAMEGEN_PROFILE_OVERRIDE ||
      parsedEnv.GAMEGEN_MODEL_PROFILE ||
      process.env.GAMEGEN_MODEL_PROFILE ||
      all.active ||
      "balanced"
    );
  } catch {
    return (
      parsedEnv.GAMEGEN_MODEL_PROFILE ||
      process.env.GAMEGEN_MODEL_PROFILE ||
      "balanced"
    );
  }
}

async function renderConfig(profileOverride) {
  if (profileOverride) process.env.GAMEGEN_PROFILE_OVERRIDE = profileOverride;
  const env = { ...process.env };
  if (profileOverride) env.GAMEGEN_PROFILE_OVERRIDE = profileOverride;
  run("node", ["scripts/render_opencode_config.mjs"], { cwd: root, env });
}

async function createJobDir() {
  await fs.ensureDir(generatedRoot);
  const jobId = `job_${Date.now()}`;
  const jobDir = path.join(generatedRoot, jobId);
  const projectDir = path.join(jobDir, "project");

  await fs.copy(path.join(root, "templates/base-web-game"), projectDir);
  await fs.copy(path.join(root, "LICENSE"), path.join(projectDir, "LICENSE"));
  await fs.copy(
    path.join(root, "opencode.jsonc"),
    path.join(projectDir, "opencode.jsonc"),
  );
  await fs.copy(
    path.join(root, ".opencode"),
    path.join(projectDir, ".opencode"),
  );
  await fs.copy(path.join(root, "config"), path.join(projectDir, "config"));
  await fs.ensureDir(path.join(projectDir, "scripts"));
  for (const s of [
    "generate_assets.mjs",
    "run_playwright_qa.mjs",
    "visual_score.mjs",
    "visual_score_v2.mjs",
    "validate_asset_manifest.mjs",
    "improve_diagnosis.mjs",
    "feedback_acceptance_check.mjs",
  ]) {
    await fs.copy(
      path.join(root, "scripts", s),
      path.join(projectDir, "scripts", s),
    );
  }

  await fs.remove(latestLink);
  await fs.ensureSymlink(jobDir, latestLink, "dir");
  await writeJobMeta(jobDir, {
    job_id: jobId,
    project_dir: projectDir,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "created",
  });
  return { jobId, jobDir, projectDir };
}

async function writeJobMeta(jobDir, patch) {
  const p = path.join(jobDir, "gamegen_report.json");
  let old = {};
  try {
    old = await fs.readJson(p);
  } catch {}
  const next = { ...old, ...patch, updated_at: new Date().toISOString() };
  await fs.writeJson(p, next, { spaces: 2 });
  return next;
}

async function listJobs() {
  await fs.ensureDir(generatedRoot);
  const entries = (await fs.readdir(generatedRoot)).filter((x) =>
    x.startsWith("job_"),
  );
  const rows = [];
  for (const id of entries) {
    const jobDir = path.join(generatedRoot, id);
    const st = await fs.stat(jobDir).catch(() => null);
    let report = {};
    try {
      report = await fs.readJson(path.join(jobDir, "gamegen_report.json"));
    } catch {}
    let spec = {};
    try {
      spec = await fs.readJson(path.join(jobDir, "project/game_spec.json"));
    } catch {}
    let final = {};
    try {
      final = await fs.readJson(path.join(jobDir, "project/report.json"));
    } catch {}
    rows.push({
      id,
      mtime: st?.mtimeMs || 0,
      title: spec.title || final.title || report.title || "-",
      type: spec.game_type || "-",
      status: report.status || final.status || "-",
      project: path.join(jobDir, "project"),
    });
  }
  rows.sort((a, b) => b.mtime - a.mtime);
  if (!rows.length) {
    console.log("No jobs found.");
    return;
  }
  console.log("Job ID                 Status        Type              Title");
  console.log(
    "----------------------------------------------------------------",
  );
  for (const r of rows)
    console.log(
      `${r.id.padEnd(22)} ${String(r.status).padEnd(13)} ${String(r.type).padEnd(17)} ${r.title}`,
    );
  console.log(
    "\nUse `gamegen use <job_id>` or pass `--job <job_id>` to qa/preview/export/improve.",
  );
}

async function resolveJobDir(opts = {}) {
  if (opts.project) return path.dirname(path.resolve(expandHome(opts.project)));
  if (opts.job) return jobDirectory(opts.job);
  const jobDir = await fs.realpath(latestLink).catch(() => {
    throw new Error(
      "No current game. Run `gamegen demo` or `gamegen create` first.",
    );
  });
  return jobDir;
}

function jobDirectory(jobId) {
  if (!/^job_\d+$/.test(jobId))
    throw new Error("Invalid job ID. Use an ID shown by `gamegen list`.");
  return path.join(generatedRoot, jobId);
}

async function resolveProjectDir(opts = {}) {
  if (opts.project) return path.resolve(expandHome(opts.project));
  const jobDir = await resolveJobDir(opts);
  return path.join(jobDir, "project");
}

async function useJob(jobId) {
  const jobDir = jobDirectory(jobId);
  if (!(await fs.pathExists(path.join(jobDir, "project"))))
    throw new Error(`Job not found or missing project: ${jobId}`);
  await fs.remove(latestLink);
  await fs.ensureSymlink(jobDir, latestLink, "dir");
  console.log(`Now using ${jobId}`);
  console.log(path.join(jobDir, "project"));
}

async function writeInitialSpec(projectDir, prompt, opts) {
  const spec = {
    schema_version: "v10-game-spec",
    prompt,
    game_type: opts.type || "arcade",
    title: opts.title || "Generated Game",
    target_platform: "browser",
    engine: "vite-typescript-canvas",
    art_style: opts.style || "neon arcade, clean cartoon, high readability",
    controls: ["keyboard", "mouse", "touch"],
    core_mechanics: [],
    assets_required: [
      "background",
      "player",
      "enemy",
      "ui_panel",
      "projectile",
      "effect",
    ],
    qa_acceptance_criteria: [
      "npm run build passes",
      "Playwright test passes",
      "main screenshot exists",
      "no browser console errors",
    ],
    visual_acceptance_criteria: [
      "not plain rectangles only",
      "styled HUD",
      "styled background",
      "readable UI",
      "generated assets are used when available",
    ],
    iteration_budget: {
      max_coding_rounds: Number(opts.maxRounds || opts.rounds || 3),
      max_visual_rounds: Number(opts.visualRounds || 2),
      min_visual_score: Number(opts.minVisualScore || 4),
      max_image_generations: Number(opts.maxImages || 12),
      max_video_frames: Number(opts.maxVideoFrames || 8),
    },
  };
  await fs.writeJson(path.join(projectDir, "game_spec.json"), spec, {
    spaces: 2,
  });
  await seedAssetManifest(projectDir, opts);
}

async function seedAssetManifest(projectDir, opts = {}) {
  const assets = [
    {
      id: "background",
      role: "background",
      type: "background",
      output: "public/assets/generated/background.png",
      fallback_output: "public/assets/generated/background.svg",
      size: "1536x1024",
      hitbox: null,
      anchor: [0.5, 0.5],
      used_by: ["SceneBackground"],
      fallback: "canvas_gradient",
      prompt: `A polished 2D ${opts.style || "neon arcade"} background for ${opts.title || "a browser game"}, no text, no logo, no UI.`,
    },
    {
      id: "player",
      role: "player",
      type: "sprite",
      output: "public/assets/generated/player.png",
      fallback_output: "public/assets/generated/player.svg",
      size: "1024x1024",
      hitbox: [72, 92],
      anchor: [0.5, 0.5],
      used_by: ["Player.draw"],
      fallback: "canvas_ship",
      prompt: `A centered 2D ${opts.style || "neon arcade"} player sprite, clean silhouette, no text, pure magenta background #ff00ff if background is needed.`,
    },
    {
      id: "enemy",
      role: "enemy",
      type: "sprite",
      output: "public/assets/generated/enemy.png",
      fallback_output: "public/assets/generated/enemy.svg",
      size: "1024x1024",
      hitbox: [70, 80],
      anchor: [0.5, 0.5],
      used_by: ["Enemy.draw"],
      fallback: "canvas_enemy",
      prompt: `A centered 2D ${opts.style || "neon arcade"} enemy sprite, clean silhouette, no text, pure magenta background #ff00ff if background is needed.`,
    },
    {
      id: "projectile",
      role: "projectile",
      type: "effect",
      output: "public/assets/generated/projectile.png",
      hitbox: [8, 18],
      anchor: [0.5, 0.5],
      used_by: ["Bullet.draw"],
      fallback: "canvas_bullet",
    },
    {
      id: "effect",
      role: "effect",
      type: "effect",
      output: "public/assets/generated/effect.png",
      hitbox: null,
      anchor: [0.5, 0.5],
      used_by: ["Explosion.draw"],
      fallback: "canvas_particles",
    },
    {
      id: "ui_panel",
      role: "ui",
      type: "ui",
      output: "public/assets/generated/ui_panel.png",
      hitbox: null,
      anchor: [0.5, 0.5],
      used_by: ["HUD.draw"],
      fallback: "css_panel",
    },
  ];
  await fs.writeJson(
    path.join(projectDir, "asset_manifest.json"),
    {
      schema_version: "v10-asset-manifest",
      game: opts.title || "generated-game",
      style:
        opts.style ||
        "neon arcade, clean cartoon, high readability, no text inside images",
      asset_contract: {
        text_rendering:
          "All UI text must be rendered by Canvas/HTML/CSS, not inside generated images.",
        generated_assets_are_optional:
          "If image loading fails, gameplay must continue with canvas fallbacks.",
        required_fields: [
          "id",
          "role",
          "type",
          "output",
          "used_by",
          "fallback",
          "hitbox",
          "anchor",
        ],
      },
      assets,
    },
    { spaces: 2 },
  );
}

async function ensureInstall(projectDir) {
  const installCommand = (await fs.pathExists(
    path.join(projectDir, "package-lock.json"),
  ))
    ? "ci"
    : "install";
  run("npm", [installCommand, "--no-audit", "--no-fund"], { cwd: projectDir });
}

async function generateAssets(projectDir, useOpenAI = false) {
  const args = ["scripts/generate_assets.mjs", "--quality", "low"];
  if (useOpenAI) args.push("--use-openai");
  run("node", args, {
    cwd: projectDir,
    env: { ...process.env, GAMEGEN_ROOT: root },
  });
  run("node", ["scripts/validate_asset_manifest.mjs"], {
    cwd: projectDir,
    check: false,
  });
}

function parseRolePath(items = [], defaultRole) {
  const out = [];
  for (const raw of items || []) {
    const idx = raw.indexOf("=");
    if (idx > 0)
      out.push({
        role: raw.slice(0, idx).trim(),
        path: raw.slice(idx + 1).trim(),
      });
    else out.push({ role: defaultRole, path: raw });
  }
  return out;
}

function mediaId(file) {
  return path.basename(file).replace(/[^a-zA-Z0-9_.-]/g, "_");
}

async function saveMediaManifest(projectDir, patch) {
  const p = path.join(projectDir, "analysis/media_manifest.json");
  let old = {
    schema_version: "v10-media-manifest",
    images: [],
    videos: [],
    attached_files: [],
  };
  try {
    old = await fs.readJson(p);
  } catch {}
  const next = {
    ...old,
    images: [...(old.images || []), ...(patch.images || [])],
    videos: [...(old.videos || []), ...(patch.videos || [])],
    attached_files: [
      ...(old.attached_files || []),
      ...(patch.attached_files || []),
    ],
    updated_at: new Date().toISOString(),
    policy: {
      use_as_reference_only: true,
      do_not_copy: [
        "logos",
        "commercial characters",
        "readable text",
        "exact copyrighted UI",
        "protected artwork",
      ],
      extract_only: [
        "palette",
        "silhouette",
        "layout",
        "pacing",
        "camera",
        "mechanic hints",
        "mood",
      ],
    },
  };
  await fs.writeJson(p, next, { spaces: 2 });
  return next;
}

async function ingestMedia(projectDir, opts) {
  const files = [];
  await fs.ensureDir(path.join(projectDir, "uploads/raw"));
  await fs.ensureDir(path.join(projectDir, "analysis"));
  await fs.ensureDir(path.join(projectDir, "media/frames"));

  const imageItems = [
    ...parseRolePath(opts.image || [], "image_reference"),
    ...parseRolePath(opts.imageRole || [], "image_reference"),
  ];
  const imagesStructured = [];
  for (const item of imageItems) {
    const src = expandHome(item.path);
    const dest = path.join(projectDir, "uploads/raw", path.basename(src));
    await fs.copy(src, dest);
    files.push(dest);
    const rec = {
      id: mediaId(dest),
      type: "image",
      role: item.role,
      source_path: src,
      file: path.relative(projectDir, dest),
      attached: true,
      usable_for:
        item.role === "player"
          ? ["player sprite", "silhouette", "palette"]
          : item.role === "ui"
            ? ["HUD layout", "button style", "panel style"]
            : ["visual style", "layout", "palette"],
      do_not_copy: [
        "logos",
        "exact protected characters",
        "readable text",
        "unique protected artwork",
      ],
      summary:
        "User uploaded image reference. Use high-level style/layout constraints only.",
    };
    imagesStructured.push(rec);
  }

  const videoItems = [
    ...parseRolePath(opts.video || [], "video_reference"),
    ...parseRolePath(opts.videoRole || [], "video_reference"),
  ];
  const videosStructured = [];
  let frameCountTotal = 0;
  const maxFrames = Number(opts.maxVideoFrames || 8);
  for (const item of videoItems) {
    const src = expandHome(item.path);
    const base = path.basename(src);
    const dest = path.join(projectDir, "uploads/raw", base);
    await fs.copy(src, dest);
    const framesDir = path.join(
      projectDir,
      "media/frames",
      base.replace(/[^a-zA-Z0-9_.-]/g, "_"),
    );
    await fs.ensureDir(framesDir);
    const outPattern = path.join(framesDir, "frame_%04d.jpg");
    run(
      "ffmpeg",
      ["-y", "-i", dest, "-vf", "fps=1,scale=1024:-1", outPattern],
      { cwd: projectDir, check: false },
    );
    const frames = (await fs.readdir(framesDir))
      .filter((f) => f.endsWith(".jpg"))
      .sort()
      .slice(0, maxFrames)
      .map((f) => path.join(framesDir, f));
    files.push(...frames);
    frameCountTotal += frames.length;
    videosStructured.push({
      id: mediaId(dest),
      type: "video",
      role: item.role,
      source_path: src,
      file: path.relative(projectDir, dest),
      frames_dir: path.relative(projectDir, framesDir),
      extracted_frame_count: (await fs.readdir(framesDir)).filter((f) =>
        f.endsWith(".jpg"),
      ).length,
      attached_frames: frames.map((f) => path.relative(projectDir, f)),
      attached_frame_count: frames.length,
      usable_for:
        item.role === "pacing"
          ? ["gameplay pacing", "enemy cadence", "screen motion"]
          : ["camera", "layout", "mechanics", "UI", "visual polish"],
      do_not_copy: [
        "logos",
        "exact commercial game content",
        "characters",
        "unique UI",
      ],
      summary:
        "Video converted to key frames. Use frames to infer high-level mechanics, pacing, camera, UI style, and visual polish.",
    });
  }

  if (imageItems.length || videoItems.length) {
    const manifest = await saveMediaManifest(projectDir, {
      images: imagesStructured,
      videos: videosStructured,
      attached_files: files.map((f) => path.relative(projectDir, f)),
    });
    await fs.writeJson(
      path.join(projectDir, "analysis/visual_reference.json"),
      {
        schema_version: "v10-visual-reference",
        input_images: manifest.images,
        style_constraints: {
          instruction:
            "Use uploaded images as high-level references only. Do not copy exact logos, characters, text, or protected artwork.",
        },
      },
      { spaces: 2 },
    );
    await fs.writeJson(
      path.join(projectDir, "analysis/video_summary.json"),
      {
        schema_version: "v10-video-summary",
        videos: manifest.videos,
        instruction:
          "Use video frames to infer camera, pacing, UI, wave behavior, and game feel. Do not clone exact commercial content.",
      },
      { spaces: 2 },
    );
  }

  if (files.length)
    console.log(
      `Attached media files: ${files.length} (${imageItems.length} images, ${frameCountTotal} video frames)`,
    );
  return files;
}

async function runOpenCode(
  projectDir,
  prompt,
  agent = "game-orchestrator",
  title = "GameGen run",
  files = [],
) {
  const args = [
    "run",
    prompt,
    "--agent",
    agent,
    "--dir",
    projectDir,
    "--title",
    title,
  ];
  const override = process.env.GAMEGEN_MODEL_OVERRIDE || "";
  if (override) args.push("--model", override);
  for (const f of files.slice(0, 12)) args.push(`--file=${f}`);
  run("opencode", args, {
    cwd: projectDir,
    env: { ...process.env, GAMEGEN_ROOT: root },
  });
}

async function qa(projectDir) {
  run("node", ["scripts/run_playwright_qa.mjs"], {
    cwd: projectDir,
    check: false,
  });
  run("node", ["scripts/validate_asset_manifest.mjs"], {
    cwd: projectDir,
    check: false,
  });
  run("node", ["scripts/visual_score.mjs"], { cwd: projectDir, check: false });
  if (await fs.pathExists(path.join(projectDir, "feedback_acceptance.json"))) {
    run("node", ["scripts/improve_diagnosis.mjs"], {
      cwd: projectDir,
      check: false,
    });
    run("node", ["scripts/feedback_acceptance_check.mjs"], {
      cwd: projectDir,
      check: false,
    });
  }
  run("node", ["scripts/visual_score_v2.mjs"], {
    cwd: projectDir,
    check: false,
  });
  const report = await readJsonMaybe(path.join(projectDir, "qa_report.json"));
  const assets = await readJsonMaybe(
    path.join(projectDir, "asset_validation_report.json"),
  );
  const acceptance = await readJsonMaybe(
    path.join(projectDir, "feedback_acceptance_report.json"),
  );
  return (
    classifyQaFailure(report) === "passed" &&
    assets?.ok === true &&
    (!acceptance || acceptance.passed)
  );
}

async function readJsonMaybe(p) {
  try {
    return await fs.readJson(p);
  } catch {
    return null;
  }
}

const MEANINGFUL_CHANGE_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".css",
  ".html",
  ".json",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
]);
const CHANGE_IGNORE_PARTS = new Set([
  "node_modules",
  "dist",
  "test-results",
  "playwright-report",
  ".git",
]);
const REPORT_ONLY_FILES = new Set([
  "qa_report.json",
  "visual_score.json",
  "iteration_report.json",
  "asset_validation_report.json",
  "asset_generation_report.json",
  "feedback_acceptance_report.json",
  "improve_diagnosis.json",
  "visual_score_v2.json",
  "gameplay_feel_report.json",
  "run_metadata.json",
]);

async function snapshotProject(projectDir) {
  const out = new Map();
  async function walk(dir) {
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      const rel = path.relative(projectDir, full);
      const parts = rel.split(path.sep);
      if (parts.some((x) => CHANGE_IGNORE_PARTS.has(x))) continue;
      if (ent.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!ent.isFile()) continue;
      const ext = path.extname(ent.name).toLowerCase();
      if (!MEANINGFUL_CHANGE_EXTS.has(ext)) continue;
      const st = await fs.stat(full).catch(() => null);
      if (st) out.set(rel, `${st.size}:${Math.round(st.mtimeMs)}`);
    }
  }
  await walk(projectDir);
  return out;
}

function changedFiles(before, after) {
  const changed = [];
  for (const [rel, sig] of after.entries()) {
    if (before.get(rel) !== sig) changed.push(rel);
  }
  for (const rel of before.keys()) {
    if (!after.has(rel)) changed.push(rel);
  }
  return [...new Set(changed)].sort();
}

function meaningfulChangedFiles(files) {
  return files.filter((rel) => {
    const base = path.basename(rel);
    if (REPORT_ONLY_FILES.has(base)) return false;
    if (rel.startsWith("analysis/")) return false;
    return true;
  });
}

function feedbackAcceptanceCriteria(feedback) {
  const lower = feedback.toLowerCase();
  const criteria = [
    "The requested feedback must cause a concrete code, asset, style, or manifest change unless it is impossible or unsafe.",
    "Update report.json with a short summary of what changed.",
    "Run npm run build if possible and do not weaken tests to pass.",
  ];
  if (/(missile|projectile|bullet|rocket|warhead)/.test(lower)) {
    criteria.push(
      "Projectile or missile visuals must not be a plain rectangle.",
    );
    criteria.push(
      "Projectile or missile visuals should use a pointed nose, tapered body, fin, flame, or warhead-like silhouette.",
    );
    criteria.push(
      "Update either src/main.ts projectile drawing logic, public/assets/generated/projectile.svg, asset_manifest.json, or another concrete rendering asset so the change is visible.",
    );
  }
  if (/(polish|polished|visual|ui|beautiful|better)/.test(lower)) {
    criteria.push(
      "Improve at least one visible polish dimension: HUD spacing, background contrast, sprite silhouette, effects, animation feedback, start screen, or game-over screen.",
    );
  }
  return criteria;
}

async function writeFeedbackAcceptance(projectDir, feedback) {
  const doc = {
    schema_version: "v10.2-feedback-acceptance",
    feedback,
    acceptance_criteria: feedbackAcceptanceCriteria(feedback),
    minimum_required_evidence: [
      "meaningful changed_files entry in iteration_report.json",
      "updated source/asset/style/manifest file, not only report files",
      "qa_report.json after the change",
    ],
    created_at: new Date().toISOString(),
  };
  await fs.writeJson(path.join(projectDir, "feedback_acceptance.json"), doc, {
    spaces: 2,
  });
  return doc;
}

function classifyQaFailure(qaReport) {
  if (!qaReport) return "missing_qa_report";
  const text = `${qaReport.build?.stdout || ""}\n${qaReport.build?.stderr || ""}\n${qaReport.test?.stdout || ""}\n${qaReport.test?.stderr || ""}`;
  if (!qaReport.build_passed) {
    if (text.includes("TS18047")) return "typescript_null_check";
    if (text.includes("Cannot find module") || text.includes("not found"))
      return "missing_import_or_file";
    if (text.includes("error TS")) return "typescript_error";
    return "build_failed";
  }
  if (!qaReport.playwright_passed) return "playwright_failed";
  if (!qaReport.screenshot_exists) return "missing_screenshot";
  if ((qaReport.runtime_error_count || 0) > 0) return "runtime_errors";
  return "passed";
}

async function appendIterationReport(projectDir, entry) {
  const p = path.join(projectDir, "iteration_report.json");
  let old = { schema_version: "v10-iteration-report", rounds: [] };
  try {
    old = await fs.readJson(p);
  } catch {}
  old.rounds.push({ ...entry, timestamp: new Date().toISOString() });
  old.updated_at = new Date().toISOString();
  await fs.writeJson(p, old, { spaces: 2 });
}

async function outerLoop(projectDir, opts = {}) {
  const maxRounds = Number(opts.maxRounds || opts.rounds || 3);
  const maxVisualRounds = Number(opts.visualRounds || 2);
  const minVisualScore = Number(opts.minVisualScore || 4);
  let visualRounds = 0;

  for (let round = 1; round <= maxRounds; round++) {
    console.log(`\n[GameGen loop] QA round ${round}/${maxRounds}`);
    await qa(projectDir);
    const qaReport = await readJsonMaybe(
      path.join(projectDir, "qa_report.json"),
    );
    const visualReport =
      (await readJsonMaybe(path.join(projectDir, "visual_score_v2.json"))) ||
      (await readJsonMaybe(path.join(projectDir, "visual_score.json")));
    const acceptanceReport = await readJsonMaybe(
      path.join(projectDir, "feedback_acceptance_report.json"),
    );
    const assetReport = await readJsonMaybe(
      path.join(projectDir, "asset_validation_report.json"),
    );
    let failure = classifyQaFailure(qaReport);
    if (failure === "passed" && assetReport?.ok !== true)
      failure = "asset_validation_failed";
    if (failure === "passed" && acceptanceReport && !acceptanceReport.passed)
      failure = "feedback_acceptance_failed";
    const visualScore = Number(visualReport?.visual_score || 0);

    await appendIterationReport(projectDir, {
      round,
      phase: "qa",
      failure,
      build_passed: qaReport?.build_passed,
      playwright_passed: qaReport?.playwright_passed,
      screenshot_exists: qaReport?.screenshot_exists,
      runtime_error_count: qaReport?.runtime_error_count || 0,
      visual_score: visualScore,
      feedback_acceptance_passed: acceptanceReport
        ? acceptanceReport.passed
        : null,
      feedback_acceptance_score: acceptanceReport?.acceptance_score ?? null,
    });

    if (failure !== "passed") {
      const acceptanceReport = await readJsonMaybe(
        path.join(projectDir, "feedback_acceptance_report.json"),
      );
      const diagnosis = await readJsonMaybe(
        path.join(projectDir, "improve_diagnosis.json"),
      );
      const fixPrompt = `The generated game failed automated validation. Fix the project with the smallest safe changes.

Failure category: ${failure}

qa_report.json summary:
${JSON.stringify({ build_passed: qaReport?.build_passed, playwright_passed: qaReport?.playwright_passed, screenshot_exists: qaReport?.screenshot_exists, runtime_error_count: qaReport?.runtime_error_count || 0 }, null, 2)}

Build stdout tail:
${tailText(qaReport?.build?.stdout, 60)}

Build stderr tail:
${tailText(qaReport?.build?.stderr, 60)}

Playwright stderr tail:
${tailText(qaReport?.test?.stderr, 60)}

Runtime errors:
${JSON.stringify(qaReport?.runtime || {}, null, 2)}

Feedback acceptance report, if relevant:
${JSON.stringify(acceptanceReport || {}, null, 2)}

Improve diagnosis, if relevant:
${JSON.stringify(diagnosis || {}, null, 2)}

Rules:
- Do not delete tests to pass.
- Do not disable TypeScript strictness.
- Fix root cause.
- If failure is feedback_acceptance_failed, make a concrete visible change tied to the acceptance report.
- Run npm run build if possible.
- Update report.json and iteration_report.json if useful.`;
      await runOpenCode(
        projectDir,
        fixPrompt,
        "game-coder",
        `GameGen fix round ${round}`,
      );
      await appendIterationReport(projectDir, {
        round,
        phase: "fix",
        requested_agent: "game-coder",
        reason: failure,
      });
      continue;
    }

    if (visualScore < minVisualScore && visualRounds < maxVisualRounds) {
      visualRounds += 1;
      const polishPrompt = `The game passes build and Playwright, but visual_score is ${visualScore}, below required ${minVisualScore}. Improve visual quality without breaking gameplay.\n\nRead visual_score.json, qa_report.json, asset_manifest.json, asset_validation_report.json, and analysis/media_manifest.json if present.\n\nImprove HUD, background, sprite usage, spacing, contrast, effects, and start/game-over screens. Keep all UI text rendered by Canvas/HTML/CSS. Run npm run build if possible.`;
      await runOpenCode(
        projectDir,
        polishPrompt,
        "game-orchestrator",
        `GameGen visual polish ${visualRounds}`,
      );
      await appendIterationReport(projectDir, {
        round,
        phase: "visual_polish",
        requested_agent: "game-orchestrator",
        visual_score: visualScore,
      });
      continue;
    }

    await appendIterationReport(projectDir, {
      round,
      phase: "complete",
      result: "passed",
      visual_score: visualScore,
    });
    return { ok: true, round, visual_score: visualScore };
  }

  await qa(projectDir);
  const finalQa = await readJsonMaybe(path.join(projectDir, "qa_report.json"));
  const finalVisual =
    (await readJsonMaybe(path.join(projectDir, "visual_score_v2.json"))) ||
    (await readJsonMaybe(path.join(projectDir, "visual_score.json")));
  const finalAcceptance = await readJsonMaybe(
    path.join(projectDir, "feedback_acceptance_report.json"),
  );
  const finalAssets = await readJsonMaybe(
    path.join(projectDir, "asset_validation_report.json"),
  );
  return {
    ok: Boolean(
      classifyQaFailure(finalQa) === "passed" &&
        finalAssets?.ok === true &&
        (!finalAcceptance || finalAcceptance.passed) &&
        Number(finalVisual?.visual_score || 0) >= minVisualScore,
    ),
    visual_score: Number(finalVisual?.visual_score || 0),
  };
}

async function doctor() {
  console.log("GameGen doctor\n");
  const checks = [
    ["node", ["-v"]],
    ["npm", ["-v"]],
    ["opencode", ["--version"]],
    ["ffmpeg", ["-version"]],
  ];
  let ok = true;
  for (const [cmd, args] of checks) {
    const res = capture(cmd, args);
    if (res.status === 0)
      console.log(
        `OK  ${cmd}: ${String(res.stdout || res.stderr)
          .split("\n")[0]
          .trim()}`,
      );
    else {
      console.log(`FAIL ${cmd}: not found or not working`);
      ok = false;
    }
  }
  for (const p of [
    ".env",
    "config/model-profiles.json",
    "scripts/render_opencode_config.mjs",
    "scripts/validate_asset_manifest.mjs",
    "scripts/feedback_acceptance_check.mjs",
    "scripts/improve_diagnosis.mjs",
    "scripts/visual_score_v2.mjs",
    ".opencode/agents/game-orchestrator.md",
    "templates/base-web-game/playwright.config.ts",
  ]) {
    if (await fs.pathExists(path.join(root, p))) console.log(`OK  ${p}`);
    else {
      console.log(`FAIL ${p} missing`);
      ok = false;
    }
  }
  const profile = await profileName();
  console.log(`INFO current profile: ${profile}`);
  if (profile === "free")
    console.log(
      "WARN profile is free; paid OpenAI/Anthropic models will NOT be used. Set GAMEGEN_MODEL_PROFILE=balanced or deep in .env.",
    );
  console.log(ok ? "\nDoctor passed." : "\nDoctor found problems.");
  if (!ok) process.exit(1);
}

async function authCheck() {
  console.log("GameGen auth-check\n");
  const profile = await profileName();
  const all = await fs.readJson(path.join(root, "config/model-profiles.json"));
  const p = all.profiles[profile];
  console.log(`Profile: ${profile}`);
  console.log(`Default model: ${p.defaultModel}`);
  console.log(
    `Image model: ${p.imageGeneration?.provider || "openai"}/${p.imageGeneration?.model || "gpt-image-2"}`,
  );
  const openaiKey =
    parsedEnv.OPENAI_API_KEY || process.env.OPENAI_API_KEY || "";
  const anthropicKey =
    parsedEnv.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || "";
  console.log(
    `OPENAI_API_KEY: ${openaiKey && !openaiKey.includes("your-openai") ? "present" : "missing or placeholder"}`,
  );
  console.log(
    `ANTHROPIC_API_KEY: ${anthropicKey && !anthropicKey.includes("your-anthropic") ? "present" : "missing or placeholder"}`,
  );
  if (profile === "free")
    console.log(
      "WARN: current profile is free; use `gamegen profile set balanced` to use paid model routing.",
    );
  const auth = capture("opencode", ["auth", "list"], {
    cwd: root,
    env: process.env,
  });
  console.log("\nOpenCode auth list:");
  console.log((auth.stdout || auth.stderr || "").trim());
  const models = capture("opencode", ["models", "--refresh"], {
    cwd: root,
    env: process.env,
  });
  const out = `${models.stdout}\n${models.stderr}`;
  console.log("\nOpenCode models contains:");
  console.log(`openai/: ${out.includes("openai/") ? "yes" : "no"}`);
  console.log(`anthropic/: ${out.includes("anthropic/") ? "yes" : "no"}`);
  console.log(`opencode/: ${out.includes("opencode/") ? "yes" : "no"}`);
  const missing = [];
  for (const m of new Set(Object.values(p.agents || {})))
    if (!out.includes(m)) missing.push(m);
  if (missing.length) {
    console.log(
      "\nWARN: These configured agent models were not visible in `opencode models --refresh`:",
    );
    for (const m of missing) console.log(`  - ${m}`);
    console.log(
      "Edit config/model-profiles.json to exactly match model IDs shown by opencode, then run `gamegen render-config`.",
    );
  } else
    console.log("\nOK: configured agent models appear in OpenCode model list.");
}

const program = new Command();
program.name("gamegen").version("0.10.3");

program.command("doctor").action(doctor);
program.command("auth-check").action(authCheck);
program
  .command("render-config")
  .option("--profile <name>")
  .action(async (opts) => renderConfig(opts.profile));
program.command("list").action(listJobs);
program.command("use").argument("<job_id>").action(useJob);
program
  .command("profile")
  .argument("[action]", "show|set")
  .argument("[name]", "profile name")
  .action(async (action = "show", name) => {
    if (action === "show") {
      console.log(await profileName());
      return;
    }
    if (action === "set") {
      if (!name) throw new Error("profile name required");
      const all = await fs.readJson(
        path.join(root, "config/model-profiles.json"),
      );
      if (!Object.hasOwn(all.profiles, name))
        throw new Error(
          `Unknown profile '${name}'. Valid profiles: ${Object.keys(all.profiles).join(", ")}`,
        );
      let content = await fs
        .readFile(envPath, "utf8")
        .catch(() => fs.readFile(path.join(root, ".env.example"), "utf8"));
      if (content.match(/^GAMEGEN_MODEL_PROFILE=/m))
        content = content.replace(
          /^GAMEGEN_MODEL_PROFILE=.*/m,
          `GAMEGEN_MODEL_PROFILE=${name}`,
        );
      else content += `\nGAMEGEN_MODEL_PROFILE=${name}\n`;
      await fs.writeFile(envPath, content);
      console.log(`Set GAMEGEN_MODEL_PROFILE=${name} in .env`);
      await renderConfig(name);
      return;
    }
    throw new Error("Unknown profile action");
  });

program
  .command("demo")
  .description("Create the bundled starter game without calling AI providers")
  .option("--no-install", "Skip installing the starter game's dependencies")
  .action(async (opts) => {
    await renderConfig();
    const { jobId, jobDir, projectDir } = await createJobDir();
    await writeInitialSpec(
      projectDir,
      "Bundled starter demo; no AI generation",
      { type: "shooter", title: "Neon Space Demo" },
    );
    if (opts.install) await ensureInstall(projectDir);
    await generateAssets(projectDir, false);
    run("node", ["scripts/validate_asset_manifest.mjs"], { cwd: projectDir });
    await writeJobMeta(jobDir, {
      status: "demo",
      title: "Neon Space Demo",
      project_dir: projectDir,
    });
    console.log(
      `\nStarter demo ready: ${jobId}\nProject: ${projectDir}\nRun gamegen preview to play.`,
    );
  });

function addMediaOptions(cmd) {
  return cmd
    .option(
      "--image <path>",
      "image reference; repeatable",
      (v, p) => {
        p.push(v);
        return p;
      },
      [],
    )
    .option(
      "--video <path>",
      "video reference; repeatable",
      (v, p) => {
        p.push(v);
        return p;
      },
      [],
    )
    .option(
      "--image-role <role=path>",
      "structured image reference; repeatable",
      (v, p) => {
        p.push(v);
        return p;
      },
      [],
    )
    .option(
      "--video-role <role=path>",
      "structured video reference; repeatable",
      (v, p) => {
        p.push(v);
        return p;
      },
      [],
    )
    .option("--max-video-frames <n>", "max frames attached per video", "8");
}

addMediaOptions(
  program
    .command("create")
    .argument("<prompt...>")
    .option("--type <type>")
    .option("--style <style>")
    .option("--title <title>")
    .option("--rounds <n>", "legacy alias for --max-rounds", "3")
    .option("--max-rounds <n>", "outer build/QA fix rounds", "3")
    .option("--visual-rounds <n>", "visual polish rounds", "2")
    .option("--min-visual-score <n>", "minimum visual score", "4")
    .option("--max-images <n>", "max image generations", "12")
    .option("--use-openai-images")
    .option("--profile <name>"),
).action(async (parts, opts) => {
  await renderConfig(opts.profile);
  const prompt = parts.join(" ");
  const { jobId, jobDir, projectDir } = await createJobDir();
  console.log(`Created job: ${jobId}`);
  console.log(`Project: ${projectDir}`);
  await writeJobMeta(jobDir, {
    prompt,
    title: opts.title || "Generated Game",
    game_type: opts.type || "arcade",
    profile: await profileName(),
    status: "running",
  });
  await writeInitialSpec(projectDir, prompt, opts);
  const files = await ingestMedia(projectDir, opts);
  await ensureInstall(projectDir);
  await generateAssets(projectDir, Boolean(opts.useOpenaiImages));
  const mediaNote = files.length
    ? "\nUse attached images/video frames as high-level references only. Also read analysis/media_manifest.json, analysis/visual_reference.json, and analysis/video_summary.json if present."
    : "";
  await runOpenCode(
    projectDir,
    `${prompt}\nCreate a playable browser game. Update game_spec.json, asset_manifest.json, source files, and report.json. Run npm run build if possible.${mediaNote}`,
    "game-orchestrator",
    "GameGen create",
    files,
  );
  const loop = await outerLoop(projectDir, opts);
  await writeJobMeta(jobDir, {
    status: loop.ok ? "passed" : "needs_review",
    project_dir: projectDir,
    preview_command: `cd ${projectDir} && npm run dev`,
    preview_url: "http://127.0.0.1:5173",
    final_visual_score: loop.visual_score,
  });
  if (!loop.ok) process.exitCode = 1;
  console.log(`\nDone. Preview: cd ${projectDir} && npm run dev`);
});

addMediaOptions(
  program
    .command("improve")
    .argument("<feedback...>")
    .option("--use-openai-images")
    .option("--profile <name>")
    .option("--job <job_id>")
    .option("--project <path>")
    .option("--rounds <n>", "legacy alias for --max-rounds", "2")
    .option("--max-rounds <n>", "outer build/QA fix rounds", "2")
    .option("--visual-rounds <n>", "visual polish rounds", "2")
    .option("--min-visual-score <n>", "minimum visual score", "4"),
).action(async (parts, opts) => {
  await renderConfig(opts.profile);
  const projectDir = await resolveProjectDir(opts);
  await fs.copy(
    path.join(root, "opencode.jsonc"),
    path.join(projectDir, "opencode.jsonc"),
  );
  await fs.copy(
    path.join(root, ".opencode"),
    path.join(projectDir, ".opencode"),
  );
  const files = await ingestMedia(projectDir, opts);
  if (opts.useOpenaiImages) await generateAssets(projectDir, true);
  const feedback = parts.join(" ");
  const acceptance = await writeFeedbackAcceptance(projectDir, feedback);
  run("node", ["scripts/improve_diagnosis.mjs"], {
    cwd: projectDir,
    check: false,
  });
  const before = await snapshotProject(projectDir);
  await runOpenCode(
    projectDir,
    `Improve the current generated game based on this feedback:
${feedback}

You must satisfy feedback_acceptance.json and you should read improve_diagnosis.json before editing. Read qa_report.json, visual_score.json, visual_score_v2.json, asset_manifest.json, asset_validation_report.json, feedback_acceptance.json, feedback_acceptance_report.json, improve_diagnosis.json, analysis/media_manifest.json, analysis/visual_reference.json, and analysis/video_summary.json if present. Make concrete visible changes, not only report updates. If the feedback mentions projectile/missile/warhead, directly inspect projectile drawing and projectile assets, then change the source or asset so the shape requirement is visibly satisfied. Run npm run build if possible.`,
    "game-orchestrator",
    "GameGen improve",
    files,
  );
  const after = await snapshotProject(projectDir);
  const changed = changedFiles(before, after);
  const meaningful = meaningfulChangedFiles(changed);
  await appendIterationReport(projectDir, {
    phase: "improve_initial",
    requested_agent: "game-orchestrator",
    changed_files: changed,
    meaningful_changed_files: meaningful,
    acceptance_criteria: acceptance.acceptance_criteria,
  });
  run("node", ["scripts/improve_diagnosis.mjs"], {
    cwd: projectDir,
    check: false,
  });
  run("node", ["scripts/feedback_acceptance_check.mjs"], {
    cwd: projectDir,
    check: false,
  });
  const initialAcceptance = await readJsonMaybe(
    path.join(projectDir, "feedback_acceptance_report.json"),
  );
  if (!meaningful.length || (initialAcceptance && !initialAcceptance.passed)) {
    const retryBefore = await snapshotProject(projectDir);
    await runOpenCode(
      projectDir,
      `The previous improve attempt either did not make meaningful source/asset/style/manifest changes or failed feedback_acceptance_report.json. This is not acceptable for the user's feedback.\n\nFeedback:\n${feedback}\n\nAcceptance criteria:\n${acceptance.acceptance_criteria.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\nCurrent feedback_acceptance_report.json:
${JSON.stringify(initialAcceptance || {}, null, 2)}

Current improve_diagnosis.json:
${JSON.stringify((await readJsonMaybe(path.join(projectDir, "improve_diagnosis.json"))) || {}, null, 2)}

Make a concrete visible change now. For projectile/missile/warhead feedback, update projectile rendering in src/main.ts or public/assets/generated/projectile.svg so it is not a rectangle and has a warhead-like pointed shape. Then run npm run build if possible and update report.json.`,
      "game-orchestrator",
      "GameGen improve retry acceptance",
      files,
    );
    const retryAfter = await snapshotProject(projectDir);
    const retryChanged = changedFiles(retryBefore, retryAfter);
    await appendIterationReport(projectDir, {
      phase: "improve_retry_acceptance",
      requested_agent: "game-orchestrator",
      changed_files: retryChanged,
      meaningful_changed_files: meaningfulChangedFiles(retryChanged),
    });
    run("node", ["scripts/improve_diagnosis.mjs"], {
      cwd: projectDir,
      check: false,
    });
    run("node", ["scripts/feedback_acceptance_check.mjs"], {
      cwd: projectDir,
      check: false,
    });
  }
  const loop = await outerLoop(projectDir, opts);
  if (!loop.ok) process.exitCode = 1;
});

program
  .command("qa")
  .option("--job <job_id>")
  .option("--project <path>")
  .action(async (opts) => {
    if (!(await qa(await resolveProjectDir(opts)))) process.exitCode = 1;
  });
program
  .command("preview")
  .option("--job <job_id>")
  .option("--project <path>")
  .action(async (opts) =>
    run("npm", ["run", "dev"], { cwd: await resolveProjectDir(opts) }),
  );
program
  .command("where")
  .option("--job <job_id>")
  .option("--project <path>")
  .action(async (opts) => console.log(await resolveProjectDir(opts)));
program
  .command("export")
  .option("--job <job_id>")
  .option("--project <path>")
  .action(async (opts) => {
    const projectDir = await resolveProjectDir(opts);
    const jobDir = path.dirname(projectDir);
    const zipPath = path.join(jobDir, "export.zip");
    run(
      "zip",
      [
        "-r",
        zipPath,
        ".",
        "-x",
        "node_modules/*",
        "dist/*",
        "test-results/*",
        "playwright-report/*",
        ".env",
        ".env.*",
        ".git/*",
        "uploads/*",
        "analysis/*",
        "media/*",
        ".opencode/*",
        "config/*",
        "opencode.jsonc",
        "current_model_profile.json",
      ],
      { cwd: projectDir },
    );
    console.log(`Exported: ${zipPath}`);
  });

try {
  await program.parseAsync();
} catch (err) {
  console.error(`GameGen: ${err.message || err}`);
  process.exitCode = 1;
}
