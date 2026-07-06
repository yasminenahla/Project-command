import type { PCTheme } from './types'

interface Props {
  message: string
  theme:   PCTheme
}

export default function PCToast({ message, theme: t }: Props) {
  if (!message) return null
  return (
    <div style={{
      position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)',
      background: t.dark ? '#EAF2FA' : '#14315E', color: t.dark ? '#0B1F38' : '#fff',
      padding: '10px 18px', borderRadius: 99, fontSize: 13, fontWeight: 600,
      boxShadow: '0 8px 24px rgba(20,49,94,.28)', zIndex: 90,
    }}>
      {message}
    </div>
  )
}
