import { useState, useMemo } from 'react'
import './PatientSelector.css'

function riskLabel(prob, thresholds) {
  if (!thresholds) return null
  if (prob >= thresholds.high_threshold) return 'high'
  if (prob >= thresholds.low_threshold) return 'moderate'
  return 'low'
}

function PatientRow({ patient, isSelected, onSelect }) {
  const survivalColor = patient.survival_status === 'living'
    ? 'var(--status-normal)'
    : 'var(--status-high)'

  return (
    <button
      className={`patient-row ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(patient.patient_id)}
    >
      <div className="patient-row-id">
        <span className="patient-id-num">#{patient.patient_id}</span>
        <span
          className="patient-status-dot"
          style={{ background: survivalColor }}
          title={patient.survival_status}
        />
      </div>
      <div className="patient-row-meta">
        <span className="patient-row-site">{patient.primary_tumor_site || '—'}</span>
        <span className="patient-row-stage">{patient.pT_stage || '—'}</span>
      </div>
      {typeof patient.survival_prob === 'number' && (
        <div className="patient-row-bar-wrap">
          <div
            className="patient-row-bar"
            style={{ width: `${Math.round(patient.survival_prob * 100)}%` }}
          />
        </div>
      )}
    </button>
  )
}

export default function PatientSelector({ patients, selectedId, demoIds, onSelect, onAdd }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all') // all | living | deceased | recurrence

  const filtered = useMemo(() => {
    let list = patients
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(p =>
        p.patient_id.toLowerCase().includes(q) ||
        (p.primary_tumor_site || '').toLowerCase().includes(q) ||
        (p.pT_stage || '').toLowerCase().includes(q)
      )
    }
    if (filter === 'living') list = list.filter(p => p.survival_status === 'living')
    if (filter === 'deceased') list = list.filter(p => p.survival_status === 'deceased')
    if (filter === 'recurrence') list = list.filter(p => p.recurrence === 'yes')
    return list
  }, [patients, query, filter])

  const demoPatients = useMemo(() => {
    return patients.filter(p => demoIds.includes(p.patient_id))
  }, [patients, demoIds])

  return (
    <div className="patient-selector">
      {/* Add Patient Button */}
      <div className="add-patient-container">
        <button className="add-patient-btn" onClick={onAdd}>
          <span className="add-patient-icon">+</span>
          <span>Add Patient Profile</span>
        </button>
      </div>

      {/* Demo shortcuts - Only show if any patients match demo IDs */}
      {demoPatients.length > 0 && (
        <div className="demo-shortcuts">
          <span className="demo-label">Demo patients</span>
          <div className="demo-btns">
            {demoPatients.map((p, i) => {
              const labels = ['Low Risk', 'High Risk', 'Missing Data']
              return (
                <button
                  key={p.patient_id}
                  className={`demo-btn ${selectedId === p.patient_id ? 'active' : ''}`}
                  onClick={() => onSelect(p.patient_id)}
                >
                  <span className="demo-btn-num">{labels[i] || `Demo ${i + 1}`}</span>
                  <span className="demo-btn-id">#{p.patient_id}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Search - Only show if there are patients to search */}
      {patients.length > 0 && (
        <>
          <div className="selector-search">
            <span className="search-icon">⌕</span>
            <input
              type="text"
              placeholder="Search ID, site, stage…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="search-input"
            />
            {query && (
              <button className="search-clear" onClick={() => setQuery('')}>×</button>
            )}
          </div>

          <div className="filter-pills">
            {['all', 'living', 'deceased', 'recurrence'].map(f => (
              <button
                key={f}
                className={`filter-pill ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? `All (${patients.length})` : f}
              </button>
            ))}
          </div>
        </>
      )}

      {/* List */}
      <div className="patient-list">
        {patients.length === 0 ? (
          <div className="selector-empty">
            No profiles yet.<br/>
            Click "+" to add a patient.
          </div>
        ) : filtered.length === 0 ? (
          <div className="selector-empty">No patients match your search.</div>
        ) : (
          filtered.map(p => (
            <PatientRow
              key={p.patient_id}
              patient={p}
              isSelected={p.patient_id === selectedId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>

      <div className="selector-footer">
        {patients.length} patient profile{patients.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
