# Local verification

Run these commands from the repo root:

1) Install dependencies

```bash
pnpm i
```

2) Lint

```bash
pnpm -r lint
```

3) Test

```bash
pnpm -r test
```

4) Start dev server

```bash
pnpm dev
```

Open http://localhost:3000

## Success looks like

- Lint/test commands finish without errors.
- `pnpm dev` starts the Next.js server.
- The page shows "Major Map" and "Health: ok".
- `/health` responds with `{ "status": "ok" }`.

## Common fixes

- Port in use: stop the other process or run `PORT=3001 pnpm dev`.
- Missing dependencies: re-run `pnpm i`.
- Node version mismatch: use the project's expected Node version.
- Env vars: if new env vars are introduced, add them to `.env.local`.
