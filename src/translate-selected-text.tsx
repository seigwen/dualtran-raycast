import { Action, ActionPanel, Detail, getSelectedText } from "@raycast/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBridge } from "./util/bridge";
import { loadSettings, DualTranSettings } from "./util/preferences";
import { buildResultMarkdown } from "./util/markdown";
import { QUICK_TARGET_LANGUAGES, languageName } from "./util/languages";
import * as core from "dualtran";

type State =
  { status: "loading" } | { status: "done"; translated: string; original: string } | { status: "error"; error: string };

export default function TranslateSelectedText() {
  const settings = useMemo<DualTranSettings>(loadSettings, []);
  const [targetLanguage, setTargetLanguage] = useState(settings.targetLanguage);
  const [state, setState] = useState<State>({ status: "loading" });

  const run = useCallback(
    async (language: string) => {
      setState({ status: "loading" });
      try {
        const selected = (await getSelectedText()).trim();
        if (!selected) {
          throw new Error("Nothing is selected — select some text first.");
        }
        const bridge = createBridge({
          core: core as never,
          fetchImpl: null,
          getSettings: () => ({ ...settings, targetLanguage: language }),
        });
        const [translated] = await bridge.translateBlocks([selected]);
        setState({ status: "done", translated: translated ?? "", original: selected });
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
            <Action title="Retry" onAction={() => void run(targetLanguage)} />
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
          <Action.CopyToClipboard title="Copy Translation" content={state.translated} />
          <Action.Paste title="Paste Translation" content={state.translated} />
          <ActionPanel.Section title="Translate into">
            {QUICK_TARGET_LANGUAGES.map((language) => (
              <Action key={language.code} title={language.name} onAction={() => setTargetLanguage(language.code)} />
            ))}
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
