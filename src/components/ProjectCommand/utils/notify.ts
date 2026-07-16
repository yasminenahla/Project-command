import type { Task } from '../types'

/**
 * Builds a mailto: link pre-filled with the task's details, so a user can
 * notify an owner about their action item without any backend — the OS/
 * browser opens the recipient's own mail client with the message ready to
 * send. `boardUrl` (typically the current page's URL, which already
 * encodes the share id) is included as a link back to the board.
 *
 * `email` may hold several comma-separated addresses — an "owner" entry can
 * represent a group (e.g. a whole team sharing one roster row) — and every
 * address ends up on the To: line together, as one message.
 */
export function buildOwnerMailto(email: string, task: Task, boardUrl?: string): string {
  const recipients = email.split(',').map(e => e.trim()).filter(Boolean).join(',')
  const subject = `Action item: ${task.name}`
  const lines = [
    "You've been assigned the following action item:",
    '',
    `Task: ${task.name}`,
    `Status: ${task.status}`,
    `Priority: ${task.priority}`,
    `Start: ${task.start}`,
    `Due: ${task.end}`,
    task.notes ? `Notes: ${task.notes}` : null,
    boardUrl ? '' : null,
    boardUrl ? `View the board: ${boardUrl}` : null,
  ].filter((l): l is string => l !== null)
  const body = lines.join('\n')
  return `mailto:${recipients}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/** How many people are packed into a roster entry's email field. */
export function recipientCount(email: string | undefined): number {
  if (!email) return 0
  return email.split(',').map(e => e.trim()).filter(Boolean).length
}
