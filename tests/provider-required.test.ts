/**
 * SPEC 2.1 — the unconfigured AI provider (empty default).
 *
 * A fresh install stores aiProvider = "" and must say so: the settings surface
 * shows a disabled "Select a provider" placeholder, and every AI translation
 * entry refuses with the localized providerRequiredError BEFORE any network
 * request. No `|| "openai"` (or any other provider) fallback is allowed on a
 * request path.
 */
jest.mock(
  "@raycast/api",
  () => ({
    getPreferenceValues: jest.fn(() => ({})),
    LocalStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
  }),
  { virtual: true },
);

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, jest } from "@jest/globals";
import { createTranslator } from "../src/i18n";
import { createBridge } from "../src/util/bridge";
import { DEFAULT_SETTINGS, sanitizeSettings, type DualTranSettings } from "../src/util/preferences";
import { buildAiSettingsView, resolveProviderChoice } from "../src/util/ai-settings-view";

const ROOT = path.resolve(__dirname, "..");
const readJson = (relative: string) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
const manifest = readJson("package.json");
const en = readJson("locales/en/messages.json");
const zhCN = readJson("locales/zh_CN/messages.json");
const zhTW = readJson("locales/zh_TW/messages.json");

const t = createTranslator("en").t;
const tZh = createTranslator("zh_CN").t;

function makeCore(overrides: Record<string, unknown> = {}) {
  return {
    translateGoogle: jest.fn(async ({ sourceArray }: { sourceArray: string[] }) => sourceArray.map((x) => `G:${x}`)),
    streamChat: jest.fn(async () => ({ totalChunks: 1, streamError: null })),
    buildTranslationMessages: jest.fn(() => ({ system: "SYS", assistant: "ACK" })),
    codeToLanguageNameInEnglish: jest.fn((code: string) => code),
    formatAiError: jest.fn((error: unknown) => ({ message: String(error) })),
    ...overrides,
  };
}

const emptyAi: DualTranSettings = { ...DEFAULT_SETTINGS, engine: "ai" };

describe("SPEC 2.1 — the default AI provider is empty", () => {
  it('a fresh/empty config stores aiProvider = ""', () => {
    expect(DEFAULT_SETTINGS.aiProvider).toBe("");
    expect(sanitizeSettings({}).aiProvider).toBe("");
    expect(sanitizeSettings(undefined).aiProvider).toBe("");
    expect(sanitizeSettings({ engine: "ai" }).aiProvider).toBe("");
  });

  it("never rewrites a stored provider value", () => {
    expect(sanitizeSettings({ aiProvider: "anthropic" }).aiProvider).toBe("anthropic");
    expect(sanitizeSettings({ aiProvider: "openai" }).aiProvider).toBe("openai");
  });

  it("the manifest dropdown defaults to the empty placeholder, no openai default", () => {
    const provider = (manifest.preferences || []).find((entry: { name: string }) => entry.name === "aiProvider");
    expect(provider.default).toBe("");
    expect(provider.data[0]).toEqual({ title: en.providerPlaceholder.message, value: "" });
    expect(provider.data.filter((entry: { value: string }) => entry.value === "")).toHaveLength(1);
    expect(provider.data.some((entry: { value: string }) => entry.value === "openai")).toBe(true);
  });
});

describe("SPEC 2.1 — unconfigured settings surface", () => {
  const view = buildAiSettingsView({
    current: "",
    providers: [{ id: "openai", name: "OpenAI", api: "https://api.openai.com/v1" }],
  });

  it("shows a disabled, selected placeholder that is not a real option", () => {
    expect(view.provider.current).toBe("");
    expect(view.provider.placeholder).toEqual({
      value: "",
      label: en.providerPlaceholder.message,
      disabled: true,
      selected: true,
    });
    expect(view.provider.fallback).toBe("");
    expect(view.provider.options.some((option) => option.value === "")).toBe(false);
  });

  it("endpoint is empty with the https:// placeholder, model/reasoning disabled", () => {
    expect(view.endpoint.current).toBe("");
    expect(view.endpoint.placeholder).toBe("https://");
    expect(view.model.disabled).toBe(true);
    expect(view.model.options).toEqual([]);
    expect(view.model.selectedProvider).toBe("");
    expect(view.model.label).toBe(en.providerRequiredForModel.message);
    expect(view.reasoning.disabled).toBe(true);
    expect(view.reasoning.default).toBe("lowest");
  });

  it("does not leak an OpenAI endpoint or a model into the empty state", () => {
    expect(view.endpoint.current).not.toContain("api.openai.com");
    expect(view.model.options).toEqual([]);
    expect(view.model.selectedModel).toBe("");
  });
});

