# Petra issue tracker

One list of every issue we shared with the frontend and backend teams, by module. A static page (`site/index.html`) is built from data files; nothing runs on a server.

## Files

- `data/raw/*.json`: extracted from the notes (`_fe-accounting-notes`) and the code-review work plans (`code-review-2026-11`). Re-runnable, do not hand-edit.
- `data/overrides.json`: **the only file you edit by hand** (or ask Claude to). One entry per item whose status you checked:
  `{"rv-fe:purchase:1.3": {"status": "fixed", "note": "merged in release_beta_1.0.0", "ref": "24e4ad11", "date": "2026-11-09"}}`
- `data/items.json`, `site/index.html`: generated, never edit.

Statuses: `open`, `in-progress`, `fixed-per-log` (a fix log claims it; branch not checked), `fixed` (checked on a branch or release), `still-bug`, `decision` (waiting for a business answer), `wontfix`, `unknown`.

## Update

```
python tools/build.py      # rebuilds data/items.json and site/index.html
```

## Put it on the web (Vercel, free)

1. `git init` is done. Push this folder to a **private** repo (GitLab or GitHub).
2. Vercel: New Project, import the repo, Framework "Other", Output Directory `site`, no build command. Every push redeploys.
3. **Protect it.** A free Vercel site is public. The list names unfixed security gaps in the live ERP, so encrypt the page before publishing:
   `npx staticrypt site/index.html -p "<a long password>" -d site` (put the encrypted file in `site/`; keep the password in a password manager).
   Nothing in the data contains hosts or credentials; keep it that way.
