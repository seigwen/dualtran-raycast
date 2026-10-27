/**
 * Provider catalogue for the Raycast commands.
 *
 * Raycast preferences are static JSON, so the built-in list lives in the
 * manifest and the long tail (models.dev) is picked from a List command and
 * remembered in LocalStorage. This module is pure: projection, ordering and
 * the "lowest" resolution are unit-tested without the Raycast runtime.
 */

export const MODELS_DEV_URL = "https://models.dev/api.json";

export interface BuiltInProvider {
  id: string;
  name: string;
  /** models.dev id this entry aliases (google-gemini → google). */
  dev: string;
  api: string;
  model: string;
}

export const BUILTINS: BuiltInProvider[] = [
  { id: "openai", name: "OpenAI", dev: "openai", api: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  { id: "google-gemini", name: "Google Gemini", dev: "google", api: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash" },
  { id: "deepseek", name: "DeepSeek", dev: "deepseek", api: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { id: "moonshot", name: "Moonshot", dev: "moonshotai", api: "https://api.moonshot.ai/v1", model: "kimi-k2-0905-preview" },
  { id: "zhipu", name: "Zhipu", dev: "zhipuai", api: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4.6" },
  { id: "groq", name: "Groq", dev: "groq", api: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  { id: "mistral", name: "Mistral", dev: "mistral", api: "https://api.mistral.ai/v1", model: "mistral-large-latest" },
  { id: "xai", name: "xAI", dev: "grok", api: "https://api.x.ai/v1", model: "grok-4" },
  { id: "openrouter", name: "OpenRouter", dev: "openrouter", api: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini" },
  { id: "siliconflow", name: "SiliconFlow", dev: "siliconflow", api: "https://api.siliconflow.cn/v1", model: "deepseek-ai/DeepSeek-V3" },
  { id: "ollama", name: "Ollama (local)", dev: "ollama", api: "http://localhost:11434/v1", model: "llama3.2" },
];

export const LEVEL_ORDER = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];

export interface CatalogModel {
  id: string;
  label: string;
}

export interface CatalogProvider {
  id: string;
  name: string;
  api: string;
  models: CatalogModel[];
  builtIn: boolean;
}

export interface ProjectedCatalog {
  providers: CatalogProvider[];
  modelsById: Record<string, CatalogModel[]>;
  reasoning: Record<string, Record<string, string[]>>;
}

type RawModel = { name?: string; reasoning_options?: Array<{ type?: string; values?: unknown }> };
type RawProvider = { name?: string; api?: string; models?: Record<string, RawModel> };

/** Effort values a model declares, in a stable order; a toggle model reports ["high"]. */
export function levelsOf(model: RawModel | undefined): string[] {
  const options = Array.isArray(model?.reasoning_options) ? model.reasoning_options : [];
  const effort = options.find((option) => option && option.type === "effort");
  if (effort && Array.isArray(effort.values)) {
    const values = effort.values.filter((value): value is string => typeof value === "string");
    const ordered = LEVEL_ORDER.filter((level) => values.includes(level));
    return ordered.concat(values.filter((value) => !LEVEL_ORDER.includes(value)));
  }
  return options.some((option) => option && option.type === "toggle") ? ["high"] : [];
}

/** Trim models.dev's api.json down to what the pickers need. */
export function projectCatalog(raw: unknown): ProjectedCatalog {
  const providers: CatalogProvider[] = [];
  const modelsById: Record<string, CatalogModel[]> = {};
  const reasoning: Record<string, Record<string, string[]>> = {};
  const entries = raw && typeof raw === "object" ? (raw as Record<string, RawProvider>) : {};
  for (const [id, entry] of Object.entries(entries)) {
    if (!entry || typeof entry !== "object") continue;
    const models: CatalogModel[] = [];
    const levels: Record<string, string[]> = {};
    for (const [modelId, model] of Object.entries(entry.models || {})) {
      models.push({ id: modelId, label: (model && model.name) || modelId });
      levels[modelId] = levelsOf(model);
    }
    reasoning[id] = levels;
    modelsById[id] = models;
    if (entry.api && models.length) {
      providers.push({ id, name: entry.name || id, api: entry.api, models, builtIn: false });
    }
  }
  providers.sort((a, b) => a.name.localeCompare(b.name));
  return { providers, modelsById, reasoning };
}

/** Built-ins first (registry order), then the catalogue alphabetically, alias twins removed. */
export function buildProviderList(catalog: ProjectedCatalog | null): CatalogProvider[] {
  const catalogue = (catalog && catalog.providers) || [];
  const modelsById = (catalog && catalog.modelsById) || {};
  const byId = new Map(catalogue.map((provider) => [provider.id, provider]));
  const claimed = new Set(BUILTINS.map((entry) => entry.dev));
  const out: CatalogProvider[] = BUILTINS.map((entry) => {
    const dev = byId.get(entry.dev);
    const models = (dev && dev.models) || modelsById[entry.dev] || [{ id: entry.model, label: entry.model }];
    return { id: entry.id, name: entry.name, api: entry.api, models, builtIn: true };
  });
  for (const provider of catalogue) {
    if (claimed.has(provider.id)) continue;
    if (BUILTINS.some((entry) => entry.id === provider.id)) continue;
    out.push({ ...provider, builtIn: false });
  }
  return out;
}

/** models.dev id behind a built-in alias. */
export function devIdFor(providerId: string): string {
  const builtIn = BUILTINS.find((entry) => entry.id === providerId);
  return builtIn ? builtIn.dev : providerId;
}

/** Turn the stored setting into the value to send; nothing declared → no parameter. */
export function resolveReasoning(setting: string | undefined, levels: string[] | undefined): string {
  if (!setting || setting === "default") return "";
  if (setting !== "lowest") return setting;
  const values = Array.isArray(levels) ? levels : [];
  for (const level of ["none", "minimal", "low"]) {
    if (values.includes(level)) return level;
  }
  return "";
}

/** Reasoning levels declared for a provider/model, [] when the catalogue is cold. */
export function levelsFor(catalog: ProjectedCatalog | null, providerId: string, modelId: string): string[] {
  if (!catalog) return [];
  const byProvider = catalog.reasoning[devIdFor(providerId)] || catalog.reasoning[providerId] || {};
  return byProvider[modelId] || [];
}
