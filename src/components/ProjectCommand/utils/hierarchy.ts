import type { Task } from '../types'

/**
 * Reorders a task list so each milestone is immediately followed by its
 * children (in their existing relative order), for views where adjacency
 * conveys structure (e.g. the Gantt). Tasks with no milestone, or whose
 * milestone isn't in this list, keep their original relative order and
 * trail after all milestone groups.
 */
export function buildHierarchicalOrder(list: Task[]): Task[] {
  const milestoneIds = new Set(list.filter(t => t.isMilestone).map(t => t.id))
  const childrenOf = new Map<string, Task[]>()
  list.forEach(t => {
    if (!t.isMilestone && t.milestoneId && milestoneIds.has(t.milestoneId)) {
      const arr = childrenOf.get(t.milestoneId) ?? []
      arr.push(t)
      childrenOf.set(t.milestoneId, arr)
    }
  })

  const placed = new Set<string>()
  const out: Task[] = []
  list.forEach(t => {
    if (placed.has(t.id) || !t.isMilestone) return
    out.push(t)
    placed.add(t.id)
    for (const child of childrenOf.get(t.id) ?? []) {
      out.push(child)
      placed.add(child.id)
    }
  })
  list.forEach(t => { if (!placed.has(t.id)) { out.push(t); placed.add(t.id) } })
  return out
}
