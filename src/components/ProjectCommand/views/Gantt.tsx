import { useEffect, useMemo, useRef, useState } from 'react'
import type { PCScale, PCTheme, Task } from '../types'
import { STATUSES } from '../types'
import { STATUS_COLOR, LATE_COLOR } from '../theme'
import { MONTHS, WEEKDAY_INITIALS, addDays, daysInMonth, diffDays, firstOfMonth, fmtShort, isTaskLate, isoDate, mondayOf, parseDate } from '../utils/dates'

interface Props {
  theme:    PCTheme
  tasks:    Task[]
  scale:    PCScale
  onUpdate: (id: string, patch: Partial<Task>) => void
  onSelect: (id: string) => void
}

const LABEL_W = 232
const ROW = 46
const BAR = 26

interface Col { x: number; w: number; top: string; bot: string | number; weekend?: boolean }
interface MonthSeg { x: number; w: number; label: string }
interface DragState { id: string; mode: 'move' | 'l' | 'r'; startX: number; origStart: string; origEnd: string }
interface Preview { id: string; start: string; end: string }

function ppdFor(scale: PCScale): number {
  return scale === 'days' ? 34 : scale === 'weeks' ? 18 : 5
}

function gRange(tasks: Task[], scale: PCScale): { start: string; end: string } {
  let min = tasks[0].start
  let max = tasks[0].end
  for (const t of tasks) {
    if (t.start < min) min = t.start
    if (t.end > max) max = t.end
  }
  const start = scale === 'months' ? firstOfMonth(min) : scale === 'weeks' ? mondayOf(addDays(min, -3)) : addDays(min, -3)
  const end = scale === 'months'
    ? isoDate(new Date(parseDate(max).getFullYear(), parseDate(max).getMonth() + 1, 0))
    : addDays(max, scale === 'weeks' ? 7 : 4)
  return { start, end }
}

