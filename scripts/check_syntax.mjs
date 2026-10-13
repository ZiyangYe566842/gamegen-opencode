import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

for (const folder of ["bin", "scripts", "tests"]) {
  for (const name of fs
    .readdirSync(folder)
    .filter((name) => name.endsWith(".mjs"))) {
    const file = path.join(folder, name);
    const result = spawnSync(process.execPath, ["--check", file], {
      stdio: "inherit",
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
console.log("JavaScript syntax checks passed.");
