import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "@jest/globals";

/**
 * Raycast can only run on macOS inside the Raycast app, so this repository has
 * no host-level E2E (see DualTran-manage/94-host-e2e-plan.md). These checks lock
 * the manifest contract that a host E2E would otherwise catch: the command the
 * docs tell people to run, and the preference shape the code reads.
 */
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));

function preference(name: string) {
  return (manifest.preferences || []).find((entry: { name: string }) => entry.name === name);
}

describe("Raycast manifest contract", () => {
  it("ships the Choose AI Provider command", () => {
    const command = (manifest.commands || []).find(
      (entry: { name: string }) => entry.name === "choose-ai-provider"
    );
    expect(command).toBeDefined();
    expect(command.mode).toBe("view");
    expect(fs.existsSync(path.join(__dirname, "..", "src", "choose-ai-provider.tsx"))).toBe(true);
  });

  it("keeps provider and reasoning as dropdowns", () => {
    const provider = preference("aiProvider");
    expect(provider.type).toBe("dropdown");
    expect(provider.default).toBe("openai");
    expect(provider.data.length).toBeGreaterThanOrEqual(10);

    const reasoning = preference("aiReasoning");
    expect(reasoning.type).toBe("dropdown");
    expect(reasoning.default).toBe("lowest");
    const values = reasoning.data.map((entry: { value: string }) => entry.value);
    expect(values[0]).toBe("lowest");
    expect(values).toContain("high");
  });

  it("keeps the API key as a password field, never a plain textfield", () => {
    expect(preference("aiApiKey").type).toBe("password");
  });
});
