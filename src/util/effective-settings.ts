/**
 * Merge the Raycast preferences with the provider picked from the models.dev
 * list, then resolve the "lowest" reasoning sentinel against the model's own
 * declared levels. Runs before every AI translation.
 *
 * SPEC 2.1: an unconfigured provider stays empty here — nothing is ever
 * substituted for it. The bridge (and every entry point) refuses with the
 * localized providerRequiredError instead of sending a request.
 */
import { loadCatalog, loadOverride } from "./provider-cache";
import { levelsFor, resolveReasoning } from "./providers";
import { isProviderUnconfigured, type DualTranSettings } from "./preferences";

export async function withProviderOverrides(settings: DualTranSettings): Promise<DualTranSettings> {
  const override = await loadOverride();
  const aiProvider =
    override && !isProviderUnconfigured(override.id) ? override.id : String(settings.aiProvider ?? "").trim();
  const next: DualTranSettings = {
    ...settings,
    aiProvider,
    // An explicit model in the preferences wins; otherwise the override carries one.
    // An unconfigured provider has no model at all.
    aiModel: isProviderUnconfigured(aiProvider) ? "" : settings.aiModel || override?.model || "",
    aiBaseUrl: isProviderUnconfigured(aiProvider) ? "" : settings.aiBaseUrl || override?.api || "",
  };
  if (next.engine !== "ai") return next;
  // Nothing to resolve without a provider (or with no catalogue levels to read).
  if (isProviderUnconfigured(next.aiProvider)) return next;

  const catalog = await loadCatalog();
  next.aiReasoningDepth = resolveReasoning(next.aiReasoning, levelsFor(catalog, aiProvider, next.aiModel));
  return next;
}
