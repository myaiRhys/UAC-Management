# UAC Services — internal admin

Quoting, invoicing and production tracking for UAC's forecourt supplies
(squeegees, garage rolls, pink soap, sponges, covers).

Deliberately light: a Vite + React SPA talking straight to Supabase. Two users
today (Rhys and Dani), so there is no server layer to maintain.

## Stack

- Vite + React + TypeScript
- Supabase — Postgres, auth, RLS (project `uac-services`, ref `ifqazfvsfkhwzljhqwia`)
- Vercel for hosting

## Running locally

```sh
npm install
npm run dev
```

No configuration needed: the `uac-services` URL and publishable key live in
`src/lib/supabase.ts`. That key is designed to ship in the browser bundle — row
level security, not secrecy, is what guards the data.

To point a build at a different Supabase project, copy `.env.example` to
`.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; they
override the built-in defaults.

## What's in it

- **Quotes & Invoices** — pick a client, add lines from the price list, watch
  the total, save as a quote, invoice or collection sheet, then mark it sent,
  paid, accepted or collected. Numbers (`Q0001`, `INV0001`, `COL0001`) are
  assigned the first time a document leaves draft.
- **Clients** — list, add, edit.
- **Production log** — quick entry for what was made, in what colour, how many,
  when and by whom. This screen holds no pricing or client data, so a staff
  member can eventually be given access to it alone.
- **Price list** — read-only view of the seeded products, and the questions
  still open with Rhys.
- **Print / PDF** — a plain letterhead document; the browser's own
  "Save as PDF" produces the file.

## Two rules worth knowing

**No VAT.** UAC is not VAT-registered. Subtotal and total are the same number
and every document says so in print.

**Bulk squeegees.** 50 or more squeegees drop from R28.00 to R24.50 each. The
threshold counts *across the whole document*, not per line — 30 black plus 30
blue is 60 squeegees and gets the bulk price on both lines. If that should
instead be per colour, change `bulkGroupKey` in `src/lib/pricing.ts` to use the
product id. Typing a price by hand overrides the rule; "use list price" puts it
back.

## Still waiting on Rhys

- **Nozzle covers** — no price confirmed, so there is no nozzle cover in the
  products table. ("Out of Order Cover" at R120 is a different item.) Quote
  them as a custom line until the price is set.
- **Banking details** — invoices print "banking details to follow". Nothing has
  been invented. Fill in `bankingNote` in `src/lib/company.ts` once an account
  is confirmed.
- **Branding** — no logo or brand colours confirmed, so documents are plain.

## Accounts

Users are created in the Supabase dashboard (Authentication → Users). There is
no self sign-up. RLS currently grants any authenticated user full access —
tighten it when production-only staff logins are added.

## Tests

See [`e2e/README.md`](e2e/README.md).
