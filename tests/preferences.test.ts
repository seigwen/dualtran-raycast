/**
 * Locks the virtual-mock pattern for @raycast/api (the module only exists in
 * the Raycast runtime): preferences loading is tested through a virtual mock.
 */
jest.mock("@raycast/api", () => ({ getPreferenceValues: jest.fn() }), { virtual: true });

import { describe, expect, it, jest } from "@jest/globals";
import { getPreferenceValues } from "@raycast/api";
import {
  DEFAULT_SETTINGS,
  TARGET_LANGUAGES,
  isTargetLanguage,
  loadSettings,
  sanitizeSettings,
} from "../src/util/preferences";

describe("sanitizeSettings", () => {
  it("returns defaults for malformed input", () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings("nope")).toEqual(DEFAULT_SETTINGS);
  });

  it("merges partial data over the defaults", () => {
    expect(sanitizeSettings({ engine: "ai", aiApiKey: "k" })).toEqual({
      ...DEFAULT_SETTINGS,
      engine: "ai",
      aiApiKey: "k",
    });
  });

  it("rejects an unknown engine value and non-string fields", () => {
    expect(sanitizeSettings({ engine: "yandex", targetLanguage: 7 })).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps a target language the dropdown offers, including regional codes", () => {
    for (const code of ["en", "ja", "zh-CN", "zh-TW", "pt-BR", "ur"]) {
      expect(sanitizeSettings({ targetLanguage: code }).targetLanguage).toBe(code);
    }
  });

  it("falls back to the default for a target language the dropdown does not offer", () => {
    for (const stale of ["klingon", "", "zh", "EN", "auto"]) {
      expect(sanitizeSettings({ targetLanguage: stale }).targetLanguage).toBe(DEFAULT_SETTINGS.targetLanguage);
    }
  });

  it("offers at least 38 distinct target languages", () => {
    expect(TARGET_LANGUAGES.length).toBeGreaterThanOrEqual(38);
    expect(new Set(TARGET_LANGUAGES.map((language) => language.code)).size).toBe(TARGET_LANGUAGES.length);
    expect(isTargetLanguage(DEFAULT_SETTINGS.targetLanguage)).toBe(true);
    expect(isTargetLanguage(undefined)).toBe(false);
  });
});

describe("loadSettings", () => {
  it("reads and sanitizes the Raycast preferences", () => {
    (getPreferenceValues as jest.Mock).mockReturnValue({
      engine: "ai",
      sourceLanguage: "auto",
      targetLanguage: "fr",
      aiProvider: "anthropic",
      aiApiKey: "key-123",
      aiModel: "claude-x",
      aiBaseUrl: "",
    });
    const settings = loadSettings();
    expect(settings.engine).toBe("ai");
    expect(settings.targetLanguage).toBe("fr");
    expect(settings.aiProvider).toBe("anthropic");
  });
});
