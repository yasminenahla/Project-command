import { PRIORITIES, STATUSES } from '../types'
import type { PCGroup, PCTheme, Task, TaskPriority } from '../types'
import { STATUS_COLOR, PRIORITY_COLOR, ownerColor } from '../theme'
import { diffDays } from '../utils/dates'
import InlineInput from './InlineInput'
import DepsCell from './DepsCell'

interface Props {
  theme:      PCTheme
  tasks:      Task[]      // filtered, in display order
  allTasks:   Task[]      // full set, for deps popover
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
}

const COLS = ['', '', 'Task', 'Owner', 'Status', 'Priority', 'Start', 'Due', 'Progress', 'Tags', 'Deps', 'Notes', '']
const STATUS_C_DONE = STATUS_COLOR.Done

export default function ActionTracker({
  theme: t, tasks, allTasks, group, sel, depsFor, taskName,
  onUpdate, onDelete, onMove, onDragStart, onDrop, onCycleStatus, onToggleDone, onToggleDep, onSetDepsFor,
}: Props) {
  const grouped = group !== 'None'

  let groups: [string | null, Task[]][]
  if (grouped) {
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
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.flatMap(([g, list]) => [
            g != null && (
              <tr key={`g${g}`}>
                <td colSpan={13} style={{ padding: '11px 14px 7px' }}>
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
                selected={sel === task.id}
                depsOpen={depsFor === task.id}
                allTasks={allTasks}
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
  selected:   boolean
  depsOpen:   boolean
  allTasks:   Task[]
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
}

function TrackerRow({
  task, theme: t, grouped, selected, depsOpen, allTasks, taskName,
  onUpdate, onDelete, onMove, onDragStart, onDrop, onCycleStatus, onToggleDone, onToggleDep, onSetDepsFor,
}: RowProps) {
  const done = task.status === 'Done'
  const cell = (child: React.ReactNode, style?: React.CSSProperties) => (
    <td style={{ padding: '7px 8px', verticalAlign: 'middle', ...style }}>{child}</td>
  )

  return (
    <tr
      draggable={!grouped}
      onDragStart={() => onDragStart(task.id)}
      onDragOver={e => e.preventDefault()}
      onDrop={() => onDrop(task.id)}
      style={{ borderBottom: `1px solid ${t.line}`, background: selected ? t.chip : 'transparent', transition: 'background .15s' }}
    >
      {cell(
        !grouped ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ cursor: 'grab', color: t.sub, fontSize: 13, lineHeight: 0.8, letterSpacing: -2 }}>⠿</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <button onClick={() => onMove(task.id, -1)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: t.sub, fontSize: 9, lineHeight: 0.7, padding: 0 }}>▲</button>
              <button onClick={() => onMove(task.id, 1)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: t.sub, fontSize: 9, lineHeight: 0.7, padding: 0 }}>▼</button>
            </div>
          </div>
        ) : <span style={{ color: t.sub, fontSize: 12 }}>·</span>,
        { width: 26 },
      )}

      {cell(
        <button
          onClick={() => onToggleDone(task.id)}
          title="Toggle done"
          style={{
            width: 20, height: 20, borderRadius: 6, cursor: 'pointer',
            border: `2px solid ${done ? STATUS_C_DONE : t.border}`, background: done ? STATUS_C_DONE : 'transparent',
            color: '#fff', fontSize: 12, fontWeight: 800, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {done ? '✓' : ''}
        </button>,
        { width: 26 },
      )}

      {cell(
        <InlineInput
          value={task.name}
          onCommit={v => onUpdate(task.id, { name: v })}
          theme={t}
          style={{ fontWeight: 700, fontSize: 13.5, minWidth: 180, textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1 }}
        />,
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
          <InlineInput value={task.owner} onCommit={v => onUpdate(task.id, { owner: v })} theme={t} style={{ width: 88, fontSize: 12.5 }} />
        </div>,
      )}

      {cell(
        <button
          onClick={() => onCycleStatus(task.id)}
          title="Click to cycle"
          style={{
            cursor: 'pointer', border: 'none', borderRadius: 99, padding: '5px 11px', fontSize: 11.5, fontWeight: 800,
            whiteSpace: 'nowrap', color: '#fff', background: STATUS_COLOR[task.status], display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 99, background: 'rgba(255,255,255,.9)' }} />
          {task.status}
        </button>,
      )}

      {cell(
        <select
          value={task.priority}
          onChange={e => onUpdate(task.id, { priority: e.target.value as TaskPriority })}
          style={{
            border: `1px solid ${PRIORITY_COLOR[task.priority]}`, background: 'transparent', color: PRIORITY_COLOR[task.priority],
            borderRadius: 8, padding: '5px 6px', fontSize: 12, fontWeight: 800, cursor: 'pointer', outline: 'none',
          }}
        >
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>,
      )}

      {cell(
        <DateInput
          value={task.start}
          theme={t}
          onChange={v => onUpdate(task.id, { start: v, end: diffDays(v, task.end) < 0 ? v : task.end })}
        />,
      )}
      {cell(
        <DateInput
          value={task.end}
          theme={t}
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
            onChange={e => {
              const v = Math.max(0, Math.min(100, +e.target.value || 0))
              onUpdate(task.id, { progress: v, status: v === 100 ? 'Done' : (v > 0 && task.status === 'Not started' ? 'In progress' : task.status) })
            }}
            style={{ width: 44, border: `1px solid ${t.border}`, background: t.panel, color: t.text, borderRadius: 6, padding: '4px 4px', fontSize: 12, fontWeight: 700, textAlign: 'right', outline: 'none' }}
          />
          <span style={{ fontSize: 11, color: t.sub, fontWeight: 700 }}>%</span>
        </div>,
      )}

      {cell(
        <InlineInput
          value={(task.tags || []).join(', ')}
          onCommit={v => onUpdate(task.id, { tags: v.split(',').map(s => s.trim()).filter(Boolean) })}
          theme={t}
          style={{ width: 110, fontSize: 12, color: t.sub }}
        />,
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
        />,
        { position: 'relative' },
      )}

      {cell(
        <InlineInput
          value={task.notes}
          onCommit={v => onUpdate(task.id, { notes: v })}
          theme={t}
          style={{ width: 200, fontSize: 12, color: t.sub }}
        />,
        { minWidth: 180 },
      )}

      {cell(
        <button
          onClick={() => onDelete(task.id)}
          title="Delete"
          style={{ cursor: 'pointer', border: 'none', background: 'none', color: t.sub, fontSize: 15, opacity: 0.6, padding: '4px 6px' }}
        >
          ✕
        </button>,
        { width: 30 },
      )}
    </tr>
  )
}

function DateInput({ value, onChange, theme: t }: { value: string; onChange: (v: string) => void; theme: PCTheme }) {
  return (
    <input
      type="date"
      value={value}
      onChange={e => e.target.value && onChange(e.target.value)}
      style={{
        border: `1px solid ${t.border}`, background: t.panel, color: t.text, borderRadius: 7, padding: '5px 7px',
        fontSize: 12, fontWeight: 600, outline: 'none', fontFamily: "'DM Mono',monospace", colorScheme: t.dark ? 'dark' : 'light',
      }}
    />
  )
}
