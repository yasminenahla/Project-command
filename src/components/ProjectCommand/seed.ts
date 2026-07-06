import type { Task } from './types'

export function seedTasks(): Task[] {
  const t = (
    id: string, name: string, owner: string, status: Task['status'], priority: Task['priority'],
    start: string, end: string, progress: number, deps: string[], tags: string[], notes: string,
  ): Task => ({ id, name, owner, status, priority, start, end, progress, deps, tags, notes })

  return [
    t('T1', 'Kickoff & scoping',        'Alex',   'Done',        'High',   '2026-06-15', '2026-06-19', 100, [],     ['planning'],  'Align on goals, budget and success metrics.'),
    t('T2', 'Requirements gathering',   'Priya',  'In progress', 'High',   '2026-06-22', '2026-07-03',  60, ['T1'], ['discovery'], 'Interview stakeholders, draft the PRD.'),
    t('T3', 'Design phase',             'Sam',    'In progress', 'Medium', '2026-07-06', '2026-07-24',  30, ['T2'], ['design'],    'Wireframes → hi-fi mockups.'),
    t('T4', 'Prototype build',          'Jordan', 'Not started', 'High',   '2026-07-27', '2026-08-14',   0, ['T3'], ['build'],     'Clickable prototype of core flow.'),
    t('T5', 'User testing',             'Priya',  'Not started', 'Medium', '2026-08-17', '2026-08-28',   0, ['T4'], ['research'],  '5 sessions, synthesize findings.'),
    t('T6', 'Revisions',                'Sam',    'Blocked',     'Medium', '2026-08-31', '2026-09-11',   0, ['T5'], ['design'],    'Waiting on testing readout.'),
    t('T7', 'Launch prep',              'Alex',   'Not started', 'High',   '2026-09-14', '2026-09-25',   0, ['T6'], ['gtm'],       'Docs, comms, rollout plan.'),
    t('T8', 'Go live',                  'Alex',   'Not started', 'High',   '2026-09-28', '2026-09-30',   0, ['T7'], ['milestone'], 'Ship it.'),
  ]
}
