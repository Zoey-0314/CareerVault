import fs from "node:fs";
import path from "node:path";
import { evaluateCase, validateFixture } from "./ai-eval-core.mjs";

const ROOT = process.cwd();
const args = process.argv.slice(2);

function argValue(name, fallback = "") {
  const prefixed = `--${name}=`;
  const item = args.find((value) => value.startsWith(prefixed));
  return item ? item.slice(prefixed.length) : fallback;
}

const baseUrl = argValue("base-url", process.env.CAREERVAULT_EVAL_BASE_URL || "https://www.career-vault.xyz").replace(/\/$/, "");
const caseId = argValue("case");
const assetRoot = path.resolve(argValue("asset-dir", process.env.CAREERVAULT_EVAL_ASSET_DIR || "evals/private-assets"));
const fixtureRoot = path.join(ROOT, "evals", "fixtures");
const reportDir = path.join(ROOT, "evals", "reports");

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(target) : entry.name.endsWith(".json") ? [target] : [];
  });
}

function dataUrl(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === ".png" ? "image/png"
    : ext === ".webp" ? "image/webp"
    : ext === ".pdf" ? "application/pdf"
    : "image/jpeg";
  return `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`;
}

async function callCase(fixture) {
  if (fixture.kind === "credential") {
    const assetPath = path.join(assetRoot, fixture.assetFile);
    if (!fs.existsSync(assetPath)) return { skipped: true, reason: `missing asset: ${assetPath}` };
    const body = {
      credential: {
        type: fixture.request?.credential?.type || "certificate",
        name: fixture.request?.credential?.name || "",
        issuer: fixture.request?.credential?.issuer || "",
        date: fixture.request?.credential?.date || "",
        rank: fixture.request?.credential?.rank || "",
        description: fixture.request?.credential?.description || "",
        attachmentName: path.basename(assetPath),
        attachmentDataUrl: dataUrl(assetPath),
      },
    };
    return fetch(`${baseUrl}/api/credential`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": baseUrl },
      body: JSON.stringify(body),
    });
  }

  if (fixture.kind === "jd") {
    const assetPath = path.join(assetRoot, fixture.assetFile);
    if (!fs.existsSync(assetPath)) return { skipped: true, reason: `missing asset: ${assetPath}` };
    return fetch(`${baseUrl}/api/jd`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": baseUrl },
      body: JSON.stringify({ fileDataUrls: [dataUrl(assetPath)], filename: path.basename(assetPath) }),
    });
  }

  if (fixture.kind === "interview") {
    return fetch(`${baseUrl}/api/interview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": baseUrl },
      body: JSON.stringify(fixture.request),
    });
  }

  throw new Error(`Unsupported kind: ${fixture.kind}`);
}

const fixtures = walk(fixtureRoot)
  .map((file) => JSON.parse(fs.readFileSync(file, "utf8")))
  .filter((fixture) => !caseId || fixture.id === caseId);

if (!fixtures.length) {
  console.error(caseId ? `No eval fixture found for case ${caseId}` : "No eval fixtures found.");
  process.exit(1);
}

const reports = [];
for (const fixture of fixtures) {
  const errors = validateFixture(fixture);
  if (errors.length) {
    reports.push({ id: fixture.id, kind: fixture.kind, pass: false, error: errors.join("; ") });
    continue;
  }

  const result = await callCase(fixture);
  if (result?.skipped) {
    reports.push({ id: fixture.id, kind: fixture.kind, skipped: true, reason: result.reason });
    console.log(`↷ ${fixture.id}: ${result.reason}`);
    continue;
  }

  const response = await result.json().catch(() => null);
  if (!result.ok) {
    reports.push({ id: fixture.id, kind: fixture.kind, pass: false, httpStatus: result.status, response });
    console.log(`✗ ${fixture.id}: HTTP ${result.status}`);
    continue;
  }

  const report = evaluateCase(fixture, response);
  reports.push({ ...report, provider: response?.provider, model: response?.model });
  console.log(`${report.pass ? "✓" : "✗"} ${fixture.id} ${JSON.stringify(report.metrics)}`);
}

fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, "latest.json");
fs.writeFileSync(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  baseUrl,
  reports,
}, null, 2) + "\n");

const executed = reports.filter((item) => !item.skipped);
const failed = executed.filter((item) => item.pass === false);
console.log(`\nSaved report: ${path.relative(ROOT, reportPath)}`);
console.log(`Executed: ${executed.length}, failed: ${failed.length}, skipped: ${reports.length - executed.length}`);
if (failed.length) process.exit(1);
