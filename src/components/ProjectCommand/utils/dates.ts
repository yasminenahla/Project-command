/** Parse ISO date string to local midnight Date */
function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function isoDate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function addDaysToDate(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(d.getDate() + n); return r
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const WEEKDAY_INITIALS = ['Su','Mo','Tu','We','Th','Fr','Sa']

export function addDays(iso: string, n: number): string {
  return isoDate(addDaysToDate(parseDate(iso), n))
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000)
}

export function fmtShort(iso: string): string {
  const d = parseDate(iso)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate()
}

export function firstOfMonth(iso: string): string {
  const d = parseDate(iso)
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1))
}

export function mondayOf(iso: string): string {
  const d = parseDate(iso)
  const off = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - off)
  return isoDate(d)
}

export function excelToISO(v: unknown): string {
  if (v == null || v === '') return isoDate(new Date())
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86_400_000))
    return isoDate(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  }
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  return isNaN(d.getTime()) ? isoDate(new Date()) : isoDate(d)
}

export function uid(): string {
  return 'T' + Math.random().toString(36).slice(2, 8)
}

/** A task is late once its due date has passed and it isn't marked Done. */
export function isTaskLate(end: string, status: string): boolean {
  return status !== 'Done' && end < isoDate(new Date())
}

export { MONTHS, WEEKDAY_INITIALS, isoDate, parseDate }
