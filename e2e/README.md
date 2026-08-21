# Smoke test

Drives the whole app in a real browser: login, client CRUD, a quote that
crosses the 50+ squeegee threshold, promotion to invoice, the printed
document, and the production log.

It runs against `mock-supabase.mjs` — a small in-memory stand-in for the
handful of Supabase auth and PostgREST endpoints the app uses — so the test
needs no network and never touches the live `uac-services` project.

```sh
npm i -D playwright && npx playwright install chromium   # once
node e2e/mock-supabase.mjs &                             # port 54321
VITE_SUPABASE_URL=http://127.0.0.1:54321 \
  VITE_SUPABASE_ANON_KEY=mock-key npx vite --port 5174 &
BASE=http://localhost:5174 node e2e/smoke.mjs
```

The test clears the mock's in-memory tables through `/__reset` before it starts,
so the totals it asserts on cannot be thrown off by an earlier run.

Playwright is deliberately not a package.json dependency: it would pull a
browser download into every Vercel build for no benefit.
