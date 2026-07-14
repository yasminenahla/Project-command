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

/** Recursively counts every subtask (at any depth) beneath a task. */
function countAllSubtasks(taskId: string, subtasksOf: Map<string, Task[]>): number {
  const kids = subtasksOf.get(taskId) ?? []
  return kids.reduce((sum, k) => sum + 1 + countAllSubtasks(k.id, subtasksOf), 0)
}

export interface ActionNumberMaps {
  /** task/milestone id -> its displayed number, e.g. "2", "2.3", "2.3.1", "U1", "U1.2" */
  numbers: Map<string, string>
  /** "2" -> the milestone task numbered 2 */
  milestoneByNumber: Map<string, Task>
  /** "2.3" or "U1" -> the top-level (non-milestone) task at that number, for subtask reparenting */
  topByNumber: Map<string, Task>
}

/**
 * Assigns a stable, hierarchical "action number" to every milestone, task
 * and subtask: milestones get "1", "2"…; their tasks get "1.1", "1.2"…;
 * subtasks get "1.1.1", "1.1.2"…. Tasks with no milestone (and their
 * subtasks) get their own "U1", "U2"… sequence so they're never confused
 * with a milestone number. Order follows buildHierarchicalOrder, so it
 * matches how the board is actually laid out.
 */
export function computeActionNumbers(list: Task[]): ActionNumberMaps {
  const ordered = buildHierarchicalOrder(list)
  const numbers = new Map<string, string>()
  const milestoneByNumber = new Map<string, Task>()
  const topByNumber = new Map<string, Task>()
  let milestoneCounter = 0
  let unassignedCounter = 0
  const taskCounterByMilestone = new Map<string, number>()
  const subtaskCounterByParent = new Map<string, number>()

  for (const t of ordered) {
    if (t.isMilestone) {
      milestoneCounter++
      const num = String(milestoneCounter)
      numbers.set(t.id, num)
      milestoneByNumber.set(num, t)
    } else if (t.parentTaskId && numbers.has(t.parentTaskId)) {
      const n = (subtaskCounterByParent.get(t.parentTaskId) ?? 0) + 1
      subtaskCounterByParent.set(t.parentTaskId, n)
      numbers.set(t.id, `${numbers.get(t.parentTaskId)}.${n}`)
    } else if (t.milestoneId && numbers.has(t.milestoneId)) {
      const n = (taskCounterByMilestone.get(t.milestoneId) ?? 0) + 1
      taskCounterByMilestone.set(t.milestoneId, n)
      const num = `${numbers.get(t.milestoneId)}.${n}`
      numbers.set(t.id, num)
      topByNumber.set(num, t)
    } else {
      unassignedCounter++
      const num = `U${unassignedCounter}`
      numbers.set(t.id, num)
      topByNumber.set(num, t)
    }
  }
  return { numbers, milestoneByNumber, topByNumber }
}

function siblingIndices(remaining: Task[], predicate: (t: Task) => boolean): number[] {
  const idx: number[] = []
  remaining.forEach((t, i) => { if (predicate(t)) idx.push(i) })
  return idx
}

/** Where to splice a moving block in so it lands at 1-based `pos` among its new siblings. */
function insertionIndex(siblings: number[], anchorIndex: number, pos: number): number {
  if (siblings.length === 0) return anchorIndex + 1
  const clamped = Math.max(1, Math.min(pos, siblings.length + 1))
  return clamped <= siblings.length ? siblings[clamped - 1] : siblings[siblings.length - 1] + 1
}

export type RetargetResult = { tasks: Task[] } | { error: string }

/**
 * Moves a task/subtask to wherever a typed action number (e.g. "2.3", "U1",
 * "2.3.1") implies: assigning it to the referenced milestone/task and
 * reordering it to the requested position. This is the write side of
 * computeActionNumbers — same numbering scheme, resolved in reverse.
 * Milestones themselves aren't retargetable this way (their own numbers are
 * purely positional and read-only); use the existing reorder controls.
 */
