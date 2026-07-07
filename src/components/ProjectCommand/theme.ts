import type { PCTheme, PCThemeName, TaskPriority, TaskStatus } from './types'

export const STATUS_COLOR: Record<TaskStatus, string> = {
  'Not started': '#9AA7B8',
  'In progress': '#0096D6',
  'Done':        '#7BBE28',
  'Blocked':     '#F5A100',
}

export const PRIORITY_COLOR: Record<TaskPriority, string> = {
  Low:    '#2AB6E6',
  Medium: '#F5B301',
  High:   '#E8663B',
}

// Distinct from the brand palette so a late tag never reads as a priority chip
export const LATE_COLOR = '#D64545'

// Owner-avatar hash palette
export const BAR_PALETTE = ['#0096D6', '#7BBE28', '#F5B301', '#2AB6E6', '#14315E', '#E8663B']

export function ownerColor(owner: string): string {
  if (!owner) return '#9AA7B8'
  return BAR_PALETTE[owner.charCodeAt(0) % BAR_PALETTE.length]
}

export const THEMES: Record<PCThemeName, PCTheme> = {
  minimal: {
    label: 'Minimal',
    appBg: '#F4F7FA', panel: '#FFFFFF', panel2: '#FAFBFD', border: '#E6EBF2', line: '#EEF2F7',
    text: '#14315E', sub: '#6B7A90', accent: '#0096D6', radius: 12, barRad: 7, dark: false,
    headBg: '#FFFFFF', headBorder: '#E6EBF2', headText: '#14315E', chip: '#EFF4F9', chipTx: '#3A5375',
    shadow: '0 1px 2px rgba(20,49,94,.05), 0 2px 8px rgba(20,49,94,.05)', weekend: '#F6F8FB',
  },
  playful: {
    label: 'Playful',
    appBg: '#EAF5FC', panel: '#FFFFFF', panel2: '#F4FAFE', border: '#DCEDF8', line: '#E9F3FA',
    text: '#123A5E', sub: '#5B7186', accent: '#0096D6', radius: 18, barRad: 99, dark: false,
    headBg: 'linear-gradient(105deg,#0096D6 0%,#14315E 92%)', headBorder: 'transparent', headText: '#FFFFFF', chip: '#E7F3FB', chipTx: '#0A6CA0',
    shadow: '0 8px 24px rgba(20,49,94,.10), 0 2px 6px rgba(20,49,94,.06)', weekend: '#EFF7FC',
  },
  bold: {
    label: 'Bold',
    appBg: '#0B1F38', panel: '#122B4C', panel2: '#0F2543', border: '#23446F', line: '#1C3A61',
    text: '#EAF2FA', sub: '#8FA6C4', accent: '#2AB6E6', radius: 9, barRad: 4, dark: true,
    headBg: '#081A31', headBorder: '#23446F', headText: '#FFFFFF', chip: '#1B3A63', chipTx: '#BFD6EF',
    shadow: '0 10px 30px rgba(0,0,0,.38)', weekend: '#0E2440',
  },
}
