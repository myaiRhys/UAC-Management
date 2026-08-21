import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type {
  Client,
  DocType,
  Order,
  OrderLine,
  OrderStatus,
  Product,
} from '../lib/types'
import { money, productLabel } from '../lib/format'
import { orderTotal, priceLines, type DraftLine } from '../lib/pricing'
import { nextOrderNumber } from '../lib/orderNumber'
import { ErrorBox, Loading, PageHeader, StatusPill } from '../components/Bits'

const DOC_TYPES: { value: DocType; label: string; hint: string }[] = [
  { value: 'quote', label: 'Quote', hint: 'Pricing sent to a client' },
  { value: 'invoice', label: 'Invoice', hint: 'Payment due' },
  {
    value: 'collection',
    label: 'Collection sheet',
    hint: 'Stock going out to be collected',
  },
]

/** Which status buttons make sense for each document type. */
const STATUS_ACTIONS: Record<DocType, OrderStatus[]> = {
  quote: ['sent', 'accepted', 'cancelled'],
  invoice: ['sent', 'paid', 'cancelled'],
  collection: ['collected', 'cancelled'],
}

/**
 * A saved line only counts as manually priced if its price matches neither the
 * product's standard nor its bulk price. That way reopening a quote and
 * changing quantities still re-applies the bulk tier, while a hand-typed price
 * survives the round trip.
 */
function savedPriceOverride(
  line: OrderLine,
  productsById: Map<string, Product>,
): number | null {
  const price = Number(line.unit_price)
  const product = line.product_id ? productsById.get(line.product_id) : null
  if (!product) return price
  const known = [Number(product.unit_price)]
  if (product.bulk_unit_price != null) known.push(Number(product.bulk_unit_price))
  return known.some((p) => Math.abs(p - price) < 0.005) ? null : price
}

let keySeq = 0
const newKey = () => `line-${++keySeq}`

function blankLine(): DraftLine {
  return {
    key: newKey(),
    product_id: null,
    description: '',
    quantity: 1,
    price_override: null,
  }
}

