import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PCGroup, PCRole, PCScale, PCTab, PCThemeName, Task, TaskStatus } from '../types'
import { STATUSES } from '../types'
import { seedTasks } from '../seed'
import { addDays, uid } from '../utils/dates'
import { buildShareUrl, clearShareFromLocation, readLegacySnapshotFromLocation, readShareIdFromLocation, readShareRoleFromLocation } from '../utils/shareLink'
import { createShare, fetchShare, fetchShareVersion, updateShare } from '../utils/liveShare'
import { buildHierarchicalOrder } from '../utils/hierarchy'
import { mergeTaskLists } from '../utils/merge'

const LS_KEY = 'pc-timeline-v1'

interface Persisted {
  tasks: Task[]
  theme: PCThemeName
  tab:   PCTab
  scale: PCScale
  group: PCGroup
  shareId?: string  // jsonblob id this board auto-syncs to, once shared
  role:  PCRole     // this browser's access level on the current board — 'viewer' if opened via a view-only link
  remoteVersion?: string  // the shared row's updated_at as of our last successful push/pull — used to detect a concurrent editor's changes before overwriting them
  baseTasks?: Task[]  // the task list as of remoteVersion — the 3-way merge ancestor for reconciling local edits with a newer remote copy
}

function load(): Persisted {
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
          shareId: s.shareId,
          role: s.role ?? 'editor',
          remoteVersion: s.remoteVersion,
          baseTasks: s.baseTasks,
        }
      }
    }
  } catch { /* fall through to seed */ }
  return { tasks: seedTasks(), theme: 'playful', tab: 'tracker', scale: 'weeks', group: 'None', role: 'editor' }
}

