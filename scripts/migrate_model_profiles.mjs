import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const file = path.join(root, "config/model-profiles.json");
const all = JSON.parse(fs.readFileSync(file, "utf8"));

const defaultImage = {
  provider: "openai",
  model: "gpt-image-2",
  quality: "low",
  size: "1024x1024",
  outputFormat: "png",
  background: "auto",
};

for (const profile of Object.values(all.profiles || {})) {
  if (!profile.imageGeneration) profile.imageGeneration = { ...defaultImage };
  if (!profile.providerOptions) profile.providerOptions = {};
}

if (!all.active) all.active = "balanced";
fs.writeFileSync(file, JSON.stringify(all, null, 2));
console.log(
  "Migrated model-profiles.json: ensured imageGeneration and providerOptions exist.",
);
