import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import OpenAI from "openai";

const cwd = process.cwd();
const root = process.env.GAMEGEN_ROOT || cwd;
let env = {};
try {
  env = dotenv.parse(fs.readFileSync(path.join(root, ".env")));
} catch {}
for (const [k, v] of Object.entries(env))
  if (!(k in process.env)) process.env[k] = v;

const useOpenAI = process.argv.includes("--use-openai");
const qualityArgIndex = process.argv.indexOf("--quality");
const requestedQuality =
  qualityArgIndex >= 0 ? process.argv[qualityArgIndex + 1] : undefined;

function loadImageConfig() {
  try {
    const all = JSON.parse(
      fs.readFileSync(path.join(root, "config/model-profiles.json"), "utf8"),
    );
    const profileName =
      process.env.GAMEGEN_PROFILE_OVERRIDE ||
      env.GAMEGEN_MODEL_PROFILE ||
      process.env.GAMEGEN_MODEL_PROFILE ||
      all.active ||
      "balanced";
    const p = all.profiles[profileName];
    return (
      p?.imageGeneration || {
        provider: "openai",
        model: "gpt-image-2",
        quality: "low",
        size: "1024x1024",
        outputFormat: "png",
      }
    );
  } catch {
    return {
      provider: "openai",
      model: "gpt-image-2",
      quality: "low",
      size: "1024x1024",
      outputFormat: "png",
    };
  }
}

const imageConfig = loadImageConfig();
const quality = requestedQuality || imageConfig.quality || "low";
const manifestPath = path.join(cwd, "asset_manifest.json");

const defaultManifest = {
  game: "generated-game",
  style: "neon arcade, clean cartoon, high readability, no text inside images",
  assets: [
    {
      id: "background",
      type: "background",
      size: "1536x1024",
      quality,
      output: "public/assets/generated/background.png",
      fallback_output: "public/assets/generated/background.svg",
      prompt:
        "A polished 2D neon arcade space background for a browser game, deep blue and purple, subtle nebula, no text, no logo, no UI.",
    },
    {
      id: "player",
      type: "sprite",
      size: "1024x1024",
      quality,
      output: "public/assets/generated/player.png",
      fallback_output: "public/assets/generated/player.svg",
      prompt:
        "A centered 2D arcade player spaceship sprite, top-down view, neon blue and white, clean silhouette, no text, pure magenta background #ff00ff.",
    },
    {
      id: "enemy",
      type: "sprite",
      size: "1024x1024",
      quality,
      output: "public/assets/generated/enemy.png",
      fallback_output: "public/assets/generated/enemy.svg",
      prompt:
        "A centered 2D arcade enemy spaceship sprite, top-down view, neon pink and purple, clean silhouette, no text, pure magenta background #ff00ff.",
    },
  ],
};

async function ensureManifest() {
  try {
    await fsp.access(manifestPath);
  } catch {
    await fsp.writeFile(manifestPath, JSON.stringify(defaultManifest, null, 2));
  }
  return JSON.parse(await fsp.readFile(manifestPath, "utf8"));
}

function svgForAsset(asset) {
  if (asset.id === "background")
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024"><defs><radialGradient id="g" cx="50%" cy="20%" r="80%"><stop offset="0%" stop-color="#2837a8"/><stop offset="50%" stop-color="#0b102f"/><stop offset="100%" stop-color="#03040a"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>${Array.from({ length: 180 }, (_, i) => `<circle cx="${(i * 137) % 1536}" cy="${(i * 71) % 1024}" r="${i % 8 === 0 ? 2.4 : 1.2}" fill="${i % 8 === 0 ? "#ff4ecd" : "#bff9ff"}" opacity="0.85"/>`).join("")}</svg>`;
  if (asset.id === "enemy")
    return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#ff00ff"/><g filter="drop-shadow(0 0 22px #ff4ecd)"><path d="M256 390 L410 120 L256 200 L102 120 Z" fill="#ff4ecd"/><circle cx="256" cy="230" r="42" fill="#ffd6f4"/></g></svg>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#ff00ff"/><g filter="drop-shadow(0 0 22px #64f4ff)"><path d="M256 60 L390 430 L256 350 L122 430 Z" fill="#00d4ff"/><path d="M256 80 L310 350 L256 318 L202 350 Z" fill="#ffffff" opacity="0.85"/><ellipse cx="256" cy="430" rx="34" ry="58" fill="#ffb000"/></g></svg>`;
}

async function generateFallback(asset) {
  const out =
    asset.fallback_output || `public/assets/generated/${asset.id}.svg`;
  await fsp.mkdir(path.dirname(path.join(cwd, out)), { recursive: true });
  await fsp.writeFile(path.join(cwd, out), svgForAsset(asset));
  return out;
}

async function generateOpenAI(asset) {
  if (imageConfig.provider !== "openai")
    throw new Error(`Unsupported image provider: ${imageConfig.provider}`);
  if (
    !process.env.OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY.includes("your-openai")
  )
    throw new Error("OPENAI_API_KEY is missing or placeholder");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const result = await client.images.generate({
    model: imageConfig.model || "gpt-image-2",
    prompt: asset.prompt,
    size: asset.size || imageConfig.size || "1024x1024",
    quality: asset.quality || quality || imageConfig.quality || "low",
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error(`No image returned for ${asset.id}`);
  const out = asset.output || `public/assets/generated/${asset.id}.png`;
  await fsp.mkdir(path.dirname(path.join(cwd, out)), { recursive: true });
  await fsp.writeFile(path.join(cwd, out), Buffer.from(b64, "base64"));
  return out;
}

async function main() {
  const manifest = await ensureManifest();
  const outputs = [];
  for (const asset of manifest.assets) {
    try {
      const output = useOpenAI
        ? await generateOpenAI(asset)
        : await generateFallback(asset);
      outputs.push({
        id: asset.id,
        output,
        mode: useOpenAI ? "openai" : "fallback",
        image_model: useOpenAI ? imageConfig.model : undefined,
      });
    } catch (err) {
      const output = await generateFallback(asset);
      outputs.push({
        id: asset.id,
        output,
        mode: "fallback_after_error",
        image_model: imageConfig.model,
        error: String(err),
      });
    }
  }
  await fsp.writeFile(
    "asset_generation_report.json",
    JSON.stringify({ ok: true, imageConfig, outputs }, null, 2),
  );
  console.log(JSON.stringify({ ok: true, imageConfig, outputs }, null, 2));
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
