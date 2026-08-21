import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { COMPANY } from '../lib/company'

const NAV = [
  { to: '/orders', label: 'Quotes & Invoices' },
  { to: '/clients', label: 'Clients' },
  { to: '/production', label: 'Production' },
  { to: '/products', label: 'Price list' },
]

export default function Layout() {
  const { session, signOut } = useAuth()

  return (
    <div className="app">
      <header className="topbar no-print">
        <div className="topbar-inner">
          <div className="brand">
            <strong>{COMPANY.name}</strong>
            <span className="muted small">Forecourt supplies</span>
          </div>
          <nav className="nav">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? 'nav-link active' : 'nav-link'
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="topbar-user">
            <span className="muted small">{session?.user.email}</span>
            <button className="btn ghost small" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
