import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Client } from '../lib/types'
import { Empty, ErrorBox, Loading, PageHeader } from '../components/Bits'

export default function Clients() {
  const [clients, setClients] = useState<Client[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase
      .from('clients')
      .select('*')
      .order('name')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setClients(data as Client[])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const term = search.trim().toLowerCase()
  const visible = (clients ?? []).filter((c) =>
    term
      ? [c.name, c.contact_name, c.phone, c.email]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(term))
      : true,
  )

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Petrol stations and other accounts UAC supplies."
        actions={
          <Link className="btn primary" to="/clients/new">
            New client
          </Link>
        }
      />
      <ErrorBox message={error} />

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search name, contact, phone, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {clients === null ? (
        <Loading what="Loading clients" />
      ) : visible.length === 0 ? (
        <Empty>
          {clients.length === 0
            ? 'No clients yet. Add the first one to start quoting.'
            : 'No clients match that search.'}
        </Empty>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Email</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/clients/${c.id}`}>{c.name}</Link>
                  </td>
                  <td>{c.contact_name ?? '—'}</td>
                  <td>{c.phone ?? '—'}</td>
                  <td>{c.email ?? '—'}</td>
                  <td className="right">
                    <Link className="btn ghost small" to={`/clients/${c.id}`}>
                      Edit
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
