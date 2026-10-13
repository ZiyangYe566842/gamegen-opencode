import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const root = process.cwd();
const envPath = path.join(root, ".env");
let envFile = {};
try {
  envFile = dotenv.parse(fs.readFileSync(envPath));
} catch {}

function profileNameFromEnv(all) {
  // Explicit CLI override wins; otherwise prefer .env over stale shell exports.
  return (
    process.env.GAMEGEN_PROFILE_OVERRIDE ||
    envFile.GAMEGEN_MODEL_PROFILE ||
    process.env.GAMEGEN_MODEL_PROFILE ||
    all.active ||
    "balanced"
  );
}

function currentProfile() {
  const profilesPath = path.join(root, "config/model-profiles.json");
  const all = JSON.parse(fs.readFileSync(profilesPath, "utf8"));
  const name = profileNameFromEnv(all);
  const profile = all.profiles[name];
  if (!profile)
    throw new Error(
      `Unknown profile '${name}'. Valid profiles: ${Object.keys(all.profiles).join(", ")}`,
    );
  return { all, name, profile };
}

function providerModels(providerOptions = {}) {
  const provider = {};
  for (const [providerId, models] of Object.entries(providerOptions)) {
    provider[providerId] = { models: {} };
    for (const [modelId, options] of Object.entries(models || {})) {
      provider[providerId].models[modelId] = { options };
    }
  }
  return provider;
}

function agentPrompt(name) {
  const prompts = {
    "game-orchestrator": `You are the GameGen orchestrator. Produce playable browser games for CLI users who do not read code. Load and follow relevant skills before acting: game-spec, media-input, asset-pipeline, canvas-game-architecture, gameplay-quality, debug-fix-loop, playwright-qa, visual-polish, and cost-control. Follow this pipeline: read game_spec.json, asset_manifest.json, and analysis/*.json when present; implement or improve the Vite TypeScript Canvas game; use uploaded images/video frames as high-level references only; use generated assets with fallbacks; run npm run build or node scripts/run_playwright_qa.mjs when possible; fix build/test failures with minimal patches; update report.json. Never ask the user to inspect source code. Keep changes inside the active project.`,
    "game-planner": `Convert the user request into game_spec.json. Load game-spec, media-input, image-reference-analysis, video-reference-analysis, gameplay-quality, and cost-control when relevant. Include game_type, title, target_platform, engine, art_style, input_media_summary, controls, core_mechanics, entities, scoring, health_or_lives, win_condition, lose_condition, screens, assets_required, qa_acceptance_criteria, visual_acceptance_criteria, iteration_budget, and known_risks. Do not write gameplay code except the JSON spec.`,
    "game-coder": `Implement the browser game. Load canvas-game-architecture, gameplay-quality, asset-pipeline, debug-fix-loop, and playwright-qa when relevant. Use Vite + TypeScript + Canvas. Keep the game playable and buildable. Render visible text with HTML/CSS/Canvas. Use generated assets from public/assets when they exist, but keep Canvas fallbacks. Run npm run build after major edits and fix failures without disabling strict checks.`,
    "asset-agent": `Maintain asset_manifest.json and the game asset pipeline. Load asset-pipeline, media-input, image-reference-analysis, video-reference-analysis, and cost-control when relevant. Use generated assets and uploaded image/video references as high-level style constraints. Ensure generated assets are actually used or documented. Do not copy exact logos, copyrighted characters, or protected artwork. Do not generate UI text inside images.`,
    "qa-agent": `Run build and browser QA. Load playwright-qa, debug-fix-loop, visual-polish, and cost-control when relevant. Run npm run build and Playwright if available. Check screenshot output and write qa_report.json. Summarize failures for the coder agent. Do not weaken tests only to pass.`,
    "visual-polisher": `Improve visual quality. Load visual-polish, asset-pipeline, media-input, image-reference-analysis, video-reference-analysis, gameplay-quality, and playwright-qa when relevant. Improve background, HUD, buttons, sprites, spacing, colors, effects, and animation. Use attached images or video frames as high-level references only. Do not copy exact copyrighted assets. Run npm run build when possible.`,
  };
  return prompts[name] || `You are a GameGen agent named ${name}.`;
}

