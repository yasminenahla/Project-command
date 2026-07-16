import { useState } from 'react'
import { PRIORITIES, STATUSES } from '../types'
import type { OwnerEntry, PCGroup, PCTheme, Task, TaskPriority } from '../types'
import { STATUS_COLOR, PRIORITY_COLOR, LATE_COLOR, ownerColor } from '../theme'
import { diffDays, isTaskLate } from '../utils/dates'
import { taskIndentLevel } from '../utils/hierarchy'
import { buildOwnerMailto, recipientCount } from '../utils/notify'
import { buildShareUrl } from '../utils/shareLink'
import InlineInput from './InlineInput'
import DepsCell from './DepsCell'

interface Props {
  theme:      PCTheme
  tasks:      Task[]      // filtered, in display order
  allTasks:   Task[]      // full set, for deps popover
  milestones: Task[]      // tasks marked isMilestone, for the Milestone column's options
  actionNumbers: Map<string, string>
  shareId?:   string      // lets the "Notify" link point back at the live board, scoped to the owner's access level
  group:      PCGroup
  sel:        string | null
  depsFor:    string | null
  taskName:   (id: string) => string
  onUpdate:   (id: string, patch: Partial<Task>) => void
  onDelete:   (id: string) => void
  onMove:     (id: string, dir: 1 | -1) => void
  onDragStart:(id: string) => void
  onDrop:     (id: string) => void
  onCycleStatus: (id: string) => void
  onToggleDone:  (id: string) => void
  onToggleDep:   (id: string, depId: string) => void
  onSetDepsFor:  (id: string | null) => void
  onSetMilestone: (id: string, milestoneId: string | null) => void
  onAddSubtask:   (parentTaskId: string) => void
  onRenumber:     (id: string, value: string) => void
  owners:     OwnerEntry[]
  onManageOwners: () => void
  rosterDirty?: boolean
  readOnly?: boolean
}

const COLS = ['', '', '#', 'Task', 'Owner', 'Status', 'Priority', 'Milestone', 'Start', 'Due', 'Progress', 'Deps', 'Notes', '']
const STATUS_C_DONE = STATUS_COLOR.Done

