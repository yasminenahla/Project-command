import type { PCTheme, Task } from '../types'

interface Props {
  task:      Task
  allTasks:  Task[]
  theme:     PCTheme
  open:      boolean
  onToggle:  () => void
  onClose:   () => void
  onToggleDep: (depId: string) => void
  taskName:  (id: string) => string
}

export default function DepsCell({ task, allTasks, theme: t, open, onToggle, onClose, onToggleDep, taskName }: Props) {
  const depLabel = task.deps.map(taskName).join(', ')
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onToggle}
        style={{
          cursor: 'pointer', border: `1px dashed ${t.border}`, background: 'transparent',
          color: task.deps.length ? t.accent : t.sub, borderRadius: 8, padding: '5px 9px',
          fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
        }}
      >
        {task.deps.length ? depLabel.slice(0, 18) + (depLabel.length > 18 ? '…' : '') : '＋ link'}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 8, zIndex: 60, marginTop: 4, background: t.panel,
            border: `1px solid ${t.border}`, borderRadius: 10, boxShadow: '0 12px 30px rgba(20,49,94,.22)',
            padding: 8, minWidth: 200, maxHeight: 240, overflow: 'auto',
          }}
        >
          <div style={{ fontSize: 10.5, fontWeight: 800, color: t.sub, textTransform: 'uppercase', letterSpacing: 0.5, padding: '2px 6px 6px' }}>
            Depends on
          </div>
          {allTasks.filter(x => x.id !== task.id).map(x => (
            <label
              key={x.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px', borderRadius: 7, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: t.text }}
            >
              <input type="checkbox" checked={task.deps.includes(x.id)} onChange={() => onToggleDep(x.id)} />
              {x.name}
            </label>
          ))}
          <button
            onClick={onClose}
            style={{ marginTop: 4, width: '100%', border: 'none', background: t.chip, color: t.text, borderRadius: 7, padding: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  )
}
