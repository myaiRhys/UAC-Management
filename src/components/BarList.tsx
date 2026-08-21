import type { Tally } from '../lib/dashboard'

/**
 * A ranked horizontal bar list. One measure, one hue — magnitude only, so a
 * sequential single colour rather than a per-category palette. Every bar
 * carries its value at the tip: with a handful of rows the number is what the
 * reader is actually after, and it keeps the list readable if the hue is hard
 * to judge by length alone.
 *
 * Pass `scaleMax` to put two lists on one scale. Two lists of the same unit
 * sitting side by side get compared by eye, so letting each normalise to its
 * own biggest row would make a shorter list look like a match for a longer one.
 */
export default function BarList({
  rows,
  hue,
  unit = 'units',
  empty,
  scaleMax,
}: {
  rows: Tally[]
  hue: string
  unit?: string
  empty: string
  scaleMax?: number
}) {
  if (rows.length === 0) return <p className="muted pad-sm">{empty}</p>

  const max = Math.max(scaleMax ?? 0, ...rows.map((r) => r.units))

  return (
    <ul className="barlist">
      {rows.map((row) => (
        <li key={row.label} title={`${row.label}: ${row.units} ${unit}`}>
          <span className="barlist-label">{row.label}</span>
          <span className="barlist-track">
            <span
              className="barlist-bar"
              style={{
                width: `${Math.max(2, (row.units / max) * 100)}%`,
                background: hue,
              }}
            />
          </span>
          <span className="barlist-value mono">{row.units}</span>
        </li>
      ))}
    </ul>
  )
}

export function StatTile({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note?: string
}) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {note && <span className="muted small">{note}</span>}
    </div>
  )
}
