import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Client, Order, OrderLine } from '../lib/types'
import { money, shortDate } from '../lib/format'
import { COMPANY } from '../lib/company'
import { ErrorBox, Loading } from '../components/Bits'

const TITLES: Record<string, string> = {
  quote: 'Quotation',
  invoice: 'Invoice',
  collection: 'Collection Note',
}

export default function OrderPrint() {
  const { id } = useParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [lines, setLines] = useState<OrderLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [orderRes, linesRes] = await Promise.all([
        supabase.from('orders').select('*, clients(*)').eq('id', id!).single(),
        supabase
          .from('order_lines')
          .select('*')
          .eq('order_id', id!)
          .order('sort_order'),
      ])
      if (cancelled) return
      if (orderRes.error) setError(orderRes.error.message)
      else if (orderRes.data) {
        const row = orderRes.data as Order & { clients: Client | null }
        setOrder(row)
        setClient(row.clients)
      }
      if (linesRes.error) setError(linesRes.error.message)
      else setLines((linesRes.data ?? []) as OrderLine[])
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) return <Loading what="Loading document" />
  if (!order) return <ErrorBox message={error ?? 'Document not found.'} />

  const isInvoice = order.doc_type === 'invoice'
  const title = TITLES[order.doc_type] ?? 'Document'

  return (
    <div className="print-page">
      <div className="print-bar no-print">
        <Link className="btn ghost" to={`/orders/${order.id}`}>
          ← Back to editor
        </Link>
        <button className="btn primary" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      <ErrorBox message={error} />

      <article className="doc">
        <header className="doc-head">
          <div className="doc-from">
            <h1>{COMPANY.name}</h1>
            {COMPANY.addressLines.map((l) => (
              <div key={l}>{l}</div>
            ))}
            <div>{COMPANY.phone}</div>
            <div>{COMPANY.email}</div>
          </div>
          <div className="doc-meta">
            <h2>{title}</h2>
            <dl>
              <dt>Number</dt>
              <dd>{order.order_number ?? 'DRAFT'}</dd>
              <dt>Date</dt>
              <dd>{shortDate(order.created_at)}</dd>
              <dt>Status</dt>
              <dd className="capitalise">{order.status}</dd>
            </dl>
          </div>
        </header>

        <section className="doc-to">
          <h3>{isInvoice ? 'Invoice to' : 'For'}</h3>
          {client ? (
            <>
              <div className="strong">{client.name}</div>
              {client.contact_name && <div>{client.contact_name}</div>}
              {client.phone && <div>{client.phone}</div>}
              {client.email && <div>{client.email}</div>}
            </>
          ) : (
            <div className="muted">No client selected</div>
          )}
        </section>

        <table className="doc-table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="right">Qty</th>
              <th className="right">Unit price</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td>{l.description}</td>
                <td className="right">{Number(l.quantity)}</td>
                <td className="right">{money(Number(l.unit_price))}</td>
                <td className="right">{money(Number(l.line_total))}</td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No line items.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="right strong">
                Total due
              </td>
              <td className="right strong">{money(Number(order.total))}</td>
            </tr>
          </tfoot>
        </table>

        <p className="doc-vat">
          UAC Services is not registered for VAT. No VAT is charged on this
          document.
        </p>

        {order.notes && (
          <section className="doc-notes">
            <h3>Notes</h3>
            <p>{order.notes}</p>
          </section>
        )}

        {isInvoice && (
          <section className="doc-banking">
            <h3>Payment</h3>
            {/* Left deliberately blank until Rhys confirms the UAC account. */}
            <p>{COMPANY.bankingNote}</p>
          </section>
        )}

        <footer className="doc-foot">
          {COMPANY.name} · {COMPANY.phone} · {COMPANY.email}
        </footer>
      </article>
    </div>
  )
}
