# DualTran for Raycast

Translate the selected text or the clipboard with **Google** or your own AI
model (BYOK, 20+ providers) — without leaving the keyboard. Powered by
`@dualtran/core`, the engine extracted from the
[DualTran browser extension](https://github.com/seigwen/DualTran-extension).

## Commands

- **Translate Selected Text** — translates the selection, shows it with the
  original below; actions: Copy, Paste into the frontmost app, or switch the
  target language on the spot.
- **Translate Clipboard** — same for whatever is on the clipboard.

## Preferences

Engine (Google / AI), source & target language, and for AI mode: provider id,
API key, model and an optional base URL override.

## Languages

Runtime surfaces (actions, sections, toasts) ship **38 language catalogues** —
the same set as the browser extension — and follow the system language through
`Intl.DateTimeFormat().resolvedOptions().locale`, falling back to English.
Raycast metadata (command titles, preference labels) is English-only by
platform design.

```bash
npm run i18n:sync    # fill every catalogue
npm run i18n:check   # missing key / empty value / lost placeholder → fail
npm run i18n:build   # regenerate src/i18n.generated.ts
```

`npm run verify` runs the tests and `i18n:check`.

## Development

```bash
node scripts/sync-core.mjs   # vendors @dualtran/core into vendor/ (committed)
npm install
npm test                     # jest: pure-logic units + virtual-mock pattern + vendored-core integration
npm run build                # ray build
npm run lint                 # ray lint
```

`vendor/dualtran-core.tgz` is committed on purpose: the Raycast review
pipeline runs `npm ci` + `ray build` on this repository (see
raycast/extensions), so the core artifact must travel with the sources.

## License

MIT — the bundled `@dualtran/core` portion is MPL-2.0.

## Tests

Raycast only runs on macOS inside the Raycast app, so this repository has no host-level E2E. `npm test` covers the provider catalogue (projection, alias dedupe, ordering), the `lowest` reasoning resolution, preferences sanitisation, the bridge, and a manifest contract test (command present, provider/reasoning dropdowns, key stored as a password).
