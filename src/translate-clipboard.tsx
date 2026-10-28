import { t } from "./i18n";
import { Action, ActionPanel, Clipboard, Detail } from "@raycast/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBridge } from "./util/bridge";
import { withProviderOverrides } from "./util/effective-settings";
import { loadSettings, DualTranSettings } from "./util/preferences";
import { buildResultMarkdown } from "./util/markdown";
import { QUICK_TARGET_LANGUAGES, languageName } from "./util/languages";
import * as core from "dualtran";

type State =
  { status: "loading" } | { status: "done"; translated: string; original: string } | { status: "error"; error: string };

export default function TranslateClipboard() {
  const settings = useMemo<DualTranSettings>(loadSettings, []);
  const [targetLanguage, setTargetLanguage] = useState(settings.targetLanguage);
  const [state, setState] = useState<State>({ status: "loading" });

  const run = useCallback(
    async (language: string) => {
      setState({ status: "loading" });
      try {
        const original = ((await Clipboard.readText()) ?? "").trim();
        if (!original) {
          throw new Error("The clipboard is empty.");
        }
        const effective = await withProviderOverrides({ ...settings, targetLanguage: language });
        const bridge = createBridge({
          core: core as never,
          fetchImpl: null,
          getSettings: () => effective,
        });
        const [translated] = await bridge.translateBlocks([original]);
        setState({ status: "done", translated: translated ?? "", original });
      } catch (error) {
        setState({ status: "error", error: error instanceof Error ? error.message : String(error) });
      }
    },
    [settings],
  );

  useEffect(() => {
    void run(targetLanguage);
  }, [run, targetLanguage]);

  if (state.status === "loading") {
    return <Detail isLoading markdown={`Translating to ${languageName(targetLanguage)}…`} />;
  }

  if (state.status === "error") {
    return (
      <Detail
        markdown={`⚠️ ${state.error}`}
        actions={
          <ActionPanel>
            <Action title={t("actionRetry")} onAction={() => void run(targetLanguage)} />
          </ActionPanel>
        }
      />
    );
  }

  return (
    <Detail
      markdown={buildResultMarkdown(state.translated, state.original, languageName(targetLanguage))}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title={t("actionCopy")} content={state.translated} />
          <Action.Paste title={t("actionPaste")} content={state.translated} />
          <ActionPanel.Section title={t("sectionTranslateInto")}>
            {QUICK_TARGET_LANGUAGES.map((language) => (
              <Action key={language.code} title={language.name} onAction={() => setTargetLanguage(language.code)} />
            ))}
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
