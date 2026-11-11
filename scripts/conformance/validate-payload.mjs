#!/usr/bin/env node
/**
 * Loads a host payload generator as REAL ESM and validates it with the kit.
 *
 *   node scripts/conformance/validate-payload.mjs <repoRoot> <module>
 *   node scripts/conformance/validate-payload.mjs <repoRoot> --self-test
 *   node scripts/conformance/validate-payload.mjs <repoRoot> --generate [module]
 *              (module defaults to conformance.json `payloadGenerator`)
 *
 *   <module>   generator bundled and validated → one JSON line:
 *              { ok: true, summary } | { ok: false, rule, error, detail? }
 *   --generate  generator bundled, called with the repo root, payload JSON
 *               printed on stdout (this is what `npm run conformance` consumes).
 *
 * Why a child process: Jest's module sandbox cannot `import()` ES modules
 * (it needs --experimental-vm-modules), and the payload generator lives in a
 * TypeScript Jest test with extension-less relative imports. Plain `node` loads
 * the kit natively; esbuild (already installed for the Raycast build) bundles
 * the generator into one ESM file first. No network: kit, fixtures and
 * generator all come from the repo.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [, , rootArg, moduleArg] = process.argv;

function finish(result) {
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exit(result.ok ? 0 : 1);
}

if (!rootArg) {
  console.error("usage: validate-payload.mjs <repoRoot> <module|--self-test|--generate>");
  process.exit(2);
}

const repoRoot = resolve(rootArg);
const kit = await import(pathToFileURL(join(repoRoot, "scripts/conformance/validate.mjs")).href);

if (moduleArg === "--self-test") {
  try {
    finish({ ok: true, summary: { selfTest: kit.selfTest() } });
  } catch (error) {
    finish({ ok: false, rule: "SELFTEST", error: error.message });
  }
}

let config;
try {
  config = JSON.parse(readFileSync(join(repoRoot, "conformance.json"), "utf8"));
} catch (error) {
  finish({ ok: false, rule: "CONFIG", error: `conformance.json: ${error.message}` });
}
if (config.spec !== kit.SPEC_VERSION) {
  finish({
    ok: false,
    rule: "CONFIG",
    error: `conformance.json targets spec ${config.spec}, kit is ${kit.SPEC_VERSION}`,
  });
}

// --generate has no module argument: the generator is named in conformance.json.
const generate = moduleArg === "--generate";
const moduleName = generate ? process.argv[4] || config.payloadGenerator || config.payload : moduleArg;
if (typeof moduleName !== "string" || !moduleName) {
  console.error("usage: validate-payload.mjs <repoRoot> <module|--self-test|--generate>");
  process.exit(2);
}

// The Raycast runtime only exists inside the app and the generator never calls
// it; @jest/globals must not run the suite's assertions in this process. Both
// are aliased to tiny stubs written next to the bundle (a temp dir we delete).
const buildDir = mkdtempSync(join(repoRoot, ".conformance-build-"));
const outfile = join(buildDir, "payload.generated.mjs");
const stubFile = join(buildDir, "raycast-api.mjs");
writeFileSync(stubFile, "export const getPreferenceValues = () => ({});\nexport default {};\n");
const jestStubFile = join(buildDir, "jest-globals.mjs");
writeFileSync(
  jestStubFile,
  [
    "export const describe = () => {};",
    "export const it = () => {};",
    "export const test = () => {};",
    "export const beforeAll = () => {};",
    "export const afterAll = () => {};",
    "export const beforeEach = () => {};",
    "export const afterEach = () => {};",
    "export const jest = { mock: () => {}, fn: () => () => {} };",
    "export const expect = () => new Proxy({}, { get: () => () => {} });",
    "",
  ].join("\n"),
);

// Bundle the generator into one ESM file: relative imports ("./util/providers")
// resolve at build time, TypeScript is stripped, and only Node built-ins plus
// node_modules stay external.
const esbuildArgs = [
  resolve(repoRoot, moduleName),
  "--bundle",
  "--packages=external",
  ...builtinModules.map((name) => `--external:${name}`),
  `--alias:@raycast/api=${pathToFileURL(stubFile).href}`,
  `--alias:@jest/globals=${pathToFileURL(jestStubFile).href}`,
  "--platform=node",
  "--format=esm",
  "--target=node22",
  "--log-level=error",
  // Jest provides __dirname/__filename in CJS; the ESM bundle derives them.
  "--define:__dirname=__conformanceDirname",
  "--define:__filename=__conformanceFilename",
  '--banner:js=import { fileURLToPath as __conformanceUrl } from "node:url"; import { dirname as __conformanceDir } from "node:path"; const __conformanceFilename = __conformanceUrl(import.meta.url); const __conformanceDirname = __conformanceDir(__conformanceFilename);',
  `--outfile=${outfile}`,
];

function bail(message) {
  rmSync(buildDir, { recursive: true, force: true });
  if (generate) {
    console.error(message);
    process.exit(1);
  }
  finish({ ok: false, rule: "PAYLOAD", error: message });
}

let payload;
try {
  const built = spawnSync(join(repoRoot, "node_modules", ".bin", "esbuild"), esbuildArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (built.status !== 0) {
    bail(`cannot bundle ${moduleName}: ${(built.stderr || "").trim()}`);
  }
  writeFileSync(join(buildDir, "package.json"), JSON.stringify({ type: "module" }));
  const generator = await import(pathToFileURL(outfile).href);
  const build = generator.buildPayload ?? generator.default;
  if (typeof build !== "function") bail(`${moduleName} exports neither buildPayload nor a default function`);
  payload = await build(repoRoot);
} catch (error) {
  bail(error.message);
}
rmSync(buildDir, { recursive: true, force: true });

if (generate) {
  process.stdout.write(JSON.stringify(payload) + "\n");
  process.exit(0);
}

try {
  finish({ ok: true, summary: kit.validatePayload(payload, config) });
} catch (error) {
  finish({ ok: false, rule: error.rule || error.name || "SPEC", error: error.message, detail: error.detail });
}
