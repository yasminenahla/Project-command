import type { Task } from '../types'

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Three-way merges a single task: any field the local copy changed relative to
 * `base` wins (that's the active user's own edit); every other field takes
 * the remote copy's value, so concurrent edits to different tasks — or
 * different fields of the same task — are both kept. A genuine same-field
 * double-edit is resolved in the local edit's favor, so a refresh never
 * silently erases what you were just typing.
 */
function mergeTask(base: Task | undefined, local: Task | undefined, remote: Task | undefined): Task | null {
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

  const merged: Task = { ...remote }
  for (const key of Object.keys(local) as (keyof Task)[]) {
    if (!sameValue(local[key], base[key])) {
      (merged as unknown as Record<string, unknown>)[key] = local[key]
    }
  }
  return merged
}

/**
 * Merges the local (possibly unsynced) task list with a freshly-fetched remote
 * one, using `base` — the last state known to be common to both — as the
 * three-way merge ancestor. Preserves remote's ordering (so another editor's
 * reordering sticks) and appends any local-only new tasks at the end.
 */
export function mergeTaskLists(base: Task[], local: Task[], remote: Task[]): Task[] {
  const baseById   = new Map(base.map(t => [t.id, t]))
  const localById  = new Map(local.map(t => [t.id, t]))
  const remoteById = new Map(remote.map(t => [t.id, t]))

  const out: Task[] = []
  const seen = new Set<string>()

  for (const r of remote) {
    seen.add(r.id)
    const merged = mergeTask(baseById.get(r.id), localById.get(r.id), r)
    if (merged) out.push(merged)
  }
  for (const l of local) {
    if (seen.has(l.id)) continue
    seen.add(l.id)
    const merged = mergeTask(baseById.get(l.id), l, remoteById.get(l.id))
    if (merged) out.push(merged)
  }
  return out
}
