import type { Task } from '../types'

/** Maps a task id to its direct subtasks (tasks whose parentTaskId points to it). */
function buildSubtaskMap(list: Task[]): Map<string, Task[]> {
  const byId = new Map(list.map(t => [t.id, t]))
  const subtasksOf = new Map<string, Task[]>()
  list.forEach(t => {
    if (!t.isMilestone && t.parentTaskId && byId.has(t.parentTaskId)) {
      const arr = subtasksOf.get(t.parentTaskId) ?? []
      arr.push(t)
      subtasksOf.set(t.parentTaskId, arr)
    }
  })
  return subtasksOf
}

/**
 * A task's own progress if it has no subtasks, otherwise the average of its
 * subtasks' effective progress (recursive, so a subtask with its own
 * subtasks still rolls up correctly).
 */
export function effectiveProgress(task: Task, subtasksOf: Map<string, Task[]>): number {
  const kids = subtasksOf.get(task.id)
  if (!kids?.length) return task.progress
  return Math.round(kids.reduce((sum, k) => sum + effectiveProgress(k, subtasksOf), 0) / kids.length)
}

/**
 * Nesting depth for indentation: 0 for a milestone or an unassigned
 * top-level task, +1 for a task under a milestone, +1 more for a subtask
 * under that (a subtask's depth follows its parent's, whatever that is).
 */
export function taskIndentLevel(task: Task, byId: Map<string, Task>): number {
  if (task.parentTaskId) {
    const parent = byId.get(task.parentTaskId)
    return (parent ? taskIndentLevel(parent, byId) : 0) + 1
  }
  if (task.milestoneId) return 1
  return 0
}

/**
 * Reorders a task list so each milestone is immediately followed by its
 * tasks, and each task is immediately followed by its own subtasks (in
 * their existing relative order) — for views where adjacency conveys
 * structure (e.g. the Gantt). Anything left over keeps its original
 * relative order and trails at the end.
 */
export function buildHierarchicalOrder(list: Task[]): Task[] {
  const milestoneIds = new Set(list.filter(t => t.isMilestone).map(t => t.id))
  const tasksOfMilestone = new Map<string, Task[]>()
  const subtasksOf = buildSubtaskMap(list)

  list.forEach(t => {
    if (!t.isMilestone && !t.parentTaskId && t.milestoneId && milestoneIds.has(t.milestoneId)) {
      const arr = tasksOfMilestone.get(t.milestoneId) ?? []
      arr.push(t)
      tasksOfMilestone.set(t.milestoneId, arr)
    }
  })

  const placed = new Set<string>()
  const out: Task[] = []

  function place(t: Task) {
    out.push(t)
    placed.add(t.id)
    for (const child of subtasksOf.get(t.id) ?? []) place(child)
  }

  list.forEach(t => {
    if (placed.has(t.id) || !t.isMilestone) return
    place(t)
    for (const child of tasksOfMilestone.get(t.id) ?? []) place(child)
  })
  list.forEach(t => { if (!placed.has(t.id)) place(t) })
  return out
}

export type TimelineRow =
  | { kind: 'milestone'; milestone: Task; children: Task[]; completion: number; start: string }
  | { kind: 'rolledTask'; task: Task; children: Task[]; completion: number; start: string }
  | { kind: 'task'; task: Task; start: string }

/**
 * Collapses a task list to one row per milestone (with its tasks rolled up
 * into a completion percentage), one row per top-level task that has
 * subtasks (same treatment, one level down), and a plain row for every
 * other top-level task — sorted chronologically by start date. Subtasks
 * and milestone tasks never appear as their own row; they're embedded.
 */
export function rollupByMilestone(list: Task[]): TimelineRow[] {
  const byId = new Map(list.map(t => [t.id, t]))
  const subtasksOf = buildSubtaskMap(list)
  const milestones = list.filter(t => t.isMilestone)
  const milestoneIds = new Set(milestones.map(m => m.id))

  // top-level = not a milestone, and not itself a subtask of another task in this list
  const rootTasks = list.filter(t => !t.isMilestone && !(t.parentTaskId && byId.has(t.parentTaskId)))

  const tasksOfMilestone = new Map<string, Task[]>()
  const unassigned: Task[] = []
  rootTasks.forEach(t => {
    if (t.milestoneId && milestoneIds.has(t.milestoneId)) {
      const arr = tasksOfMilestone.get(t.milestoneId) ?? []
      arr.push(t)
      tasksOfMilestone.set(t.milestoneId, arr)
    } else {
      unassigned.push(t)
    }
  })

  const rows: TimelineRow[] = [
    ...milestones.map((m): TimelineRow => {
      const children = tasksOfMilestone.get(m.id) ?? []
      const completion = children.length
        ? Math.round(children.reduce((sum, c) => sum + effectiveProgress(c, subtasksOf), 0) / children.length)
        : m.progress
      return { kind: 'milestone', milestone: m, children, completion, start: m.start }
    }),
    ...unassigned.map((t): TimelineRow => {
      const kids = subtasksOf.get(t.id) ?? []
      if (kids.length) {
        return { kind: 'rolledTask', task: t, children: kids, completion: effectiveProgress(t, subtasksOf), start: t.start }
      }
      return { kind: 'task', task: t, start: t.start }
    }),
  ]

  return rows.sort((a, b) => a.start < b.start ? -1 : 1)
}
