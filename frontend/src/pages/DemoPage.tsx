import { Link } from 'react-router-dom'
import { GridCanvas } from '../features/demo/GridCanvas'
import { ControlsPanel } from '../features/demo/ControlsPanel'
import { OutcomeChart } from '../features/demo/OutcomeChart'
import { PlanCompareTable } from '../features/demo/PlanCompareTable'
import { RedTeamPanel } from '../features/demo/RedTeamPanel'

function DemoPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-bold">AEGIS-X</h1>
          <p className="text-xs text-slate-500">
            Test the decision before reality does. · Flood evacuation demo
          </p>
        </div>
        <nav className="flex gap-3 text-xs">
          <Link to="/" className="text-slate-400 hover:text-white">
            Home
          </Link>
          <Link to="/docs" className="text-slate-400 hover:text-white">
            Documentation
          </Link>
        </nav>
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

export default DemoPage
