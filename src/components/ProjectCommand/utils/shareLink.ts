import type { PCRole, PCThemeName, Task } from '../types'

export interface SharePayload {
  tasks: Task[]
  theme: PCThemeName
}

function fromBase64Url(str: string): string {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  return decodeURIComponent(escape(atob(padded)))
}

/** Builds a URL carrying a live share id and access role as a `#s=&role=` fragment — opening it always fetches the latest board. */
export function buildShareUrl(id: string, role: PCRole = 'editor'): string {
  const url = new URL(window.location.href)
  url.hash = `s=${id}&role=${role}`
  return url.toString()
}

/** Reads a `#s=<id>` live-share reference from the current URL, if present. */
export function readShareIdFromLocation(): string | null {
  const hash = window.location.hash.replace(/^#/, '')
  return new URLSearchParams(hash).get('s')
}

/** Reads the `role` a share link grants — defaults to 'editor' so older links (sent before this feature) keep working as before. */
export function readShareRoleFromLocation(): PCRole {
  const hash = window.location.hash.replace(/^#/, '')
  return new URLSearchParams(hash).get('role') === 'viewer' ? 'viewer' : 'editor'
}

/**
 * Legacy fallback: reads a full board snapshot from an older `#share=<base64>` link
 * (pre-dating live sync). Still honored so links already sent out keep working once.
 */
export function readLegacySnapshotFromLocation(): SharePayload | null {
  const hash = window.location.hash.replace(/^#/, '')
  const encoded = new URLSearchParams(hash).get('share')
  if (!encoded) return null
  try {
    const parsed = JSON.parse(fromBase64Url(encoded))
    if (Array.isArray(parsed?.tasks)) return parsed as SharePayload
  } catch { /* malformed or tampered link — ignore and fall back to local state */ }
  return null
}

/** Strips the share fragment once its payload has been loaded, so reloads use local storage. */
export function clearShareFromLocation(): void {
  history.replaceState(null, '', window.location.pathname + window.location.search)
}