export function useProjectCommand() {
  const [persisted, setPersisted] = useState<Persisted>(load)
  const [q, setQ]           = useState('')
  const [depsFor, setDepsFor] = useState<string | null>(null)
  const [sel, setSel]       = useState<string | null>(null)
  const [toast, setToast]   = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [dirty, setDirty]   = useState(false)   // local edits that haven't synced to the share yet
  const [conflict, setConflict] = useState(false) // another editor pushed a change we haven't pulled yet — our own sync is paused until refresh

  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  const dragId      = useRef<string | null>(null)
  const syncTimer   = useRef<ReturnType<typeof setTimeout>>()
  // Set right before a remote-driven setPersisted (pull, or our own push's version bump) so the
  // auto-sync effect's next run — triggered by that same state change — doesn't mistake it for a local edit.
  const suppressDirtyRef = useRef(false)

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(persisted)) } catch { /* ignore quota errors */ }
  }, [persisted])

  const flash = useCallback((msg: string) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }, [])

  // If the URL carries a live share id, fetch the current board from it —
  // always the latest, not a snapshot — and keep syncing to it from here on.
  // Falls back to an older full-payload snapshot link if that's what was sent.
  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      const id = readShareIdFromLocation()
      if (id) {
        const role = readShareRoleFromLocation()
        try {
          const remote = await fetchShare(id)
          if (cancelled) return
          if (remote?.tasks?.length) {
            suppressDirtyRef.current = true
            setPersisted(p => ({ ...p, tasks: remote.tasks, theme: remote.theme ?? p.theme, shareId: id, role, remoteVersion: remote.updatedAt, baseTasks: remote.tasks }))
            flash(role === 'viewer' ? `Viewing shared board (read-only) · ${remote.tasks.length} tasks` : `Loaded shared board · ${remote.tasks.length} tasks`)
          } else {
            flash('That share link looks empty or invalid')
          }
        } catch (err) {
          console.error('[ProjectCommand] loading shared board failed:', err)
          if (!cancelled) flash(`Could not reach the shared board: ${err instanceof Error ? err.message : 'unknown error'}`)
        }
        clearShareFromLocation()
        return
      }
      const legacy = readLegacySnapshotFromLocation()
      if (legacy?.tasks?.length) {
        flash(`Loaded shared board · ${legacy.tasks.length} tasks`)
        clearShareFromLocation()
      }
    }
    hydrate()
    return () => { cancelled = true }
  }, [])

  const { tasks, theme, tab, scale, group, shareId, role, remoteVersion, baseTasks } = persisted

  // Once a board is shared, keep the remote copy fresh as it's edited —
  // debounced so rapid edits collapse into one sync a little after they stop.
  // Viewers never write back — they only ever pull.
  useEffect(() => {
    if (!shareId || role === 'viewer') return
    // This run was triggered by a pull we just did (hydrate/refresh/our own
    // push's version bump), not a local edit — nothing new to sync.
    if (suppressDirtyRef.current) { suppressDirtyRef.current = false; return }
    setDirty(true)
    clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(async () => {
      try {
        // Someone else may have pushed since we last pulled — check before
        // overwriting their changes with our (possibly stale) local copy.
        const currentVersion = await fetchShareVersion(shareId).catch(() => null)
        if (currentVersion && remoteVersion && currentVersion !== remoteVersion) {
          setConflict(true)
          flash('Another editor made changes — refresh to see them before your edits can sync')
          return
        }
        const newVersion = await updateShare(shareId, { tasks, theme })
        suppressDirtyRef.current = true
        setPersisted(p => ({ ...p, remoteVersion: newVersion, baseTasks: tasks }))
        setDirty(false)
        setConflict(false)
      } catch {
        flash('Could not sync your latest changes to the share link')
      }
    }, 1200)
    return () => clearTimeout(syncTimer.current)
  }, [shareId, tasks, theme, role, remoteVersion, flash])

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

  const addTask = useCallback((milestoneId?: string) => {
    const last = tasks[tasks.length - 1]
    const start = last ? addDays(last.end, 1) : new Date().toISOString().slice(0, 10)
    const nt: Task = {
      id: uid(), name: 'New task', owner: '', status: 'Not started', priority: 'Medium',
      start, end: addDays(start, 4), progress: 0, deps: [], tags: [], notes: '',
      milestoneId: milestoneId ?? null,
    }
    setTasks([...tasks, nt])
    setSel(nt.id)
    flash('Task added')
  }, [tasks, setTasks, flash])

  const addMilestone = useCallback(() => {
    const last = tasks[tasks.length - 1]
    const start = last ? addDays(last.end, 1) : new Date().toISOString().slice(0, 10)
    const nt: Task = {
      id: uid(), name: 'New milestone', owner: '', status: 'Not started', priority: 'High',
      start, end: addDays(start, 9), progress: 0, deps: [], tags: [], notes: '',
      isMilestone: true, milestoneId: null,
    }
    setTasks([...tasks, nt])
    setSel(nt.id)
    flash('Milestone added')
  }, [tasks, setTasks, flash])

  const setMilestone = useCallback((id: string, milestoneId: string | null) => {
    update(id, { milestoneId })
  }, [update])

  const addSubtask = useCallback((parentTaskId: string) => {
    const parentIndex = tasks.findIndex(t => t.id === parentTaskId)
    if (parentIndex === -1) return
    const parent = tasks[parentIndex]
    let insertAt = parentIndex + 1
    while (insertAt < tasks.length && tasks[insertAt].parentTaskId === parentTaskId) insertAt++
    const nt: Task = {
      id: uid(), name: 'New subtask', owner: parent.owner, status: 'Not started', priority: parent.priority,
      start: parent.start, end: parent.end, progress: 0, deps: [], tags: [], notes: '',
      parentTaskId,
    }
    const next = tasks.slice()
    next.splice(insertAt, 0, nt)
    setTasks(next)
    setSel(nt.id)
    flash('Subtask added')
  }, [tasks, setTasks, flash])

  const del = useCallback((id: string) => {
    setTasks(tasks.filter(t => t.id !== id).map(t => ({
      ...t,
      deps: t.deps.filter(d => d !== id),
      milestoneId: t.milestoneId === id ? null : t.milestoneId,
      parentTaskId: t.parentTaskId === id ? null : t.parentTaskId,
    })))
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

  const share = useCallback(async (requestedRole: PCRole = 'editor') => {
    // A viewer can only ever hand out further view-only links — they have no edit
    // access of their own to grant, so any request is downgraded to 'viewer'.
    const linkRole: PCRole = role === 'viewer' ? 'viewer' : requestedRole
    try {
      let id = shareId
      if (!id) {
        const created = await createShare({ tasks, theme })
        id = created.id
        suppressDirtyRef.current = true
        setPersisted(p => ({ ...p, shareId: id, remoteVersion: created.updatedAt, baseTasks: tasks }))
        setDirty(false)
      } else if (role !== 'viewer') {
        const updatedAt = await updateShare(id, { tasks, theme })
        suppressDirtyRef.current = true
        setPersisted(p => ({ ...p, remoteVersion: updatedAt, baseTasks: tasks }))
        setDirty(false)
        setConflict(false)
      }
      const url = buildShareUrl(id, linkRole)
      try {
        await navigator.clipboard.writeText(url)
        flash(linkRole === 'viewer' ? 'View-only link copied' : 'Share link copied — it stays up to date as you edit')
      } catch {
        flash('Link ready but could not copy it — copy it from your address bar')
      }
    } catch (err) {
      console.error('[ProjectCommand] share failed:', err)
      flash(`Could not create the share link: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }, [tasks, theme, shareId, role, flash])

  const refresh = useCallback(async () => {
    if (!shareId) {
      flash('Not shared yet — click Share to sync with collaborators')
      return
    }
    setRefreshing(true)
    try {
      const remote = await fetchShare(shareId)
      if (!remote?.tasks?.length) {
        flash('Could not find that shared board anymore')
        return
      }
      setConflict(false)
      if (dirty && role !== 'viewer') {
        // Reconcile instead of overwriting: any field you changed since the
        // last sync wins, everything else picks up the incoming remote value —
        // so your unsynced edits survive the refresh rather than being wiped.
        const merged = mergeTaskLists(baseTasks ?? tasks, tasks, remote.tasks)
        const stillPending = JSON.stringify(merged) !== JSON.stringify(remote.tasks)
        setPersisted(p => ({ ...p, tasks: merged, theme: remote.theme ?? p.theme, remoteVersion: remote.updatedAt, baseTasks: remote.tasks }))
        if (!stillPending) setDirty(false) // nothing local survived the merge — remote already reflected everything we had
        flash(stillPending ? 'Refreshed and merged — your local edits were kept' : 'Refreshed — you were already up to date')
      } else {
        suppressDirtyRef.current = true
        setPersisted(p => ({ ...p, tasks: remote.tasks, theme: remote.theme ?? p.theme, remoteVersion: remote.updatedAt, baseTasks: remote.tasks }))
        setDirty(false)
        flash(`Refreshed · ${remote.tasks.length} tasks`)
      }
    } catch (err) {
      console.error('[ProjectCommand] refresh failed:', err)
      flash(`Could not refresh: ${err instanceof Error ? err.message : 'unknown error'}`)
    } finally {
      setRefreshing(false)
    }
  }, [shareId, flash, dirty, role, tasks, baseTasks])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return tasks
    return tasks.filter(t =>
      `${t.name} ${t.owner} ${(t.tags || []).join(' ')} ${t.status} ${t.priority}`.toLowerCase().includes(query),
    )
  }, [tasks, q])

  const milestones = useMemo(() => tasks.filter(t => t.isMilestone), [tasks])
  const hierarchicalFiltered = useMemo(() => buildHierarchicalOrder(filtered), [filtered])

  return {
    tasks, filtered, theme, tab, scale, group, q, depsFor, sel, toast, refreshing, role, dirty, conflict,
    milestones, hierarchicalFiltered,
    setTheme, setTab, setScale, setGroup, setQ, setDepsFor, setSel, flash,
    taskName, update, addTask, addMilestone, addSubtask, setMilestone, del, move, startDragReorder, dropReorder,
    cycleStatus, toggleDone, toggleDep, importTasks, setTasks, share, refresh,
  }
}

export type ProjectCommandState = ReturnType<typeof useProjectCommand>
