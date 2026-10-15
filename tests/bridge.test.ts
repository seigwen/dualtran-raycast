import { describe, expect, it, jest } from "@jest/globals";
import { createBridge, normalizeBlocks } from "../src/util/bridge";

const googleSettings = {
  engine: "google" as const,
  sourceLanguage: "auto",
  targetLanguage: "en",
  aiProvider: "openai",
  aiApiKey: "",
  aiModel: "",
  aiBaseUrl: "",
};

function makeCore(overrides: Record<string, unknown> = {}) {
  return {
    translateGoogle: jest.fn(async ({ sourceArray }: { sourceArray: string[] }) => sourceArray.map((t) => `T:${t}`)),
    streamChat: jest.fn(async () => ({ totalChunks: 0, streamError: null })),
    buildTranslationMessages: jest.fn(() => ({ system: "SYS", assistant: "ACK" })),
    codeToLanguageNameInEnglish: jest.fn((c: string) => (c === "en" ? "English" : c)),
    formatAiError: jest.fn((e: { message?: string } | undefined) => ({ message: String((e && e.message) || e) })),
    ...overrides,
  };
}

describe("normalizeBlocks", () => {
  it("trims, drops empty entries and keeps order", () => {
    expect(normalizeBlocks(["  a  ", "", "   ", "b"])).toEqual(["a", "b"]);
  });
});

describe("createBridge — google engine", () => {
  it("delegates a normalized batch to core.translateGoogle with the injected fetch", async () => {
    const core = makeCore();
    const fetchImpl = jest.fn();
    const bridge = createBridge({ core: core as never, fetchImpl: fetchImpl as never, getSettings: () => googleSettings });
    const out = await bridge.translateBlocks(["Hello", "  World  ", ""]);
    expect(out).toEqual(["T:Hello", "T:World"]);
    expect(core.translateGoogle).toHaveBeenCalledTimes(1);
    const arg = (core.translateGoogle as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(arg.sourceArray).toEqual(["Hello", "World"]);
    expect(arg.sourceLanguage).toBe("auto");
    expect(arg.targetLanguage).toBe("en");
    expect(arg.fetchImpl).toBe(fetchImpl);
    expect(arg.cache).toBeNull();
  });

  it("short-circuits empty input without calling the engine", async () => {
    const core = makeCore();
    const bridge = createBridge({ core: core as never, fetchImpl: null, getSettings: () => googleSettings });
    expect(await bridge.translateBlocks(["", "  "])).toEqual([]);
    expect(core.translateGoogle).not.toHaveBeenCalled();
  });

  it("propagates engine failures (no silent empty translation)", async () => {
    const core = makeCore({
      translateGoogle: jest.fn(async () => {
        throw new Error("Google translation failed: HTTP 429");
      }),
    });
    const bridge = createBridge({ core: core as never, fetchImpl: null, getSettings: () => googleSettings });
    await expect(bridge.translateBlocks(["Hello"])).rejects.toThrow("Google translation failed: HTTP 429");
  });
});

describe("createBridge — ai engine", () => {
  const aiSettings = {
    ...googleSettings,
    engine: "ai" as const,
    aiApiKey: "k",
    aiModel: "gpt-test",
    aiBaseUrl: "https://proxy.example/v1",
  };

  it("streams one chat request per block and assembles the chunks", async () => {
    const core = makeCore({
      streamChat: jest.fn(async ({ onChunk }: { onChunk: (t: string) => void }) => {
        onChunk("Hola ");
        onChunk("mundo");
        return { totalChunks: 2, streamError: null };
      }),
    });
    const bridge = createBridge({ core: core as never, fetchImpl: null, getSettings: () => aiSettings });
    expect(await bridge.translateBlocks(["Hello world"])).toEqual(["Hola mundo"]);
    const arg = (core.streamChat as jest.Mock).mock.calls[0][0] as Record<string, never>;
    expect(arg.provider).toBe("openai");
    expect(arg.apiKey).toBe("k");
    expect(arg.model).toBe("gpt-test");
    expect(arg.extra).toEqual({ baseURL: "https://proxy.example/v1" });
    expect((arg.messages as { role: string }[]).map((m) => m.role)).toEqual(["system", "user", "user"]);
  });

  it("throws the formatted provider error when the stream reports one", async () => {
    const core = makeCore({
      streamChat: jest.fn(async () => ({ totalChunks: 0, streamError: { statusCode: 401 } })),
      formatAiError: jest.fn(() => ({ message: "Invalid or missing API key" })),
    });
    const bridge = createBridge({ core: core as never, fetchImpl: null, getSettings: () => aiSettings });
    await expect(bridge.translateBlocks(["x"])).rejects.toThrow("Invalid or missing API key");
  });

  it("throws when the stream produced no chunks", async () => {
    const core = makeCore({ streamChat: jest.fn(async () => ({ totalChunks: 0, streamError: null })) });
    const bridge = createBridge({ core: core as never, fetchImpl: null, getSettings: () => aiSettings });
    await expect(bridge.translateBlocks(["x"])).rejects.toThrow(/No response from AI provider/);
  });
});
