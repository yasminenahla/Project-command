import type { PCThemeName, Task } from '../types'

export interface SharePayload {
  tasks: Task[]
  theme: PCThemeName
}

function toBase64Url(str: string): string {
  const b64 = btoa(unescape(encodeURIComponent(str)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(str: string): string {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  return decodeURIComponent(escape(atob(padded)))
}

/** Builds a URL that carries the current board as a `#share=` fragment — no server involved. */
export function buildShareUrl(payload: SharePayload): string {
  const encoded = toBase64Url(JSON.stringify(payload))
  const url = new URL(window.location.href)
  url.hash = `share=${encoded}`
  return url.toString()
}

/** Reads a `#share=` payload from the current URL, if present. */
export function readShareFromLocation(): SharePayload | null {
  const hash = window.location.hash.replace(/^#/, '')
  const encoded = new URLSearchParams(hash).get('share')
  if (!encoded) return null
  try {
    const parsed = JSON.parse(fromBase64Url(encoded))
    if (Array.isArray(parsed?.tasks)) return parsed as SharePayload
  } catch { /* malformed or tampered link — ignore and fall back to local state */ }
  return null
}

/** Strips the `#share=` fragment once its payload has been loaded, so reloads use local storage. */
export function clearShareFromLocation(): void {
  history.replaceState(null, '', window.location.pathname + window.location.search)
}
