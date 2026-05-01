import { useState, useEffect, useCallback } from 'react'
import './App.css'
import PatientSelector from './components/PatientSelector'
import PatientOverview from './components/PatientOverview'
import BloodTrend from './components/BloodTrend'
import BiomarkerPanel from './components/BiomarkerPanel'
import RiskAssessment from './components/RiskAssessment'
import ExplanationPanel from './components/ExplanationPanel'
import WhatIfMode from './components/WhatIfMode'
import AIChatPanel from './components/AIChatPanel'

const TABS = [
  { id: 'overview',     label: 'Overview' },
  { id: 'biomarkers',   label: 'Biomarkers' },
  { id: 'risk',         label: 'Risk Assessment' },
  { id: 'explanation',  label: 'Explanation' },
  { id: 'whatif',       label: 'What-If' },
  { id: 'ai',           label: 'AI Assistant' },
]

function SettingsPopover({ onClose }) {
  const [key, setKey] = useState(() => localStorage.getItem('deepseek_api_key') || '')

  const save = () => {
    localStorage.setItem('deepseek_api_key', key.trim())
    onClose()
  }

  return (
    <div className="settings-popover-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="settings-popover">
        <h2>API Settings</h2>
        <div className="settings-field">
          <label>DeepSeek API Key</label>
          <input
            type="password"
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="sk-..."
            autoFocus
            onKeyDown={e => e.key === 'Enter' && save()}
          />
        </div>
        <p className="settings-note">
          Your key is stored only in your browser's local storage and never sent
          anywhere except the DeepSeek API. Required for the AI Assistant tab.
        </p>
        <div className="settings-actions">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [appData, setAppData] = useState(null)
  const [modelMeta, setModelMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/data/patients_with_predictions.json').then(r => r.json()),
      fetch('/data/model_metadata.json').then(r => r.json()),
    ])
      .then(([data, meta]) => {
        setAppData(data)
        setModelMeta(meta)
        // Default to first demo patient
        if (data.demo_patient_ids?.length > 0) {
          setSelectedPatientId(data.demo_patient_ids[0])
        } else if (data.patients?.length > 0) {
          setSelectedPatientId(data.patients[0].patient_id)
        }
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const selectedPatient = appData?.patients?.find(p => p.patient_id === selectedPatientId) ?? null

  const handleSelectPatient = useCallback(id => {
    setSelectedPatientId(id)
    setActiveTab('overview')
  }, [])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem' }}>
          Loading patient data…
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="loading-screen">
        <span style={{ color: 'var(--status-high)' }}>⚠ Failed to load data: {error}</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Ensure patients_with_predictions.json is in public/data/
        </span>
      </div>
    )
  }

  const patients = appData.patients ?? []
  const demoIds = appData.demo_patient_ids ?? []

  return (
    <div className="app-shell">
      {/* Top Bar */}
      <header className="topbar">
        <div className="topbar-brand">
          <span className="topbar-logo">NeuroBridge</span>
          <span className="topbar-subtitle">HNSCC Clinical Decision Support</span>
        </div>
        <div className="topbar-actions">
          {selectedPatient && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Patient <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                #{selectedPatient.patient_id}
              </span>
            </span>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowSettings(true)}
            title="API Settings"
          >
            ⚙ Settings
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="main-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <PatientSelector
            patients={patients}
            selectedId={selectedPatientId}
            demoIds={demoIds}
            onSelect={handleSelectPatient}
          />
        </aside>

        {/* Content */}
        <main className="main-content">
          {selectedPatient ? (
            <>
              {/* Tab bar */}
              <div className="tab-bar">
                {TABS.map(t => (
                  <button
                    key={t.id}
                    className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={{ animation: 'fadeIn 0.2s ease' }} key={`${selectedPatientId}-${activeTab}`}>
                {activeTab === 'overview' && (
                  <>
                    <PatientOverview patient={selectedPatient} />
                    <BloodTrend patient={selectedPatient} />
                  </>
                )}
                {activeTab === 'biomarkers' && (
                  <BiomarkerPanel
                    patient={selectedPatient}
                    analyteMeta={appData.analyte_metadata}
                  />
                )}
                {activeTab === 'risk' && (
                  <RiskAssessment
                    patient={selectedPatient}
                    modelMeta={modelMeta}
                  />
                )}
                {activeTab === 'explanation' && (
                  <ExplanationPanel
                    patient={selectedPatient}
                    modelMeta={modelMeta}
                  />
                )}
                {activeTab === 'whatif' && (
                  <WhatIfMode
                    patient={selectedPatient}
                    modelMeta={modelMeta}
                  />
                )}
                {activeTab === 'ai' && (
                  <AIChatPanel
                    patient={selectedPatient}
                    modelMeta={modelMeta}
                    analyteMeta={appData.analyte_metadata}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <span className="empty-state-icon">🔬</span>
              <h3>Select a patient to begin</h3>
              <p>Choose a patient from the sidebar or use the demo shortcuts to explore the system.</p>
            </div>
          )}
        </main>
      </div>

      {showSettings && <SettingsPopover onClose={() => setShowSettings(false)} />}
    </div>
  )
}
