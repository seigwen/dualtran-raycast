import { Action, ActionPanel, Icon, Keyboard, List, Toast, showToast } from "@raycast/api";
import { t } from "./i18n";
import { useCallback, useEffect, useState } from "react";
import { buildProviderList, type CatalogProvider } from "./util/providers";
import { loadCatalog, loadOverride, saveOverride } from "./util/provider-cache";
import { loadSettings } from "./util/preferences";

/**
 * The dropdown Raycast preferences cannot hold: every provider models.dev
 * knows, behind the same "built-in first, then More" split as the other
 * DualTran surfaces. The pick is remembered in LocalStorage, so a manifest
 * refresh never loses it.
 */
export default function ChooseAiProvider() {
  const [providers, setProviders] = useState<CatalogProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [current, setCurrent] = useState("");

  const refresh = useCallback(async (force = false) => {
    setIsLoading(true);
    const [catalog, override] = await Promise.all([loadCatalog(force), loadOverride()]);
    setProviders(buildProviderList(catalog));
    if (!override) setCurrent(loadSettings().aiProvider);
    setIsLoading(false);
    return catalog;
  }, []);

  useEffect(() => {
    void (async () => {
      const [catalog, override] = await Promise.all([loadCatalog(), loadOverride()]);
      setProviders(buildProviderList(catalog));
      setCurrent(override?.id || loadSettings().aiProvider);
      setIsLoading(false);
    })();
  }, []);

  async function pick(provider: CatalogProvider) {
    const model = provider.models[0]?.id || "";
    await saveOverride({ id: provider.id, name: provider.name, api: provider.api, model });
    setCurrent(provider.id);
    await showToast({
      style: Toast.Style.Success,
      title: provider.name,
      message: model ? t("toastModel", { MODEL: model }) : t("toastSetModel"),
    });
  }

  async function reset() {
    await saveOverride(null);
    setCurrent(loadSettings().aiProvider);
    await showToast({ style: Toast.Style.Success, title: t("toastUsingPreference") });
  }

  const builtIns = providers.filter((provider) => provider.builtIn);
  const catalogue = providers.filter((provider) => !provider.builtIn);

  const item = (provider: CatalogProvider) => (
    <List.Item
      key={provider.id}
      icon={provider.id === current ? Icon.CheckCircle : Icon.Circle}
      title={provider.name}
      subtitle={provider.id}
      accessories={[{ text: provider.models[0]?.id || "" }]}
      actions={
        <ActionPanel>
          <Action title={t("actionUseProvider")} onAction={() => void pick(provider)} />
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
    <List isLoading={isLoading} searchBarPlaceholder="Search providers from models.dev">
      <List.Section title={t("sectionBuiltIn")} subtitle={String(builtIns.length)}>
        {builtIns.map(item)}
      </List.Section>
      <List.Section title={t("sectionMore")} subtitle={String(catalogue.length)}>
        {catalogue.map(item)}
      </List.Section>
    </List>
  );
}
