# Submitting DualTran to the Raycast Store

Status: prepared, not yet submitted. Submission is the maintainer's action:
`npm run publish` (or the "Publish Extension" action via Raycast) opens a PR
against [raycast/extensions](https://github.com/raycast/extensions); the store
lists the extension after the PR merges.

## Pre-flight checklist

- [ ] **`author` = your Raycast account handle** (currently `seigwen` in
      package.json — must match the account used to publish, or the bot
      rejects the PR).
- [ ] `npm test` green (jest suites incl. the vendored-core integration).
- [ ] `npm run build` + `npm run lint` green.
- [ ] `vendor/dualtran-core.tgz` committed (the review pipeline runs
      `npm ci && ray build` on this repo — the file: dependency must exist).
- [ ] CHANGELOG.md has an entry for this version (bot-enforced).
- [ ] ≥3 screenshots 2000×1250 PNG in `metadata/` — **needs a macOS machine**
      (run `npm run dev`, capture the Detail views for both commands and the
      language-switch action).
- [ ] Categories + license (MIT) — already set.

## Publish

```bash
npm run publish   # ray publish → opens the PR with a new branch
```

Then answer the bot's checks on the PR. After merge the extension goes live
within a day.

## Store listing copy (draft)

- **Title:** DualTran
- **Description:** Translate selected text or your clipboard with Google or
  your own AI model. Keep the original in view, copy or paste the translation
  instantly, and switch target languages without leaving the keyboard.
