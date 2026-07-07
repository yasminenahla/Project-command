import type { PCTheme, Task } from '../types'
import { STATUS_COLOR, LATE_COLOR } from '../theme'
import { MONTHS, fmtShort, isTaskLate, parseDate } from '../utils/dates'
import { rollupByMilestone } from '../utils/hierarchy'

interface Props {
  theme:    PCTheme
  tasks:    Task[]
  onSelect: (id: string) => void
}

function completionColor(pct: number): string {
  if (pct >= 100) return STATUS_COLOR.Done
  if (pct <= 0) return STATUS_COLOR['Not started']
  return STATUS_COLOR['In progress']
}

export default function Timeline({ theme: t, tasks: filtered, onSelect }: Props) {
  const rows = rollupByMilestone(filtered)

  if (!rows.length) {
    return (
      <div style={{ marginTop: 60, textAlign: 'center', color: t.sub }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No tasks match your search</div>
        <div style={{ fontSize: 13 }}>Clear the search box or add a new task.</div>
      </div>
    )
  }

  let curMonth = ''

  return (
    <div style={{ marginTop: 22, maxWidth: 920, margin: '22px auto 0', position: 'relative' }}>
      <div style={{
        position: 'absolute', left: '50%', top: 0, bottom: 0, width: 3, marginLeft: -1.5,
        background: 'linear-gradient(#0096D6,#7BBE28,#F5B301)', borderRadius: 99, opacity: 0.5,
      }} />
      {rows.map((row, i) => {
        const left = i % 2 === 0
        const d = parseDate(row.start)
        const mLabel = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
        const showMonth = mLabel !== curMonth
        curMonth = mLabel

        const dotColor = row.kind === 'milestone' ? completionColor(row.completion) : STATUS_COLOR[row.task.status]
        const rowId = row.kind === 'milestone' ? row.milestone.id : row.task.id

        const card = row.kind === 'milestone' ? (
          <div
            onClick={() => onSelect(row.milestone.id)}
            style={{
              background: t.chip, border: `1px solid ${t.border}`, borderRadius: t.radius, padding: '14px 16px',
              boxShadow: t.shadow, cursor: 'pointer', borderLeft: `6px solid ${dotColor}`, transition: 'transform .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, justifyContent: left ? 'flex-end' : 'flex-start', flexDirection: left ? 'row-reverse' : 'row' }}>
              <span style={{ fontSize: 15.5, fontWeight: 800, color: t.text }}>
                <span style={{ color: t.accent, marginRight: 6 }}>◆</span>{row.milestone.name}
              </span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.sub, fontFamily: "'DM Mono',monospace", textAlign: left ? 'right' : 'left', marginBottom: 10 }}>
              {fmtShort(row.milestone.start)} → {fmtShort(row.milestone.end)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: left ? 'row-reverse' : 'row' }}>
              <div style={{ flex: 1, height: 8, borderRadius: 99, background: t.line, overflow: 'hidden' }}>
                <div style={{ width: `${row.completion}%`, height: '100%', borderRadius: 99, background: dotColor, transition: 'width .2s' }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: dotColor, whiteSpace: 'nowrap' }}>{row.completion}%</span>
            </div>
            {row.children.length > 0 && (
              <div style={{ fontSize: 11, fontWeight: 600, color: t.sub, marginTop: 6, textAlign: left ? 'right' : 'left' }}>
                {row.children.length} task{row.children.length === 1 ? '' : 's'}
              </div>
            )}
          </div>
        ) : (() => {
          const task = row.task
          const done = task.status === 'Done'
          const late = isTaskLate(task.end, task.status)
          return (
            <div
              onClick={() => onSelect(task.id)}
              style={{
                background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius, padding: '14px 16px',
                boxShadow: t.shadow, cursor: 'pointer', borderLeft: `4px solid ${STATUS_COLOR[task.status]}`,
                transition: 'transform .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, justifyContent: left ? 'flex-end' : 'flex-start', flexDirection: left ? 'row-reverse' : 'row' }}>
                <span style={{ fontSize: 14.5, fontWeight: 800, color: t.text, textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.65 : 1 }}>
                  {task.name}
                </span>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: STATUS_COLOR[task.status], padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                  {task.status}
                </span>
                {late && (
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: LATE_COLOR, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap', letterSpacing: 0.3 }}>
                    LATE
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: late ? LATE_COLOR : t.sub, fontFamily: "'DM Mono',monospace", textAlign: left ? 'right' : 'left' }}>
                {fmtShort(task.start)} → {fmtShort(task.end)}
              </div>
              {task.notes && (
                <div style={{ fontSize: 12, color: t.sub, marginTop: 6, textAlign: left ? 'right' : 'left', lineHeight: 1.45 }}>
                  {task.notes}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, justifyContent: left ? 'flex-end' : 'flex-start', flexDirection: left ? 'row-reverse' : 'row' }}>
                {task.owner && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: t.chipTx, background: t.chip, padding: '3px 9px', borderRadius: 99 }}>
                    {task.owner}
                  </span>
                )}
                {(task.tags || []).slice(0, 2).map(tag => (
                  <span key={tag} style={{ fontSize: 10.5, fontWeight: 700, color: t.sub, border: `1px solid ${t.border}`, padding: '2px 8px', borderRadius: 99 }}>
                    #{tag}
                  </span>
                ))}
                <span style={{ fontSize: 11, fontWeight: 800, color: STATUS_COLOR[task.status], marginLeft: left ? 0 : 'auto', marginRight: left ? 'auto' : 0 }}>
                  {task.progress}%
                </span>
              </div>
            </div>
          )
        })()

        return (
          <div key={rowId}>
            {showMonth && (
              <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0 18px' }}>
                <span style={{
                  fontSize: 12, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: '#fff',
                  background: t.accent, padding: '5px 16px', borderRadius: 99, boxShadow: '0 3px 8px rgba(0,150,214,.3)',
                  zIndex: 2, position: 'relative',
                }}>
                  {mLabel}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 20, position: 'relative' }}>
              <div style={{ width: '50%', paddingRight: left ? 26 : 0, paddingLeft: left ? 0 : 26, order: left ? 0 : 2 }}>
                {left ? card : null}
              </div>
              <div style={{
                position: 'absolute', left: '50%',
                marginLeft: row.kind === 'milestone' ? -13 : -9, width: row.kind === 'milestone' ? 26 : 18, height: row.kind === 'milestone' ? 26 : 18, borderRadius: 99,
                background: row.kind === 'milestone' ? dotColor : t.panel,
                border: `3px solid ${dotColor}`, zIndex: 3, boxShadow: `0 0 0 4px ${t.appBg}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {row.kind === 'milestone' && <span style={{ color: '#fff', fontSize: 11 }}>◆</span>}
              </div>
              <div style={{ width: '50%', paddingLeft: left ? 0 : 26, paddingRight: left ? 26 : 0, order: left ? 2 : 0 }}>
                {!left ? card : null}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
