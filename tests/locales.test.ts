/** Locale guards for the Raycast extension. */
import fs from "node:fs";
import path from "node:path";
import { createTranslator, detectLocale, normalizeTag } from "../src/i18n";

const ROOT = path.resolve(__dirname, "..");
const LOCALES = path.join(ROOT, "locales");
const EXPECTED = [
  "af", "ar", "ca", "cs", "da", "de", "el", "en", "es", "fa", "fi", "fr", "he", "hi", "hr",
  "hu", "is", "it", "ja", "ko", "lv", "nl", "no", "pl", "pt_BR", "pt_PT", "ro", "ru", "sl",
  "sr", "sv", "th", "tr", "ug", "uk", "vi", "zh_CN", "zh_TW",
];

const read = (code: string) => JSON.parse(fs.readFileSync(path.join(LOCALES, code, "messages.json"), "utf8"));
const en = read("en");
const enKeys = Object.keys(en);

test("ships the agreed 38 locales", () => {
  const codes = fs
    .readdirSync(LOCALES)
    .filter((code) => fs.existsSync(path.join(LOCALES, code, "messages.json")));
  expect(codes.sort()).toEqual([...EXPECTED].sort());
});

test("every locale carries every key, non-empty", () => {
  for (const code of EXPECTED) {
    const catalogue = read(code);
    expect(Object.keys(catalogue)).toEqual(enKeys);
    for (const key of enKeys) {
      expect(typeof catalogue[key].message).toBe("string");
      expect(catalogue[key].message.trim().length).toBeGreaterThan(0);
    }
    if (!code.startsWith("zh") && !code.startsWith("ja")) {
      expect(/[\u4e00-\u9fff]/.test(JSON.stringify(catalogue))).toBe(false);
    }
  }
});

test("the generated bundle matches the catalogues", () => {
  const generated = fs.readFileSync(path.join(ROOT, "src", "i18n.generated.ts"), "utf8");
  // Prettier may unquote plain identifiers, so accept both spellings.
  for (const code of EXPECTED) {
    expect(new RegExp(`(^|[\\s,{])"?${code}"?:\\s*\\{`, "m").test(generated)).toBe(true);
  }
});

test("locale detection folds the usual tags", () => {
  expect(normalizeTag("zh-CN")).toBe("zh_CN");
  expect(normalizeTag("zh-Hant-TW")).toBe("zh_TW");
  expect(normalizeTag("pt-BR")).toBe("pt_BR");
  expect(normalizeTag("nb-NO")).toBe("no");
  expect(detectLocale("de-AT")).toBe("de");
  expect(detectLocale("xx-YY")).toBe("en");
  expect(detectLocale(undefined)).toBe("en");
});

test("translator falls back to English and interpolates", () => {
  expect(createTranslator("de").t("actionRetry")).toBe(read("de").actionRetry.message);
  expect(createTranslator("de").t("actionRetry")).not.toBe("actionRetry");
  expect(createTranslator("zh_CN").t("toastModel", { MODEL: "gpt-4o" })).toContain("gpt-4o");
  expect(createTranslator("xx").t("toastUsingPreference")).toBe(en.toastUsingPreference.message);
});
