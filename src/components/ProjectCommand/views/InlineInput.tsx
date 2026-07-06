import { useState } from 'react'
import type { CSSProperties } from 'react'
import type { PCTheme } from '../types'

interface Props {
  value:    string
  onCommit: (v: string) => void
  theme:    PCTheme
  style?:   CSSProperties
}

export default function InlineInput({ value, onCommit, theme: t, style }: Props) {
  const [focused, setFocused] = useState(false)

  return (
    <input
      defaultValue={value}
      key={value}
      onFocus={() => setFocused(true)}
      onBlur={e => {
        setFocused(false)
        if (e.target.value !== value) onCommit(e.target.value)
      }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      style={{
        border: '1px solid transparent', background: 'transparent', color: t.text, borderRadius: 7,
        padding: '6px 8px', fontSize: 13, fontWeight: 600, width: '100%', outline: 'none',
        transition: 'all .12s',
        ...(focused ? { background: t.panel2, borderColor: t.border } : {}),
        ...style,
      }}
    />
  )
}
