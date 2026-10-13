import fs from "node:fs/promises";
import path from "node:path";

const cwd = process.cwd();
const manifestPath = path.join(cwd, "asset_manifest.json");
const reportPath = path.join(cwd, "asset_generation_report.json");

const defaultsById = {
  background: {
    role: "background",
    type: "background",
    used_by: ["SceneBackground"],
    anchor: [0.5, 0.5],
    hitbox: null,
    fallback: "canvas_gradient",
  },
  player: {
    role: "player",
    type: "sprite",
    used_by: ["Player.draw"],
    anchor: [0.5, 0.5],
    hitbox: [72, 92],
    fallback: "canvas_ship",
  },
  enemy: {
    role: "enemy",
    type: "sprite",
    used_by: ["Enemy.draw"],
    anchor: [0.5, 0.5],
    hitbox: [70, 80],
    fallback: "canvas_enemy",
  },
  projectile: {
    role: "projectile",
    type: "effect",
    used_by: ["Bullet.draw"],
    anchor: [0.5, 0.5],
    hitbox: [8, 18],
    fallback: "canvas_bullet",
  },
  effect: {
    role: "effect",
    type: "effect",
    used_by: ["Explosion.draw"],
    anchor: [0.5, 0.5],
    hitbox: null,
    fallback: "canvas_particles",
  },
  ui_panel: {
    role: "ui",
    type: "ui",
    used_by: ["HUD.draw"],
    anchor: [0.5, 0.5],
    hitbox: null,
    fallback: "css_panel",
  },
};

function normalizeAsset(asset) {
  const d = defaultsById[asset.id] || {};
  const file =
    asset.output ||
    asset.file ||
    asset.fallback_output ||
    `public/assets/generated/${asset.id}.png`;
  return {
    id: asset.id,
    role: asset.role || d.role || asset.type || "game_asset",
    type: asset.type || d.type || "asset",
    file,
    output: asset.output || file,
    fallback_output: asset.fallback_output || undefined,
    prompt: asset.prompt || undefined,
    size: asset.size || undefined,
    hitbox: asset.hitbox ?? d.hitbox ?? null,
    anchor: asset.anchor || d.anchor || [0.5, 0.5],
    used_by: asset.used_by || d.used_by || [],
    fallback: asset.fallback || d.fallback || "canvas_shape",
    status: asset.status || "declared",
    generated_by: asset.generated_by || undefined,
    constraints: asset.constraints || {
      no_text_inside_image: true,
      do_not_copy_logos_or_protected_characters: true,
    },
  };
}

async function exists(rel) {
  if (!rel) return false;
  try {
    await fs.access(path.join(cwd, rel));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  let manifest = { game: "generated-game", assets: [] };
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch {}

  let report = { outputs: [] };
  try {
    report = JSON.parse(await fs.readFile(reportPath, "utf8"));
  } catch {}

  const outputsById = new Map((report.outputs || []).map((o) => [o.id, o]));
  const declared = new Map((manifest.assets || []).map((a) => [a.id, a]));

  for (const id of ["background", "player", "enemy"]) {
    if (!declared.has(id))
      declared.set(id, { id, output: `public/assets/generated/${id}.png` });
  }

  const assets = [];
  for (const [id, raw] of declared) {
    const out = outputsById.get(id);
    const asset = normalizeAsset({
      ...raw,
      output: out?.output || raw.output,
      generated_by: out?.image_model || raw.generated_by,
    });
    asset.status = (await exists(asset.output))
      ? "ready"
      : (await exists(asset.fallback_output))
        ? "fallback_ready"
        : "missing";
    asset.generation_mode = out?.mode || asset.generation_mode || "unknown";
    assets.push(asset);
  }

  const next = {
    ...manifest,
    schema_version: "v10-asset-manifest",
    generated_at: new Date().toISOString(),
    asset_contract: {
      text_rendering:
        "All UI text, numbers, score, health, and instructions must be rendered by Canvas/HTML/CSS, not baked into generated images.",
      required_bindings: [
        "file",
        "role",
        "used_by",
        "fallback",
        "hitbox",
        "anchor",
        "status",
      ],
      fallback_required: true,
    },
    assets,
  };

  await fs.writeFile(manifestPath, JSON.stringify(next, null, 2));
  const summary = {
    ok: assets.every(
      (a) => a.status === "ready" || a.status === "fallback_ready",
    ),
    total_assets: assets.length,
    ready_assets: assets.filter(
      (a) => a.status === "ready" || a.status === "fallback_ready",
    ).length,
    missing_assets: assets
      .filter((a) => a.status === "missing")
      .map((a) => a.id),
    manifest: "asset_manifest.json",
  };
  await fs.writeFile(
    "asset_validation_report.json",
    JSON.stringify(summary, null, 2),
  );
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
