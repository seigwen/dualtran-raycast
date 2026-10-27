/**
 * Host-agnostic translation bridge over @dualtran/core. Fully
 * dependency-injected ({ core, fetchImpl, getSettings }) so the unit suite
 * runs against a stub core with zero module mocking; only the integration
 * test touches the vendored core.
 */
import type { DualTranSettings } from "./preferences";

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
}

export type FetchLike = (url: string, init?: unknown) => Promise<FetchResponseLike>;

export interface CoreLike {
  translateGoogle(args: {
    sourceArray: string[];
    sourceLanguage: string;
    targetLanguage: string;
    cache: unknown;
    fetchImpl: FetchLike | null;
  }): Promise<string[]>;
  streamChat(args: {
    provider: string;
    reasoningDepth?: string;
    apiKey: string;
    model: string;
    messages: Array<{ role: string; content: string }>;
    extra?: Record<string, unknown>;
    store?: unknown;
    onChunk?: (text: string) => void;
  }): Promise<{ totalChunks: number; streamError: unknown }>;
  buildTranslationMessages(args: { content: string; targetLanguageName: string }): {
    system: string;
    assistant: string;
  };
  codeToLanguageNameInEnglish?(code: string): string;
  formatAiError(error: unknown): { message: string };
}

/** Trim every block, drop the ones that became empty, keep the order. */
export function normalizeBlocks(blocks: string[]): string[] {
  return blocks.map((block) => block.trim()).filter((block) => block.length > 0);
}

export function createBridge({
  core,
  fetchImpl,
  getSettings,
}: {
  core: CoreLike;
  fetchImpl: FetchLike | null;
  getSettings: () => DualTranSettings;
}) {
  async function translateBlocksAi(blocks: string[], settings: DualTranSettings): Promise<string[]> {
    const results: string[] = [];
    for (const content of blocks) {
      const targetLanguageName =
        (core.codeToLanguageNameInEnglish && core.codeToLanguageNameInEnglish(settings.targetLanguage)) ||
        settings.targetLanguage;
      const prompt = core.buildTranslationMessages({ content, targetLanguageName });
      // Message shape mirrors the extension's fetchSSE assembly so translation
      // quality matches the product.
      const messages = [
        { role: "system", content: prompt.system },
        { role: "user", content: "I understand. Please give me the text." },
        { role: "user", content },
      ];
      let text = "";
      const { totalChunks, streamError } = await core.streamChat({
        provider: settings.aiProvider,
        apiKey: settings.aiApiKey,
        model: settings.aiModel,
        messages,
        reasoningDepth: settings.aiReasoningDepth || "",
        extra: settings.aiBaseUrl ? { baseURL: settings.aiBaseUrl } : {},
        store: null,
        onChunk: (chunk) => {
          text += chunk;
        },
      });
      if (streamError) {
        throw new Error(core.formatAiError(streamError).message);
      }
      if (totalChunks === 0) {
        throw new Error("No response from AI provider");
      }
      results.push(text);
    }
    return results;
  }

  return {
    /**
     * Translate a batch of text blocks. Google goes out as ONE batched request
     * (the core builds it); AI streams one request per block. Empty input
     * short-circuits without touching the engine.
     */
    async translateBlocks(blocks: string[]): Promise<string[]> {
      const normalized = normalizeBlocks(blocks);
      if (normalized.length === 0) {
        return [];
      }
      const settings = getSettings();
      if (settings.engine === "ai") {
        return translateBlocksAi(normalized, settings);
      }
      return core.translateGoogle({
        sourceArray: normalized,
        sourceLanguage: settings.sourceLanguage,
        targetLanguage: settings.targetLanguage,
        cache: null,
        fetchImpl,
      });
    },
  };
}
