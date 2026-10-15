import { GridCanvas } from './components/GridCanvas'
import { ControlsPanel } from './components/ControlsPanel'
import { OutcomeChart } from './components/OutcomeChart'
import { PlanCompareTable } from './components/PlanCompareTable'
import { RedTeamPanel } from './components/RedTeamPanel'

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 flex flex-col gap-3">
      <header>
        <h1 className="text-xl font-bold">AEGIS-X</h1>
        <p className="text-xs text-slate-500">Test the decision before reality does. · Flood evacuation demo</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <GridCanvas />
        <ControlsPanel />
        <div className="flex flex-col gap-3">
          <OutcomeChart />
          <PlanCompareTable />
        </div>
        <RedTeamPanel />
      </div>
    </div>
  )
}

export default App
