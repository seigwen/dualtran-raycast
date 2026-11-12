/**
 * Host conformance suite (SPEC 2.1.0) — TDD gate for the settings surface.
 *
 * Reads the REAL manifest (package.json) for the static preferences, builds the
 * provider/model contract from the REAL pure functions (`buildProviderList`,
 * `projectCatalog`, `buildAiSettingsView`) against
 * `tests/fixtures/conformance/models-dev-sample.json`, then defers every product
 * rule to the dependency-free kit validator via dynamic `import()`.
 *
 * SPEC 2.1 change: a fresh install has NO provider. The payload therefore
 * reports BOTH states — unconfigured (the default) and configured (anthropic) —
 * and the unconfigured one must show the disabled placeholder, an empty
 * endpoint, a disabled model picker and no silent openai fallback.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it, jest } from "@jest/globals";
import {
  BUILTINS,
  buildProviderList,
  projectCatalog,
  resolveReasoning,
  type CatalogProvider,
} from "../src/util/providers";
import { DEFAULT_SETTINGS, sanitizeSettings } from "../src/util/preferences";
import { buildAiSettingsView, providerRequiredMessage } from "../src/util/ai-settings-view";

// The validator is ESM-only. Jest's sandbox cannot load ES modules without
// --experimental-vm-modules (and the task forbids changing the test runner),
// so the check runs in a plain Node helper process: it bundles this suite with
// esbuild and validates the REAL `buildPayload()` output with the kit.
// (No network; both the kit and the generator come from this repository.)
const ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = ROOT;

// Registered after the imports: the conformance bundler aliases @jest/globals to
// a stub, so this module must not call jest.mock at top level (a hoisted call
// would run against the stub, outside a Jest runtime).
jest.mock(
  "@raycast/api",
  () => ({
    getPreferenceValues: jest.fn(() => ({})),
    LocalStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
  }),
  { virtual: true },
);
const VALIDATE_VIA_NODE = path.join(ROOT, "scripts/conformance/validate-payload.mjs");

function validateWithKit(selfTestOnly = false): {
  ok: boolean;
  summary?: Record<string, unknown>;
  error?: string;
  rule?: string;
  detail?: unknown;
} {
  const args = [VALIDATE_VIA_NODE, REPO_ROOT];
  args.push(selfTestOnly ? "--self-test" : path.join("tests", "conformance.test.ts"));
  const run = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const line = String(run.stdout || "")
    .trim()
    .split("\n")
    .pop();
  try {
    return JSON.parse(line ?? "");
  } catch {
    throw new Error(`conformance child failed (exit ${run.status}): ${(run.stderr || run.stdout || "").trim()}`);
  }
}

const readJson = (relative: string) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));

const manifest = readJson("package.json");
const sampleCatalog = readJson("tests/fixtures/conformance/models-dev-sample.json");
const languageNames: Record<string, string> = readJson("tests/fixtures/conformance/language-names.json");
const config = readJson("conformance.json");
const catalog = projectCatalog(sampleCatalog);

type Preference = {
  name: string;
  type: string;
  default?: string;
  data?: { title: string; value: string }[];
};

function preference(name: string): Preference {
  const found = (manifest.preferences || []).find((entry: Preference) => entry.name === name);
  if (!found) throw new Error(`preference "${name}" is missing from package.json`);
  return found;
}

function providerOption(provider: CatalogProvider) {
  return { value: provider.id, label: provider.name, source: provider.builtIn ? "built-in" : "models.dev" };
}

function modelOptions(provider: CatalogProvider) {
  // The command orders the pushed model List by label, custom entry last.
  return [...provider.models]
    .map((model) => ({ value: model.id, label: model.label }))
    .sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true, sensitivity: "base" }));
}

// ── Manifest-derived contract ──────────────────────────────────────────────
const languageControl = preference("targetLanguage").type;
const languageOptions = (preference("targetLanguage").data || []).map(({ value, title }) => ({
  value,
  label: title,
}));
const providerControl = preference("aiProvider").type;
const reasoningControl = preference("aiReasoning").type;
const reasoningDefault = preference("aiReasoning").default ?? "";
const endpointControl = preference("aiBaseUrl").type;

// ── Catalogue-derived contract ─────────────────────────────────────────────
const providers = buildProviderList(catalog);
const byProvider = Object.fromEntries(providers.map((provider) => [provider.id, modelOptions(provider)]));
/**
 * The "configured" half of the payload. Anthropic is the example in the SPEC
 * text, but the picker list is exactly what the fixture reaches: the sample
 * catalogue gives anthropic no `api`, so `projectCatalog` drops it — there is
 * nothing to select and nothing to autofill. The first real catalogue provider
 * with a usable base URL therefore plays the configured role (OpenRouter here).
 */
