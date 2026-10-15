/**
 * Detail-view markdown: the translation on top, the original kept below so the
 * user can compare at a glance.
 */
export function buildResultMarkdown(translated: string, original: string, targetLanguageName: string): string {
  return [`# ${translated}`, "", "---", "", `## Original (${targetLanguageName})`, "", original, ""].join("\n");
}
