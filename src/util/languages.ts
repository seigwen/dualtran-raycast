/** Handy target languages offered as one-keystroke actions in the result view. */
export const QUICK_TARGET_LANGUAGES: { code: string; name: string }[] = [
  { code: "en", name: "English" },
  { code: "zh-CN", name: "简体中文" },
  { code: "zh-TW", name: "繁體中文" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "es", name: "Español" },
];

export function languageName(code: string): string {
  return QUICK_TARGET_LANGUAGES.find((l) => l.code === code)?.name ?? code;
}
