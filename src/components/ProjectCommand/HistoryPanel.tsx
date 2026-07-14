import type { PCTheme } from './types'
import type { VersionEntry } from './utils/liveShare'

interface Props {
  theme:   PCTheme
  open:    boolean
  loading: boolean
  versions: VersionEntry[]
  readOnly?: boolean
  onRestore: (entry: VersionEntry) => void
  onClose:  () => void
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export default function HistoryPanel({ theme: t, open, loading, versions, readOnly, onRestore, onClose }: Props) {
  if (!open) return null

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,20,35,.4)', zIndex: 100 }} />
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 360, maxWidth: '90vw',
          background: t.panel, borderLeft: `1px solid ${t.border}`, zIndex: 101,
          boxShadow: '-14px 0 34px rgba(20,49,94,.25)', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>Version history</div>
            <div style={{ fontSize: 11.5, color: t.sub, marginTop: 2 }}>A snapshot is saved every time the board syncs</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: t.sub, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <div style={{ padding: 14, overflowY: 'auto', flex: 1 }}>
          {loading && <div style={{ color: t.sub, fontSize: 13, padding: '8px 4px' }}>Loading…</div>}
          {!loading && versions.length === 0 && (
            <div style={{ color: t.sub, fontSize: 13, padding: '8px 4px', lineHeight: 1.5 }}>
              No history yet — versions are recorded the next time this board syncs.
            </div>
          )}
          {!loading && versions.map((v, i) => (
            <div
              key={v.id}
              style={{
                padding: '11px 13px', borderRadius: 10, border: `1px solid ${t.border}`, marginBottom: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                background: i === 0 ? t.panel2 : 'transparent',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, whiteSpace: 'nowrap' }}>
                  {relativeTime(v.createdAt)}{i === 0 && <span style={{ marginLeft: 7, fontSize: 10.5, fontWeight: 800, color: t.accent }}>LATEST</span>}
                </div>
                <div style={{ fontSize: 11.5, color: t.sub, marginTop: 2 }}>
                  {new Date(v.createdAt).toLocaleString()} · {v.payload.tasks.length} tasks
                </div>
              </div>
              {!readOnly && i !== 0 && (
                <button
                  onClick={() => onRestore(v)}
                  style={{ flexShrink: 0, cursor: 'pointer', border: 'none', background: t.accent, color: '#fff', padding: '6px 13px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}
                >
                  Restore
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
