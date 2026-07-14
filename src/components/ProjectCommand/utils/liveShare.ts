import type { SharePayload } from './shareLink'

// Supabase (your project) backs live sharing: a `shares` table with an
// `id` (text) and `data` (jsonb) column, RLS-scoped to public read/insert/
// update on just that table. The publishable key is meant to be embedded
// client-side — access control comes from the RLS policies, not secrecy.
const SUPABASE_URL = 'https://qazruufilcmaigisqpps.supabase.co'
const SUPABASE_KEY = 'sb_publishable_UkJKvY0yOYLcNVZwrwHuGQ_stfwak6M'
const TABLE_URL = `${SUPABASE_URL}/rest/v1/shares`
const VERSIONS_URL = `${SUPABASE_URL}/rest/v1/share_versions`
const MAX_VERSIONS = 30

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

// `updatedAt` is the write's own version stamp — callers keep the last one
// they saw and compare it against the row's current stamp before writing
// again, so a stale sync never blindly clobbers a newer one from another
// editor (see useProjectCommand's conflict check).
async function upsert(id: string, payload: SharePayload): Promise<string> {
  const res = await safeFetch(`${TABLE_URL}?on_conflict=id`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify([{ id, data: payload, updated_at: new Date().toISOString() }]),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Supabase rejected the write: HTTP ${res.status}${detail ? ` — ${detail}` : ''}`)
  }
  const rows = await res.json().catch(() => null)
  return Array.isArray(rows) ? rows[0]?.updated_at : new Date().toISOString()
}

export async function createShare(payload: SharePayload): Promise<{ id: string; updatedAt: string }> {
  const id = crypto.randomUUID()
  const updatedAt = await upsert(id, payload)
  return { id, updatedAt }
}

export async function updateShare(id: string, payload: SharePayload): Promise<string> {
  return upsert(id, payload)
}

export async function fetchShare(id: string): Promise<(SharePayload & { updatedAt: string }) | null> {
  const res = await safeFetch(`${TABLE_URL}?id=eq.${encodeURIComponent(id)}&select=data,updated_at`, { headers: HEADERS })
  if (!res.ok) return null
  const rows = await res.json()
  const row = Array.isArray(rows) ? rows[0] : null
  const data = row?.data
  return Array.isArray(data?.tasks) ? { ...(data as SharePayload), updatedAt: row.updated_at } : null
}

/** Cheap check for whether the shared board has changed since a given version, without pulling the whole payload. */
export async function fetchShareVersion(id: string): Promise<string | null> {
  const res = await safeFetch(`${TABLE_URL}?id=eq.${encodeURIComponent(id)}&select=updated_at`, { headers: HEADERS })
  if (!res.ok) return null
  const rows = await res.json().catch(() => null)
  return Array.isArray(rows) ? rows[0]?.updated_at ?? null : null
}

export interface VersionEntry {
  id: number
  createdAt: string
  payload: SharePayload
}

/**
 * Snapshots a board state into history — best-effort: called after every
 * successful push (see useProjectCommand), so restoring an earlier version
 * is always possible even if a later sync clobbers something unexpectedly.
 * Never throws; a failed snapshot shouldn't break the main sync flow.
 */
export async function saveVersion(shareId: string, payload: SharePayload): Promise<void> {
  try {
    await safeFetch(VERSIONS_URL, {
      method: 'POST',
      headers: { ...HEADERS, Prefer: 'return=minimal' },
      body: JSON.stringify([{ share_id: shareId, data: payload }]),
    })
    await pruneVersions(shareId)
  } catch { /* history is a safety net, not the primary sync path — ignore failures */ }
}

/** Keeps only the most recent MAX_VERSIONS snapshots per share so the table doesn't grow unbounded. */
async function pruneVersions(shareId: string): Promise<void> {
  const res = await safeFetch(
    `${VERSIONS_URL}?share_id=eq.${encodeURIComponent(shareId)}&select=id&order=created_at.desc&offset=${MAX_VERSIONS}`,
    { headers: HEADERS },
  )
  if (!res.ok) return
  const rows = await res.json().catch(() => [])
  const staleIds = Array.isArray(rows) ? rows.map((r: { id: number }) => r.id) : []
  if (!staleIds.length) return
  await safeFetch(`${VERSIONS_URL}?id=in.(${staleIds.join(',')})`, { method: 'DELETE', headers: HEADERS }).catch(() => {})
}

/** Lists the most recent snapshots for a share, newest first. */
export async function listVersions(shareId: string, limit = MAX_VERSIONS): Promise<VersionEntry[]> {
  const res = await safeFetch(
    `${VERSIONS_URL}?share_id=eq.${encodeURIComponent(shareId)}&select=id,data,created_at&order=created_at.desc&limit=${limit}`,
    { headers: HEADERS },
  )
  if (!res.ok) return []
  const rows = await res.json().catch(() => [])
  if (!Array.isArray(rows)) return []
  return rows
    .filter(r => Array.isArray(r?.data?.tasks))
    .map(r => ({ id: r.id, createdAt: r.created_at, payload: r.data as SharePayload }))
}

/** Deletes a single snapshot. */
export async function deleteVersion(id: number): Promise<void> {
  const res = await safeFetch(`${VERSIONS_URL}?id=eq.${id}`, { method: 'DELETE', headers: HEADERS })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Supabase rejected the delete: HTTP ${res.status}${detail ? ` — ${detail}` : ''}`)
  }
}

/** Deletes every snapshot for a share — used by "Clear all history". */
export async function deleteAllVersions(shareId: string): Promise<void> {
  const res = await safeFetch(`${VERSIONS_URL}?share_id=eq.${encodeURIComponent(shareId)}`, { method: 'DELETE', headers: HEADERS })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Supabase rejected the delete: HTTP ${res.status}${detail ? ` — ${detail}` : ''}`)
  }
}
