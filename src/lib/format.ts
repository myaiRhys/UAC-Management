const rand = new Intl.NumberFormat('en-ZA', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function money(value: number): string {
  return `R ${rand.format(Number.isFinite(value) ? value : 0)}`
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function productLabel(p: {
  name: string
  variant?: string | null
}): string {
  return p.variant ? `${p.name} — ${p.variant}` : p.name
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
