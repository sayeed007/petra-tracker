# Petra issue tracker

Private, bilingual issue tracker for the Petra frontend and backend teams. It imports the existing JSON catalogue, then stores assignments, comments, and live status in MongoDB. Vercel runs the Next.js app; MongoDB Atlas can be provisioned through the Vercel Marketplace or supplied as an existing Atlas URI.

## Workflow

- An administrator adds developers by their GitHub account's primary email, assigns issues, and can deactivate access.
- Only active, pre-added GitHub accounts can sign in. There is no public signup.
- Administrators can view and assign every issue. Developers can see and update only issues assigned to them.
- Every posted update requires a comment. A status change is recorded alongside that comment. When choosing `Won't fix`, explain the business rule or why the work will not proceed.
- Existing IDs, evidence, owner notes, and statuses are retained from `data/items.json` during import. Re-imports refresh source details without overwriting live status or assignments.

## Local setup

Use Node.js 20.19 or newer.

1. Install packages: `npm install`
2. Copy `.env.example` to `.env` and fill in:
   - `MONGODB_URI`: MongoDB Atlas connection string.
   - `MONGODB_DB`: database name (`petra_tracker` by default).
   - `AUTH_SECRET`: a long random value (`node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`).
   - `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`: a GitHub OAuth app.
   - `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_NAME`: first administrator; the email must match the GitHub account's primary email.
3. Add the initial admin: `npm run db:bootstrap-admin`
4. Import the catalogue: `npm run db:import-issues`
5. Start the app: `npm run dev`

The first app connection creates the required MongoDB indexes. The database user needs read/write access to the selected database and permission to create indexes. Status/comment updates use a MongoDB transaction, so use Atlas or another replica set. Issue IDs are served only through the authenticated app; the old static HTML is no longer the Vercel output.

## Vercel setup

`vercel.json` selects the Next.js framework. Connect the repo to Vercel, add the MongoDB Atlas Marketplace integration or set `MONGODB_URI` yourself, then set `MONGODB_DB`, `AUTH_SECRET`, `AUTH_GITHUB_ID`, and `AUTH_GITHUB_SECRET` for the deployment environments. Set the bootstrap admin variables before the first bootstrap.

Set the GitHub OAuth callback URL to `https://<your-domain>/api/auth/callback/github`. For an Atlas cluster not provisioned through Vercel, allow the Vercel deployment to connect in Atlas Network Access.

Run the one-time admin bootstrap and catalogue import from a trusted local checkout with the production environment variables. Both scripts are safe to re-run; the import adds missing issues and refreshes source descriptions without resetting comments, assignment, or status.

## Commands

```powershell
npm run dev
npm run typecheck
npm run lint
npm run build
npm run db:bootstrap-admin
npm run db:import-issues
python tools/build.py       # rebuild the legacy JSON/HTML archive from source data
python tools/redmine.py    # write the ignored Redmine CSV export
```

The generated legacy files (`data/items.json` and `site/index.html`) remain available for archive/export workflows; Vercel serves the authenticated Next.js application. `export/` is git-ignored and is not deployed.
