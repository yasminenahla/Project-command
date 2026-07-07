import type { PCGroup, PCScale, PCTab, PCTheme } from './types'

interface Props {
  theme:    PCTheme
  tab:      PCTab
  onTab:    (v: PCTab) => void
  q:        string
  onQ:      (v: string) => void
  group:    PCGroup
  onGroup:  (v: PCGroup) => void
  scale:    PCScale
  onScale:  (v: PCScale) => void
  onAdd:    () => void
  onAddMilestone: () => void
}

const TABS: { id: PCTab; label: string; icon: string }[] = [
  { id: 'timeline', label: 'Timeline',       icon: '◷' },
  { id: 'tracker',  label: 'Action Tracker', icon: '☰' },
  { id: 'gantt',    label: 'Gantt',          icon: '▤' },
]

const GROUP_OPTS: PCGroup[] = ['None', 'Status', 'Owner', 'Priority', 'Milestone']
const SCALE_OPTS: PCScale[] = ['days', 'weeks', 'months']

export default function Toolbar({ theme: t, tab, onTab, q, onQ, group, onGroup, scale, onScale, onAdd, onAddMilestone }: Props) {
  return (
    <div
      style={{
        position: 'sticky', top: 0, zIndex: 40, background: t.appBg, padding: '2px 22px 0',
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', borderBottom: `1px solid ${t.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {TABS.map(tb => {
          const active = tab === tb.id
          return (
            <button
              key={tb.id}
              onClick={() => onTab(tb.id)}
              style={{
                cursor: 'pointer', border: 'none', background: 'transparent', padding: '12px 4px',
                margin: '0 4px', fontSize: 14.5, fontWeight: 700, letterSpacing: -0.2, position: 'relative',
                color: active ? t.accent : t.sub, transition: 'color .15s',
              }}
            >
              <span style={{ marginRight: 7, opacity: 0.9 }}>{tb.icon}</span>{tb.label}
              {active && (
                <div style={{ position: 'absolute', left: 4, right: 4, bottom: 0, height: 3, background: t.accent, borderRadius: 3 }} />
              )}
            </button>
          )
        })}
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: t.panel, border: `1px solid ${t.border}`, borderRadius: 10, padding: '7px 12px', boxShadow: t.shadow }}>
        <span style={{ color: t.sub, fontSize: 14 }}>⌕</span>
        <input
          value={q}
          placeholder="Search tasks, owners, tags…"
          onChange={e => onQ(e.target.value)}
          style={{ border: 'none', outline: 'none', background: 'transparent', color: t.text, fontSize: 13, fontWeight: 600, width: 180 }}
        />
      </div>

      {tab === 'tracker' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: t.sub }}>
          Group
          <select
            value={group}
            onChange={e => onGroup(e.target.value as PCGroup)}
            style={{ border: `1px solid ${t.border}`, background: t.panel, color: t.text, borderRadius: 8, padding: '6px 8px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', outline: 'none' }}
          >
            {GROUP_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      )}

      {tab === 'gantt' && (
        <div style={{ display: 'flex', gap: 3, background: t.panel, border: `1px solid ${t.border}`, borderRadius: 9, padding: 3, boxShadow: t.shadow }}>
          {SCALE_OPTS.map(s => {
            const active = scale === s
            return (
              <button
                key={s}
                onClick={() => onScale(s)}
                style={{
                  cursor: 'pointer', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12,
                  fontWeight: 700, textTransform: 'capitalize',
                  background: active ? t.accent : 'transparent', color: active ? '#fff' : t.sub, transition: 'all .15s',
                }}
              >
                {s}
              </button>
            )
          })}
        </div>
      )}

      <button
        onClick={onAddMilestone}
        title="Add a key milestone to group tasks under"
        style={{
          cursor: 'pointer', border: `1px solid ${t.border}`, background: t.panel, color: t.text,
          padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 7, boxShadow: t.shadow,
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1 }}>◆</span>Add milestone
      </button>

      <button
        onClick={onAdd}
        style={{
          cursor: 'pointer', border: 'none', background: t.accent, color: '#fff', padding: '9px 16px',
          borderRadius: 10, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7,
          boxShadow: '0 3px 10px rgba(0,150,214,.32)',
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span>Add task
      </button>
    </div>
  )
}
