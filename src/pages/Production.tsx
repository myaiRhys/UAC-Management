import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { ProductionEntry, Product } from '../lib/types'
import { productLabel, shortDate, today } from '../lib/format'
import { Empty, ErrorBox, Loading, PageHeader } from '../components/Bits'

type Row = ProductionEntry & { products: { name: string } | null }

/**
 * Quick-entry screen. Deliberately holds no pricing or client data so a staff
 * member can eventually be given access to this screen alone.
 */
export default function Production() {
  const [products, setProducts] = useState<Product[]>([])
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)

  const [productId, setProductId] = useState('')
  const [variant, setVariant] = useState('')
  const [quantity, setQuantity] = useState('')
  const [producedBy, setProducedBy] = useState('')
  const [producedOn, setProducedOn] = useState(today())
  const [notes, setNotes] = useState('')

  async function refresh() {
    const { data, error } = await supabase
      .from('production_log')
      .select('*, products(name)')
      .order('produced_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) setError(error.message)
    else setRows((data ?? []) as Row[])
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('name')
        .order('variant')
      if (cancelled) return
      if (error) setError(error.message)
      else setProducts((data ?? []) as Product[])
      await refresh()
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  // Colours already used for a product become one-tap buttons.
  const variantsForProduct = useMemo(() => {
    const chosen = products.find((p) => p.id === productId)
    if (!chosen) return []
    return products
      .filter((p) => p.name === chosen.name && p.variant)
      .map((p) => p.variant!)
  }, [products, productId])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(null)

    const qty = Number(quantity)
    if (!productId) return setError('Pick what was made.')
    if (!qty || qty <= 0) return setError('Enter how many were made.')

    setSaving(true)
    const { error } = await supabase.from('production_log').insert({
      product_id: productId,
      variant: variant.trim() || null,
      quantity: qty,
      produced_by: producedBy.trim() || null,
      produced_on: producedOn,
      notes: notes.trim() || null,
    })
    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    const chosen = products.find((p) => p.id === productId)
    setSaved(
      `Logged ${qty} × ${chosen ? productLabel(chosen) : 'item'}${
        variant ? ` (${variant})` : ''
      }.`,
    )
    // Keep product, maker and date — the next entry is usually more of the same.
    setQuantity('')
    setNotes('')
    await refresh()
  }

  return (
    <>
      <PageHeader
        title="Production log"
        subtitle="What was made, by whom, and when."
      />
      <ErrorBox message={error} />
      {saved && <p className="success pad">{saved}</p>}

      <form className="card form-card" onSubmit={onSubmit}>
        <div className="grid-2">
          <label className="field">
            <span>What was made *</span>
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value)
                const p = products.find((x) => x.id === e.target.value)
                setVariant(p?.variant ?? '')
              }}
              required
            >
              <option value="">— pick a product —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {productLabel(p)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>How many *</span>
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </label>
        </div>

        <label className="field">
          <span>Colour / variant</span>
          <input
            value={variant}
            onChange={(e) => setVariant(e.target.value)}
            placeholder="e.g. Black"
          />
          {variantsForProduct.length > 0 && (
            <div className="chips">
              {variantsForProduct.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={variant === v ? 'chip active' : 'chip'}
                  onClick={() => setVariant(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </label>

        <div className="grid-2">
          <label className="field">
            <span>Made by</span>
            <input
              value={producedBy}
              onChange={(e) => setProducedBy(e.target.value)}
              placeholder="Name"
            />
          </label>
          <label className="field">
            <span>Date</span>
            <input
              type="date"
              value={producedOn}
              onChange={(e) => setProducedOn(e.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span>Notes</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything worth remembering about this batch"
          />
        </label>

        <div className="row gap end">
          <button className="btn primary" disabled={saving}>
            {saving ? 'Logging…' : 'Log production'}
          </button>
        </div>
      </form>

      <h2 className="section-title">Recent entries</h2>
      {rows === null ? (
        <Loading what="Loading log" />
      ) : rows.length === 0 ? (
        <Empty>Nothing logged yet.</Empty>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Colour</th>
                <th className="right">Qty</th>
                <th>Made by</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{shortDate(r.produced_on)}</td>
                  <td>{r.products?.name ?? '—'}</td>
                  <td>{r.variant ?? '—'}</td>
                  <td className="right mono">{r.quantity}</td>
                  <td>{r.produced_by ?? '—'}</td>
                  <td className="muted">{r.notes ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
