# Contributing

Contributions are welcome: corrections to game data, translations, bug fixes
and features. The app is not open source (see [`NOTICE.md`](NOTICE.md) and
[`LICENSE`](LICENSE)), so please read the terms below before sending anything.

## What's welcome

- **Game data corrections.** Pirates, Skaven, anything in `src/data/`. Say which
  source you checked against (book, Town Cryer issue, errata, page). Rules text
  follows the [Mordheimer](https://mordheimer.net) transcription word for word
  (spec §33), so a wording correction usually goes to Mordheimer first.
- **Translations.** All interface text lives in `src/strings.ts`, so a language
  starts there. There is no language switcher yet. Open an issue before starting
  so the groundwork can be agreed first.
- **Bug fixes and features.** For anything bigger than a small fix, open an
  issue first to check it fits the roadmap.

## How

1. Fork the repository and create a branch.
2. Run `npm run build` (and `npm run db:test` if you touched `supabase/`).
3. Open a pull request against `main` that describes what changed and how you
   checked it.

## Terms for contributions

By submitting a contribution (code, data, text, translations or anything else)
you confirm that:

1. **It's yours to give.** You wrote it, or you otherwise have the right to
   submit it under these terms. Game content transcribed from Games Workshop
   material is the exception: you don't own that, and it is handled as described
   in `NOTICE.md`.
2. **You grant Evin Wijninga a licence to it.** The licence is perpetual,
   worldwide, non-exclusive, royalty-free and irrevocable. It covers using,
   copying, modifying, distributing and sublicensing your contribution, and
   relicensing it as part of the app under any terms, including terms other
   than the current licence.
3. **You keep your own copyright.** You may still use your own contribution
   elsewhere, separately from this app.

Sign off each commit to confirm this (`git commit -s`, which adds a
`Signed-off-by:` line).
