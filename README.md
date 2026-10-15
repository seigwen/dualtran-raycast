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
