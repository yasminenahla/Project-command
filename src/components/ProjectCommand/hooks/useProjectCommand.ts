import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PCGroup, PCScale, PCTab, PCThemeName, Task, TaskStatus } from '../types'
import { STATUSES } from '../types'
import { seedTasks } from '../seed'
import { addDays, uid } from '../utils/dates'
import { buildShareUrl, clearShareFromLocation, readShareFromLocation } from '../utils/shareLink'

const LS_KEY = 'pc-timeline-v1'

interface Persisted {
  tasks: Task[]
  theme: PCThemeName
  tab:   PCTab
  scale: PCScale
  group: PCGroup
}

function load(): Persisted {
  const shared = readShareFromLocation()
  if (shared?.tasks?.length) {
    return { tasks: shared.tasks, theme: shared.theme ?? 'playful', tab: 'tracker', scale: 'weeks', group: 'None' }
  }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const s = JSON.parse(raw) as Partial<Persisted>
      if (s.tasks?.length) {
        return {
          tasks: s.tasks,
          theme: s.theme ?? 'playful',
          tab:   s.tab   ?? 'tracker',
          scale: s.scale ?? 'weeks',
          group: s.group ?? 'None',
        }
      }
    }
  } catch { /* fall through to seed */ }
  return { tasks: seedTasks(), theme: 'playful', tab: 'tracker', scale: 'weeks', group: 'None' }
}

export function useProjectCommand() {
  const [persisted, setPersisted] = useState<Persisted>(load)
  const [q, setQ]           = useState('')
  const [depsFor, setDepsFor] = useState<string | null>(null)
  const [sel, setSel]       = useState<string | null>(null)
  const [toast, setToast]   = useState('')

  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  const dragId      = useRef<string | null>(null)

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(persisted)) } catch { /* ignore quota errors */ }
  }, [persisted])

  const flash = useCallback((msg: string) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }, [])

  // If this load came from a shared link, surface it once and drop the
  // fragment so a later reload uses local storage instead of re-importing it.
  useEffect(() => {
    const shared = readShareFromLocation()
    if (shared?.tasks?.length) {
      flash(`Loaded shared board · ${shared.tasks.length} tasks`)
      clearShareFromLocation()
    }
  }, [flash])

  const { tasks, theme, tab, scale, group } = persisted

  const setTasks = useCallback((next: Task[]) => {
    setPersisted(p => ({ ...p, tasks: next }))
  }, [])

  const setTheme = useCallback((v: PCThemeName) => setPersisted(p => ({ ...p, theme: v })), [])
  const setTab   = useCallback((v: PCTab)       => setPersisted(p => ({ ...p, tab: v })), [])
  const setScale = useCallback((v: PCScale)     => setPersisted(p => ({ ...p, scale: v })), [])
  const setGroup = useCallback((v: PCGroup)     => setPersisted(p => ({ ...p, group: v })), [])

  const taskName = useCallback((id: string) => tasks.find(t => t.id === id)?.name ?? '', [tasks])

  const update = useCallback((id: string, patch: Partial<Task>) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, ...patch } : t))
  }, [tasks, setTasks])

  const addTask = useCallback(() => {
    const last = tasks[tasks.length - 1]
    const start = last ? addDays(last.end, 1) : new Date().toISOString().slice(0, 10)
    const nt: Task = {
      id: uid(), name: 'New task', owner: '', status: 'Not started', priority: 'Medium',
      start, end: addDays(start, 4), progress: 0, deps: [], tags: [], notes: '',
    }
    setTasks([...tasks, nt])
    setSel(nt.id)
    flash('Task added')
  }, [tasks, setTasks, flash])

  const del = useCallback((id: string) => {
    setTasks(tasks.filter(t => t.id !== id).map(t => ({ ...t, deps: t.deps.filter(d => d !== id) })))
  }, [tasks, setTasks])

  const move = useCallback((id: string, dir: 1 | -1) => {
    const a = tasks.slice()
    const i = a.findIndex(t => t.id === id)
    const j = i + dir
    if (j < 0 || j >= a.length) return
    ;[a[i], a[j]] = [a[j], a[i]]
    setTasks(a)
  }, [tasks, setTasks])

  const startDragReorder = useCallback((id: string) => { dragId.current = id }, [])
  const dropReorder = useCallback((id: string) => {
    const from = dragId.current
    if (from == null || from === id) return
    const a = tasks.slice()
    const fi = a.findIndex(t => t.id === from)
    const ti = a.findIndex(t => t.id === id)
    const [it] = a.splice(fi, 1)
    a.splice(ti, 0, it)
    dragId.current = null
    setTasks(a)
  }, [tasks, setTasks])

  const cycleStatus = useCallback((id: string) => {
    const t = tasks.find(x => x.id === id)
    if (!t) return
    const i = STATUSES.indexOf(t.status)
    const ns: TaskStatus = STATUSES[(i + 1) % STATUSES.length]
    update(id, { status: ns, progress: ns === 'Done' ? 100 : ns === 'Not started' ? 0 : t.progress })
  }, [tasks, update])

  const toggleDone = useCallback((id: string) => {
    const t = tasks.find(x => x.id === id)
    if (!t) return
    const done = t.status === 'Done'
    update(id, done ? { status: 'In progress', progress: 60 } : { status: 'Done', progress: 100 })
  }, [tasks, update])

  const toggleDep = useCallback((id: string, depId: string) => {
    const t = tasks.find(x => x.id === id)
    if (!t) return
    const has = t.deps.includes(depId)
    update(id, { deps: has ? t.deps.filter(d => d !== depId) : [...t.deps, depId] })
  }, [tasks, update])

  const importTasks = useCallback((imported: Task[]) => {
    if (!imported.length) { flash('No rows found in sheet'); return }
    setTasks(imported)
    flash(`Imported ${imported.length} tasks`)
  }, [setTasks, flash])

  const share = useCallback(async () => {
    const url = buildShareUrl({ tasks, theme })
    try {
      await navigator.clipboard.writeText(url)
      flash('Share link copied — send it to a collaborator')
    } catch {
      flash('Could not copy — copy the link from your address bar')
    }
  }, [tasks, theme, flash])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return tasks
    return tasks.filter(t =>
      `${t.name} ${t.owner} ${(t.tags || []).join(' ')} ${t.status} ${t.priority}`.toLowerCase().includes(query),
    )
  }, [tasks, q])

  return {
    tasks, filtered, theme, tab, scale, group, q, depsFor, sel, toast,
    setTheme, setTab, setScale, setGroup, setQ, setDepsFor, setSel, flash,
    taskName, update, addTask, del, move, startDragReorder, dropReorder,
    cycleStatus, toggleDone, toggleDep, importTasks, setTasks, share,
  }
}

export type ProjectCommandState = ReturnType<typeof useProjectCommand>
