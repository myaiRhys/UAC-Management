import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Product } from '../lib/types'
import { money } from '../lib/format'
import { ErrorBox, Loading, PageHeader } from '../components/Bits'

/** The editable fields, held as strings so a half-typed value is not fought. */
type Draft = {
  unit_price: string
  bulk_unit_price: string
  bulk_qty_threshold: string
}

const numberOrNull = (v: string) => (v.trim() === '' ? null : Number(v))

function toDraft(p: Product): Draft {
  return {
    unit_price: String(p.unit_price ?? ''),
    bulk_unit_price: p.bulk_unit_price == null ? '' : String(p.bulk_unit_price),
    bulk_qty_threshold:
      p.bulk_qty_threshold == null ? '' : String(p.bulk_qty_threshold),
  }
}

function isDirty(a: Draft, b: Draft): boolean {
  return (
    a.unit_price !== b.unit_price ||
    a.bulk_unit_price !== b.bulk_unit_price ||
    a.bulk_qty_threshold !== b.bulk_qty_threshold
  )
}

/** Returns a problem to show against the row, or null when it is fine. */
function validate(draft: Draft, name: string): string | null {
  const price = numberOrNull(draft.unit_price)
  const bulkPrice = numberOrNull(draft.bulk_unit_price)
  const bulkQty = numberOrNull(draft.bulk_qty_threshold)

  if (price == null || !Number.isFinite(price) || price < 0) {
    return `${name}: needs a price of zero or more.`
  }
  if ((bulkPrice == null) !== (bulkQty == null)) {
    return `${name}: a bulk price needs a quantity to kick in at, and vice versa.`
  }
  if (bulkQty != null && (!Number.isInteger(bulkQty) || bulkQty < 2)) {
    return `${name}: the bulk quantity must be a whole number of 2 or more.`
  }
  if (bulkPrice != null && (!Number.isFinite(bulkPrice) || bulkPrice < 0)) {
    return `${name}: the bulk price must be zero or more.`
  }
  if (bulkPrice != null && price != null && bulkPrice > price) {
    return `${name}: the bulk price is higher than the normal price.`
  }
  return null
}

