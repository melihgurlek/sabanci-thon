import { useState, useMemo } from 'react'
import './BiomarkerPanel.css'

const FLAG_CONFIG = {
  high:    { label: 'High',    color: 'var(--status-high)',    bg: 'var(--status-high-bg)',    dot: '▲' },
  low:     { label: 'Low',     color: 'var(--status-low)',     bg: 'var(--status-low-bg)',     dot: '▼' },
  normal:  { label: 'Normal',  color: 'var(--status-normal)',  bg: 'var(--status-normal-bg)',  dot: '●' },
  unknown: { label: 'N/A',     color: 'var(--status-unknown)', bg: 'var(--status-unknown-bg)', dot: '—' },
}

function getFlag(flagVal) {
  return FLAG_CONFIG[flagVal] || FLAG_CONFIG.unknown
}

function formatValue(val, unit) {
  if (val === null || val === undefined) return '—'
  const rounded = val < 0.01 ? val.toExponential(2) : parseFloat(val.toPrecision(4))
  return unit ? `${rounded} ${unit}` : `${rounded}`
}

function ReferenceRange({ meta, sex }) {
  const sexKey = (sex === 'male') ? 'male' : 'female'
  const min = meta?.[`normal_${sexKey}_min`] ?? meta?.normal_male_min
  const max = meta?.[`normal_${sexKey}_max`] ?? meta?.normal_male_max
  if (min == null && max == null) return <span className="ref-range">—</span>
  if (min == null) return <span className="ref-range">≤ {max}</span>
  if (max == null) return <span className="ref-range">≥ {min}</span>
  return <span className="ref-range">{min} – {max}</span>
}

function AnalyteRow({ name, value, flag, meta, sex }) {
  const config = getFlag(flag)
  const isAbnormal = flag === 'high' || flag === 'low'

  // Inline bar showing where value sits within reference range
  let barPct = null
  if (value !== null && meta) {
    const sexKey = sex === 'male' ? 'male' : 'female'
    const min = meta[`normal_${sexKey}_min`] ?? meta.normal_male_min
    const max = meta[`normal_${sexKey}_max`] ?? meta.normal_male_max
    if (min != null && max != null && max > min) {
      const spread = max - min
      const pct = ((value - min) / spread) * 100
      barPct = Math.max(0, Math.min(100, pct))
    }
  }

  return (
    <tr className={`analyte-row ${isAbnormal ? 'abnormal' : ''}`}>
      <td className="analyte-name">
        <div className="analyte-name-main">{name}</div>
        {meta?.LOINC_name && meta.LOINC_name !== name && (
          <div className="analyte-loinc">{meta.group}</div>
        )}
      </td>
      <td className="analyte-value">
        {formatValue(value, meta?.unit)}
      </td>
      <td className="analyte-ref">
        <ReferenceRange meta={meta} sex={sex} />
      </td>
      <td className="analyte-bar-cell">
        {barPct !== null && (
          <div className="analyte-bar-track">
            <div className="analyte-bar-normal-zone" />
            <div
              className="analyte-bar-marker"
              style={{ left: `${barPct}%` }}
              title={`${Math.round(barPct)}% through normal range`}
            />
          </div>
        )}
      </td>
      <td className="analyte-status">
        {value !== null ? (
          <span
            className="flag-badge"
            style={{ color: config.color, background: config.bg }}
          >
            {config.dot} {config.label}
          </span>
        ) : (
          <span className="flag-badge missing">— Missing</span>
        )}
      </td>
    </tr>
  )
}

export default function BiomarkerPanel({ patient, analyteMeta }) {
  const [groupFilter, setGroupFilter] = useState('all')
  const [showAbnormal, setShowAbnormal] = useState(false)

  const groups = useMemo(() => {
    const seen = new Set()
    Object.values(analyteMeta || {}).forEach(m => {
      if (m.group) seen.add(m.group)
    })
    return ['all', ...Array.from(seen).sort()]
  }, [analyteMeta])

  const analytes = useMemo(() => {
    const flags = patient.biomarker_flags || {}
    const values = patient.analyte_values || {}
    const sex = patient.sex || 'male'

    return Object.keys(flags)
      .map(name => ({
        name,
        value: values[name] ?? null,
        flag: flags[name] ?? 'unknown',
        meta: analyteMeta?.[name] || null,
      }))
      .filter(a => {
        if (groupFilter !== 'all' && a.meta?.group !== groupFilter) return false
        if (showAbnormal && (a.flag === 'normal' || a.flag === 'unknown')) return false
        return true
      })
      .sort((a, b) => {
        // Sort: abnormal first
        const rankMap = { high: 0, low: 1, normal: 2, unknown: 3 }
        return (rankMap[a.flag] ?? 3) - (rankMap[b.flag] ?? 3)
      })
  }, [patient, analyteMeta, groupFilter, showAbnormal])

  const abnormalCount = useMemo(() => {
    return Object.values(patient.biomarker_flags || {}).filter(f => f === 'high' || f === 'low').length
  }, [patient])

  const missingCount = useMemo(() => {
    return Object.values(patient.analyte_values || {}).filter(v => v === null).length
  }, [patient])

  return (
    <div className="card biomarker-panel">
      <div className="card-header">
        <span className="card-title">Biomarker Panel</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge badge-teal">{patient.blood_analyte_count || 0} measured</span>
          {abnormalCount > 0 && (
            <span className="badge badge-yes">{abnormalCount} abnormal</span>
          )}
          {missingCount > 0 && (
            <span className="badge badge-incomplete">{missingCount} missing</span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="biomarker-controls">
        <div className="group-filter">
          {groups.map(g => (
            <button
              key={g}
              className={`filter-pill ${groupFilter === g ? 'active' : ''}`}
              onClick={() => setGroupFilter(g)}
            >
              {g}
            </button>
          ))}
        </div>
        <label className="abnormal-toggle">
          <input
            type="checkbox"
            checked={showAbnormal}
            onChange={e => setShowAbnormal(e.target.checked)}
          />
          Abnormal only
        </label>
      </div>

      {/* Table */}
      <div className="biomarker-table-wrap">
        <table className="biomarker-table">
          <thead>
            <tr>
              <th>Analyte</th>
              <th>Value</th>
              <th>Reference Range</th>
              <th>Position</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {analytes.map(a => (
              <AnalyteRow
                key={a.name}
                name={a.name}
                value={a.value}
                flag={a.flag}
                meta={a.meta}
                sex={patient.sex}
              />
            ))}
          </tbody>
        </table>
        {analytes.length === 0 && (
          <div className="empty-state" style={{ padding: '40px' }}>
            <span className="empty-state-icon">🔬</span>
            <h3>No analytes match the current filter</h3>
          </div>
        )}
      </div>
    </div>
  )
}
