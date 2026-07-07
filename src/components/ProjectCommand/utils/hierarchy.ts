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

export type TimelineRow =
  | { kind: 'milestone'; milestone: Task; children: Task[]; completion: number; start: string }
  | { kind: 'task'; task: Task; start: string }

/**
 * Collapses a task list to one row per milestone (with its children rolled
 * up into a completion percentage) plus a row for every task that isn't
 * under a milestone — sorted chronologically by start date.
 */
export function rollupByMilestone(list: Task[]): TimelineRow[] {
  const milestones = list.filter(t => t.isMilestone)
  const milestoneIds = new Set(milestones.map(m => m.id))
  const childrenOf = new Map<string, Task[]>()
  const unassigned: Task[] = []

  list.forEach(t => {
    if (t.isMilestone) return
    if (t.milestoneId && milestoneIds.has(t.milestoneId)) {
      const arr = childrenOf.get(t.milestoneId) ?? []
      arr.push(t)
      childrenOf.set(t.milestoneId, arr)
    } else {
      unassigned.push(t)
    }
  })

  const rows: TimelineRow[] = [
    ...milestones.map((m): TimelineRow => {
      const children = childrenOf.get(m.id) ?? []
      const completion = children.length
        ? Math.round(children.reduce((sum, c) => sum + c.progress, 0) / children.length)
        : m.progress
      return { kind: 'milestone', milestone: m, children, completion, start: m.start }
    }),
    ...unassigned.map((t): TimelineRow => ({ kind: 'task', task: t, start: t.start })),
  ]

  return rows.sort((a, b) => a.start < b.start ? -1 : 1)
}
