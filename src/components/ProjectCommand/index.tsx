import { useProjectCommand } from './hooks/useProjectCommand'
import { THEMES } from './theme'
import PCHeader from './Header'
import Toolbar from './Toolbar'
import PCToast from './PCToast'
import HistoryPanel from './HistoryPanel'
import OwnerManager from './OwnerManager'
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
    if (pc.role === 'viewer') { pc.flash('This is a view-only board — importing is disabled'); return }
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

  const readOnly = pc.role === 'viewer'

  return (
    <div style={{ minHeight: '100vh', background: t.appBg, color: t.text, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <PCHeader theme={pc.theme} onTheme={pc.setTheme} onImport={handleImport} onExport={handleExport} onShare={pc.share} onHistory={pc.openHistory} role={pc.role} onExit={onExit} />
      <Toolbar
        theme={t}
        tab={pc.tab} onTab={pc.setTab}
        q={pc.q} onQ={pc.setQ}
        group={pc.group} onGroup={pc.setGroup}
        scale={pc.scale} onScale={pc.setScale}
        onAdd={pc.addTask}
        onAddMilestone={pc.addMilestone}
        onRefresh={pc.refresh}
        refreshing={pc.refreshing}
        readOnly={readOnly}
        dirty={pc.dirty}
        conflict={pc.conflict}
      />
      {pc.conflict && (
        <div style={{ margin: '10px 22px 0', padding: '10px 16px', background: 'rgba(245,179,1,.14)', border: '1px solid #F5B301', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>⚠ Another editor made changes to this board.</span>
          <span style={{ fontSize: 12.5, color: t.sub }}>Your local edits are paused until you refresh — refreshing merges them with the latest version, so nothing gets lost.</span>
          <button
            onClick={() => pc.refresh()}
            style={{ marginLeft: 'auto', cursor: 'pointer', border: 'none', background: '#F5B301', color: '#20160a', padding: '6px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700 }}
          >
            Refresh &amp; merge
          </button>
        </div>
      )}
      <div style={{ padding: '0 22px 60px' }}>
        {pc.tab === 'tracker' && (
          <ActionTracker
            theme={t}
            tasks={pc.filtered}
            allTasks={pc.tasks}
            milestones={pc.milestones}
            actionNumbers={pc.actionNumbers}
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
            onAddSubtask={pc.addSubtask}
            onRenumber={pc.renumberTask}
            owners={pc.owners}
            onManageOwners={pc.openOwnerManager}
            rosterDirty={pc.rosterDirty}
            readOnly={readOnly}
          />
        )}
        {pc.tab === 'gantt' && (
          <Gantt theme={t} tasks={pc.hierarchicalFiltered} scale={pc.scale} onUpdate={pc.update} onSelect={selectTask} readOnly={readOnly} />
        )}
        {pc.tab === 'timeline' && (
          <Timeline theme={t} tasks={pc.filtered} onSelect={selectTask} />
        )}
      </div>
      <PCToast message={pc.toast} theme={t} />
      <HistoryPanel
        theme={t}
        open={pc.historyOpen}
        loading={pc.loadingVersions}
        versions={pc.versions}
        readOnly={readOnly}
        snapshotIntervalMs={pc.snapshotIntervalMs}
        onRestore={pc.restoreVersion}
        onDelete={pc.deleteVersionEntry}
        onClearAll={pc.clearAllHistory}
        onSetSnapshotInterval={pc.setSnapshotInterval}
        onClose={pc.closeHistory}
      />
      <OwnerManager
        theme={t}
        open={pc.ownerManagerOpen}
        owners={pc.owners}
        dirty={pc.rosterDirty}
        onAdd={pc.addOwner}
        onUpdateKeywords={pc.updateOwnerKeywords}
        onUpdateEmail={pc.updateOwnerEmail}
        onRename={pc.renameOwner}
        onRemove={pc.removeOwner}
        onMove={pc.moveOwner}
        onSave={pc.saveRoster}
        onClose={pc.closeOwnerManager}
      />
    </div>
  )
}
