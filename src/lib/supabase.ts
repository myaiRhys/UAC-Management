import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// The uac-services project. The publishable key is meant to ship in the browser
// bundle — row level security, not secrecy, is what guards the data — so it is
// checked in to keep deploys configuration-free. Set the env vars to point a
// build somewhere else (a branch database, a local stack).
const DEFAULT_URL = 'https://ifqazfvsfkhwzljhqwia.supabase.co'
const DEFAULT_KEY = 'sb_publishable_U3fy6Jb0MRrxge3Sv03gWg_8mmm8Zpt'

const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_KEY

export const supabase = createClient<Database>(url, key)