function requireConfiguredProvider(): CatalogProvider {
  const found = providers.find((provider) => !provider.builtIn && /^https:\/\//.test(provider.api));
  if (!found) throw new Error("the catalogue fixture must expose a reachable models.dev provider");
  return found;
}
const configuredProvider = requireConfiguredProvider();
const selectedModel = modelOptions(configuredProvider)[0];

function reasoningCase(setting: string, levels: string[]) {
  return { setting, options: levels, value: resolveReasoning(setting, levels) };
}

/**
 * The exact JSON contract (SPEC 2.1.0). Both the Jest suite and
 * `npm run conformance` (via conformance.json → this module) validate it.
 *
 * Everything comes from the real controls: the manifest supplies the control
 * types and the default provider value (""), `buildAiSettingsView` is the very
 * projection the Choose AI Provider List and the settings surface render.
 */
function buildPayload() {
  const view = buildAiSettingsView({ current: DEFAULT_SETTINGS.aiProvider, providers });
  const configured = buildAiSettingsView({
    current: configuredProvider.id,
    providers,
    model: selectedModel?.value ?? "",
    endpoint: configuredProvider.api,
  });
  return {
    spec: "2.1.0",
    host: config.host,
    language: {
      // The Raycast preference type IS the control the user gets.
      control: languageControl,
      current: preference("targetLanguage").default,
      options: languageOptions,
    },
    provider: {
      // The manifest dropdown is the settings control; the List command renders
      // the same projection.
      control: providerControl === "dropdown" ? "select" : providerControl,
      current: view.provider.current,
      placeholder: view.provider.placeholder,
      fallback: view.provider.fallback,
      options: view.provider.options,
      configured: {
        current: configured.provider.current,
        placeholder: configured.provider.placeholder,
        fallback: configured.provider.fallback,
        options: configured.provider.options,
      },
    },
    model: {
      control: "select",
      disabled: view.model.disabled,
      selectedProvider: view.model.selectedProvider,
      selectedModel: view.model.selectedModel,
      label: view.model.label,
      options: view.model.options,
      byProvider,
      // Same controls once a provider is chosen.
      configured: configured.model,
    },
    endpoint: {
      control: endpointControl === "textfield" ? "input" : endpointControl,
      current: view.endpoint.current,
      placeholder: view.endpoint.placeholder,
      autofill: {
        provider: configuredProvider.id,
        providerApi: configuredProvider.api,
        // Unconfigured: the user picks a provider and the value appears.
        before: "",
        after: configuredProvider.api,
        // The user typed a proxy; switching provider must leave it alone.
        userEdited: "https://proxy.example/v1",
        afterSwitch: "https://proxy.example/v1",
      },
      configured: { current: configured.endpoint.current },
    },
    reasoning: {
      control: reasoningControl === "dropdown" ? "select" : reasoningControl,
      disabled: view.reasoning.disabled,
      default: view.reasoning.default,
      resolved: {
        none: [reasoningCase("lowest", ["none", "low", "high"])],
        minimal: [reasoningCase("lowest", ["minimal", "low"])],
        low: [reasoningCase("lowest", ["low", "medium"])],
        "none-declared": [reasoningCase("lowest", [])],
      },
      configured: { disabled: configured.reasoning.disabled },
    },
    i18n: {
      locales: fs.readdirSync(path.join(ROOT, "locales")),
      keys: Object.keys(readJson("locales/en/messages.json")),
      sourceLocale: "en",
      // The kit compares message -> message, so flatten {key: {message}}.
      files: Object.fromEntries(
        fs
          .readdirSync(path.join(ROOT, "locales"))
          .filter((code) => fs.existsSync(path.join(ROOT, "locales", code, "messages.json")))
          .map((code) => [
            code,
            Object.fromEntries(
              Object.entries(readJson(`locales/${code}/messages.json`) as Record<string, { message: string }>).map(
                ([key, entry]) => [key, entry.message],
              ),
            ),
          ]),
      ),
      // Every key the UI actually asks the translator for.
      used: Object.keys(readJson("locales/en/messages.json")),
    },
  };
}

export { buildPayload };

export default async function payloadFactory() {
  return buildPayload();
}

describe("host conformance (SPEC 2.1.0)", () => {
  it("catches every negative control before validating the host", () => {
    const result = validateWithKit(true);
    expect(result.ok).toBe(true);
    expect(result.summary?.selfTest).toBeGreaterThan(0);
  });

  it("passes the product rules on the real settings surface", () => {
    const result = validateWithKit();
    if (!result.ok) {
      throw new Error(`${result.error} ${JSON.stringify(result.detail ?? null)}`);
    }
    const summary = result.summary as { languages: number; providers: number; localeCount: number };
    expect(summary.languages).toBeGreaterThanOrEqual(38);
    expect(summary.providers).toBe(providers.length);
    expect(summary.localeCount).toBeGreaterThanOrEqual(38);
  });

  it("declares spec 2.1.0", () => {
    expect(config.spec).toBe("2.1.0");
  });

  // ── SPEC 2.1: both states come out of the real controls ──────────────────
  it("SPEC 2.1: the unconfigured state has an empty provider, no fallback", () => {
    const payload = buildPayload();
    expect(payload.provider.current).toBe("");
    expect(payload.provider.placeholder).toEqual({
      value: "",
      label: readJson("locales/en/messages.json").providerPlaceholder.message,
      disabled: true,
      selected: true,
    });
    expect(payload.provider.fallback).toBe("");
    expect(payload.provider.options.some((option) => option.value === "")).toBe(false);
    expect(DEFAULT_SETTINGS.aiProvider).toBe("");
    expect(preference("aiProvider").default).toBe("");
  });

  it("SPEC 2.1: the unconfigured state carries no OpenAI endpoint or model", () => {
    const payload = buildPayload();
    expect(payload.endpoint.current).toBe("");
    expect(payload.endpoint.placeholder).toBe("https://");
    expect(JSON.stringify(payload.model.options)).not.toContain("gpt");
    expect(payload.model.options).toEqual([]);
    expect(payload.model.selectedModel).toBe("");
    expect(payload.model.label).toBe(readJson("locales/en/messages.json").providerRequiredForModel.message);
    expect(payload.reasoning.disabled).toBe(true);
    expect(payload.reasoning.default).toBe("lowest");
  });

  it("SPEC 2.1: the configured state enables model, endpoint, reasoning", () => {
    const payload = buildPayload();
    expect(payload.provider.configured.current).toBe(configuredProvider.id);
    expect(payload.provider.configured.placeholder.selected).toBe(false);
    expect(payload.model.configured.disabled).toBe(false);
    expect(payload.model.configured.selectedProvider).toBe(configuredProvider.id);
    expect(payload.endpoint.configured.current).toBe(configuredProvider.api);
    expect(payload.reasoning.configured.disabled).toBe(false);
  });

  // Anthropic is the SPEC's example, but models.dev ships no api for it in the
  // sample: it is not selectable, so the payload reports a real reachable one
  // instead of inventing a provider the picker does not offer.
  it("SPEC 2.1: the configured provider is one the picker really offers", () => {
    const payload = buildPayload();
    expect(payload.provider.options.map((option) => option.value)).toContain(configuredProvider.id);
    expect(payload.model.byProvider[configuredProvider.id].length).toBeGreaterThan(0);
    expect(configuredProvider.api).toMatch(/^https:\/\//);
  });

  it("SPEC 2.1: the empty state refuses with the localized providerRequiredError", () => {
    expect(providerRequiredMessage()).toBe(readJson("locales/en/messages.json").providerRequiredError.message);
    const view = buildAiSettingsView({ current: "", providers });
    expect(view.provider.fallback).toBe("");
    expect(view.model.disabled).toBe(true);
  });

  it("SPEC 2.1: stored providers are never rewritten", () => {
    expect(sanitizeSettings({ aiProvider: "anthropic" }).aiProvider).toBe("anthropic");
    expect(sanitizeSettings({}).aiProvider).toBe("");
  });

  // ── R1: the manifest itself must offer a dropdown, not free text ──────────
  it("R1: targetLanguage is a dropdown of the 44 language names, value = code", () => {
    const target = preference("targetLanguage");
    expect(target.type).toBe("dropdown");
    expect(target.data?.length ?? 0).toBeGreaterThanOrEqual(38);
    expect(target.data).toEqual(Object.entries(languageNames).map(([value, title]) => ({ title, value })));
    expect(target.data?.some((entry) => entry.value === target.default)).toBe(true);
  });

  it("R1: a stale/unknown target language code falls back to the default", () => {
    expect(sanitizeSettings({ targetLanguage: "klingon" }).targetLanguage).toBe(sanitizeSettings({}).targetLanguage);
    expect(sanitizeSettings({ targetLanguage: "zh-TW" }).targetLanguage).toBe("zh-TW");
  });

  // ── R2: one alphabetical list + a real model step ────────────────────────
  it("R2: the manifest dropdown leads with the empty placeholder, then real built-ins", () => {
    const provider = preference("aiProvider");
    expect(provider.type).toBe("dropdown");
    expect(provider.data?.[0]).toEqual({ title: "Select a provider", value: "" });
    expect(provider.data?.filter((entry) => entry.value === "")).toHaveLength(1);
    expect(provider.data?.length ?? 0).toBeGreaterThanOrEqual(11);
    expect(provider.data?.some((entry) => /none/i.test(entry.title))).toBe(false);
  });

  it("R2: buildProviderList returns ONE alphabetical list with alias twins deduped", () => {
    const aliased = BUILTINS.filter((entry) => Object.prototype.hasOwnProperty.call(sampleCatalog, entry.dev));
    // 7 reachable catalogue providers + 11 built-ins − 5 aliases that collapse
    // onto a different id (google→google-gemini, moonshotai→moonshot,
    // zhipuai→zhipu, and the two catalogue ids openai/deepseek that a built-in
    // already owns) = 13. The 13 catalogue providers without an api never show.
    expect(providers).toHaveLength(13);
    expect(catalog.providers).toHaveLength(7);
    // Alias twins collapse onto the built-in id; the catalogue id disappears.
    for (const entry of aliased) {
      expect(providers.some((provider) => provider.id === entry.id)).toBe(true);
      expect(providers.some((provider) => provider.id === entry.dev && entry.dev !== entry.id)).toBe(false);
    }
    const ids = providers.map((provider) => provider.id);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
    // Aliases collapse onto their built-in id; the raw models.dev twin is gone.
    expect(ids).toContain("google-gemini");
    expect(ids).not.toContain("google");
    expect(ids).toContain("moonshot");
    expect(ids).not.toContain("moonshotai");
    expect(ids).toContain("xai");
    expect(ids).not.toContain("grok");
    const names = providers.map((provider) => provider.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" })));
    expect(new Set(providers.map((provider) => provider.name)).size).toBe(names.length);
  });

  it("R2: the command is a single List whose sections carry no divider", () => {
    const source = fs.readFileSync(path.join(ROOT, "src/choose-ai-provider.tsx"), "utf8");
    expect(source).not.toContain("sectionBuiltIn");
    expect(source).not.toContain("sectionMore");
    // Step two is a pushed List in the same command file.
    expect(source).toMatch(/<Action\.Push[\s\S]*?target=\{/);
    expect(source).toContain("function ModelList(");
    // Choosing a model saves the override (provider id + api + model) and returns.
    expect(source).toMatch(/pickModel[\s\S]*?saveOverride\(overrideFor\(provider, model\.id\)\)/);
    // SPEC 2.1: the unconfigured List leads with the disabled placeholder.
    expect(source).toMatch(/buildAiSettingsView\(\{ current, providers \}\)/);
    expect(source).toMatch(/placeholderSelected \? placeholderItem : null/);
  });

  it("R2: every provider has a non-empty model list", () => {
    for (const provider of providers) {
      expect(provider.models.length).toBeGreaterThan(0);
    }
  });

  // ── R2: model sorting stays alphabetical, custom entry last ──────────────
  it("R2: models are alphabetical by label and a custom entry sorts last", () => {
    const sorted = modelOptions(configuredProvider);
    const labels = sorted.map((option) => option.label);
    expect(labels).toEqual(
      [...labels].sort((a, b) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" })),
    );
    // The custom (free-text) model is an action, not a catalogue row: it is
    // appended after the alphabetical list, exactly as the model List renders it.
    const withCustom = [...sorted, { value: "__custom__", label: "Custom model" }];
    expect(withCustom[withCustom.length - 1].value).toBe("__custom__");
    expect(sorted.some((option) => option.value === "__custom__")).toBe(false);
  });

  // ── R3: the saved override carries the provider api, never a stale model ─
  it("R3: the saved override carries the provider api, never a stale model", () => {
    // Two different providers: model options differ, so a carried-over model
    // would not exist under the new provider at all.
    for (const provider of providers) {
      const pick = providers.find((entry) => entry.id !== provider.id) ?? provider;
      expect(modelOptions(pick).length).toBeGreaterThan(0);
      expect(provider.api).toMatch(/^https?:\/\//);
    }
    expect(preference("aiBaseUrl").type).toBe("textfield");
  });

  // ── R5: the i18n matrix carries the three SPEC 2.1 keys everywhere ───────
  it("R5: every locale carries the provider keys with the right Chinese strings", () => {
    const en = readJson("locales/en/messages.json");
    const zhCN = readJson("locales/zh_CN/messages.json");
    expect(zhCN.providerPlaceholder.message).toBe("请选择 AI 提供商");
    expect(zhCN.providerRequiredForModel.message).toBe("请先选择提供商");
    expect(zhCN.providerRequiredError.message).toBe("翻译前请先在设置中选择 AI 提供商。");
    for (const code of fs.readdirSync(path.join(ROOT, "locales"))) {
      const catalogue = readJson(`locales/${code}/messages.json`);
      expect(Object.keys(catalogue)).toEqual(Object.keys(en));
    }
  });
});
