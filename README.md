# תמר בת 70

A shared memories site for Tamar's 70th birthday, plus a family escape-room game built from the stories.

## Layout

| Folder         | What                                                                         |
| -------------- | ---------------------------------------------------------------------------- |
| `web/`         | React 19 + Vite site (plain JavaScript), deployed to Firebase Hosting        |
| `apps-script/` | JSON API on Google Apps Script (Sheets + Drive), bundled with esbuild        |
| `shared/`      | Constants, Zod schemas, Sheet table definitions and rules used by both sides |

npm workspaces, one lockfile at the root. Node 22 (see `.nvmrc`).

## Commands (run from the root)

```sh
npm install          # installs every workspace and sets up the pre-commit hook
npm run dev          # Vite dev server on localhost:5173
npm test             # Vitest (shared, apps-script, web)
npm run lint         # ESLint
npm run format       # Prettier
npm run check        # everything CI runs: lint, format check, tests, build
npm run build -w apps-script    # bundle the API into apps-script/dist/Code.js
```

The pre-commit hook runs ESLint, Stylelint and Prettier on staged files.

## Design system

All colors, fonts, sizes, radii and shadows live in [`web/src/theme/tokens.css`](web/src/theme/tokens.css), taken from the approved mockups. Lint rejects raw colors and font values anywhere else. Rules and usage: [`web/src/theme/README.md`](web/src/theme/README.md). Rendered reference: `/_styleguide`.

## The API (apps-script/)

- `src/core/`: plain JS, no Google services. Router, actions, migration. Tested in Node with in-memory fakes.
- `src/gas/`: the only code that touches Apps Script services (Sheets, cache, lock, crypto).
- `src/main.js`: entry points. `build.js` bundles everything into one file and declares `doGet`, `doPost`, `setup` and `rotateFamilyCode` at the top level, where Apps Script can see them.
- The Sheet is built and upgraded automatically: on the first request after a deploy that bumps `SCHEMA_VERSION` (`shared/src/tables.js`), missing tabs and columns are added. Nothing is ever deleted.
- Run by hand in the Apps Script editor: `setup` (first time, or to grant new permissions) and `rotateFamilyCode` (new link for contributors; the log shows it).

## CI and deploy

GitHub Actions (`.github/workflows/ci.yml`) runs `lint`, `format:check`, `test` and `build` on every PR and on `main`. Once those pass:

- **Pull request:** the site is deployed to a temporary Firebase preview channel (kept 14 days) and the URL is posted on the PR. Previews use the live API.
- **Merge to `main`:**
  1. If `apps-script/` or `shared/` changed: the API is bundled, pushed with clasp, and the web app deployment in `apps-script/deployment.json` is updated in place (same URL). Uses the `CLASPRC_JSON` secret.
  2. The site goes live at https://tamar70.web.app. Uses the `FIREBASE_SERVICE_ACCOUNT_TAMAR70` secret.

The site gets the API URL from `apps-script/deployment.json` at build time.
