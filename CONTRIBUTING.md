# Contributing

Thanks for helping out. Bug reports and ideas are just as welcome as code.
Use the in-app feedback button (the speech bubble in the top bar) or open an
issue.

## Before your first pull request

All code contributions need the [Contributor License Agreement](CLA.md).
**You keep your copyright.** The agreement lets the maintainer keep
distributing your work, including alongside a possible paid service such as
cross-device sync. It also promises that your contribution stays available
under an open source license.

To agree, include this line in your pull request description:

```
I have read the CLA (CLA.md, version 1.0) and I agree to its terms.
```

The pull request template already includes it as a checkbox. You only need to
agree once; it covers your later contributions too. Pull requests without it
can't be merged.

If you're contributing on behalf of a company, or your employer may own work
you create, check with them first (CLA §5.2).

## Content rules

- **Only SRD and original content.** Never commit text, data or art from
  published books, from FightClub collections you didn't write, or from any
  other copyrighted source. Imports stay in the user's browser; they never
  belong in this repo.
- Keep the SRD's CC-BY attribution intact (`ATTRIBUTION.md`).
- Don't use "D&D" or "Dungeons & Dragons" in names, UI text or marketing.
  "Fifth edition" or "5e-compatible" is fine.

## Development

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # type-check + production build; must pass before a PR
```

- Match the existing style: TypeScript, single quotes, no new formatter.
- The app is local-first. Don't add network calls, analytics or third-party
  services without discussing it in an issue first.
- If you change what's stored in IndexedDB, add a new version to
  `SCHEMA_HISTORY` in `src/lib/db.ts` (with an `upgrade` function if existing
  rows change shape) so existing users' data upgrades cleanly. Never edit or
  remove a version that has shipped. If the backup file's contents change
  shape too, add a matching step to `BACKUP_MIGRATIONS` in
  `src/lib/backup.ts`. The app already saves a safety copy of the data before
  any upgrade runs.
