import type { SharePayload } from './shareLink'

// Supabase (your project) backs live sharing: a `shares` table with an
// `id` (text) and `data` (jsonb) column, RLS-scoped to public read/insert/
// update on just that table. The publishable key is meant to be embedded
// client-side — access control comes from the RLS policies, not secrecy.
const SUPABASE_URL = 'https://qazruufilcmaigisqpps.supabase.co'
const SUPABASE_KEY = 'sb_publishable_UkJKvY0yOYLcNVZwrwHuGQ_stfwak6M'
const TABLE_URL = `${SUPABASE_URL}/rest/v1/shares`

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
}

async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (err) {
    // fetch() throws a generic TypeError for both offline connections and
    // CORS rejections — there's no way to tell them apart from here.
    throw new Error(`network/CORS error reaching Supabase (${err instanceof Error ? err.message : err})`)
  }
}

async function upsert(id: string, payload: SharePayload): Promise<void> {
  const res = await safeFetch(`${TABLE_URL}?on_conflict=id`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ id, data: payload, updated_at: new Date().toISOString() }]),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Supabase rejected the write: HTTP ${res.status}${detail ? ` — ${detail}` : ''}`)
  }
}

export async function createShare(payload: SharePayload): Promise<string> {
  const id = crypto.randomUUID()
  await upsert(id, payload)
  return id
}

export async function updateShare(id: string, payload: SharePayload): Promise<void> {
  await upsert(id, payload)
}

export async function fetchShare(id: string): Promise<SharePayload | null> {
  const res = await safeFetch(`${TABLE_URL}?id=eq.${encodeURIComponent(id)}&select=data`, { headers: HEADERS })
  if (!res.ok) return null
  const rows = await res.json()
  const data = Array.isArray(rows) ? rows[0]?.data : null
  return Array.isArray(data?.tasks) ? (data as SharePayload) : null
}
