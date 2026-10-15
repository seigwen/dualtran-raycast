#!/usr/bin/env node
/**
 * Vendored-core smoke — loads vendor/dualtran-core.tgz through the REAL Node
 * ESM loader (jest's transform cannot process the core's .mjs bundle) and runs
 * a Google translation against a canned response. Wired into `npm test`.
 */
import assert from "node:assert/strict";

const core = await import("dualtran");

assert.equal(typeof core.translateGoogle, "function", "translateGoogle missing from the vendored core");
assert.equal(typeof core.streamChat, "function", "streamChat missing from the vendored core");
assert.equal(typeof core.buildTranslationMessages, "function", "buildTranslationMessages missing from the vendored core");

const calls = [];
const out = await core.translateGoogle({
  sourceArray: ["Hello world"],
  sourceLanguage: "auto",
  targetLanguage: "fr",
  cache: null,
  fetchImpl: async (url) => {
    calls.push(url);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify([[["Bonjour le monde", "Hello world", null, null, 10]], null, "en"]),
    };
  },
});

assert.deepEqual(out, ["Bonjour le monde"]);
assert.equal(calls.length, 1, "expected exactly one batched request");
assert.ok(calls[0].includes("translate.googleapis.com"), `unexpected request URL: ${calls[0]}`);

console.log("[smoke-core] vendored @dualtran/core loads and translates — OK");