export default function Gantt({ theme: t, tasks, scale, onUpdate, onSelect }: Props) {
  const ppd = ppdFor(scale)
  const [drag, setDrag]     = useState<DragState | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const previewRef = useRef<Preview | null>(null)

  useEffect(() => {
    if (!drag) return
    function onMove(e: MouseEvent) {
      if (!drag) return
      const dd = Math.round((e.clientX - drag.startX) / ppd)
      let s = drag.origStart
      let en = drag.origEnd
      if (drag.mode === 'move') { s = addDays(drag.origStart, dd); en = addDays(drag.origEnd, dd) }
      else if (drag.mode === 'l') { s = addDays(drag.origStart, dd); if (diffDays(s, en) < 0) s = en }
      else { en = addDays(drag.origEnd, dd); if (diffDays(s, en) < 0) en = s }
      const next = { id: drag.id, start: s, end: en }
      previewRef.current = next
      setPreview(next)
    }
    function onUp() {
      if (previewRef.current) onUpdate(previewRef.current.id, { start: previewRef.current.start, end: previewRef.current.end })
      previewRef.current = null
      setPreview(null)
      setDrag(null)
    }
    document.body.style.cursor = drag.mode === 'move' ? 'grabbing' : 'ew-resize'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
    }
  }, [drag, ppd])

  const geometry = useMemo(() => {
    if (!tasks.length) return null
    const { start, end } = gRange(tasks, scale)
    const total = diffDays(start, end) + 1
    const W = total * ppd
    const todayISO = isoDate(new Date())
    const todayX = diffDays(start, todayISO) * ppd

    const cols: Col[] = []
    if (scale === 'days') {
      for (let i = 0; i < total; i++) {
        const iso = addDays(start, i)
        const d = parseDate(iso)
        cols.push({ x: i * ppd, w: ppd, top: WEEKDAY_INITIALS[d.getDay()], bot: d.getDate(), weekend: d.getDay() === 0 || d.getDay() === 6 })
      }
    } else if (scale === 'weeks') {
      for (let i = 0; i < total; i += 7) cols.push({ x: i * ppd, w: 7 * ppd, top: '', bot: fmtShort(addDays(start, i)) })
    } else {
      let cur = start
      while (cur <= end) {
        const d = parseDate(cur)
        const dim = daysInMonth(d.getFullYear(), d.getMonth())
        const x = diffDays(start, cur) * ppd
        cols.push({ x, w: dim * ppd, top: '', bot: `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}` })
        cur = addDays(cur, dim)
      }
    }

    const months: MonthSeg[] = []
    if (scale !== 'months') {
      let cur = firstOfMonth(start)
      while (cur <= end) {
        const d = parseDate(cur)
        const dim = daysInMonth(d.getFullYear(), d.getMonth())
        const segStart = cur < start ? start : cur
        const segEndRaw = addDays(firstOfMonth(cur), dim - 1)
        const segEnd = segEndRaw > end ? end : segEndRaw
        const x = diffDays(start, segStart) * ppd
        const w = (diffDays(segStart, segEnd) + 1) * ppd
        months.push({ x, w, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` })
        cur = addDays(firstOfMonth(cur), dim)
      }
    }

    const idxOf: Record<string, number> = {}
    tasks.forEach((x, i) => { idxOf[x.id] = i })
    const rowY = (idx: number) => idx * ROW
    const arrows: { x1: number; y1: number; x2: number; y2: number; key: string }[] = []
    tasks.forEach((task, i) => {
      task.deps.forEach(dp => {
        if (idxOf[dp] == null) return
        const p = tasks[idxOf[dp]]
        const x1 = (diffDays(start, p.end) + 1) * ppd
        const y1 = rowY(idxOf[dp]) + ROW / 2
        const x2 = diffDays(start, task.start) * ppd
        const y2 = rowY(i) + ROW / 2
        arrows.push({ x1, y1, x2, y2, key: `${dp}-${task.id}` })
      })
    })

    return { start, end, total, W, todayX, cols, months, arrows, gridH: tasks.length * ROW }
  }, [tasks, scale, ppd])

  if (!tasks.length || !geometry) {
    return (
      <div style={{ marginTop: 60, textAlign: 'center', color: t.sub }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No tasks match your search</div>
        <div style={{ fontSize: 13 }}>Clear the search box or add a new task.</div>
      </div>
    )
  }

  const { start, W, todayX, cols, months, arrows, gridH } = geometry

  function taskDates(task: Task): { s: string; e: string } {
    if (preview && preview.id === task.id) return { s: preview.start, e: preview.end }
    return { s: task.start, e: task.end }
  }

  return (
    <div style={{ marginTop: 16, background: t.panel, border: `1px solid ${t.border}`, borderRadius: t.radius, boxShadow: t.shadow, overflow: 'hidden' }}>
      <div style={{ display: 'flex' }}>
        {/* left labels */}
        <div style={{ width: LABEL_W, flexShrink: 0, borderRight: `1px solid ${t.border}`, background: t.panel2 }}>
          <div style={{
            height: scale === 'months' ? 38 : 58, borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'flex-end',
            padding: '0 16px 8px', fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: t.sub,
          }}>
            Task
          </div>
          {tasks.map(task => (
            <div
              key={task.id}
              style={{
                height: ROW, display: 'flex', alignItems: 'center', gap: 9, borderBottom: `1px solid ${t.line}`,
                padding: `0 14px 0 ${task.isMilestone ? 14 : task.milestoneId ? 28 : 14}px`,
                background: task.isMilestone ? t.chip : 'transparent',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: STATUS_COLOR[task.status] }} />
              <div style={{ overflow: 'hidden', flex: '1 1 auto', minWidth: 0 }}>
                <div style={{ fontSize: task.isMilestone ? 13.5 : 13, fontWeight: task.isMilestone ? 800 : 700, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {task.isMilestone && <span style={{ color: t.accent, marginRight: 5 }}>◆</span>}{task.name}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: t.sub }}>{task.owner || 'Unassigned'}</div>
              </div>
              {isTaskLate(task.end, task.status) && (
                <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 800, color: '#fff', background: LATE_COLOR, borderRadius: 99, padding: '1px 6px', letterSpacing: 0.3 }}>
                  LATE
                </span>
              )}
            </div>
          ))}
        </div>

        {/* scrollable chart */}
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <div style={{ width: W, position: 'relative' }}>
            {scale !== 'months' && (
              <div style={{ height: 20, position: 'relative', borderBottom: `1px solid ${t.line}` }}>
                {months.map((m, i) => (
                  <div key={i} style={{
                    position: 'absolute', left: m.x, width: m.w, height: 20, display: 'flex', alignItems: 'center',
                    paddingLeft: 8, fontSize: 11, fontWeight: 800, color: t.text, borderLeft: `1px solid ${t.line}`,
                    whiteSpace: 'nowrap', overflow: 'hidden',
                  }}>
                    {m.label}
                  </div>
                ))}
              </div>
            )}
            <div style={{ height: 38, position: 'relative', borderBottom: `1px solid ${t.border}` }}>
              {cols.map((c, i) => (
                <div key={i} style={{
                  position: 'absolute', left: c.x, width: c.w, height: 38, borderLeft: `1px solid ${t.line}`,
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  alignItems: scale === 'days' ? 'center' : 'flex-start', paddingLeft: scale === 'days' ? 0 : 7,
                }}>
                  {c.top && <div style={{ fontSize: 9, fontWeight: 700, color: t.sub, opacity: 0.7 }}>{c.top}</div>}
                  <div style={{ fontSize: scale === 'days' ? 11 : 11.5, fontWeight: 700, color: c.weekend ? t.sub : t.text }}>{c.bot}</div>
                </div>
              ))}
            </div>

            <div style={{ position: 'relative', height: gridH }}>
              {scale === 'days' && cols.filter(c => c.weekend).map((c, i) => (
                <div key={`we${i}`} style={{ position: 'absolute', left: c.x, top: 0, width: c.w, height: gridH, background: t.weekend }} />
              ))}
              {tasks.map((task, i) => task.isMilestone && (
                <div key={`mb${i}`} style={{ position: 'absolute', left: 0, top: rowY(i), width: W, height: ROW, background: t.chip, opacity: 0.5 }} />
              ))}
              {cols.map((c, i) => (
                <div key={`gl${i}`} style={{ position: 'absolute', left: c.x, top: 0, width: 1, height: gridH, background: t.line }} />
              ))}
              {tasks.map((_task, i) => (
                <div key={`rl${i}`} style={{ position: 'absolute', left: 0, top: (i + 1) * ROW - 1, width: W, height: 1, background: t.line }} />
              ))}

              {todayX >= 0 && todayX <= W && (
                <div style={{ position: 'absolute', left: todayX, top: 0, width: 2, height: gridH, background: '#E8663B', zIndex: 5 }}>
                  <div style={{ position: 'absolute', top: -2, left: -4, width: 10, height: 10, borderRadius: 99, background: '#E8663B' }} />
                </div>
              )}

              <svg width={W} height={gridH} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 3 }}>
                <defs>
                  <marker id="pc-arrowhead" markerWidth={8} markerHeight={8} refX={6} refY={3} orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill={t.sub} />
                  </marker>
                </defs>
                {arrows.map(a => {
                  const d = `M${a.x1},${a.y1} C${a.x1 + 16},${a.y1} ${a.x2 - 16},${a.y2} ${a.x2},${a.y2}`
                  return <path key={a.key} d={d} fill="none" stroke={t.sub} strokeWidth={1.5} opacity={0.45} markerEnd="url(#pc-arrowhead)" />
                })}
              </svg>

              {tasks.map((task, i) => {
                const { s, e } = taskDates(task)
                const left = diffDays(start, s) * ppd
                const w = Math.max(ppd * 0.6, (diffDays(s, e) + 1) * ppd)
                const color = STATUS_COLOR[task.status]
                const late = isTaskLate(task.end, task.status)
                return (
                  <div
                    key={task.id}
                    onMouseDown={ev => {
                      ev.preventDefault(); ev.stopPropagation()
                      setDrag({ id: task.id, mode: 'move', startX: ev.clientX, origStart: task.start, origEnd: task.end })
                    }}
                    onClick={() => onSelect(task.id)}
                    style={{
                      position: 'absolute', left, top: rowY(i) + (ROW - BAR) / 2, width: w, height: BAR, borderRadius: t.barRad,
                      background: color, cursor: 'grab', display: 'flex', alignItems: 'center', overflow: 'hidden', zIndex: 4,
                      border: late ? `2px solid ${LATE_COLOR}` : task.isMilestone ? '2px solid rgba(255,255,255,.6)' : 'none',
                      boxShadow: late ? `0 0 0 2px rgba(214,69,69,.25), 0 3px 10px rgba(20,49,94,.35)` : task.isMilestone ? '0 3px 10px rgba(20,49,94,.35)' : '0 2px 6px rgba(20,49,94,.18)',
                    }}
                  >
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${task.progress || 0}%`, background: 'rgba(255,255,255,.28)' }} />
                    <div
                      onMouseDown={ev => {
                        ev.preventDefault(); ev.stopPropagation()
                        setDrag({ id: task.id, mode: 'l', startX: ev.clientX, origStart: task.start, origEnd: task.end })
                      }}
                      style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, cursor: 'ew-resize', zIndex: 2 }}
                    />
                    <div
                      onMouseDown={ev => {
                        ev.preventDefault(); ev.stopPropagation()
                        setDrag({ id: task.id, mode: 'r', startX: ev.clientX, origStart: task.start, origEnd: task.end })
                      }}
                      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 8, cursor: 'ew-resize', zIndex: 2 }}
                    />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', padding: '0 10px', whiteSpace: 'nowrap', position: 'relative', textShadow: '0 1px 2px rgba(0,0,0,.2)' }}>
                      {w > 60 ? (task.isMilestone ? `◆ ${task.name}` : task.name) : ''}
                    </span>
                    {task.progress > 0 && task.progress < 100 && w > 120 && (
                      <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, color: '#fff', padding: '0 8px', opacity: 0.9 }}>{task.progress}%</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '10px 16px', borderTop: `1px solid ${t.border}`, fontSize: 11.5, fontWeight: 600, color: t.sub, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span>Drag a bar to reschedule · drag its edges to resize</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 14 }}>
          {STATUSES.map(s => (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: STATUS_COLOR[s] }} />
              {s}
            </span>
          ))}
        </span>
      </div>
    </div>
  )
}

function rowY(idx: number): number { return idx * ROW }
