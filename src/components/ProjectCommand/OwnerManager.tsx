import { useState } from 'react'
import type { OwnerEntry, PCTheme } from './types'

interface Props {
  theme:   PCTheme
  open:    boolean
  owners:  OwnerEntry[]
  onAdd:    (name: string, keywords: string[]) => void
  onUpdateKeywords: (name: string, keywords: string[]) => void
  onRename: (oldName: string, newName: string) => void
  onRemove: (name: string) => void
  onClose:  () => void
}

function parseKeywords(v: string): string[] {
  return v.split(',').map(s => s.trim()).filter(Boolean)
}

export default function OwnerManager({ theme: t, open, owners, onAdd, onUpdateKeywords, onRename, onRemove, onClose }: Props) {
  const [newName, setNewName] = useState('')
  const [newKeywords, setNewKeywords] = useState('')

  if (!open) return null

  const inputStyle: React.CSSProperties = {
    border: `1px solid ${t.border}`, background: t.panel, color: t.text, borderRadius: 8,
    padding: '7px 9px', fontSize: 12.5, fontWeight: 600, outline: 'none', width: '100%',
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,20,35,.4)', zIndex: 100 }} />
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, maxWidth: '90vw',
          background: t.panel, borderLeft: `1px solid ${t.border}`, zIndex: 101,
          boxShadow: '-14px 0 34px rgba(20,49,94,.25)', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>Team roster</div>
            <div style={{ fontSize: 11.5, color: t.sub, marginTop: 2 }}>Owners appear in the tracker's dropdown</div>
          </div>
          <button onClick={onClose} title="Close panel" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: t.sub, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <div style={{ padding: 14, overflowY: 'auto', flex: 1 }}>
          {owners.length === 0 && (
            <div style={{ color: t.sub, fontSize: 13, padding: '8px 4px', lineHeight: 1.5 }}>
              No one on the roster yet — add a name below.
            </div>
          )}
          {owners.map(o => (
            <div key={o.name} style={{ padding: '11px 13px', borderRadius: 10, border: `1px solid ${t.border}`, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input
                  defaultValue={o.name}
                  key={o.name}
                  onBlur={e => { if (e.target.value.trim() && e.target.value.trim() !== o.name) onRename(o.name, e.target.value) }}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  style={{ ...inputStyle, fontWeight: 800, fontSize: 13.5 }}
                />
                <button
                  onClick={() => onRemove(o.name)}
                  title="Remove from roster"
                  style={{ flexShrink: 0, cursor: 'pointer', border: 'none', background: 'none', color: t.sub, fontSize: 15, opacity: 0.6, padding: 4 }}
                >
                  ✕
                </button>
              </div>
              <label style={{ fontSize: 10.5, fontWeight: 800, color: t.sub, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Keywords (comma-separated)
                <input
                  defaultValue={o.keywords.join(', ')}
                  key={`${o.name}-${o.keywords.join(',')}`}
                  placeholder="e.g. design, figma, mockups"
                  onBlur={e => onUpdateKeywords(o.name, parseKeywords(e.target.value))}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  style={{ ...inputStyle, marginTop: 5, fontWeight: 600, fontSize: 12 }}
                />
              </label>
              <div style={{ fontSize: 11, color: t.sub, marginTop: 5 }}>
                A task naming one of these gets {o.name} auto-assigned as owner (if none is set yet).
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: 14, borderTop: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: t.sub, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
            Add someone
          </div>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Name"
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <input
            value={newKeywords}
            onChange={e => setNewKeywords(e.target.value)}
            placeholder="Keywords (optional, comma-separated)"
            style={{ ...inputStyle, marginBottom: 10 }}
          />
          <button
            onClick={() => {
              if (!newName.trim()) return
              onAdd(newName, parseKeywords(newKeywords))
              setNewName('')
              setNewKeywords('')
            }}
            disabled={!newName.trim()}
            style={{
              width: '100%', cursor: newName.trim() ? 'pointer' : 'default', border: 'none', background: t.accent,
              color: '#fff', padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              opacity: newName.trim() ? 1 : 0.5,
            }}
          >
            + Add to roster
          </button>
        </div>
      </div>
    </>
  )
}
