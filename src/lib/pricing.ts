import type { Product } from './types'
import { round2 } from './format'

/**
 * A line as held in the order builder before it is saved.
 */
export type DraftLine = {
  key: string
  product_id: string | null
  description: string
  quantity: number
  /** Set when the user has typed their own price; otherwise price is derived. */
  price_override: number | null
}

export type PricedLine = DraftLine & {
  unit_price: number
  line_total: number
  /** True when the bulk tier was applied rather than the standard unit price. */
  bulk_applied: boolean
  /** Standard price, kept so the UI can show what the bulk tier saved. */
  standard_price: number
}

/**
 * Bulk tiers are counted across every line sharing a product NAME, not per line.
 * A customer ordering 20 black + 30 blue squeegees has bought 50 squeegees and
 * gets the 50+ price (R24.50 instead of R28) on all of them.
 *
 * ASSUMPTION flagged to Rhys: if the 50+ threshold is meant to apply per colour
 * rather than per order, change the grouping key here to the product id.
 */
function bulkGroupKey(product: Product): string {
  return product.name.trim().toLowerCase()
}

export function priceLines(
  lines: DraftLine[],
  productsById: Map<string, Product>,
): PricedLine[] {
  // Total quantity per bulk group across the whole order.
  const groupTotals = new Map<string, number>()
  for (const line of lines) {
    const product = line.product_id ? productsById.get(line.product_id) : null
    if (!product || product.bulk_qty_threshold == null) continue
    const key = bulkGroupKey(product)
    groupTotals.set(key, (groupTotals.get(key) ?? 0) + (line.quantity || 0))
  }

  return lines.map((line) => {
    const product = line.product_id ? productsById.get(line.product_id) : null
    const standard = product ? Number(product.unit_price) : 0

    let unit_price = standard
    let bulk_applied = false

    if (
      product &&
      product.bulk_qty_threshold != null &&
      product.bulk_unit_price != null &&
      (groupTotals.get(bulkGroupKey(product)) ?? 0) >= product.bulk_qty_threshold
    ) {
      unit_price = Number(product.bulk_unit_price)
      bulk_applied = true
    }

    // A manual price always wins over the derived one.
    if (line.price_override != null) {
      unit_price = line.price_override
      bulk_applied = false
    }

    return {
      ...line,
      unit_price,
      standard_price: standard,
      bulk_applied,
      line_total: round2(unit_price * (line.quantity || 0)),
    }
  })
}

export function orderTotal(lines: PricedLine[]): number {
  // No VAT: UAC is not VAT-registered, so subtotal and total are the same number.
  return round2(lines.reduce((sum, l) => sum + l.line_total, 0))
}
