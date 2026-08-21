import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { money, shortDate } from '../lib/format'
import {
  daysSince,
  isCommitted,
  isLive,
  lineLabel,
  monthStart,
  productionLabel,
  sumWhere,
  tally,
  type LineRow,
  type OrderRow,
  type ProductionRow,
} from '../lib/dashboard'
import { ErrorBox, Loading, PageHeader, StatusPill } from '../components/Bits'
import BarList, { StatTile } from '../components/BarList'

// Validated against a white surface: both clear 3:1 and every CVD gate.
const HUE_OWED = '#2a78d6'
const HUE_MADE = '#15794f'

export default function Dashboard() {
  const [orders, setOrders] = useState<OrderRow[] | null>(null)
  const [lines, setLines] = useState<LineRow[]>([])
  const [madeThisMonth, setMadeThisMonth] = useState<ProductionRow[]>([])
  const [recentProduction, setRecentProduction] = useState<ProductionRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const since = monthStart()

      const [ordersRes, monthRes, recentRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*, clients(name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('production_log')
          .select('*, products(name, variant)')
          .gte('produced_on', since),
        supabase
          .from('production_log')
          .select('*, products(name, variant)')
          .order('produced_on', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(6),
      ])

      if (cancelled) return
      const failed = ordersRes.error ?? monthRes.error ?? recentRes.error
      if (failed) setError(failed.message)

      const allOrders = (ordersRes.data ?? []) as OrderRow[]
      setOrders(allOrders)
      setMadeThisMonth((monthRes.data ?? []) as ProductionRow[])
      setRecentProduction((recentRes.data ?? []) as ProductionRow[])

      // Only the committed documents need their lines pulled.
      const committedIds = allOrders.filter(isCommitted).map((o) => o.id)
      if (committedIds.length) {
        const linesRes = await supabase
          .from('order_lines')
          .select('*, products(name, variant)')
          .in('order_id', committedIds)
        if (cancelled) return
        if (linesRes.error) setError(linesRes.error.message)
        setLines((linesRes.data ?? []) as LineRow[])
      } else {
        setLines([])
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const view = useMemo(() => {
    const all = orders ?? []
    return {
      awaitingPayment: sumWhere(
        all,
        (o) => o.doc_type === 'invoice' && o.status === 'sent',
      ),
      quotesOut: sumWhere(
        all,
        (o) => o.doc_type === 'quote' && o.status === 'sent',
      ),
      accepted: sumWhere(
        all,
        (o) => o.doc_type === 'quote' && o.status === 'accepted',
      ),
      owed: tally(
        lines.map((l) => ({
          label: lineLabel(l),
          quantity: Number(l.quantity),
        })),
      ),
      made: tally(
        madeThisMonth.map((r) => ({
          label: productionLabel(r),
          quantity: Number(r.quantity),
        })),
      ),
      live: all
        .filter(isLive)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }
  }, [orders, lines, madeThisMonth])

  if (orders === null) return <Loading what="Loading dashboard" />

  const madeTotal = view.made.reduce((sum, r) => sum + r.units, 0)
  // Both panels count units of the same products, so they share one scale —
  // otherwise "made" would look like it matches "owed" whatever the numbers.
  const unitScale = Math.max(
    0,
    ...view.owed.map((r) => r.units),
    ...view.made.map((r) => r.units),
  )

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Where the money and the making stand today."
        actions={
          <>
            <Link className="btn ghost" to="/production">
              Log production
            </Link>
            <Link className="btn primary" to="/orders/new">
              New document
            </Link>
          </>
        }
      />
      <ErrorBox message={error} />

      <div className="stat-row">
        <StatTile
          label="Awaiting payment"
          value={money(view.awaitingPayment.total)}
          note={`${view.awaitingPayment.count} invoice${
            view.awaitingPayment.count === 1 ? '' : 's'
          } sent, unpaid`}
        />
        <StatTile
          label="Quotes out"
          value={money(view.quotesOut.total)}
          note={`${view.quotesOut.count} awaiting a reply`}
        />
        <StatTile
          label="Accepted, to invoice"
          value={money(view.accepted.total)}
          note={`${view.accepted.count} quote${
            view.accepted.count === 1 ? '' : 's'
          } agreed`}
        />
        <StatTile
          label="Made this month"
          value={String(madeTotal)}
          note={madeTotal === 1 ? 'unit logged' : 'units logged'}
        />
      </div>

      <div className="panel-row">
        <section className="card panel">
          <h2 className="panel-title">Still owed to clients</h2>
          <p className="muted small panel-note">
            Units on accepted quotes, unpaid invoices and uncollected
            collection sheets.
          </p>
          <BarList
            rows={view.owed}
            hue={HUE_OWED}
            scaleMax={unitScale}
            empty="Nothing outstanding — every agreed document is closed out."
          />
        </section>

        <section className="card panel">
          <h2 className="panel-title">Made this month</h2>
          <p className="muted small panel-note">
            From the production log, {shortDate(monthStart())} onwards. Bars
            share a scale with the panel on the left.
          </p>
          <BarList
            rows={view.made}
            hue={HUE_MADE}
            scaleMax={unitScale}
            empty="Nothing logged this month yet."
          />
        </section>
      </div>

      <h2 className="section-title">Needs attention</h2>
      {view.live.length === 0 ? (
        <div className="empty">
          Nothing open. Every quote and invoice is settled or cancelled.
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Type</th>
                <th>Client</th>
                <th>Raised</th>
                <th>Waiting</th>
                <th>Status</th>
                <th className="right">Total</th>
              </tr>
            </thead>
            <tbody>
              {view.live.map((o) => {
                const days = daysSince(o.created_at)
                return (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/orders/${o.id}`}>
                        {o.order_number ?? 'Draft'}
                      </Link>
                    </td>
                    <td className="capitalise">{o.doc_type}</td>
                    <td>{o.clients?.name ?? '—'}</td>
                    <td>{shortDate(o.created_at)}</td>
                    <td className={days >= 14 ? 'stale' : undefined}>
                      {days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'}`}
                    </td>
                    <td>
                      <StatusPill status={o.status} />
                    </td>
                    <td className="right mono">{money(Number(o.total))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="section-title">Recent production</h2>
      {recentProduction.length === 0 ? (
        <div className="empty">Nothing logged yet.</div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th className="right">Qty</th>
                <th>Made by</th>
              </tr>
            </thead>
            <tbody>
              {recentProduction.map((r) => (
                <tr key={r.id}>
                  <td>{shortDate(r.produced_on)}</td>
                  <td>{productionLabel(r)}</td>
                  <td className="right mono">{r.quantity}</td>
                  <td>{r.produced_by ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
