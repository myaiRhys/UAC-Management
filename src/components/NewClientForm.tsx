import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Client } from '../lib/types'

/**
 * Inline "add a client without leaving this page" panel. Saves straight to
 * public.clients and hands the new row back so the caller can select it.
 */
export default function NewClientForm({
  onCreated,
  onCancel,
}: {
  onCreated: (client: Client) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('A business name is needed.')
      return
    }

    setSaving(true)
    setError(null)

    const { data, error } = await supabase
      .from('clients')
      .insert({
        name: trimmed,
        contact_name: contactName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
      })
      .select('*')
      .single()

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    onCreated(data as Client)
  }

  return (
    <div className="inline-form">
      <div className="inline-form-head">
        <strong>New client</strong>
        <span className="muted small">
          Saved to Clients — add the rest of their details there later.
        </span>
      </div>

      <label className="field">
        <span>Business name *</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            // Enter saves; the surrounding page is not a form of its own.
            if (e.key === 'Enter') {
              e.preventDefault()
              void save()
            }
          }}
          placeholder="e.g. Shell Retreat"
          autoFocus
        />
      </label>

      <div className="grid-2">
        <label className="field">
          <span>Contact person</span>
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
      </div>

      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      {error && <p className="error small">{error}</p>}

      <div className="row gap end">
        <button type="button" className="btn ghost small" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn primary small"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? 'Saving…' : 'Save client'}
        </button>
      </div>
    </div>
  )
}
