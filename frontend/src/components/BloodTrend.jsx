import { useState, useMemo } from 'react'
import './BloodTrend.css'

const KEY_ANALYTES = ['CRP', 'Hemoglobin', 'Leukocytes', 'Lymphocytes', 'Platelets', 'Albumin']

function Sparkline({ points, min, max, width = 200, height = 40 }) {
  if (!points || points.length === 0) return null
  const range = max - min || 1
  const xs = points.map((_, i) => (i / (points.length - 1 || 1)) * width)
  const ys = points.map(v => height - ((v - min) / range) * (height - 6) - 3)

  const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ')
  const areaD = `${pathD} L ${xs[xs.length - 1].toFixed(1)} ${height} L 0 ${height} Z`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="sparkline-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--teal-deep)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--teal-deep)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#sparkGrad)" />
      <path d={pathD} fill="none" stroke="var(--teal-mid)" strokeWidth="1.5" />
      {/* Last point dot */}
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3" fill="var(--teal-deep)" />
    </svg>
  )
}

export default function BloodTrend({ patient }) {
  const [selectedAnalyte, setSelectedAnalyte] = useState(KEY_ANALYTES[0])

  const trend = patient.blood_trend || []

  const availableAnalytes = useMemo(() => {
    const seen = new Set()
    trend.forEach(t => seen.add(t.analyte))
    return KEY_ANALYTES.filter(a => seen.has(a))
  }, [trend])

  const trendData = useMemo(() => {
    return trend
      .filter(t => t.analyte === selectedAnalyte && t.value !== null)
      .sort((a, b) => a.day - b.day)
  }, [trend, selectedAnalyte])

  if (availableAnalytes.length === 0) {
    return null
  }

  const active = availableAnalytes.includes(selectedAnalyte) ? selectedAnalyte : availableAnalytes[0]
  const displayData = trend
    .filter(t => t.analyte === active && t.value !== null)
    .sort((a, b) => a.day - b.day)

  if (displayData.length === 0) return null

  const values = displayData.map(d => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)

  return (
    <div className="card blood-trend-card">
      <div className="card-header">
        <span className="card-title">Longitudinal Blood Trend</span>
        <span className="badge badge-teal">{displayData.length} time points</span>
      </div>
      <div className="card-body">
        {/* Analyte selector */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {availableAnalytes.map(a => (
            <button
              key={a}
              className={`filter-pill ${(selectedAnalyte === a || (!availableAnalytes.includes(selectedAnalyte) && a === availableAnalytes[0])) ? 'active' : ''}`}
              onClick={() => setSelectedAnalyte(a)}
            >
              {a}
            </button>
          ))}
        </div>

        {/* Chart area */}
        <div className="trend-chart-area">
          <div className="trend-y-labels">
            <span>{max.toFixed(1)}</span>
            <span>{((min + max) / 2).toFixed(1)}</span>
            <span>{min.toFixed(1)}</span>
          </div>
          <div className="trend-chart-body">
            <Sparkline points={values} min={min} max={max} width={400} height={80} />
            <div className="trend-x-labels">
              {displayData.map((d, i) => (
                i === 0 || i === displayData.length - 1 || displayData.length <= 6 ? (
                  <span key={i} style={{ left: `${(i / (displayData.length - 1 || 1)) * 100}%` }}>
                    day {d.day}
                  </span>
                ) : null
              ))}
            </div>
          </div>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
          Values measured {displayData[0].day < 0 ? `${Math.abs(displayData[0].day)}–${Math.abs(displayData[displayData.length - 1].day)} days before` : 'at'} first treatment
        </p>
      </div>
    </div>
  )
}
