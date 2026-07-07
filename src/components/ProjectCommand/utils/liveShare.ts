import type { SharePayload } from './shareLink'

// jsonblob.com: free, keyless JSON storage — used so a share link always
// reflects the latest board instead of a snapshot baked into the URL.
// Anyone holding the link/id can read AND overwrite that blob; there's no
// access control or uptime guarantee beyond what the free service offers.
const API = 'https://jsonblob.com/api/jsonBlob'

export async function createShare(payload: SharePayload): Promise<string> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`jsonblob create failed: ${res.status}`)
  const location = res.headers.get('Location') ?? res.headers.get('location')
  const id = location?.split('/').filter(Boolean).pop()
  if (!id) throw new Error('jsonblob did not return a blob id')
  return id
}

export async function updateShare(id: string, payload: SharePayload): Promise<void> {
  const res = await fetch(`${API}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`jsonblob update failed: ${res.status}`)
}

export async function fetchShare(id: string): Promise<SharePayload | null> {
  const res = await fetch(`${API}/${id}`)
  if (!res.ok) return null
  const data = await res.json()
  return Array.isArray(data?.tasks) ? (data as SharePayload) : null
}
