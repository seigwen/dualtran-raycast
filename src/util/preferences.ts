import { getPreferenceValues } from "@raycast/api";

export type Engine = "google" | "ai";

export interface DualTranSettings {
  engine: Engine;
  sourceLanguage: string;
  targetLanguage: string;
  aiProvider: string;
  aiReasoning: string;
  aiApiKey: string;
  aiModel: string;
  aiBaseUrl: string;
  /** Resolved request value ("lowest" already expanded); never persisted. */
  aiReasoningDepth?: string;
}

/**
 * Target languages offered by the `targetLanguage` dropdown in package.json
 * (code → English name), in manifest order, so a stored value is validated
 * against exactly what the user can pick.
 */
export const TARGET_LANGUAGES: { code: string; name: string }[] = [
  { code: "af", name: "Afrikaans" },
  { code: "ar", name: "Arabic" },
  { code: "bg", name: "Bulgarian" },
  { code: "bn", name: "Bengali" },
  { code: "ca", name: "Catalan" },
  { code: "cs", name: "Czech" },
  { code: "da", name: "Danish" },
  { code: "de", name: "German" },
  { code: "el", name: "Greek" },
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "et", name: "Estonian" },
  { code: "fa", name: "Persian" },
  { code: "fi", name: "Finnish" },
  { code: "fr", name: "French" },
  { code: "he", name: "Hebrew" },
  { code: "hi", name: "Hindi" },
  { code: "hr", name: "Croatian" },
  { code: "hu", name: "Hungarian" },
  { code: "id", name: "Indonesian" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "lt", name: "Lithuanian" },
  { code: "lv", name: "Latvian" },
  { code: "ms", name: "Malay" },
  { code: "nl", name: "Dutch" },
  { code: "no", name: "Norwegian" },
  { code: "pl", name: "Polish" },
  { code: "pt", name: "Portuguese" },
  { code: "pt-BR", name: "Portuguese (Brazil)" },
  { code: "ro", name: "Romanian" },
  { code: "ru", name: "Russian" },
  { code: "sk", name: "Slovak" },
  { code: "sl", name: "Slovenian" },
  { code: "sr", name: "Serbian" },
  { code: "sv", name: "Swedish" },
  { code: "th", name: "Thai" },
  { code: "tr", name: "Turkish" },
  { code: "uk", name: "Ukrainian" },
  { code: "ur", name: "Urdu" },
  { code: "vi", name: "Vietnamese" },
  { code: "zh-CN", name: "Chinese (Simplified)" },
  { code: "zh-TW", name: "Chinese (Traditional)" },
];

const TARGET_LANGUAGE_CODES = new Set(TARGET_LANGUAGES.map((language) => language.code));

/** True when the code is one the target-language dropdown actually offers. */
export function isTargetLanguage(code: unknown): code is string {
  return typeof code === "string" && TARGET_LANGUAGE_CODES.has(code);
}

export const DEFAULT_SETTINGS: DualTranSettings = {
  engine: "google",
  sourceLanguage: "auto",
  targetLanguage: "en",
  aiProvider: "openai",
  aiReasoning: "lowest",
  aiApiKey: "",
  aiModel: "",
  aiBaseUrl: "",
};

/**
 * Coerce whatever the preferences surface returns into a valid settings
 * object: unknown engine values fall back to the default, non-string fields
 * fall back too.
 */
export function sanitizeSettings(raw: unknown): DualTranSettings {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const settings: DualTranSettings = { ...DEFAULT_SETTINGS };
  if (source.engine === "google" || source.engine === "ai") {
    settings.engine = source.engine;
  }
  const stringKeys = [
    "sourceLanguage",
    "targetLanguage",
    "aiProvider",
    "aiReasoning",
    "aiApiKey",
    "aiModel",
    "aiBaseUrl",
  ] as const;
  for (const key of stringKeys) {
    if (typeof source[key] === "string") {
      settings[key] = source[key] as string;
    }
  }
  // A stale code from an older manifest (or hand-edited storage) is not a
  // language the dropdown offers: fall back rather than send it to the engine.
  if (!isTargetLanguage(settings.targetLanguage)) {
    settings.targetLanguage = DEFAULT_SETTINGS.targetLanguage;
  }
  return settings;
}

/** Read the extension preferences (Raycast) and normalize them. */
export function loadSettings(): DualTranSettings {
  return sanitizeSettings(getPreferenceValues());
}
