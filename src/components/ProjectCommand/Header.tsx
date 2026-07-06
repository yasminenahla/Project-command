import { useRef } from 'react'
import type { PCTheme, PCThemeName } from './types'
import { THEMES } from './theme'

interface Props {
  theme:    PCThemeName
  onTheme:  (v: PCThemeName) => void
  onImport: (file: File) => void
  onExport: () => void
  onExit?:  () => void
}

const THEME_ORDER: PCThemeName[] = ['minimal', 'playful', 'bold']

export default function PCHeader({ theme, onTheme, onImport, onExport, onExit }: Props) {
  const t: PCTheme = THEMES[theme]
  const fileRef = useRef<HTMLInputElement>(null)
  const headerIsLight = t.headText === '#FFFFFF'
  const logoChipStyle = {
    background: headerIsLight ? 'rgba(255,255,255,.94)' : '#fff', borderRadius: 12,
    padding: '7px 12px', boxShadow: '0 2px 8px rgba(20,49,94,.12)', display: 'flex',
    alignItems: 'center', border: 'none',
  } as const
  const logoImg = <img src={`${import.meta.env.BASE_URL}pepsico-logo.png`} alt="PepsiCo" style={{ height: 26, display: 'block' }} draggable={false} />

  return (
    <div
      style={{
        background: t.headBg, borderBottom: `1px solid ${t.headBorder}`,
        padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginRight: 'auto' }}>
        {onExit ? (
          <button onClick={onExit} title="Back to home" style={{ ...logoChipStyle, cursor: 'pointer' }}>
            {logoImg}
          </button>
        ) : (
          <div style={logoChipStyle}>{logoImg}</div>
        )}
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3, color: t.headText, lineHeight: 1.1 }}>
            Project Command
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: t.headText, opacity: 0.72, letterSpacing: 0.3 }}>
            Timeline · Tracker · Gantt
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, background: headerIsLight ? 'rgba(255,255,255,.14)' : '#EFF4F9', padding: 4, borderRadius: 11 }}>
        {THEME_ORDER.map(v => {
          const active = theme === v
          return (
            <button
              key={v}
              onClick={() => onTheme(v)}
              style={{
                border: 'none', cursor: 'pointer', padding: '6px 13px', borderRadius: 8,
                fontSize: 12.5, fontWeight: 700, letterSpacing: 0.2,
                background: active ? (t.dark ? '#2AB6E6' : '#fff') : 'transparent',
                color: active ? (t.dark ? '#08243f' : '#14315E') : t.headText,
                opacity: active ? 1 : 0.72,
                boxShadow: active ? '0 2px 6px rgba(0,0,0,.15)' : 'none',
                transition: 'all .15s',
              }}
            >
              {THEMES[v].label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            cursor: 'pointer', border: `1px solid ${headerIsLight ? 'rgba(255,255,255,.35)' : t.border}`,
            background: headerIsLight ? 'rgba(255,255,255,.10)' : '#fff',
            color: headerIsLight ? t.headText : '#14315E',
            padding: '8px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 7,
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>⤒</span>Import
        </button>
        <button
          onClick={onExport}
          style={{
            cursor: 'pointer', border: `1px solid ${headerIsLight ? 'rgba(255,255,255,.35)' : t.border}`,
            background: headerIsLight ? '#fff' : '#14315E',
            color: headerIsLight ? '#14315E' : '#fff',
            padding: '8px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 7,
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>⤓</span>Export
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xlsm,.xls,.csv"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onImport(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