export default function ActionTracker({
  theme: t, tasks, allTasks, milestones, actionNumbers, shareId, group, sel, depsFor, taskName,
  onUpdate, onDelete, onMove, onDragStart, onDrop, onCycleStatus, onToggleDone, onToggleDep, onSetDepsFor, onSetMilestone, onAddSubtask, onRenumber, owners, onManageOwners, rosterDirty, readOnly,
}: Props) {
  const grouped = group !== 'None'
  const groupByMilestone = group === 'Milestone'
  const showHierarchy = group === 'None' || groupByMilestone
  const byId = new Map(allTasks.map(t => [t.id, t]))

  let groups: [string | null, Task[]][]
  if (groupByMilestone) {
    const milestoneById = new Map(milestones.map(m => [m.id, m]))
    const subtasksOf = new Map<string, Task[]>()
    for (const x of tasks) {
      if (!x.isMilestone && x.parentTaskId) {
        (subtasksOf.get(x.parentTaskId) ?? subtasksOf.set(x.parentTaskId, []).get(x.parentTaskId)!).push(x)
      }
    }
    const withSubtasks = (x: Task) => [x, ...(subtasksOf.get(x.id) ?? [])]
    const rootTasks = tasks.filter(x => !x.isMilestone && !x.parentTaskId)
    const childMap = new Map<string, Task[]>()
    const unassigned: Task[] = []
    for (const x of rootTasks) {
      if (x.milestoneId && milestoneById.has(x.milestoneId)) {
        (childMap.get(x.milestoneId) ?? childMap.set(x.milestoneId, []).get(x.milestoneId)!).push(...withSubtasks(x))
      } else {
        unassigned.push(...withSubtasks(x))
      }
    }
    groups = milestones
      .filter(m => tasks.includes(m) || (childMap.get(m.id)?.length ?? 0) > 0)
      .map((m): [string, Task[]] => [m.name, [m, ...(childMap.get(m.id) ?? [])]])
    if (unassigned.length) groups.push(['No milestone', unassigned])
  } else if (grouped) {
    const map: Record<string, Task[]> = {}
    for (const x of tasks) {
      const g = (group === 'Status' ? x.status : group === 'Owner' ? (x.owner || 'Unassigned') : x.priority) || '—'
      ;(map[g] ??= []).push(x)
    }
    const order = group === 'Status' ? STATUSES : group === 'Priority' ? [...PRIORITIES].reverse() : Object.keys(map).sort()
    const known = order.filter(g => map[g]).map((g): [string, Task[]] => [g, map[g]])
    const rest  = Object.keys(map).filter(g => !order.includes(g)).map((g): [string, Task[]] => [g, map[g]])
    groups = [...known, ...rest]
  } else {
    groups = [[null, tasks]]
  }

  if (!tasks.length) {
    return (
      <div style={{ marginTop: 60, textAlign: 'center', color: t.sub }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No tasks match your search</div>
        <div style={{ fontSize: 13 }}>Clear the search box or add a new task.</div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 16, background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius, boxShadow: t.shadow, overflow: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1080 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${t.border}`, background: t.panel2 }}>
            {COLS.map((c, i) => (
              <th key={i} style={{ textAlign: 'left', fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: t.sub, padding: '0 12px 10px', whiteSpace: 'nowrap' }}>
                {c === 'Owner' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {c}
                    {!readOnly && (
                      <button
                        onClick={onManageOwners}
                        title={rosterDirty ? 'Manage the team roster — unsaved changes' : 'Manage the team roster'}
                        style={{
                          position: 'relative', cursor: 'pointer', border: 'none', background: 'none', color: t.sub, opacity: 0.7,
                          fontSize: 11, lineHeight: 1, padding: 0, textTransform: 'none', letterSpacing: 0, fontWeight: 700,
                        }}
                      >
                        ⚙
                        {rosterDirty && (
                          <span style={{ position: 'absolute', top: -3, right: -5, width: 6, height: 6, borderRadius: 99, background: '#F5B301' }} />
                        )}
                      </button>
                    )}
                  </span>
                ) : c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.flatMap(([g, list]) => [
            g != null && (
              <tr key={`g${g}`}>
                <td colSpan={14} style={{ padding: '11px 14px 7px' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: t.text, letterSpacing: 0.3 }}>{g}</span>
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: t.sub, background: t.chip, padding: '2px 8px', borderRadius: 99 }}>
                    {list.length}
                  </span>
                </td>
              </tr>
            ),
            ...list.map(task => (
              <TrackerRow
                key={task.id}
                task={task}
                theme={t}
                grouped={grouped}
                showHierarchy={showHierarchy}
                indentLevel={showHierarchy ? taskIndentLevel(task, byId) : 0}
                selected={sel === task.id}
                depsOpen={depsFor === task.id}
                allTasks={allTasks}
                milestones={milestones}
                actionNumber={actionNumbers.get(task.id) ?? ''}
                shareId={shareId}
                taskName={taskName}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onMove={onMove}
                onDragStart={onDragStart}
                onDrop={onDrop}
                onCycleStatus={onCycleStatus}
                onToggleDone={onToggleDone}
                onToggleDep={onToggleDep}
                onSetDepsFor={onSetDepsFor}
                onSetMilestone={onSetMilestone}
                onAddSubtask={onAddSubtask}
                onRenumber={onRenumber}
                owners={owners}
                readOnly={readOnly}
              />
            )),
          ])}
        </tbody>
      </table>
    </div>
  )
}

interface RowProps {
  task:       Task
  theme:      PCTheme
  grouped:    boolean
  showHierarchy: boolean
  indentLevel: number
  selected:   boolean
  depsOpen:   boolean
  allTasks:   Task[]
  milestones: Task[]
  actionNumber: string
  shareId?:   string
  taskName:   (id: string) => string
  onUpdate:   (id: string, patch: Partial<Task>) => void
  onDelete:   (id: string) => void
  onMove:     (id: string, dir: 1 | -1) => void
  onDragStart:(id: string) => void
  onDrop:     (id: string) => void
  onCycleStatus: (id: string) => void
  onToggleDone:  (id: string) => void
  onToggleDep:   (id: string, depId: string) => void
  onSetDepsFor:  (id: string | null) => void
  onSetMilestone: (id: string, milestoneId: string | null) => void
  onAddSubtask:   (parentTaskId: string) => void
  onRenumber:     (id: string, value: string) => void
  owners:     OwnerEntry[]
  readOnly?: boolean
}

function TrackerRow({
  task, theme: t, grouped, showHierarchy, indentLevel, selected, depsOpen, allTasks, milestones, actionNumber, shareId, taskName,
  onUpdate, onDelete, onMove, onDragStart, onDrop, onCycleStatus, onToggleDone, onToggleDep, onSetDepsFor, onSetMilestone, onAddSubtask, onRenumber, owners, readOnly,
}: RowProps) {
  const done = task.status === 'Done'
  const late = isTaskLate(task.end, task.status)
  const cell = (child: React.ReactNode, style?: React.CSSProperties) => (
    <td style={{ padding: '7px 8px', verticalAlign: 'middle', ...style }}>{child}</td>
  )
  // Bumped on every renumber attempt (success or failure) so the field
  // always remounts and shows the authoritative number — otherwise a
  // rejected edit (e.g. an unresolvable number) would leave the invalid
  // text sitting in the box, since the InlineInput's own value wouldn't
  // have actually changed.
  const [numAttempt, setNumAttempt] = useState(0)

  return (
    <tr
      draggable={!grouped && !readOnly}
      onDragStart={() => onDragStart(task.id)}
      onDragOver={e => e.preventDefault()}
      onDrop={() => onDrop(task.id)}
      style={{
        borderBottom: `1px solid ${t.line}`,
        background: selected ? t.chip : task.isMilestone ? t.panel2 : 'transparent',
        transition: 'background .15s',
      }}
    >
      {cell(
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {!grouped ? (
            <span style={{ cursor: readOnly ? 'default' : 'grab', color: t.sub, fontSize: 13, lineHeight: 0.8, letterSpacing: -2, opacity: readOnly ? 0.4 : 1 }}>⠿</span>
          ) : task.isMilestone ? (
            <span title="Milestone" style={{ color: t.accent, fontSize: 13 }}>◆</span>
          ) : <span style={{ color: t.sub, fontSize: 12 }}>·</span>}
          {showHierarchy && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <button onClick={() => onMove(task.id, -1)} disabled={readOnly} title="Move up among its siblings" style={{ border: 'none', background: 'none', cursor: readOnly ? 'default' : 'pointer', color: t.sub, fontSize: 9, lineHeight: 0.7, padding: 0, opacity: readOnly ? 0.4 : 1 }}>▲</button>
              <button onClick={() => onMove(task.id, 1)} disabled={readOnly} title="Move down among its siblings" style={{ border: 'none', background: 'none', cursor: readOnly ? 'default' : 'pointer', color: t.sub, fontSize: 9, lineHeight: 0.7, padding: 0, opacity: readOnly ? 0.4 : 1 }}>▼</button>
            </div>
          )}
        </div>,
        { width: 26 },
      )}

      {cell(
        task.isMilestone ? (
          <span title="Action number" style={{ fontSize: 12.5, fontWeight: 800, color: t.accent }}>{actionNumber}</span>
        ) : (
          <InlineInput
            key={numAttempt}
            value={actionNumber}
            onCommit={v => { onRenumber(task.id, v); setNumAttempt(n => n + 1) }}
            theme={t}
            disabled={readOnly}
            style={{
              width: 52, fontSize: 12, fontWeight: 700, textAlign: 'center', padding: '5px 4px',
              color: actionNumber.startsWith('U') ? t.sub : t.text, fontStyle: actionNumber.startsWith('U') ? 'italic' : 'normal',
            }}
          />
        ),
        { width: 60 },
      )}

      {cell(
        <button
          onClick={() => onToggleDone(task.id)}
          disabled={readOnly}
          title="Toggle done"
          style={{
            width: 20, height: 20, borderRadius: 6, cursor: readOnly ? 'default' : 'pointer',
            border: `2px solid ${done ? STATUS_C_DONE : t.border}`, background: done ? STATUS_C_DONE : 'transparent',
            color: '#fff', fontSize: 12, fontWeight: 800, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: readOnly ? 0.6 : 1,
          }}
        >
          {done ? '✓' : ''}
        </button>,
        { width: 26 },
      )}

      {cell(
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: indentLevel * 18 }}>
          <InlineInput
            value={task.name}
            onCommit={v => onUpdate(task.id, { name: v })}
            theme={t}
            disabled={readOnly}
            style={{
              fontWeight: task.isMilestone ? 800 : 700, fontSize: task.isMilestone ? 14 : 13.5, minWidth: 180,
              textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1,
            }}
          />
          {!readOnly && !task.isMilestone && !task.parentTaskId && (
            <button
              onClick={() => onAddSubtask(task.id)}
              title="Add subtask"
              style={{
                cursor: 'pointer', border: `1px solid ${t.border}`, background: 'transparent', color: t.sub,
                borderRadius: 6, fontSize: 11, fontWeight: 800, lineHeight: 1, padding: '3px 6px', flexShrink: 0,
              }}
            >
              + sub
            </button>
          )}
        </div>,
        { minWidth: 200 },
      )}

      {cell(
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 22, height: 22, borderRadius: 99, flexShrink: 0, background: task.owner ? ownerColor(task.owner) : t.border,
            color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {task.owner ? task.owner[0].toUpperCase() : '?'}
          </span>
          <select
            value={task.owner}
            onChange={e => onUpdate(task.id, { owner: e.target.value })}
            disabled={readOnly}
            style={{
              border: `1px solid ${t.border}`, background: t.panel, color: t.text, borderRadius: 8,
              padding: '5px 6px', fontSize: 12.5, fontWeight: 600, cursor: readOnly ? 'default' : 'pointer', outline: 'none',
              width: 100, opacity: readOnly ? 0.75 : 1,
            }}
          >
            <option value="">— unassigned —</option>
            {owners.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
            {task.owner && !owners.some(o => o.name === task.owner) && (
              <option value={task.owner}>{task.owner}</option>
            )}
          </select>
          {task.owner && (() => {
            const ownerEntry = owners.find(o => o.name === task.owner)
            const email = ownerEntry?.email
            const count = recipientCount(email)
            // Always a view-only link unless the roster explicitly grants this
            // person editor access — notifying someone shouldn't hand out edit
            // rights by accident.
            const boardUrl = shareId ? buildShareUrl(shareId, ownerEntry?.role === 'editor' ? 'editor' : 'viewer') : undefined
            return (
              <a
                href={email ? buildOwnerMailto(email, task, boardUrl) : undefined}
                onClick={e => { if (!email) e.preventDefault() }}
                title={
                  email
                    ? count > 1 ? `Email all ${count} people under "${task.owner}" about this task` : `Email ${task.owner} about this task`
                    : `Add an email for ${task.owner} in the team roster to enable this`
                }
                style={{
                  flexShrink: 0, cursor: email ? 'pointer' : 'default', textDecoration: 'none', display: 'inline-block',
                  color: t.sub, fontSize: 13, opacity: email ? 0.75 : 0.3, padding: '4px 2px',
                }}
              >
                ✉
              </a>
            )
          })()}
        </div>,
      )}

      {cell(
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => onCycleStatus(task.id)}
            disabled={readOnly}
            title="Click to cycle"
            style={{
              cursor: readOnly ? 'default' : 'pointer', border: 'none', borderRadius: 99, padding: '5px 11px', fontSize: 11.5, fontWeight: 800,
              whiteSpace: 'nowrap', color: '#fff', background: STATUS_COLOR[task.status], display: 'inline-flex', alignItems: 'center', gap: 6,
              opacity: readOnly ? 0.75 : 1,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 99, background: 'rgba(255,255,255,.9)' }} />
            {task.status}
          </button>
          {late && (
            <span
              title="Past its due date and not marked Done"
              style={{
                fontSize: 10.5, fontWeight: 800, color: '#fff', background: LATE_COLOR,
                padding: '3px 8px', borderRadius: 99, whiteSpace: 'nowrap', letterSpacing: 0.3,
              }}
            >
              LATE
            </span>
          )}
        </div>,
      )}

      {cell(
        <select
          value={task.priority}
          onChange={e => onUpdate(task.id, { priority: e.target.value as TaskPriority })}
          disabled={readOnly}
          style={{
            border: `1px solid ${PRIORITY_COLOR[task.priority]}`, background: 'transparent', color: PRIORITY_COLOR[task.priority],
            borderRadius: 8, padding: '5px 6px', fontSize: 12, fontWeight: 800, cursor: readOnly ? 'default' : 'pointer', outline: 'none',
            opacity: readOnly ? 0.75 : 1,
          }}
        >
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>,
      )}

      {cell(
        task.isMilestone ? (
          <span style={{ fontSize: 11, fontWeight: 700, color: t.accent }}>◆ Milestone</span>
        ) : (
          <select
            value={task.milestoneId ?? ''}
            onChange={e => onSetMilestone(task.id, e.target.value || null)}
            disabled={readOnly}
            style={{
              border: `1px solid ${t.border}`, background: t.panel, color: t.text, borderRadius: 8,
              padding: '5px 6px', fontSize: 12, fontWeight: 600, cursor: readOnly ? 'default' : 'pointer', outline: 'none', maxWidth: 130,
              opacity: readOnly ? 0.75 : 1,
            }}
          >
            <option value="">— none —</option>
            {milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        ),
      )}

      {cell(
        <DateInput
          value={task.start}
          theme={t}
          disabled={readOnly}
          onChange={v => onUpdate(task.id, { start: v, end: diffDays(v, task.end) < 0 ? v : task.end })}
        />,
      )}
      {cell(
        <DateInput
          value={task.end}
          theme={t}
          late={late}
          disabled={readOnly}
          onChange={v => onUpdate(task.id, { end: diffDays(task.start, v) < 0 ? task.start : v })}
        />,
      )}

      {cell(
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 130 }}>
          <div style={{ flex: 1, height: 7, borderRadius: 99, background: t.line, overflow: 'hidden' }}>
            <div style={{ width: `${task.progress}%`, height: '100%', borderRadius: 99, background: STATUS_COLOR[task.status], transition: 'width .2s' }} />
          </div>
          <input
            type="number"
            min={0}
            max={100}
            value={task.progress}
            disabled={readOnly}
            onChange={e => {
              const v = Math.max(0, Math.min(100, +e.target.value || 0))
              onUpdate(task.id, { progress: v, status: v === 100 ? 'Done' : (v > 0 && task.status === 'Not started' ? 'In progress' : task.status) })
            }}
            style={{ width: 44, border: `1px solid ${t.border}`, background: t.panel, color: t.text, borderRadius: 6, padding: '4px 4px', fontSize: 12, fontWeight: 700, textAlign: 'right', outline: 'none', opacity: readOnly ? 0.7 : 1 }}
          />
          <span style={{ fontSize: 11, color: t.sub, fontWeight: 700 }}>%</span>
        </div>,
      )}

      {cell(
        <DepsCell
          task={task}
          allTasks={allTasks}
          theme={t}
          open={depsOpen}
          onToggle={() => onSetDepsFor(depsOpen ? null : task.id)}
          onClose={() => onSetDepsFor(null)}
          onToggleDep={depId => onToggleDep(task.id, depId)}
          taskName={taskName}
          disabled={readOnly}
        />,
        { position: 'relative' },
      )}

      {cell(
        <InlineInput
          value={task.notes}
          onCommit={v => onUpdate(task.id, { notes: v })}
          theme={t}
          disabled={readOnly}
          style={{ width: 200, fontSize: 12, color: t.sub }}
        />,
        { minWidth: 180 },
      )}

      {cell(
        !readOnly && (
          <button
            onClick={() => onDelete(task.id)}
            title="Delete"
            style={{ cursor: 'pointer', border: 'none', background: 'none', color: t.sub, fontSize: 15, opacity: 0.6, padding: '4px 6px' }}
          >
            ✕
          </button>
        ),
        { width: 30 },
      )}
    </tr>
  )
}

function DateInput({ value, onChange, theme: t, late, disabled }: { value: string; onChange: (v: string) => void; theme: PCTheme; late?: boolean; disabled?: boolean }) {
  return (
    <input
      type="date"
      value={value}
      disabled={disabled}
      onChange={e => e.target.value && onChange(e.target.value)}
      style={{
        border: `1px solid ${late ? LATE_COLOR : t.border}`, background: t.panel, color: late ? LATE_COLOR : t.text,
        borderRadius: 7, padding: '5px 7px', fontSize: 12, fontWeight: late ? 800 : 600, outline: 'none',
        fontFamily: "'DM Mono',monospace", colorScheme: t.dark ? 'dark' : 'light', opacity: disabled ? 0.7 : 1,
      }}
    />
  )
}
