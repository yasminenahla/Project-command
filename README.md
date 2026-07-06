# Project Command

A single-page project management tool with three synchronized views over one shared
task list:

1. **Action Tracker** — an editable table of every task and field.
2. **Gantt** — a draggable/resizable bar chart on a switchable Days / Weeks / Months grid.
3. **Timeline** — a chronological view with alternating cards on a center spine.

Themed with the PepsiCo brand palette, with three switchable visual directions
(Minimal / Playful / Bold-dark). Edits autosave to the browser; data imports/exports
as an Excel workbook (`.xlsx` / `.xlsm`).

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL. No sign-in — the app opens directly to the Action Tracker.

## Stack

React + TypeScript + Vite, no UI framework — all view styling is done via per-theme
design tokens (see `src/components/ProjectCommand/theme.ts`) applied through inline
styles, since colors/radii/shadows vary per theme.

## Data model

```ts
type Status   = 'Not started' | 'In progress' | 'Done' | 'Blocked'
type Priority = 'Low' | 'Medium' | 'High'

interface Task {
  id:       string
  name:     string
  owner:    string
  status:   Status
  priority: Priority
  start:    string   // ISO date 'YYYY-MM-DD'
  end:      string   // ISO date 'YYYY-MM-DD' (inclusive)
  progress: number   // 0–100
  deps:     string[] // predecessor task ids
  tags:     string[]
  notes:    string
}
```

State (`tasks`, `theme`, `tab`, `scale`, `group`) persists to `localStorage` under the
key `pc-timeline-v1`, and rehydrates on load (falling back to seed data).

## Excel import/export

Export produces a `.xlsx` with columns: Task, Owner, Status, Priority, Start, Due,
Progress %, Tags, Dependencies, Notes. Import reads the first sheet of a `.xlsx` or
`.xlsm` file, maps those same columns back to the task model, and re-links
dependencies by matching task name.

## Project structure

```
src/
  components/ProjectCommand/
    index.tsx        entry component
    Header.tsx        logo, theme switcher, import/export
    Toolbar.tsx        view tabs, search, group/scale controls, add task
    PCToast.tsx        toast notification
    theme.ts           theme tokens + status/priority colors
    types.ts           Task and related types
    seed.ts            seed data
    hooks/useProjectCommand.ts   state + persistence + task mutations
    utils/dates.ts      date helpers
    utils/excel.ts       import/export
    views/
      ActionTracker.tsx
      Gantt.tsx
      Timeline.tsx
      DepsCell.tsx       dependency picker popover
      InlineInput.tsx    inline-editable table cell
```
