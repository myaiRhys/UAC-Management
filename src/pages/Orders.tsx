import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { DocType, Order } from '../lib/types'
import { money, shortDate } from '../lib/format'
import {
  Empty,
  ErrorBox,
  Loading,
  PageHeader,
  StatusPill,
} from '../components/Bits'

type Row = Order & { clients: { name: string } | null }

const FILTERS: { key: DocType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'quote', label: 'Quotes' },
  { key: 'invoice', label: 'Invoices' },
  { key: 'collection', label: 'Collections' },
]

export default function Orders() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<DocType | 'all'>('all')

  useEffect(() => {
    let cancelled = false
    supabase
      .from('orders')
      .select('*, clients(name)')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setRows((data ?? []) as Row[])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const visible = (rows ?? []).filter(
    (r) => filter === 'all' || r.doc_type === filter,
  )

  return (
    <>
      <PageHeader
        title="Quotes & Invoices"
        subtitle="No VAT is charged — UAC is not VAT-registered."
        actions={
          <Link className="btn primary" to="/orders/new">
            New document
          </Link>
        }
      />
      <ErrorBox message={error} />

      <div className="toolbar">
        <div className="tabs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={filter === f.key ? 'tab active' : 'tab'}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {rows === null ? (
        <Loading what="Loading documents" />
      ) : visible.length === 0 ? (
        <Empty>Nothing here yet. Create a quote or invoice to get going.</Empty>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Type</th>
                <th>Client</th>
                <th>Date</th>
                <th>Status</th>
                <th className="right">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/orders/${r.id}`}>
                      {r.order_number ?? 'Draft'}
                    </Link>
                  </td>
                  <td className="capitalise">{r.doc_type}</td>
                  <td>{r.clients?.name ?? '—'}</td>
                  <td>{shortDate(r.created_at)}</td>
                  <td>
                    <StatusPill status={r.status} />
                  </td>
                  <td className="right mono">{money(Number(r.total))}</td>
                  <td className="right">
                    <Link
                      className="btn ghost small"
                      to={`/orders/${r.id}/print`}
                    >
                      Print
                    </Link>
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
