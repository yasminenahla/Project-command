export type TaskStatus   = 'Not started' | 'In progress' | 'Done' | 'Blocked'
export type TaskPriority = 'Low' | 'Medium' | 'High'

export interface Task {
  id:       string
  name:     string
  owner:    string
  status:   TaskStatus
  priority: TaskPriority
  start:    string      // ISO date 'YYYY-MM-DD'
  end:      string      // ISO date 'YYYY-MM-DD' (inclusive)
  progress: number       // 0–100
  deps:     string[]     // predecessor task ids
  tags:     string[]
  notes:    string
  isMilestone?: boolean  // marks this task as a key milestone (a group header for other tasks)
  milestoneId?: string | null  // id of the milestone task this task falls under, if any
}

export type PCThemeName = 'minimal' | 'playful' | 'bold'
export type PCTab        = 'timeline' | 'tracker' | 'gantt'
export type PCScale       = 'days' | 'weeks' | 'months'
export type PCGroup       = 'None' | 'Status' | 'Owner' | 'Priority' | 'Milestone'

export interface PCTheme {
  label:      string
  appBg:      string
  panel:      string
  panel2:     string
  border:     string
  line:       string
  text:       string
  sub:        string
  accent:     string
  radius:     number
  barRad:     number
  dark:       boolean
  headBg:     string
  headBorder: string
  headText:   string
  chip:       string
  chipTx:     string
  shadow:     string
  weekend:    string
}

export const STATUSES: TaskStatus[]   = ['Not started', 'In progress', 'Done', 'Blocked']
export const PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High']
