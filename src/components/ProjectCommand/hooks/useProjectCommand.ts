import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { OwnerEntry, PCGroup, PCRole, PCScale, PCTab, PCThemeName, Task, TaskStatus } from '../types'
import { STATUSES } from '../types'
import { seedTasks } from '../seed'
import { addDays, uid } from '../utils/dates'
import { buildShareUrl, clearShareFromLocation, readLegacySnapshotFromLocation, readShareIdFromLocation, readShareRoleFromLocation } from '../utils/shareLink'
import { createShare, fetchShare, fetchShareVersion, listVersions, saveVersion, updateShare } from '../utils/liveShare'
import type { VersionEntry } from '../utils/liveShare'
import { buildHierarchicalOrder } from '../utils/hierarchy'
import { mergeOwnerLists, mergeTaskLists } from '../utils/merge'
import { deriveInitialOwners, suggestOwner } from '../utils/ownerSuggest'

const LS_KEY = 'pc-timeline-v1'
// If a shared board sits open with no local edits and no sync for this long,
// auto-refresh it — otherwise a long-idle tab can act on a very stale view
// once someone resumes editing, causing avoidable conflicts.
const IDLE_REFRESH_MS = 25 * 60 * 1000

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
  owners: OwnerEntry[]  // the team roster — name + keywords that auto-suggest this owner on a matching task
  baseOwners?: OwnerEntry[]  // the owners list as of remoteVersion — merge ancestor, mirrors baseTasks
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
          // Older saved boards won't have a roster yet — bootstrap one from whatever
          // owner names are already on the tasks, so the dropdown isn't empty.
          owners: s.owners ?? deriveInitialOwners(s.tasks.map(t => t.owner)),
          baseOwners: s.baseOwners,
        }
      }
    }
  } catch { /* fall through to seed */ }
  const tasks = seedTasks()
  return { tasks, theme: 'playful', tab: 'tracker', scale: 'weeks', group: 'None', role: 'editor', owners: deriveInitialOwners(tasks.map(t => t.owner)) }
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
  const [historyOpen, setHistoryOpen] = useState(false)
  const [versions, setVersions] = useState<VersionEntry[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [ownerManagerOpen, setOwnerManagerOpen] = useState(false)

  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  const dragId      = useRef<string | null>(null)
  const syncTimer   = useRef<ReturnType<typeof setTimeout>>()
  // Set right before a remote-driven setPersisted (pull, or our own push's version bump) so the
  // auto-sync effect's next run — triggered by that same state change — doesn't mistake it for a local edit.
  const suppressDirtyRef = useRef(false)
  // Bumped on every local edit and every successful push/pull — the idle-refresh
  // timer below fires only once this has gone untouched for IDLE_REFRESH_MS.
  const lastActivityRef = useRef(Date.now())

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
            const owners = remote.owners ?? deriveInitialOwners(remote.tasks.map(t => t.owner))
            suppressDirtyRef.current = true
            lastActivityRef.current = Date.now()
            setPersisted(p => ({ ...p, tasks: remote.tasks, theme: remote.theme ?? p.theme, shareId: id, role, remoteVersion: remote.updatedAt, baseTasks: remote.tasks, owners, baseOwners: owners }))
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

  const { tasks, theme, tab, scale, group, shareId, role, remoteVersion, baseTasks, owners, baseOwners } = persisted

  // Once a board is shared, keep the remote copy fresh as it's edited —
  // debounced so rapid edits collapse into one sync a little after they stop.
  // Viewers never write back — they only ever pull.
  useEffect(() => {
    if (!shareId || role === 'viewer') return
    // This run was triggered by a pull we just did (hydrate/refresh/our own
    // push's version bump), not a local edit — nothing new to sync.
    if (suppressDirtyRef.current) { suppressDirtyRef.current = false; return }
    lastActivityRef.current = Date.now()
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
        const newVersion = await updateShare(shareId, { tasks, theme, owners })
        saveVersion(shareId, { tasks, theme, owners }).catch(() => {})
        suppressDirtyRef.current = true
        lastActivityRef.current = Date.now()
        setPersisted(p => ({ ...p, remoteVersion: newVersion, baseTasks: tasks, baseOwners: owners }))
        setDirty(false)
        setConflict(false)
      } catch {
        flash('Could not sync your latest changes to the share link')
      }
    }, 1200)
    return () => clearTimeout(syncTimer.current)
  }, [shareId, tasks, theme, owners, role, remoteVersion, flash])

  const setTasks = useCallback((next: Task[]) => {
    setPersisted(p => ({ ...p, tasks: next }))
  }, [])

  const setTheme = useCallback((v: PCThemeName) => setPersisted(p => ({ ...p, theme: v })), [])
  const setTab   = useCallback((v: PCTab)       => setPersisted(p => ({ ...p, tab: v })), [])
  const setScale = useCallback((v: PCScale)     => setPersisted(p => ({ ...p, scale: v })), [])
  const setGroup = useCallback((v: PCGroup)     => setPersisted(p => ({ ...p, group: v })), [])

  const taskName = useCallback((id: string) => tasks.find(t => t.id === id)?.name ?? '', [tasks])

  const update = useCallback((id: string, patch: Partial<Task>) => {
    setTasks(tasks.map(t => {
      if (t.id !== id) return t
      const next = { ...t, ...patch }
      // Auto-suggest an owner from the roster's keywords, but only ever fill
      // a blank owner field — never override someone's explicit choice.
      if (!next.owner && (patch.name !== undefined || patch.notes !== undefined || patch.tags !== undefined)) {
        const suggested = suggestOwner(`${next.name} ${next.notes} ${(next.tags || []).join(' ')}`, owners)
        if (suggested) next.owner = suggested
      }
      return next
    }))
  }, [tasks, setTasks, owners])

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

  const addOwner = useCallback((name: string, keywords: string[] = []) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setPersisted(p => p.owners.some(o => o.name.toLowerCase() === trimmed.toLowerCase())
      ? p
      : { ...p, owners: [...p.owners, { name: trimmed, keywords }] })
  }, [])

  const updateOwnerKeywords = useCallback((name: string, keywords: string[]) => {
    setPersisted(p => ({ ...p, owners: p.owners.map(o => o.name === name ? { ...o, keywords } : o) }))
  }, [])

  const renameOwner = useCallback((oldName: string, newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldName) return
    setPersisted(p => ({
      ...p,
      owners: p.owners.map(o => o.name === oldName ? { ...o, name: trimmed } : o),
      tasks: p.tasks.map(t => t.owner === oldName ? { ...t, owner: trimmed } : t),
    }))
  }, [])

  const removeOwner = useCallback((name: string) => {
    setPersisted(p => ({ ...p, owners: p.owners.filter(o => o.name !== name) }))
  }, [])

  const openOwnerManager  = useCallback(() => setOwnerManagerOpen(true), [])
  const closeOwnerManager = useCallback(() => setOwnerManagerOpen(false), [])

  const share = useCallback(async (requestedRole: PCRole = 'editor') => {
    // A viewer can only ever hand out further view-only links — they have no edit
    // access of their own to grant, so any request is downgraded to 'viewer'.
    const linkRole: PCRole = role === 'viewer' ? 'viewer' : requestedRole
    try {
      let id = shareId
      if (!id) {
        const created = await createShare({ tasks, theme, owners })
        id = created.id
        saveVersion(id, { tasks, theme, owners }).catch(() => {})
        suppressDirtyRef.current = true
        lastActivityRef.current = Date.now()
        setPersisted(p => ({ ...p, shareId: id, remoteVersion: created.updatedAt, baseTasks: tasks, baseOwners: owners }))
        setDirty(false)
      } else if (role !== 'viewer') {
        const updatedAt = await updateShare(id, { tasks, theme, owners })
        saveVersion(id, { tasks, theme, owners }).catch(() => {})
        suppressDirtyRef.current = true
        lastActivityRef.current = Date.now()
        setPersisted(p => ({ ...p, remoteVersion: updatedAt, baseTasks: tasks, baseOwners: owners }))
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
  }, [tasks, theme, owners, shareId, role, flash])

  const refresh = useCallback(async (auto = false) => {
    if (!shareId) {
      if (!auto) flash('Not shared yet — click Share to sync with collaborators')
      return
    }
    setRefreshing(true)
    try {
      const remote = await fetchShare(shareId)
      if (!remote?.tasks?.length) {
        if (!auto) flash('Could not find that shared board anymore')
        return
      }
      setConflict(false)
      lastActivityRef.current = Date.now()
      if (dirty && role !== 'viewer') {
        // Reconcile instead of overwriting: any field you changed since the
        // last sync wins, everything else picks up the incoming remote value —
        // so your unsynced edits survive the refresh rather than being wiped.
        // If we never captured a merge ancestor (e.g. this board was saved by an
        // older version of the app), fall back to an empty base rather than
        // `tasks` itself — using `tasks` as its own ancestor would make every
        // field look "unchanged," so the merge would silently take remote's
        // version of everything and erase the local edits it's supposed to protect.
        const remoteOwners = remote.owners ?? deriveInitialOwners(remote.tasks.map(t => t.owner))
        const merged = mergeTaskLists(baseTasks ?? [], tasks, remote.tasks)
        const mergedOwners = mergeOwnerLists(baseOwners ?? [], owners, remoteOwners)
        const stillPending = JSON.stringify(merged) !== JSON.stringify(remote.tasks) || JSON.stringify(mergedOwners) !== JSON.stringify(remoteOwners)
        setPersisted(p => ({ ...p, tasks: merged, theme: remote.theme ?? p.theme, owners: mergedOwners, remoteVersion: remote.updatedAt, baseTasks: remote.tasks, baseOwners: remoteOwners }))
        if (!stillPending) setDirty(false) // nothing local survived the merge — remote already reflected everything we had
        flash(stillPending
          ? (auto ? 'Auto-refreshed after being idle — your unsynced edits were merged in' : 'Refreshed and merged — your local edits were kept')
          : (auto ? 'Auto-refreshed after being idle' : 'Refreshed — you were already up to date'))
      } else {
        const remoteOwners = remote.owners ?? deriveInitialOwners(remote.tasks.map(t => t.owner))
        suppressDirtyRef.current = true
        setPersisted(p => ({ ...p, tasks: remote.tasks, theme: remote.theme ?? p.theme, owners: remoteOwners, remoteVersion: remote.updatedAt, baseTasks: remote.tasks, baseOwners: remoteOwners }))
        setDirty(false)
        flash(auto ? `Auto-refreshed after being idle · ${remote.tasks.length} tasks` : `Refreshed · ${remote.tasks.length} tasks`)
      }
    } catch (err) {
      console.error('[ProjectCommand] refresh failed:', err)
      if (!auto) flash(`Could not refresh: ${err instanceof Error ? err.message : 'unknown error'}`)
    } finally {
      setRefreshing(false)
    }
  }, [shareId, flash, dirty, role, tasks, baseTasks, owners, baseOwners])

  // Periodically check whether this tab has gone untouched (no edits, no
  // syncs) long enough to risk acting on stale data — if so, auto-refresh it.
  useEffect(() => {
    if (!shareId) return
    const interval = setInterval(() => {
      if (refreshing) return
      if (Date.now() - lastActivityRef.current >= IDLE_REFRESH_MS) refresh(true)
    }, 60_000)
    return () => clearInterval(interval)
  }, [shareId, refreshing, refresh])

  const openHistory = useCallback(async () => {
    if (!shareId) {
      flash('Not shared yet — nothing to show history for')
      return
    }
    setHistoryOpen(true)
    setLoadingVersions(true)
    try {
      const list = await listVersions(shareId)
      setVersions(list)
    } catch {
      flash('Could not load version history')
    } finally {
      setLoadingVersions(false)
    }
  }, [shareId, flash])

  const closeHistory = useCallback(() => setHistoryOpen(false), [])

  const restoreVersion = useCallback(async (entry: VersionEntry) => {
    if (!shareId || role === 'viewer') return
    const ok = window.confirm(
      `Replace the current board with the version from ${new Date(entry.createdAt).toLocaleString()}? The current board will be saved to history first, so this can always be undone.`,
    )
    if (!ok) return
    try {
      await saveVersion(shareId, { tasks, theme, owners }) // preserve the current state before overwriting it
      const restoredOwners = entry.payload.owners ?? owners // older versions may pre-date the roster field
      const newVersion = await updateShare(shareId, { ...entry.payload, owners: restoredOwners })
      await saveVersion(shareId, { ...entry.payload, owners: restoredOwners })
      suppressDirtyRef.current = true
      lastActivityRef.current = Date.now()
      setPersisted(p => ({
        ...p,
        tasks: entry.payload.tasks,
        theme: entry.payload.theme ?? p.theme,
        owners: restoredOwners,
        remoteVersion: newVersion,
        baseTasks: entry.payload.tasks,
        baseOwners: restoredOwners,
      }))
      setDirty(false)
      setConflict(false)
      setHistoryOpen(false)
      flash('Restored an earlier version — your previous board was saved to history too')
    } catch (err) {
      flash(`Could not restore: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }, [shareId, role, tasks, theme, owners, flash])

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
    milestones, hierarchicalFiltered, historyOpen, versions, loadingVersions, owners, ownerManagerOpen,
    setTheme, setTab, setScale, setGroup, setQ, setDepsFor, setSel, flash,
    taskName, update, addTask, addMilestone, addSubtask, setMilestone, del, move, startDragReorder, dropReorder,
    cycleStatus, toggleDone, toggleDep, importTasks, setTasks, share, refresh,
    openHistory, closeHistory, restoreVersion,
    addOwner, updateOwnerKeywords, renameOwner, removeOwner, openOwnerManager, closeOwnerManager,
  }
}

export type ProjectCommandState = ReturnType<typeof useProjectCommand>
