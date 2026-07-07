import { useProjectCommand } from './hooks/useProjectCommand'
import { THEMES } from './theme'
import PCHeader from './Header'
import Toolbar from './Toolbar'
import PCToast from './PCToast'
import ActionTracker from './views/ActionTracker'
import Gantt from './views/Gantt'
import Timeline from './views/Timeline'
import { exportTasksXlsx, importTasksXlsx } from './utils/excel'

interface Props {
  onExit?: () => void
}

export default function ProjectCommand({ onExit }: Props = {}) {
  const pc = useProjectCommand()
  const t = THEMES[pc.theme]

  function selectTask(id: string) {
    pc.setTab('tracker')
    pc.setSel(id)
  }

  async function handleImport(file: File) {
    try {
      const tasks = await importTasksXlsx(file)
      pc.importTasks(tasks)
    } catch {
      pc.flash('Could not read that file')
    }
  }

  function handleExport() {
    exportTasksXlsx(pc.tasks)
    pc.flash(`Exported Excel · ${pc.tasks.length} tasks`)
  }

  return (
    <div style={{ minHeight: '100vh', background: t.appBg, color: t.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <PCHeader theme={pc.theme} onTheme={pc.setTheme} onImport={handleImport} onExport={handleExport} onShare={pc.share} onExit={onExit} />
      <Toolbar
        theme={t}
        tab={pc.tab} onTab={pc.setTab}
        q={pc.q} onQ={pc.setQ}
        group={pc.group} onGroup={pc.setGroup}
        scale={pc.scale} onScale={pc.setScale}
        onAdd={pc.addTask}
        onAddMilestone={pc.addMilestone}
      />
      <div style={{ padding: '0 22px 60px' }}>
        {pc.tab === 'tracker' && (
          <ActionTracker
            theme={t}
            tasks={pc.filtered}
            allTasks={pc.tasks}
            milestones={pc.milestones}
            group={pc.group}
            sel={pc.sel}
            depsFor={pc.depsFor}
            taskName={pc.taskName}
            onUpdate={pc.update}
            onDelete={pc.del}
            onMove={pc.move}
            onDragStart={pc.startDragReorder}
            onDrop={pc.dropReorder}
            onCycleStatus={pc.cycleStatus}
            onToggleDone={pc.toggleDone}
            onToggleDep={pc.toggleDep}
            onSetDepsFor={pc.setDepsFor}
            onSetMilestone={pc.setMilestone}
          />
        )}
        {pc.tab === 'gantt' && (
          <Gantt theme={t} tasks={pc.hierarchicalFiltered} scale={pc.scale} onUpdate={pc.update} onSelect={selectTask} />
        )}
        {pc.tab === 'timeline' && (
          <Timeline theme={t} tasks={pc.filtered} onSelect={selectTask} />
        )}
      </div>
      <PCToast message={pc.toast} theme={t} />
    </div>
  )
}
