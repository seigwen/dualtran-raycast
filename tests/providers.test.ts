import { describe, expect, it } from "@jest/globals";
import {
  BUILTINS,
  buildProviderList,
  levelsFor,
  levelsOf,
  projectCatalog,
  resolveReasoning,
} from "../src/util/providers";

const raw = {
  openai: {
    name: "OpenAI",
    models: {
      "gpt-5": { reasoning_options: [{ type: "effort", values: ["minimal", "low", "medium"] }] },
      "gpt-4o": {},
    },
  },
  moonshot: { name: "Moonshot", api: "https://api.moonshot.cn/v1", models: { "kimi-k2": {} } },
  moonshotai: { name: "Moonshot AI", api: "https://api.moonshot.ai/v1", models: { "kimi-k2": {} } },
  google: {
    name: "Google",
    api: "https://generativelanguage.googleapis.com/v1beta",
    models: { "gemini-2.5-pro": { reasoning_options: [{ type: "effort", values: ["high", "low"] }] } },
  },
  toggleonly: { name: "Toggle Only", api: "https://toggle.example/v1", models: { thinker: { reasoning_options: [{ type: "toggle" }] } } },
  "no-api": { name: "No API", models: { m: {} } },
};

describe("projectCatalog", () => {
  it("keeps reachable providers and indexes levels for every model", () => {
    const { providers, modelsById, reasoning } = projectCatalog(raw);
    const ids = providers.map((provider) => provider.id);
    expect(ids).toContain("moonshot");
    expect(ids).not.toContain("no-api");
    expect(modelsById.openai.map((model) => model.id)).toEqual(["gpt-5", "gpt-4o"]);
    expect(reasoning.openai["gpt-5"]).toEqual(["minimal", "low", "medium"]);
    expect(reasoning.google["gemini-2.5-pro"]).toEqual(["low", "high"]);
    expect(reasoning.openai["gpt-4o"]).toEqual([]);
  });

  it("treats a toggle model as ON-only", () => {
    expect(levelsOf({ reasoning_options: [{ type: "toggle" }] })).toEqual(["high"]);
    expect(levelsOf(undefined)).toEqual([]);
  });
});

describe("buildProviderList", () => {
  it("puts the built-ins first and drops models.dev alias twins", () => {
    const list = buildProviderList(projectCatalog(raw));
    expect(list.slice(0, BUILTINS.length).every((provider) => provider.builtIn)).toBe(true);
    expect(list.filter((provider) => provider.id === "moonshot" || provider.id === "moonshotai")).toHaveLength(1);
    expect(list.find((provider) => provider.id === "openai")?.models.map((model) => model.id)).toContain("gpt-5");
  });

  it("survives a cold catalogue", () => {
    const list = buildProviderList(null);
    expect(list).toHaveLength(BUILTINS.length);
    expect(list[0].models[0].id).toBe(BUILTINS[0].model);
  });
});

describe("resolveReasoning", () => {
  it("maps lowest onto the model's own levels", () => {
    expect(resolveReasoning("lowest", ["minimal", "low"])).toBe("minimal");
    expect(resolveReasoning("lowest", ["low", "high"])).toBe("low");
    expect(resolveReasoning("lowest", ["none"])).toBe("none");
    expect(resolveReasoning("lowest", ["high"])).toBe("");
    expect(resolveReasoning("lowest", [])).toBe("");
    expect(resolveReasoning(undefined, ["low"])).toBe("");
    expect(resolveReasoning("default", ["low"])).toBe("");
    expect(resolveReasoning("medium", ["low", "medium"])).toBe("medium");
  });

  it("reads levels through the built-in alias", () => {
    const catalog = projectCatalog(raw);
    expect(levelsFor(catalog, "google-gemini", "gemini-2.5-pro")).toEqual(["low", "high"]);
    expect(levelsFor(catalog, "openai", "gpt-5")).toEqual(["minimal", "low", "medium"]);
    expect(levelsFor(null, "openai", "gpt-5")).toEqual([]);
  });
});