function safeBashPermission() {
  return {
    "*": "ask",

    // Package/build/test commands used by the GameGen workflow.
    "npm install": "allow",
    "npm install *": "allow",
    "npm run build": "allow",
    "npm run build *": "allow",
    "npm run build 2>&1": "allow",
    "npm run build 2>&1 | tail *": "allow",
    "npm run dev*": "allow",
    "npm run preview*": "allow",
    "npm test*": "allow",
    "node *": "allow",
    "npx playwright *": "allow",
    "npx vite *": "allow",

    // Git status/read-only inspection.
    "git status": "allow",
    "git diff": "allow",

    // Read-only/debug shell commands. These reduce auto-reject noise in
    // non-interactive opencode runs while keeping destructive commands denied.
    "wc *": "allow",
    ls: "allow",
    "ls *": "allow",
    "ls public/assets/generated/ 2>/dev/null": "allow",
    "find *": "allow",
    "du *": "allow",
    "file *": "allow",
    "stat *": "allow",
    "head *": "allow",
    "tail *": "allow",
    pwd: "allow",
    "test *": "allow",
    "cat package.json": "allow",
    "cat tsconfig.json": "allow",
    "cat game_spec.json": "allow",
    "cat asset_manifest.json": "allow",
    "cat asset_generation_report.json": "allow",
    "cat qa_report.json": "allow",
    "cat visual_score.json": "allow",
    "cat report.json": "allow",
    "cat feedback_acceptance.json": "allow",
    "cat feedback_acceptance_report.json": "allow",
    "cat improve_diagnosis.json": "allow",
    "cat visual_score_v2.json": "allow",
    "cat iteration_report.json": "allow",
    "cat current_model_profile.json": "allow",
    "cat analysis/*.json": "allow",
    "cat test-results/runtime_errors.json": "allow",
    "cat public/assets/**/*.json": "allow",
    "grep *": "allow",
    "sed -n *": "allow",
    "jq *": "allow",
    "printf *": "allow",
    "echo *": "allow",

    // Safe project-local directory creation. Copying stays ask because it can
    // overwrite user data if used carelessly.
    "mkdir -p *": "allow",
    "cp *": "ask",

    // Sensitive or destructive commands remain denied.
    "cat ~/.ssh/*": "deny",
    "cat ~/.env*": "deny",
    "cat /etc/passwd": "deny",
    "rm *": "deny",
    "sudo *": "deny",
    "ssh *": "deny",
    "scp *": "deny",
    "curl *": "ask",
    "wget *": "ask",
  };
}

function buildConfig(profile) {
  const basePermission = {
    "*": "ask",
    read: "allow",
    glob: "allow",
    grep: "allow",
    list: "allow",
    edit: "allow",
    todowrite: "allow",
    question: "allow",
    webfetch: "allow",
    websearch: "ask",
    external_directory: "deny",
    skill: { "*": "allow" },
    task: { "*": "allow" },
    bash: safeBashPermission(),
  };

  const agent = {};
  for (const [agentName, model] of Object.entries(profile.agents || {})) {
    agent[agentName] = {
      mode: "all",
      model,
      temperature:
        agentName === "game-planner" || agentName === "qa-agent" ? 0.1 : 0.2,
      prompt: agentPrompt(agentName),
      permission: basePermission,
    };
  }

  return {
    $schema: "https://opencode.ai/config.json",
    model: profile.defaultModel,
    small_model: profile.agents?.["qa-agent"] || profile.defaultModel,
    provider: providerModels(profile.providerOptions || {}),
    permission: basePermission,
    agent,
    compaction: { auto: true, prune: true, reserved: 10000 },
    watcher: {
      ignore: [
        "node_modules/**",
        "dist/**",
        ".git/**",
        "playwright-report/**",
        "test-results/**",
      ],
    },
  };
}

try {
  const { name, profile } = currentProfile();
  if (name === "free") {
    console.warn(
      "WARNING: using profile 'free'. This will NOT use paid OpenAI/Anthropic coding models. Set GAMEGEN_MODEL_PROFILE=balanced or deep in .env to use paid models.",
    );
  }
  const config = buildConfig(profile);
  fs.writeFileSync(
    path.join(root, "opencode.jsonc"),
    JSON.stringify(config, null, 2),
  );
  fs.writeFileSync(
    path.join(root, "current_model_profile.json"),
    JSON.stringify(
      {
        profile: name,
        defaultModel: profile.defaultModel,
        agents: profile.agents,
        imageGeneration: profile.imageGeneration,
      },
      null,
      2,
    ),
  );
  console.log(
    `Generated ${path.join(root, "opencode.jsonc")} using profile: ${name}`,
  );
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