export default function OrderEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id

  const [products, setProducts] = useState<Product[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [order, setOrder] = useState<Order | null>(null)

  const [clientId, setClientId] = useState<string>('')
  const [docType, setDocType] = useState<DocType>('quote')
  const [status, setStatus] = useState<OrderStatus>('draft')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([blankLine()])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Saving a new document navigates to its id, which would otherwise re-run the
  // loader and overwrite whatever the user typed while the save was in flight.
  // The state on screen is already what we just wrote, so skip that reload.
  const selfWrittenId = useRef<string | null>(null)

  useEffect(() => {
    if (id && id === selfWrittenId.current) return

    let cancelled = false

    async function load() {
      const [productsRes, clientsRes] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .eq('active', true)
          .order('name')
          .order('variant'),
        supabase.from('clients').select('*').order('name'),
      ])

      if (cancelled) return
      if (productsRes.error) setError(productsRes.error.message)
      if (clientsRes.error) setError(clientsRes.error.message)
      setProducts((productsRes.data ?? []) as Product[])
      setClients((clientsRes.data ?? []) as Client[])

      if (id) {
        const [orderRes, linesRes] = await Promise.all([
          supabase.from('orders').select('*').eq('id', id).single(),
          supabase
            .from('order_lines')
            .select('*')
            .eq('order_id', id)
            .order('sort_order'),
        ])
        if (cancelled) return
        if (orderRes.error) setError(orderRes.error.message)
        if (orderRes.data) {
          const o = orderRes.data as Order
          setOrder(o)
          setClientId(o.client_id ?? '')
          setDocType(o.doc_type)
          setStatus(o.status)
          setNotes(o.notes ?? '')
        }
        const saved = (linesRes.data ?? []) as OrderLine[]
        const byId = new Map(
          ((productsRes.data ?? []) as Product[]).map((p) => [p.id, p]),
        )
        setLines(
          saved.length
            ? saved.map((l) => ({
                key: newKey(),
                product_id: l.product_id,
                description: l.description,
                quantity: Number(l.quantity),
                price_override: savedPriceOverride(l, byId),
              }))
            : [blankLine()],
        )
      }
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  const productsById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  )

  const priced = useMemo(
    () => priceLines(lines, productsById),
    [lines, productsById],
  )
  const total = orderTotal(priced)

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function chooseProduct(key: string, productId: string) {
    const product = productsById.get(productId)
    updateLine(key, {
      product_id: productId || null,
      description: product ? productLabel(product) : '',
      // Drop any override so the product's own pricing rules take over.
      price_override: null,
    })
  }

  function addLine() {
    setLines((ls) => [...ls, blankLine()])
  }

  function removeLine(key: string) {
    setLines((ls) => (ls.length === 1 ? [blankLine()] : ls.filter((l) => l.key !== key)))
  }

  async function save(nextStatus?: OrderStatus) {
    setSaving(true)
    setError(null)

    const usable = priced.filter((l) => l.description.trim() && l.quantity > 0)
    const statusToSave = nextStatus ?? status
    const subtotal = orderTotal(usable)

    try {
      let orderId = id ?? null
      let orderNumber = order?.order_number ?? null

      // A number is assigned the first time a document leaves draft.
      if (!orderNumber && statusToSave !== 'draft') {
        orderNumber = await nextOrderNumber(docType)
      }

      const payload = {
        client_id: clientId || null,
        doc_type: docType,
        status: statusToSave,
        order_number: orderNumber,
        subtotal,
        total: subtotal, // no VAT
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      }

      if (orderId) {
        const { error } = await supabase
          .from('orders')
          .update(payload)
          .eq('id', orderId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('orders')
          .insert(payload)
          .select('id')
          .single()
        if (error) throw error
        orderId = (data as { id: string }).id
      }

      // Lines are small and edited as a block — replace rather than diff.
      const { error: delError } = await supabase
        .from('order_lines')
        .delete()
        .eq('order_id', orderId)
      if (delError) throw delError

      if (usable.length) {
        const { error: insError } = await supabase.from('order_lines').insert(
          usable.map((l, i) => ({
            order_id: orderId!,
            product_id: l.product_id,
            description: l.description.trim(),
            quantity: l.quantity,
            unit_price: l.unit_price,
            line_total: l.line_total,
            sort_order: i,
          })),
        )
        if (insError) throw insError
      }

      setStatus(statusToSave)
      setOrder((o) => ({
        id: orderId!,
        created_at: o?.created_at ?? new Date().toISOString(),
        ...o,
        ...payload,
      }))
      if (!id) {
        selfWrittenId.current = orderId
        setLoading(false)
        navigate(`/orders/${orderId}`, { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loading what="Loading document" />

  const bulkNote = priced.some((l) => l.bulk_applied)

  return (
    <>
      <PageHeader
        title={
          isNew
            ? 'New document'
            : `${order?.order_number ?? 'Draft'} — ${docType}`
        }
        subtitle="UAC is not VAT-registered, so the total shown is the total due."
        actions={
          <>
            {!isNew && (
              <Link className="btn ghost" to={`/orders/${id}/print`}>
                Print / PDF
              </Link>
            )}
            <button
              className="btn primary"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      />
      <ErrorBox message={error} />

      <div className="card form-card">
        <div className="grid-2">
          <label className="field">
            <span>Client</span>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">— select a client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Document type</span>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocType)}
            >
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label} — {d.hint}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="row gap middle">
          <span className="muted small">Status</span>
          <StatusPill status={status} />
          {STATUS_ACTIONS[docType]
            .filter((s) => s !== status)
            .map((s) => (
              <button
                key={s}
                className="btn ghost small capitalise"
                disabled={saving}
                onClick={() => void save(s)}
              >
                Mark {s}
              </button>
            ))}
        </div>
      </div>

      <div className="card">
        <table className="table lines">
          <thead>
            <tr>
              <th className="w-product">Product</th>
              <th>Description</th>
              <th className="w-qty right">Qty</th>
              <th className="w-price right">Unit price</th>
              <th className="w-total right">Line total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {priced.map((l) => (
              <tr key={l.key}>
                <td>
                  <select
                    value={l.product_id ?? ''}
                    onChange={(e) => chooseProduct(l.key, e.target.value)}
                  >
                    <option value="">— custom line —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {productLabel(p)}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    value={l.description}
                    placeholder="Description on the document"
                    onChange={(e) =>
                      updateLine(l.key, { description: e.target.value })
                    }
                  />
                </td>
                <td className="right">
                  <input
                    className="num"
                    type="number"
                    min={0}
                    step={1}
                    value={l.quantity}
                    onChange={(e) =>
                      updateLine(l.key, {
                        quantity: Number(e.target.value) || 0,
                      })
                    }
                  />
                </td>
                <td className="right">
                  <input
                    className="num"
                    type="number"
                    min={0}
                    step="0.01"
                    value={l.unit_price}
                    onChange={(e) =>
                      updateLine(l.key, {
                        price_override: Number(e.target.value) || 0,
                      })
                    }
                  />
                  {l.bulk_applied && (
                    <div className="bulk-tag">
                      bulk price (was {money(l.standard_price)})
                    </div>
                  )}
                  {l.price_override != null && l.product_id && (
                    <button
                      className="link-btn"
                      onClick={() =>
                        updateLine(l.key, { price_override: null })
                      }
                    >
                      use list price
                    </button>
                  )}
                </td>
                <td className="right mono">{money(l.line_total)}</td>
                <td className="right">
                  <button
                    className="btn ghost small"
                    onClick={() => removeLine(l.key)}
                    aria-label="Remove line"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="lines-footer">
          <button className="btn ghost" onClick={addLine}>
            + Add line
          </button>
          <div className="totals">
            {bulkNote && (
              <p className="muted small">
                Bulk pricing applied — 50 or more squeegees in one order drop
                from R28.00 to R24.50 each.
              </p>
            )}
            <div className="total-row">
              <span>Total due</span>
              <strong className="mono">{money(total)}</strong>
            </div>
            <p className="muted small">No VAT — UAC is not VAT-registered.</p>
          </div>
        </div>
      </div>

      <div className="card form-card">
        <label className="field">
          <span>Notes on the document</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Lead time, collection arrangements, PO number…"
          />
        </label>
      </div>
    </>
  )
}
