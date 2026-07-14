import type { OwnerEntry } from '../types'

/** Bootstraps an initial roster from whatever owner names already appear on tasks. */
export function deriveInitialOwners(taskOwners: string[]): OwnerEntry[] {
  const seen = new Set<string>()
  const out: OwnerEntry[] = []
  for (const name of taskOwners) {
    const trimmed = name.trim()
    if (!trimmed || seen.has(trimmed.toLowerCase())) continue
    seen.add(trimmed.toLowerCase())
    out.push({ name: trimmed, keywords: [] })
  }
  return out
}

/** Drops duplicate roster entries (by trimmed, case-insensitive name), keeping the first occurrence. */
export function dedupeOwners(owners: OwnerEntry[]): OwnerEntry[] {
  const seen = new Set<string>()
  const out: OwnerEntry[] = []
  for (const o of owners) {
    const key = o.name.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(o)
  }
  return out
}

/** First owner whose keyword appears (case-insensitively) in the given text, or null if none match. */
export function suggestOwner(text: string, owners: OwnerEntry[]): string | null {
  const haystack = text.toLowerCase()
  for (const o of owners) {
    for (const kw of o.keywords) {
      const needle = kw.trim().toLowerCase()
      if (needle && haystack.includes(needle)) return o.name
    }
  }
  return null
}
