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
  return settings;
}

/** Read the extension preferences (Raycast) and normalize them. */
export function loadSettings(): DualTranSettings {
  return sanitizeSettings(getPreferenceValues());
}
