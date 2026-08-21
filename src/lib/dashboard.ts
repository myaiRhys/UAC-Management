import type { Order, OrderLine, ProductionEntry } from './types'
import { round2 } from './format'

export type OrderRow = Order & { clients: { name: string } | null }
export type LineRow = OrderLine & {
  products: { name: string; variant: string | null } | null
}
export type ProductionRow = ProductionEntry & {
  products: { name: string; variant: string | null } | null
}

/**
 * A document counts as committed work — something still owed to a client —
 * once it has been agreed but not yet closed out.
 *
 * Quotes only count once accepted; a quote that is merely sent is a pitch, not
 * work. Invoices count while unpaid; paid is treated as handed over, since
 * nothing in the schema records collection against an invoice. Collection
 * sheets count until they are marked collected.
 */
export function isCommitted(order: Order): boolean {
  if (order.status === 'draft' || order.status === 'cancelled') return false
  if (order.doc_type === 'quote') return order.status === 'accepted'
  if (order.doc_type === 'invoice') return order.status === 'sent'
  return order.status !== 'collected'
}

/**
 * Anything issued and not yet finished — the list that still needs someone to
 * do something. Wider than isCommitted: a quote merely sent is not work yet,
 * but it is still waiting on the client and belongs on the chase list.
 */
export function isLive(order: Order): boolean {
  if (order.status === 'draft' || order.status === 'cancelled') return false
  if (order.doc_type === 'quote') {
    return order.status === 'sent' || order.status === 'accepted'
  }
  if (order.doc_type === 'invoice') return order.status === 'sent'
  return order.status !== 'collected'
}

export type Money = { total: number; count: number }

export function sumWhere(
  orders: Order[],
  predicate: (o: Order) => boolean,
): Money {
  const matched = orders.filter(predicate)
  return {
    total: round2(matched.reduce((sum, o) => sum + Number(o.total), 0)),
    count: matched.length,
  }
}

export type Tally = { label: string; units: number }

/** Units per product, biggest first, so the bars come out already ranked. */
export function tally(
  rows: { label: string; quantity: number }[],
): Tally[] {
  const totals = new Map<string, number>()
  for (const row of rows) {
    totals.set(row.label, (totals.get(row.label) ?? 0) + row.quantity)
  }
  return [...totals.entries()]
    .map(([label, units]) => ({ label, units }))
    .filter((t) => t.units > 0)
    .sort((a, b) => b.units - a.units)
}

export function lineLabel(line: LineRow): string {
  if (line.products) {
    return line.products.variant
      ? `${line.products.name} — ${line.products.variant}`
      : line.products.name
  }
  return line.description || 'Custom line'
}

export function productionLabel(row: ProductionRow): string {
  const name = row.products?.name ?? 'Unknown product'
  const variant = row.variant ?? row.products?.variant
  return variant ? `${name} — ${variant}` : name
}

/** First day of the current month as YYYY-MM-DD, for comparing date columns. */
export function monthStart(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
}

export function daysSince(iso: string, now = new Date()): number {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return 0
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000))
}
