import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const errors = []
const step = (m) => console.log('•', m)
// The mock accepts any credentials; override only when pointing at a real project.
const EMAIL = process.env.SMOKE_EMAIL ?? 'smoke@example.com'
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'smoke-password'
const field = (page, caption) =>
  page.locator(`label:has(> span:text-is("${caption}"))`).locator('input, select, textarea')

const browser = await chromium.launch()
const page = await browser.newPage()
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(BASE)

// --- login ---
await field(page, 'Email').fill(EMAIL)
await field(page, 'Password').fill(PASSWORD)
await page.getByRole('button', { name: 'Sign in' }).click()
await page.getByRole('heading', { name: 'Quotes & Invoices' }).waitFor({ timeout: 15000 })
step('logged in')

// --- create a client ---
const clientName = 'Shell Retreat (e2e ' + Date.now() + ')'
await page.getByRole('link', { name: 'Clients' }).click()
await page.getByRole('link', { name: 'New client' }).click()
await field(page, 'Business name *').fill(clientName)
await field(page, 'Contact person').fill('Site manager')
await field(page, 'Phone').fill('021 555 0100')
await page.getByRole('button', { name: 'Save client' }).click()
await page.getByRole('link', { name: clientName }).waitFor({ timeout: 15000 })
step('client created')

// --- edit the client ---
await page.getByRole('link', { name: clientName }).click()
await field(page, 'Email').fill('manager@example.com')
await page.getByRole('button', { name: 'Save client' }).click()
await page.getByRole('link', { name: clientName }).waitFor({ timeout: 15000 })
step('client edited')

// --- add a client without leaving the document screen ---
await page.getByRole('link', { name: 'Quotes & Invoices' }).click()
await page.getByRole('link', { name: 'New document' }).click()
const inlineName = 'Engen Tokai (e2e ' + Date.now() + ')'
await page.getByRole('button', { name: '+ New' }).click()
await field(page, 'Business name *').fill(inlineName)
await field(page, 'Contact person').fill('Forecourt supervisor')
await page.getByRole('button', { name: 'Save client' }).click()
await page.locator('.inline-form').waitFor({ state: 'detached', timeout: 15000 })
const picked = await field(page, 'Client').locator('option:checked').textContent()
console.log('  client selected after inline add:', picked)
if (picked !== inlineName) {
  errors.push(`inline client not selected: expected ${inlineName}, got ${picked}`)
}
step('client added from the document screen')

// --- build a quote: 30 black + 30 blue squeegees should hit the 50+ tier ---
await field(page, 'Client').selectOption({ label: clientName })

const rows = () => page.locator('table.lines tbody tr')
await rows().nth(0).locator('select').selectOption({ label: 'Squeegee — Black' })
await rows().nth(0).locator('input.num').first().fill('30')
await page.getByRole('button', { name: '+ Add line' }).click()
await rows().nth(1).locator('select').selectOption({ label: 'Squeegee — Blue' })
await rows().nth(1).locator('input.num').first().fill('30')

const total = await page.locator('.total-row strong').textContent()
const bulkTags = await page.locator('.bulk-tag').count()
console.log('  total with 60 squeegees:', total, '| bulk tags:', bulkTags)
if (!total.includes('1 470.00') && !total.includes('1,470.00')) {
  errors.push(`BULK RULE WRONG: expected 60 x R24.50 = R1470.00, got ${total}`)
}
if (bulkTags !== 2) errors.push(`expected 2 bulk tags, saw ${bulkTags}`)

// a non-bulk product should stay at list price
await page.getByRole('button', { name: '+ Add line' }).click()
await rows().nth(2).locator('select').selectOption({ label: 'Garage Roll — Standard' })
await rows().nth(2).locator('input.num').first().fill('2')
const total2 = await page.locator('.total-row strong').textContent()
console.log('  total + 2 standard garage rolls:', total2)
if (!total2.replace(/\s|,/g, '').includes('1940.00')) {
  errors.push(`MIXED TOTAL WRONG: expected R1940.00, got ${total2}`)
}

await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/, { timeout: 15000 })
step('quote saved as draft')

// --- promote to invoice and mark paid ---
await field(page, 'Document type').selectOption('invoice')
await page.getByRole('button', { name: 'Mark paid' }).click()
await page.locator('.pill.status-paid').waitFor({ timeout: 15000 })
const num = await page.locator('h1').textContent()
console.log('  document is now:', num)
if (!/INV\d{4}/.test(num)) errors.push(`expected an INV number, got ${num}`)
step('invoiced and marked paid')

// --- print view ---
await page.getByRole('link', { name: 'Print / PDF' }).click()
await page.locator('.doc').waitFor({ timeout: 15000 })
const doc = await page.locator('.doc').innerText()
for (const needle of [
  'UAC Services',
  '082 826 1003',
  'marketing@shadesolutions.co.za',
  'Unit 10 Celie Industrial Park',
  'Retreat',
  'Cape Town',
  'not registered for VAT',
  'Banking details to follow',
  clientName,
]) {
  if (!doc.includes(needle)) errors.push(`print view missing: ${needle}`)
}
await page.screenshot({ path: process.env.SHOT ?? 'invoice.png', fullPage: true })
step('print view rendered')

// --- production log ---
await page.goto(BASE + '/production')
await field(page, 'What was made *').selectOption({ label: 'Squeegee — Red' })
await field(page, 'How many *').fill('120')
await field(page, 'Made by').fill('Dani')
await page.getByRole('button', { name: 'Log production' }).click()
await page.locator('.success').waitFor({ timeout: 15000 })
const logged = await page.locator('table tbody tr').first().innerText()
console.log('  newest log row:', logged.replace(/\n/g, ' | '))
if (!logged.includes('120') || !logged.includes('Dani')) {
  errors.push('production entry did not appear in the log')
}
step('production logged')

// --- the inline client is a real row, not just local state ---
await page.goto(BASE + '/clients')
await page.getByRole('link', { name: inlineName }).waitFor({ timeout: 15000 })
step('inline client persisted to the clients list')

// --- price list gap callout ---
await page.goto(BASE + '/products')
const callout = await page.locator('.callout').innerText()
if (!callout.includes('Nozzle covers') || !callout.includes('Banking details')) {
  errors.push('price list is not flagging the open questions')
}
step('gaps flagged on price list')

await browser.close()

if (errors.length) {
  console.log('\nFAILURES:')
  for (const e of errors) console.log(' -', e)
  process.exit(1)
}
console.log('\nALL CHECKS PASSED')
