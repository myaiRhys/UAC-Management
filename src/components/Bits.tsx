import type { ReactNode } from 'react'
import type { OrderStatus } from '../lib/types'

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="page-header no-print">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="row gap">{actions}</div>}
    </div>
  )
}

export function StatusPill({ status }: { status: OrderStatus }) {
  return <span className={`pill status-${status}`}>{status}</span>
}

export function Loading({ what = 'Loading' }: { what?: string }) {
  return <p className="muted pad">{what}…</p>
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="error pad">{message}</p>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}
