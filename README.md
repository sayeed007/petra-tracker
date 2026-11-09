# Petra issue tracker

One list of every issue we shared with the frontend and backend teams, by module. A static page (`site/index.html`) is built from data files; nothing runs on a server.

## Files

- `data/raw/*.json`: extracted from the notes (`_fe-accounting-notes`) and the code-review work plans (`code-review-2026-11`). Re-runnable, do not hand-edit.
- `data/overrides.json`: **the only file you edit by hand** (or ask Claude to). One entry per item whose status you checked:
  `{"rv-fe:purchase:1.3": {"status": "fixed", "note": "merged in release_beta_1.0.0", "ref": "24e4ad11", "date": "2026-11-09"}}`
- `data/items.json`, `site/index.html`: generated, never edit.

Statuses: `open`, `in-progress`, `fixed-per-log` (a fix log claims it; branch not checked), `fixed` (checked on a branch or release), `still-bug`, `decision` (waiting for a business answer), `wontfix`, `unknown`.

## Update and publish

```
python tools/build.py     # rebuilds data/items.json and site/index.html
git add -A && git commit -m "update tracker" && git push
```

Vercel redeploys on every push. `vercel.json` serves only `site/` and sets `noindex`.

## Hosting (Vercel, free)

Private GitHub repo `sayeed007/petra-tracker`, imported in Vercel (Framework "Other", no build command).
The site is **open, no password** (decision 2026-11-09, so every developer can read it). Anyone with the link can read the list, which
includes unfixed security gaps: do not share the link outside the team, and keep hosts, credentials and tokens out of the data files.
