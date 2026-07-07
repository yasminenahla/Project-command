import type { SharePayload } from './shareLink'

// kvdb.io: free, keyless key-value storage explicitly designed for direct
// browser use (no CORS preflight issues) — used so a share link always
// reflects the latest board instead of a snapshot baked into the URL.
// Anyone holding the link/id can read AND overwrite that record; there's no
// access control or uptime guarantee beyond what the free service offers.
const BASE = 'https://kvdb.io'
const KEY = 'board'

async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (err) {
    // fetch() throws a generic TypeError for both offline connections and
    // CORS rejections — there's no way to tell them apart from here.
    throw new Error(`network/CORS error reaching kvdb.io (${err instanceof Error ? err.message : err})`)
  }
}

async function writeValue(bucketId: string, payload: SharePayload): Promise<void> {
  const res = await safeFetch(`${BASE}/${bucketId}/${KEY}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`kvdb.io rejected the write: HTTP ${res.status}`)
}

export async function createShare(payload: SharePayload): Promise<string> {
  const created = await safeFetch(BASE, { method: 'POST' })
  if (!created.ok) throw new Error(`kvdb.io rejected the bucket create: HTTP ${created.status}`)
  const bucketId = (await created.text()).trim()
  if (!bucketId) throw new Error('kvdb.io did not return a bucket id')
  await writeValue(bucketId, payload)
  return bucketId
}

export async function updateShare(id: string, payload: SharePayload): Promise<void> {
  await writeValue(id, payload)
}

export async function fetchShare(id: string): Promise<SharePayload | null> {
  const res = await safeFetch(`${BASE}/${id}/${KEY}`)
  if (!res.ok) return null
  try {
    const data = JSON.parse(await res.text())
    return Array.isArray(data?.tasks) ? (data as SharePayload) : null
  } catch {
    return null
  }
}
