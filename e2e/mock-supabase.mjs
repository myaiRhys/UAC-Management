// Minimal stand-in for the Supabase auth + PostgREST endpoints this app calls.
// Used only to drive the UI in CI/sandbox, where egress to the real project is
// blocked. Query semantics mirror what the app actually sends.
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'

const PRODUCTS = [
  ['Garage Roll', 'Reject', 195, null, null, 'roll'],
  ['Garage Roll', 'Standard', 235, null, null, 'roll'],
  ['Out of Order Cover', null, 120, null, null, 'each'],
  ['Pink Soap 25L', null, 450, null, null, 'each'],
  ['Replacement Rubber', null, 40, null, null, '5-pack'],
  ['Replacement Sponge', null, 40.5, null, null, '5-pack'],
  ['Squeegee', 'Black', 28, 50, 24.5, 'each'],
  ['Squeegee', 'Blue', 28, 50, 24.5, 'each'],
  ['Squeegee', 'Dark Grey', 28, 50, 24.5, 'each'],
  ['Squeegee', 'Light Grey', 28, 50, 24.5, 'each'],
  ['Squeegee', 'Red', 28, 50, 24.5, 'each'],
].map(([name, variant, unit_price, bulk_qty_threshold, bulk_unit_price, unit_label]) => ({
  id: randomUUID(), name, variant, unit_price, bulk_qty_threshold,
  bulk_unit_price, unit_label, active: true,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
}))

const db = { clients: [], products: PRODUCTS, orders: [], order_lines: [], production_log: [] }

const PARENT = {
  orders: { clients: ['client_id', 'clients'] },
  order_lines: { products: ['product_id', 'products'] },
  production_log: { products: ['product_id', 'products'] },
}

const json = (res, code, body) => {
  res.writeHead(code, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-expose-headers': '*',
  })
  res.end(JSON.stringify(body))
}

/** Apply the ?col=op.value filters PostgREST uses. */
function applyFilters(rows, params) {
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'apikey'].includes(key)) continue
    const [op, ...rest] = raw.split('.')
    const value = rest.join('.')
    rows = rows.filter((r) => {
      const actual = r[key]
      if (op === 'eq') return String(actual) === value || actual === (value === 'true')
      if (op === 'like') return typeof actual === 'string' && actual.startsWith(value.replace(/%$/, ''))
      return true
    })
  }
  return rows
}

function applyOrder(rows, params) {
  const specs = params.getAll('order').flatMap((o) => o.split(','))
  if (!specs.length) return rows
  return [...rows].sort((a, b) => {
    for (const spec of specs) {
      const [col, ...mods] = spec.split('.')
      const dir = mods.includes('desc') ? -1 : 1
      const av = a[col], bv = b[col]
      if (av === bv) continue
      if (av == null) return 1
      if (bv == null) return -1
      return av < bv ? -dir : dir
    }
    return 0
  })
}

/** Attach the embedded parent rows named in the select clause. */
function embed(table, rows, select) {
  const parents = PARENT[table] ?? {}
  return rows.map((row) => {
    const out = { ...row }
    for (const [name, [fk, target]] of Object.entries(parents)) {
      if (!new RegExp(`(^|,|\\s)${name}\\(`).test(select ?? '')) continue
      out[name] = db[target].find((p) => p.id === row[fk]) ?? null
    }
    return out
  })
}

createServer((req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, null)

  const url = new URL(req.url, 'http://localhost')

  if (url.pathname === '/auth/v1/token') {
    return json(res, 200, {
      access_token: 'mock-token', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'mock-refresh',
      user: {
        id: 'mock-user', aud: 'authenticated', role: 'authenticated',
        email: 'smoke@example.com', app_metadata: {}, user_metadata: {},
        created_at: new Date().toISOString(),
      },
    })
  }
  if (url.pathname.startsWith('/auth/v1/logout')) return json(res, 204, null)
  if (url.pathname === '/auth/v1/user') return json(res, 200, { id: 'mock-user', email: 'smoke@example.com' })

  const table = url.pathname.replace('/rest/v1/', '')
  if (!(table in db)) return json(res, 404, { message: `no table ${table}` })

  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    const single = (req.headers.accept ?? '').includes('vnd.pgrst.object')
    const payload = body ? JSON.parse(body) : null
    const select = url.searchParams.get('select')

    if (req.method === 'GET') {
      let rows = applyOrder(applyFilters(db[table], url.searchParams), url.searchParams)
      const limit = url.searchParams.get('limit')
      if (limit) rows = rows.slice(0, Number(limit))
      rows = embed(table, rows, select)
      return json(res, 200, single ? (rows[0] ?? null) : rows)
    }

    if (req.method === 'POST') {
      const now = new Date().toISOString()
      const incoming = (Array.isArray(payload) ? payload : [payload]).map((r) => ({
        id: randomUUID(), created_at: now, updated_at: now, ...r,
      }))
      db[table].push(...incoming)
      return json(res, 201, single ? incoming[0] : incoming)
    }

    if (req.method === 'PATCH') {
      const targets = applyFilters(db[table], url.searchParams)
      for (const row of targets) Object.assign(row, payload)
      return json(res, 200, single ? (targets[0] ?? null) : targets)
    }

    if (req.method === 'DELETE') {
      const doomed = new Set(applyFilters(db[table], url.searchParams).map((r) => r.id))
      db[table] = db[table].filter((r) => !doomed.has(r.id))
      return json(res, 200, [])
    }

    return json(res, 405, { message: 'not supported' })
  })
}).listen(54321, () => console.log('mock supabase on http://127.0.0.1:54321'))
