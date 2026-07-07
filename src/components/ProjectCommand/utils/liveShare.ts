import type { SharePayload } from './shareLink'

// jsonblob.com: free, keyless JSON storage — used so a share link always
// reflects the latest board instead of a snapshot baked into the URL.
// Anyone holding the link/id can read AND overwrite that blob; there's no
// access control or uptime guarantee beyond what the free service offers.
const API = 'https://jsonblob.com/api/jsonBlob'

async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (err) {
    // fetch() throws a generic TypeError for both offline connections and
    // CORS rejections — there's no way to tell them apart from here.
    throw new Error(`network/CORS error reaching jsonblob (${err instanceof Error ? err.message : err})`)
  }
}

export async function createShare(payload: SharePayload): Promise<string> {
  const res = await safeFetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`jsonblob rejected the create request: HTTP ${res.status}`)
  const location = res.headers.get('Location') ?? res.headers.get('location')
  if (!location) {
    throw new Error('jsonblob did not expose a Location header — likely a CORS header-exposure issue on their end')
  }
  const id = location.split('/').filter(Boolean).pop()
  if (!id) throw new Error(`could not parse a blob id out of "${location}"`)
  return id
}

export async function updateShare(id: string, payload: SharePayload): Promise<void> {
  const res = await safeFetch(`${API}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`jsonblob rejected the update: HTTP ${res.status}`)
}

export async function fetchShare(id: string): Promise<SharePayload | null> {
  const res = await safeFetch(`${API}/${id}`)
  if (!res.ok) return null
  const data = await res.json()
  return Array.isArray(data?.tasks) ? (data as SharePayload) : null
}
