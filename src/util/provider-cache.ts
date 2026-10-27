/**
 * Persistence for the models.dev catalogue and the provider picked from it.
 *
 * Raycast preferences are static, so the long-tail provider cannot live there:
 * the Choose AI Provider command writes an override here and every translate
 * command prefers it over the preference value.
 */
import { LocalStorage } from "@raycast/api";
import { MODELS_DEV_URL, projectCatalog, type ProjectedCatalog } from "./providers";

const CATALOG_KEY = "dualtran.catalog.v1";
const OVERRIDE_KEY = "dualtran.providerOverride";
const TTL = 24 * 60 * 60 * 1000;

export interface ProviderOverride {
  id: string;
  name: string;
  api: string;
  model: string;
}

/** models.dev, cached for a day; a failed refresh falls back to the stale copy. */
export async function loadCatalog(force = false): Promise<ProjectedCatalog | null> {
  const raw = await LocalStorage.getItem<string>(CATALOG_KEY);
  let cached: { ts: number; data: ProjectedCatalog } | null = null;
  if (raw) {
    try {
      cached = JSON.parse(raw);
    } catch {
      cached = null;
    }
  }
  if (cached && !force && Date.now() - cached.ts < TTL) return cached.data;
  try {
    const res = await fetch(MODELS_DEV_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = projectCatalog(await res.json());
    await LocalStorage.setItem(CATALOG_KEY, JSON.stringify({ ts: Date.now(), data }));
    return data;
  } catch {
    return cached ? cached.data : null;
  }
}

export async function loadOverride(): Promise<ProviderOverride | null> {
  const raw = await LocalStorage.getItem<string>(OVERRIDE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.id === "string" ? (parsed as ProviderOverride) : null;
  } catch {
    return null;
  }
}

export async function saveOverride(override: ProviderOverride | null): Promise<void> {
  if (!override) {
    await LocalStorage.removeItem(OVERRIDE_KEY);
    return;
  }
  await LocalStorage.setItem(OVERRIDE_KEY, JSON.stringify(override));
}
