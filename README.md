# תמר בת 70

A shared memories site for Tamar's 70th birthday, plus a family escape-room game built from the stories.

## Layout

| Folder         | What                                                                       |
| -------------- | -------------------------------------------------------------------------- |
| `web/`         | React 19 + Vite site (plain JavaScript), deployed to Firebase Hosting      |
| `apps-script/` | JSON API on Google Apps Script (Sheets + Drive), pushed by hand with clasp |
| `shared/`      | Constants and rules used by both sides                                     |

npm workspaces, one lockfile at the root. Node 22 (see `.nvmrc`).

## Commands (run from the root)

```sh
npm install          # installs every workspace and sets up the pre-commit hook
npm run dev          # Vite dev server on localhost:5173
npm test             # Vitest (shared + web)
npm run lint         # ESLint
npm run format       # Prettier
npm run check        # everything CI runs: lint, format check, tests, build
npm run push -w apps-script   # clasp push (needs clasp logged in as the owner account)
```

The pre-commit hook runs ESLint and Prettier on staged files.

## CI and deploy

GitHub Actions (`.github/workflows/ci.yml`) runs `lint`, `format:check`, `test` and `build` on every PR and on `main`. Once those pass:

- **Pull request:** the build is deployed to a temporary Firebase preview channel (kept 14 days) and the URL is posted on the PR.
- **Merge to `main`:** the build goes live at https://tamar70.web.app.

Both use the `FIREBASE_SERVICE_ACCOUNT_TAMAR70` repository secret. Apps Script is not deployed by CI: push it by hand with `npm run push -w apps-script`.

Manual deploy, if ever needed: `npm run build && firebase deploy --only hosting`.
