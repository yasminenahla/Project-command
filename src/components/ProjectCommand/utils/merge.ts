import type { OwnerEntry, Task } from '../types'

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Three-way merges a single entry: any field the local copy changed relative
 * to `base` wins (that's the active user's own edit); every other field takes
 * the remote copy's value, so concurrent edits to different entries — or
 * different fields of the same entry — are both kept. A genuine same-field
 * double-edit is resolved in the local edit's favor, so a refresh never
 * silently erases what you were just typing.
 */
function mergeEntry<T extends object>(base: T | undefined, local: T | undefined, remote: T | undefined): T | null {
  if (!local && !remote) return null
  if (!base) return local ?? remote ?? null // new on one or both sides — no ancestor to diff against

  if (!local) {
    // Deleted locally: honor that unless remote changed it since, in which case keep remote's edit.
    return remote && !sameValue(remote, base) ? remote : null
  }
  if (!remote) {
    // Deleted upstream: accept it unless we changed it locally since, in which case keep our edit.
    return sameValue(local, base) ? null : local
  }

  const merged: T = { ...remote }
  for (const key of Object.keys(local) as (keyof T)[]) {
    if (!sameValue(local[key], base[key])) {
      merged[key] = local[key]
    }
  }
  return merged
}

/**
 * Merges a local (possibly unsynced) list with a freshly-fetched remote one,
 * using `base` — the last state known to be common to both — as the 3-way
 * merge ancestor. Preserves remote's ordering (so another editor's reordering
 * sticks) and appends any local-only new entries at the end.
 */
function mergeByKey<T extends object>(base: T[], local: T[], remote: T[], keyOf: (t: T) => string): T[] {
  const baseByKey   = new Map(base.map(t => [keyOf(t), t]))
  const localByKey  = new Map(local.map(t => [keyOf(t), t]))
  const remoteByKey = new Map(remote.map(t => [keyOf(t), t]))

  const out: T[] = []
  const seen = new Set<string>()

  for (const r of remote) {
    const key = keyOf(r)
    seen.add(key)
    const merged = mergeEntry(baseByKey.get(key), localByKey.get(key), r)
    if (merged) out.push(merged)
  }
  for (const l of local) {
    const key = keyOf(l)
    if (seen.has(key)) continue
    seen.add(key)
    const merged = mergeEntry(baseByKey.get(key), l, remoteByKey.get(key))
    if (merged) out.push(merged)
  }
  return out
}

export function mergeTaskLists(base: Task[], local: Task[], remote: Task[]): Task[] {
  return mergeByKey(base, local, remote, t => t.id)
}

export function mergeOwnerLists(base: OwnerEntry[], local: OwnerEntry[], remote: OwnerEntry[]): OwnerEntry[] {
  return mergeByKey(base, local, remote, o => o.name)
}
