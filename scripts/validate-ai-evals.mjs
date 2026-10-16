import fs from "node:fs";
import path from "node:path";
import { validateFixture } from "./ai-eval-core.mjs";

const ROOT = process.cwd();
const FIXTURE_ROOT = path.join(ROOT, "evals", "fixtures");

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(target) : entry.name.endsWith(".json") ? [target] : [];
  });
}

const files = walk(FIXTURE_ROOT);
if (!files.length) {
  console.error("No AI eval fixtures found.");
  process.exit(1);
}

let failed = false;
for (const file of files) {
  const fixture = JSON.parse(fs.readFileSync(file, "utf8"));
  const errors = validateFixture(fixture);
  if (errors.length) {
    failed = true;
    console.error(`✗ ${path.relative(ROOT, file)}\n  - ${errors.join("\n  - ")}`);
  } else {
    console.log(`✓ ${fixture.id} [${fixture.kind}]`);
  }
}

if (failed) process.exit(1);
console.log(`Validated ${files.length} AI eval fixture(s).`);