export function retargetTask(allTasks: Task[], taskId: string, rawInput: string): RetargetResult {
  const input = rawInput.trim()
  const task = allTasks.find(t => t.id === taskId)
  if (!task) return { error: 'Task not found' }
  if (task.isMilestone) return { error: 'Milestone numbers are automatic — use the move arrows to reorder milestones' }

  const m = /^(?:[uU](\d+)(?:\.(\d+))?|(\d+)(?:\.(\d+))?(?:\.(\d+))?)$/.exec(input)
  if (!m) return { error: `"${rawInput}" isn't a valid action number — try formats like 2.3, U1, or 2.3.1` }

  const { milestoneByNumber, topByNumber } = computeActionNumbers(allTasks)

  let targetParentTaskId: string | null = null
  let targetMilestoneId: string | null = null
  let pos: number

  if (m[1] !== undefined) {
    if (m[2] !== undefined) {
      const parent = topByNumber.get(`U${m[1]}`)
      if (!parent) return { error: `No unassigned task numbered U${m[1]}` }
      targetParentTaskId = parent.id
      pos = parseInt(m[2], 10)
    } else {
      pos = parseInt(m[1], 10)
    }
  } else {
    const [a, b, c] = [m[3], m[4], m[5]]
    if (c !== undefined) {
      const parent = topByNumber.get(`${a}.${b}`)
      if (!parent) return { error: `No task numbered ${a}.${b}` }
      targetParentTaskId = parent.id
      pos = parseInt(c, 10)
    } else if (b !== undefined) {
      const milestone = milestoneByNumber.get(a)
      if (!milestone) return { error: `No milestone numbered ${a}` }
      targetMilestoneId = milestone.id
      pos = parseInt(b, 10)
    } else {
      pos = parseInt(a, 10)
    }
  }

  if (targetParentTaskId === taskId) return { error: "A task can't become its own subtask" }

  const isCurrentlyTopLevel = !task.parentTaskId
  if (targetParentTaskId) {
    const hasOwnChildren = isCurrentlyTopLevel && allTasks.some(t => t.parentTaskId === taskId)
    if (hasOwnChildren) return { error: "This task has its own subtasks — move or unassign them first, then nest it under another task" }
    const parentTask = allTasks.find(t => t.id === targetParentTaskId)
    if (parentTask?.parentTaskId) return { error: 'Subtasks can only be one level deep' }
  }

  // Move the task itself, plus (if it's currently top-level) its own subtasks, as one block.
  const block = isCurrentlyTopLevel ? [task, ...allTasks.filter(t => t.parentTaskId === taskId)] : [task]
  const blockIds = new Set(block.map(t => t.id))
  const remaining = allTasks.filter(t => !blockIds.has(t.id))

  const updatedTask: Task = targetParentTaskId
    ? { ...task, parentTaskId: targetParentTaskId, milestoneId: null }
    : { ...task, parentTaskId: null, milestoneId: targetMilestoneId }
  const updatedBlock = [updatedTask, ...block.slice(1)]

  let insertAt: number
  if (targetParentTaskId) {
    const anchor = remaining.findIndex(t => t.id === targetParentTaskId)
    const siblings = siblingIndices(remaining, t => t.parentTaskId === targetParentTaskId)
    insertAt = insertionIndex(siblings, anchor, pos)
  } else if (targetMilestoneId) {
    const anchor = remaining.findIndex(t => t.id === targetMilestoneId)
    const siblings = siblingIndices(remaining, t => !t.isMilestone && !t.parentTaskId && t.milestoneId === targetMilestoneId)
    insertAt = insertionIndex(siblings, anchor, pos)
  } else {
    const siblings = siblingIndices(remaining, t => !t.isMilestone && !t.parentTaskId && !t.milestoneId)
    insertAt = insertionIndex(siblings, remaining.length - 1, pos)
  }

  const next = remaining.slice()
  next.splice(insertAt, 0, ...updatedBlock)
  return { tasks: next }
}

export type TimelineRow =
  | { kind: 'milestone'; milestone: Task; children: Task[]; subtaskCount: number; completion: number; start: string }
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
      const subtaskCount = children.reduce((sum, c) => sum + countAllSubtasks(c.id, subtasksOf), 0)
      return { kind: 'milestone', milestone: m, children, subtaskCount, completion, start: m.start }
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
