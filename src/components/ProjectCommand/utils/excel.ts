import * as XLSX from 'xlsx'
import type { Task } from '../types'
import { STATUSES, PRIORITIES } from '../types'
import { excelToISO, uid } from './dates'

export function exportTasksXlsx(tasks: Task[]) {
  const nameById = new Map(tasks.map(t => [t.id, t.name]))

  const rows = tasks.map(t => ({
    Task:          t.name,
    Owner:         t.owner,
    Status:        t.status,
    Priority:      t.priority,
    Start:         t.start,
    Due:           t.end,
    'Progress %':  t.progress,
    Tags:          (t.tags || []).join(', '),
    Dependencies:  (t.deps || []).map(d => nameById.get(d) ?? '').filter(Boolean).join(', '),
    Notes:         t.notes,
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 30 }, { wch: 14 }, { wch: 15 }, { wch: 11 },
    { wch: 13 }, { wch: 13 }, { wch: 11 }, { wch: 18 },
    { wch: 26 }, { wch: 46 },
  ]
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  ws['!autofilter'] = { ref: `A1:J${rows.length + 1}` }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Timeline')
  XLSX.writeFile(wb, 'project-timeline.xlsx')
}

export function importTasksXlsx(file: File): Promise<Task[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target!.result as ArrayBuffer), { type: 'array' })
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]])

        type BaseTask = Task & { _depNames: string[] }
        const base: BaseTask[] = json.map(row => ({
          id:       uid(),
          name:     String(row.Task ?? row.Name ?? 'Untitled'),
          owner:    String(row.Owner ?? ''),
          status:   STATUSES.includes(row.Status as Task['status']) ? (row.Status as Task['status']) : 'Not started',
          priority: PRIORITIES.includes(row.Priority as Task['priority']) ? (row.Priority as Task['priority']) : 'Medium',
          start:    excelToISO(row.Start),
          end:      excelToISO(row.Due ?? row.End ?? row.Start),
          progress: Math.max(0, Math.min(100, Math.round(Number(row['Progress %'] ?? row.Progress ?? 0)))),
          deps:     [],
          tags:     String(row.Tags ?? '').split(',').map(s => s.trim()).filter(Boolean),
          notes:    String(row.Notes ?? ''),
          _depNames: String(row.Dependencies ?? '').split(',').map(s => s.trim()).filter(Boolean),
        }))

        const tasks: Task[] = base.map(({ _depNames, ...t }) => ({
          ...t,
          deps: _depNames.map(nm => base.find(x => x.name === nm)?.id).filter((x): x is string => !!x),
        }))

        resolve(tasks)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}
