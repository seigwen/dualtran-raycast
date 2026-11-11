import { Action, ActionPanel, Icon, Keyboard, List, Toast, showToast, useNavigation } from "@raycast/api";
import { t } from "./i18n";
import { useCallback, useEffect, useState } from "react";
import { buildProviderList, overrideFor, sortModels, type CatalogModel, type CatalogProvider } from "./util/providers";
import { loadCatalog, loadOverride, saveOverride } from "./util/provider-cache";
import { loadSettings } from "./util/preferences";

/**
 * The picker Raycast preferences cannot hold: every provider models.dev knows,
 * in ONE alphabetical list (the manifest aiProvider dropdown keeps only the
 * curated built-ins because it is static). Choosing a provider pushes the model
 * List; choosing a model saves { provider, model, api } and returns, so the
 * pick is remembered and a manifest refresh never loses it.
 */
export default function ChooseAiProvider() {
  const { pop } = useNavigation();
  const [providers, setProviders] = useState<CatalogProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [current, setCurrent] = useState("");
  const [currentModel, setCurrentModel] = useState("");

  const applyOverride = useCallback((override: { id: string; model: string } | null) => {
    setCurrent(override?.id || loadSettings().aiProvider);
    setCurrentModel(override?.model || "");
  }, []);

  const refresh = useCallback(
    async (force = false) => {
      setIsLoading(true);
      const [catalog, override] = await Promise.all([loadCatalog(force), loadOverride()]);
      setProviders(buildProviderList(catalog));
      applyOverride(override);
      setIsLoading(false);
      return catalog;
    },
    [applyOverride],
  );

  useEffect(() => {
    void (async () => {
      const [catalog, override] = await Promise.all([loadCatalog(), loadOverride()]);
      setProviders(buildProviderList(catalog));
      applyOverride(override);
      setIsLoading(false);
    })();
  }, [applyOverride]);

  async function pickModel(provider: CatalogProvider, model: CatalogModel) {
    // The override carries THIS provider's id + api + model: a model or endpoint
    // from a previously selected provider is never reused.
    await saveOverride(overrideFor(provider, model.id));
    setCurrent(provider.id);
    setCurrentModel(model.id);
    await showToast({
      style: Toast.Style.Success,
      title: provider.name,
      message: t("toastModel", { MODEL: model.id }),
    });
    // Back to the provider list; the checkmark now shows the saved pair.
    pop();
  }

  async function reset() {
    await saveOverride(null);
    applyOverride(null);
    await showToast({ style: Toast.Style.Success, title: t("toastUsingPreference") });
  }

  const providerItem = (provider: CatalogProvider) => (
    <List.Item
      key={provider.id}
      icon={provider.id === current ? Icon.CheckCircle : Icon.Circle}
      title={provider.name}
      subtitle={provider.id}
      accessories={[{ text: provider.id === current ? currentModel : "" }]}
      actions={
        <ActionPanel>
          <Action.Push
            title={t("actionUseProvider")}
            target={
              <ModelList provider={provider} models={sortModels(provider.models)} onPick={pickModel} onReset={reset} />
            }
          />
          <Action
            title={t("actionRefresh")}
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={() => void refresh(true)}
          />
          <Action title={t("actionReset")} onAction={() => void reset()} />
        </ActionPanel>
      }
    />
  );

  return (
    <List isLoading={isLoading} searchBarPlaceholder={t("searchProvider")}>
      {providers.map(providerItem)}
    </List>
  );
}

/** Step two: the chosen provider's models, alphabetical. */
function ModelList({
  provider,
  models,
  onPick,
  onReset,
}: {
  provider: CatalogProvider;
  models: CatalogModel[];
  onPick: (provider: CatalogProvider, model: CatalogModel) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  return (
    <List navigationTitle={provider.name} searchBarPlaceholder={t("searchModel")}>
      {models.map((model) => (
        <List.Item
          key={model.id}
          icon={Icon.Waveform}
          title={model.label}
          subtitle={model.id}
          actions={
            <ActionPanel>
              <Action title={t("actionUseModel")} onAction={() => void onPick(provider, model)} />
              <Action title={t("actionReset")} onAction={() => void onReset()} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
