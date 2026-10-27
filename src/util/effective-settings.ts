/**
 * Merge the Raycast preferences with the provider picked from the models.dev
 * list, then resolve the "lowest" reasoning sentinel against the model's own
 * declared levels. Runs before every AI translation.
 */
import { loadCatalog, loadOverride } from "./provider-cache";
import { levelsFor, resolveReasoning } from "./providers";
import type { DualTranSettings } from "./preferences";

export async function withProviderOverrides(settings: DualTranSettings): Promise<DualTranSettings> {
  const override = await loadOverride();
  const aiProvider = override?.id || settings.aiProvider;
  const next: DualTranSettings = {
    ...settings,
    aiProvider,
    // An explicit model in the preferences wins; otherwise the override carries one.
    aiModel: settings.aiModel || override?.model || "",
    aiBaseUrl: settings.aiBaseUrl || override?.api || "",
  };
  if (next.engine !== "ai") return next;

  const catalog = await loadCatalog();
  next.aiReasoningDepth = resolveReasoning(next.aiReasoning, levelsFor(catalog, aiProvider, next.aiModel));
  return next;
}
