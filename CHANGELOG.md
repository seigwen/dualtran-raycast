# DualTran Changelog

## [Interface languages] - {PR_MERGE_DATE}

- Actions, sections and toasts follow the system language: 38 catalogues
  (`locales/<code>/messages.json`), bundled at build time into
  `src/i18n.generated.ts`. Raycast's own metadata (command titles, preference
  labels) is English-only by platform design.

## [Initial Version] - {PR_MERGE_DATE}

- Translate selected text or the clipboard into a second language using Google
  or your own AI model (BYOK, 20+ providers).
- Actions: copy the translation, paste it into the frontmost app, and switch
  the target language on the spot.
