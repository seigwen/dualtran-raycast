/**
 * Interface translation for the Raycast extension.
 *
 * Raycast has no i18n API and its metadata (command titles, preference labels)
 * is English-only by design — this module translates the *runtime* surfaces
 * (actions, sections, toasts), using the same 38 catalogues as the browser
 * extension. The bundle is generated at build time.
 */
import { LOCALES } from "./i18n.generated";

export function normalizeTag(tag: string | undefined | null): string {
  if (!tag || typeof tag !== "string") return "";
  const raw = tag.trim().replace(/_/g, "-").toLowerCase();
  if (!raw) return "";
  if (raw.indexOf("zh-hant") === 0 || raw === "zh-tw" || raw === "zh-hk" || raw === "zh-mo") return "zh_TW";
  if (raw.indexOf("zh-hans") === 0 || raw.indexOf("zh-cn") === 0 || raw === "zh" || raw === "zh-sg") return "zh_CN";
  if (raw.indexOf("zh-") === 0) return "zh_CN";
  if (raw === "pt-br") return "pt_BR";
  if (raw === "pt-pt" || raw === "pt") return "pt_PT";
  if (raw === "nb" || raw === "nb-no" || raw === "nn" || raw === "no-no") return "no";
  return raw.split("-")[0];
}

export function detectLocale(preferred: string | undefined | null): string {
  const codes = Object.keys(LOCALES);
  const exact = normalizeTag(preferred);
  if (!exact) return "en";
  const direct = codes.find((code) => code.toLowerCase() === exact.toLowerCase());
  if (direct) return direct;
  const base = codes.find((code) => code.toLowerCase().split("_")[0] === exact.split("-")[0]);
  return base || "en";
}

/** Raycast exposes no locale; the OS locale from Intl is the closest signal. */
export function systemLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || "en";
  } catch {
    return "en";
  }
}

function interpolate(text: string, subs?: Record<string, string | number>): string {
  if (!subs) return text;
  return text.replace(/\$([A-Z0-9_]+)\$/g, (whole, name) =>
    Object.prototype.hasOwnProperty.call(subs, name) ? String(subs[name]) : whole,
  );
}

export function createTranslator(preferred: string = systemLocale()) {
  const code = detectLocale(preferred);
  const table = LOCALES[code] || {};
  const fallback = LOCALES.en || {};
  const t = (key: string, subs?: Record<string, string | number>): string => {
    const entry = table[key] || fallback[key];
    return entry && typeof entry.message === "string" ? interpolate(entry.message, subs) : key;
  };
  return { code, t };
}

export const i18n = createTranslator();
export const t = i18n.t;