export default function Products() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [saved, setSaved] = useState<Record<string, Draft>>({})
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('products')
      .select('*')
      .order('name')
      .order('variant')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setError(error.message)
          return
        }
        const rows = (data ?? []) as Product[]
        const asDrafts = Object.fromEntries(rows.map((p) => [p.id, toDraft(p)]))
        setProducts(rows)
        setSaved(asDrafts)
        setDrafts(asDrafts)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const changed = useMemo(
    () =>
      (products ?? []).filter(
        (p) => saved[p.id] && drafts[p.id] && isDirty(drafts[p.id], saved[p.id]),
      ),
    [products, drafts, saved],
  )

  const problems = useMemo(
    () =>
      changed
        .map((p) =>
          validate(drafts[p.id], p.variant ? `${p.name} — ${p.variant}` : p.name),
        )
        .filter((m): m is string => m !== null),
    [changed, drafts],
  )

  function set(id: string, field: keyof Draft, value: string) {
    setNote(null)
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [field]: value } }))
  }

  function revert() {
    setDrafts(saved)
    setNote(null)
    setError(null)
  }

  async function save() {
    if (problems.length) return
    setSaving(true)
    setError(null)

    const results = await Promise.all(
      changed.map((p) => {
        const draft = drafts[p.id]
        return supabase
          .from('products')
          .update({
            unit_price: Number(draft.unit_price),
            bulk_unit_price: numberOrNull(draft.bulk_unit_price),
            bulk_qty_threshold: numberOrNull(draft.bulk_qty_threshold),
            updated_at: new Date().toISOString(),
          })
          .eq('id', p.id)
      }),
    )

    setSaving(false)
    const failed = results.find((r) => r.error)
    if (failed?.error) {
      setError(failed.error.message)
      return
    }

    const count = changed.length
    setSaved(drafts)
    setProducts((ps) =>
      (ps ?? []).map((p) =>
        drafts[p.id]
          ? {
              ...p,
              unit_price: Number(drafts[p.id].unit_price),
              bulk_unit_price: numberOrNull(drafts[p.id].bulk_unit_price),
              bulk_qty_threshold: numberOrNull(drafts[p.id].bulk_qty_threshold),
            }
          : p,
      ),
    )
    setNote(`${count} price${count === 1 ? '' : 's'} updated.`)
  }

  if (products === null && !error) return <Loading what="Loading price list" />

  return (
    <>
      <PageHeader
        title="Price list"
        subtitle="Edit a price and save. Quotes and invoices already raised keep the price they were saved with."
        actions={
          changed.length > 0 ? (
            <>
              <button className="btn ghost" onClick={revert} disabled={saving}>
                Revert
              </button>
              <button
                className="btn primary"
                onClick={() => void save()}
                disabled={saving || problems.length > 0}
              >
                {saving
                  ? 'Saving…'
                  : `Save ${changed.length} change${
                      changed.length === 1 ? '' : 's'
                    }`}
              </button>
            </>
          ) : undefined
        }
      />
      <ErrorBox message={error} />
      {note && <p className="success pad">{note}</p>}
      {problems.map((p) => (
        <p className="error pad-sm" key={p}>
          {p}
        </p>
      ))}

      <div className="callout">
        <strong>Waiting on Rhys</strong>
        <ul>
          <li>
            <strong>Nozzle covers</strong> — no price confirmed, so there is no
            nozzle cover on the list below. (&ldquo;Out of Order Cover&rdquo; at{' '}
            {money(120)} is a different item.) Quote them as a custom line until
            the price is set.
          </li>
          <li>
            <strong>Banking details</strong> — invoices print
            &ldquo;banking details to follow&rdquo; until a UAC account is
            confirmed. Nothing has been invented.
          </li>
        </ul>
      </div>

      <div className="card">
        <table className="table prices">
          <thead>
            <tr>
              <th>Product</th>
              <th>Variant</th>
              <th>Unit</th>
              <th className="right">Price</th>
              <th className="right">Bulk price</th>
              <th className="right">Bulk from</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(products ?? []).map((p) => {
              const draft = drafts[p.id]
              if (!draft) return null
              const dirty = saved[p.id] && isDirty(draft, saved[p.id])
              return (
                <tr
                  key={p.id}
                  className={
                    [p.active ? '' : 'dim', dirty ? 'dirty' : '']
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                >
                  <td>{p.name}</td>
                  <td>{p.variant ?? '—'}</td>
                  <td className="muted">{p.unit_label ?? 'each'}</td>
                  <td className="right">
                    <input
                      className="num price-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft.unit_price}
                      aria-label={`Price for ${p.name}${
                        p.variant ? ` ${p.variant}` : ''
                      }`}
                      onChange={(e) => set(p.id, 'unit_price', e.target.value)}
                    />
                  </td>
                  <td className="right">
                    <input
                      className="num price-input"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="—"
                      value={draft.bulk_unit_price}
                      aria-label={`Bulk price for ${p.name}${
                        p.variant ? ` ${p.variant}` : ''
                      }`}
                      onChange={(e) =>
                        set(p.id, 'bulk_unit_price', e.target.value)
                      }
                    />
                  </td>
                  <td className="right">
                    <input
                      className="num price-input qty-input"
                      type="number"
                      min={2}
                      step={1}
                      placeholder="—"
                      value={draft.bulk_qty_threshold}
                      aria-label={`Bulk quantity for ${p.name}${
                        p.variant ? ` ${p.variant}` : ''
                      }`}
                      onChange={(e) =>
                        set(p.id, 'bulk_qty_threshold', e.target.value)
                      }
                    />
                  </td>
                  <td className="right">
                    {!p.active && <span className="pill">inactive</span>}
                    {dirty && <span className="pill changed">edited</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="muted small">
        Prices are in rand. Leave both bulk fields empty for a product with no
        bulk rate.
      </p>
    </>
  )
}
