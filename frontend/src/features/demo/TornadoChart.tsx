import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { SensitivityResult } from '../../api/types'

export function TornadoChart({ data }: { data: SensitivityResult[] }) {
  const chartData = data.map((d) => ({ name: d.variable, importance: d.abs_importance }))

  return (
    <div style={{ width: '100%', height: 140 }}>
      <ResponsiveContainer>
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis type="number" domain={[0, 1]} stroke="#94a3b8" fontSize={11} />
          <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={140} />
          <Tooltip formatter={(v) => Number(v).toFixed(3)} />
          <Bar dataKey="importance" fill="#a855f7" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
