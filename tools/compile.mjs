// Compile packs-src/<pack>/*.json into LevelDB compendium packs under packs/<pack>.
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "packs-src");
const dest = path.join(root, "packs");
fs.rmSync(dest, { recursive: true, force: true });
for (const pack of fs.readdirSync(src)) {
  await compilePack(path.join(src, pack), path.join(dest, pack), { log: false });
  console.log(`compiled ${pack}`);
}
