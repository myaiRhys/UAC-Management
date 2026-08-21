import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Client } from '../lib/types'
import { ErrorBox, Loading, PageHeader } from '../components/Bits'

type Form = {
  name: string
  contact_name: string
  phone: string
  email: string
  notes: string
}

const BLANK: Form = {
  name: '',
  contact_name: '',
  phone: '',
  email: '',
  notes: '',
}

export default function ClientEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id

  const [form, setForm] = useState<Form>(BLANK)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isNew) return
    let cancelled = false
    supabase
      .from('clients')
      .select('*')
      .eq('id', id!)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else if (data) {
          const c = data as Client
          setForm({
            name: c.name ?? '',
            contact_name: c.contact_name ?? '',
            phone: c.phone ?? '',
            email: c.email ?? '',
            notes: c.notes ?? '',
          })
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, isNew])

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      name: form.name.trim(),
      contact_name: form.contact_name.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const { error } = isNew
      ? await supabase.from('clients').insert(payload)
      : await supabase.from('clients').update(payload).eq('id', id!)

    setSaving(false)
    if (error) setError(error.message)
    else navigate('/clients')
  }

  async function onDelete() {
    if (!id) return
    if (
      !confirm(
        'Delete this client? Any quotes or invoices already raised for them will keep their line items but lose the client link.',
      )
    )
      return
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) setError(error.message)
    else navigate('/clients')
  }

  if (loading) return <Loading what="Loading client" />

  return (
    <>
      <PageHeader title={isNew ? 'New client' : form.name || 'Client'} />
      <ErrorBox message={error} />

      <form className="card form-card" onSubmit={onSubmit}>
        <label className="field">
          <span>Business name *</span>
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            required
            autoFocus
          />
        </label>

        <div className="grid-2">
          <label className="field">
            <span>Contact person</span>
            <input
              value={form.contact_name}
              onChange={(e) => set('contact_name', e.target.value)}
            />
          </label>
          <label className="field">
            <span>Phone</span>
            <input
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </label>

        <label className="field">
          <span>Notes</span>
          <textarea
            rows={4}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Delivery instructions, usual order, who signs for stock…"
          />
        </label>

        <div className="row gap end">
          {!isNew && (
            <button type="button" className="btn danger" onClick={onDelete}>
              Delete
            </button>
          )}
          <button
            type="button"
            className="btn ghost"
            onClick={() => navigate('/clients')}
          >
            Cancel
          </button>
          <button className="btn primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save client'}
          </button>
        </div>
      </form>
    </>
  )
}
