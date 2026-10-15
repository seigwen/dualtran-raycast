import { describe, expect, it } from "@jest/globals";
import { buildResultMarkdown } from "../src/util/markdown";
import { QUICK_TARGET_LANGUAGES } from "../src/util/languages";

describe("buildResultMarkdown", () => {
  it("shows the translation first and keeps the original below", () => {
    const md = buildResultMarkdown("Hola mundo", "Hello world", "English");
    expect(md).toContain("# Hola mundo");
    expect(md).toContain("Hello world");
    expect(md.indexOf("Hola mundo")).toBeLessThan(md.indexOf("Hello world"));
  });

  it("labels the target language in the original section", () => {
    const md = buildResultMarkdown("Hola", "Hello", "Spanish");
    expect(md).toContain("Spanish");
  });
});

describe("QUICK_TARGET_LANGUAGES", () => {
  it("has unique codes and includes the default target", () => {
    const codes = QUICK_TARGET_LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain("en");
    expect(codes).toContain("zh-CN");
  });
});
