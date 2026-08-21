import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Product } from '../lib/types'
import { money } from '../lib/format'
import { ErrorBox, Loading, PageHeader } from '../components/Bits'

/** Reference view of the seeded price list, plus the questions still open. */
export default function Products() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('products')
      .select('*')
      .order('name')
      .order('variant')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setProducts((data ?? []) as Product[])
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <PageHeader
        title="Price list"
        subtitle="Prices come from the products table in Supabase. Edit them there for now."
      />
      <ErrorBox message={error} />

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

      {products === null ? (
        <Loading what="Loading price list" />
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th>Unit</th>
                <th className="right">Price</th>
                <th className="right">Bulk price</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className={p.active ? undefined : 'dim'}>
                  <td>{p.name}</td>
                  <td>{p.variant ?? '—'}</td>
                  <td className="muted">{p.unit_label ?? 'each'}</td>
                  <td className="right mono">{money(Number(p.unit_price))}</td>
                  <td className="right mono">
                    {p.bulk_unit_price != null
                      ? `${money(Number(p.bulk_unit_price))} @ ${p.bulk_qty_threshold}+`
                      : '—'}
                  </td>
                  <td className="right">
                    {!p.active && <span className="pill">inactive</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
