#!/usr/bin/env node
/**
 * smoke-dist.mjs — Raycast has no headless host to drive, so the closest thing
 * to an e2e run is checking the *shipped bundle*: `ray build` output must carry
 * every locale's text, which is the one failure mode that actually reaches
 * users (i18n.generated.ts not regenerated before publishing).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

execFileSync("npx", ["ray", "build", "-e", "dist", "-o", "dist", "--non-interactive"], { cwd: ROOT, stdio: "inherit" });

const bundles = fs
  .readdirSync(DIST)
  .filter((file) => file.endsWith(".js"))
  .map((file) => fs.readFileSync(path.join(DIST, file), "utf8"));
if (!bundles.length) throw new Error("dist has no bundles — ray build produced nothing");
// esbuild escapes non-ASCII in some positions; compare decoded text.
const source = bundles
  .join("\n")
  .replace(/\\u([0-9a-fA-F]{4})/g, (_whole, hex) => String.fromCharCode(parseInt(hex, 16)))
  .replace(/\\x([0-9a-fA-F]{2})/g, (_whole, hex) => String.fromCharCode(parseInt(hex, 16)));

const catalogues = fs
  .readdirSync(path.join(ROOT, "locales"))
  .filter((code) => fs.existsSync(path.join(ROOT, "locales", code, "messages.json")))
  .map((code) => ({ code, messages: JSON.parse(fs.readFileSync(path.join(ROOT, "locales", code, "messages.json"), "utf8")) }));

const missing = [];
for (const { code, messages } of catalogues) {
  // A unique sentence per language: if this is absent the catalogue never made
  // it into the bundle (or the translator fell back to English).
  const probe = messages.toastSetModel && messages.toastSetModel.message;
  if (!probe) missing.push(`${code}: catalogue has no toastSetModel`);
  else if (!source.includes(probe)) missing.push(`${code}: "${probe.slice(0, 40)}" missing from the bundle`);
}
if (missing.length) {
  console.error(`[smoke-dist] ${missing.length} locale(s) missing from dist:\n${missing.join("\n")}`);
  process.exit(1);
}

// The English source strings must still be the keys, otherwise fallback breaks.
for (const key of Object.keys(catalogues.find((entry) => entry.code === "en").messages)) {
  if (!source.includes(`"${key}"`)) {
    console.error(`[smoke-dist] key "${key}" missing from the bundle`);
    process.exit(1);
  }
}

console.log(`[smoke-dist] ${catalogues.length} locales present in ${bundles.length} bundle(s) — OK`);