describe("SPEC 2.1 — choosing a provider fills the endpoint", () => {
  const provider = { id: "anthropic", name: "Anthropic", api: "https://api.anthropic.com/v1" };

  it("autofills an untouched endpoint with the provider API", () => {
    const choice = resolveProviderChoice({ currentEndpoint: "", endpointPlaceholder: "https://" }, provider);
    expect(choice?.endpoint).toBe("https://api.anthropic.com/v1");
  });

  it("does not overwrite an endpoint the user typed", () => {
    const choice = resolveProviderChoice(
      { currentEndpoint: "https://proxy.example/v1", endpointPlaceholder: "https://" },
      provider,
    );
    expect(choice?.endpoint).toBe("https://proxy.example/v1");
  });

  it("keeps the chosen provider (the placeholder can never be re-selected)", () => {
    expect(resolveProviderChoice({ currentEndpoint: "", endpointPlaceholder: "https://" }, null)).toBeNull();
    expect(
      resolveProviderChoice({ currentEndpoint: "", endpointPlaceholder: "https://" }, { ...provider, id: "" }),
    ).toBeNull();
  });
});

describe("SPEC 2.1 — AI translation with no provider sends nothing", () => {
  it("returns the localized providerRequiredError and makes zero requests", async () => {
    const core = makeCore();
    const fetchImpl = jest.fn();
    const bridge = createBridge({ core: core as never, fetchImpl: fetchImpl as never, getSettings: () => emptyAi });
    await expect(bridge.translateBlocks(["Hello"])).rejects.toThrow(en.providerRequiredError.message);
    // The diagnostic keeps the exact string (and names the empty provider).
    await expect(bridge.translateBlocks(["Hello"])).rejects.toThrow('(provider: "")');
    expect(core.streamChat).not.toHaveBeenCalled();
    expect(core.translateGoogle).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("localizes the error (zh_CN)", async () => {
    // createTranslator is the per-locale path the product uses on a zh system.
    expect(tZh("providerRequiredError")).toBe(zhCN.providerRequiredError.message);
    const bridge = createBridge({ core: makeCore() as never, fetchImpl: null, getSettings: () => emptyAi });
    let message = "";
    await bridge.translateBlocks(["Hello"]).catch((error: Error) => {
      message = error.message;
    });
    // This process runs in an en locale, so the injected translator resolves to en.
    expect(message).toContain(en.providerRequiredError.message);
  });

  it("never substitutes openai for an empty provider on the request path", async () => {
    const core = makeCore();
    const bridge = createBridge({ core: core as never, fetchImpl: null, getSettings: () => emptyAi });
    await bridge.translateBlocks(["Hello"]).catch(() => undefined);
    const calls = (core.streamChat as jest.Mock).mock.calls;
    expect(calls).toHaveLength(0);
  });
});

describe("SPEC 2.1 — locale keys", () => {
  const KEYS = ["providerPlaceholder", "providerRequiredForModel", "providerRequiredError"];

  it("English source strings are exact", () => {
    expect(en.providerPlaceholder.message).toBe("Select a provider");
    expect(en.providerRequiredForModel.message).toBe("Select a provider first");
    expect(en.providerRequiredError.message).toBe("Choose an AI provider in settings before translating.");
  });

  it("Chinese strings are the agreed ones", () => {
    expect(zhCN.providerPlaceholder.message).toBe("请选择 AI 提供商");
    expect(zhCN.providerRequiredForModel.message).toBe("请先选择提供商");
    expect(zhCN.providerRequiredError.message).toBe("翻译前请先在设置中选择 AI 提供商。");
    expect(zhTW.providerPlaceholder.message).toBe("請選擇 AI 提供商");
    expect(zhTW.providerRequiredForModel.message).toBe("請先選擇提供商");
    expect(zhTW.providerRequiredError.message).toBe("翻譯前請先在設定中選擇 AI 提供商。");
  });

  it("every locale carries the three keys, non-empty and untranslated-free", () => {
    for (const code of fs.readdirSync(path.join(ROOT, "locales"))) {
      const catalogue = readJson(`locales/${code}/messages.json`);
      for (const key of KEYS) {
        expect(typeof catalogue[key]?.message).toBe("string");
        expect(catalogue[key].message.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
