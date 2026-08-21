import { supabase } from './supabase'
import type { DocType } from './types'

const PREFIX: Record<DocType, string> = {
  quote: 'Q',
  invoice: 'INV',
  collection: 'COL',
}

/**
 * Numbers run per document type: Q0001, INV0001, COL0001.
 * Two users on an internal tool, so a read-then-write is good enough — the
 * unique index on orders.order_number is the real guard against collisions.
 */
export async function nextOrderNumber(docType: DocType): Promise<string> {
  const prefix = PREFIX[docType]
  const { data, error } = await supabase
    .from('orders')
    .select('order_number')
    .like('order_number', `${prefix}%`)
    .order('order_number', { ascending: false })
    .limit(1)

  if (error) throw error

  const last = data?.[0]?.order_number ?? null
  const lastSeq = last ? Number.parseInt(last.slice(prefix.length), 10) : 0
  const next = (Number.isNaN(lastSeq) ? 0 : lastSeq) + 1
  return `${prefix}${String(next).padStart(4, '0')}`
}
