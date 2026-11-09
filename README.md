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
PETRA_TRACKER_PW='a long password' bash tools/publish.sh
```

It rebuilds `data/items.json`, builds the plain page into `build/` (git-ignored, never published) and encrypts it with StatiCrypt into `site/index.html`. Commit and push `site/` and `data/`; Vercel redeploys.

## Put it on the web (Vercel, free)

1. Private GitHub repo (done): `sayeed007/petra-tracker`.
2. Vercel: import the repo, Framework "Other", no build command. `vercel.json` already sets the output folder to `site` and `noindex`.
3. **Never publish the plain page.** A free Vercel site is public and the list names unfixed security gaps. Only the encrypted `site/index.html` is served; `data/` and `build/` are not (they are outside `site/`). Keep the password in a password manager. If a plain version was ever deployed, delete that old deployment in Vercel (Deployments, ... , Delete): old deployment URLs keep serving their content.
