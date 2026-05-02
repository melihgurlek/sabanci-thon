import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import PatientSelector from './components/PatientSelector'
import PatientOverview from './components/PatientOverview'
import BloodTrend from './components/BloodTrend'
import BiomarkerPanel from './components/BiomarkerPanel'
import RiskAssessment from './components/RiskAssessment'
import ExplanationPanel from './components/ExplanationPanel'
import WhatIfMode from './components/WhatIfMode'
import AIChatPanel from './components/AIChatPanel'
import TwinsPanel from './components/TwinsPanel'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'biomarkers', label: 'Biomarkers' },
  { id: 'risk', label: 'Risk Assessment' },
  { id: 'explanation', label: 'Explanation' },
  { id: 'whatif', label: 'What-If' },
  { id: 'ai', label: 'AI Assistant' },
  { id: 'twins', label: 'Twins' },
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
  const API_BASE = "http://localhost:8000"
  const [appData, setAppData] = useState(null)
  const [modelMeta, setModelMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [showSettings, setShowSettings] = useState(false)

  // ============ twins ============
  const [data, setData] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [twinDataLoading, setTwinDataLoading] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [graphClickBanner, setGraphClickBanner] = useState(null); // { id, label }

  const [patients2, setPatients2] = useState([]);

  // Track pending requests to prevent race conditions
  const abortControllerRef = useRef(null);
  const selectPatientTimeoutRef = useRef(null);
  const pendingPatientIdRef = useRef(null);
  const isInitialLoadRef = useRef(true);

  const handleSelectPatient = useCallback((id, skipDebounce = false) => {
    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear any pending timeout
    if (selectPatientTimeoutRef.current) {
      clearTimeout(selectPatientTimeoutRef.current);
    }

    const executeRequest = () => {
      const trim_id = id.replace(/^0+/, '') || '0';
      const formattedId = '0'.repeat(3 - trim_id.length) + trim_id;

      // Only update if this is still the most recent selection
      if (pendingPatientIdRef.current !== formattedId) {
        pendingPatientIdRef.current = formattedId;
        setSelectedPatientId(formattedId);
        // Only reset tab on subsequent selections, not on initial load
        if (!isInitialLoadRef.current) {
          setActiveTab('overview');
        }
        setGraphClickBanner(null);
        setTwinDataLoading(true);

        // Create new AbortController for this request
        const controller = new AbortController();
        abortControllerRef.current = controller;

        fetch(`${API_BASE}/api/predict/${trim_id}`, { signal: controller.signal })
          .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
          .then(d => {
            // Only update state if this request wasn't aborted
            if (!controller.signal.aborted) {
              setData(d);
              if (d.graph) {
                // Normalise edge weights for rendering
                const weights = (d.graph.links || []).map(l => l.value);
                const maxW = Math.max(...weights, 0.0001);
                const links = (d.graph.links || []).map(l => ({ ...l, normValue: l.value / maxW }));
                setGraphData({ nodes: d.graph.nodes || [], links });
              }
              setLoading(false);
              setTwinDataLoading(false);
            }
          })
          .catch(err => {
            // Ignore abort errors
            if (err.name !== 'AbortError') {
              setLoading(false);
              setTwinDataLoading(false);
            }
          });
      }
    };

    // Skip debounce for initial load or when explicitly requested
    if (skipDebounce || isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      executeRequest();
    } else {
      // Debounce rapid clicks to prevent multiple requests
      selectPatientTimeoutRef.current = setTimeout(executeRequest, 100);
    }
  }, [API_BASE]);

  const nodeColor = useCallback((node) => {
    if (node.id === selectedPatientId || node.type === 'target') return '#ff4b4b';
    return node.survival === 'living' ? '#00d4ff' : '#94a3b8';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatientId]);

  const handleNodeClick = useCallback((node) => {
    // Ignore the current target node
    if (node.type === 'target') return;

    // Show a brief banner, then fire a full patient selection
    setGraphClickBanner({ id: node.id, label: node.label });
    setTimeout(() => setGraphClickBanner(null), 2500);

    // Trigger patient selection
    handleSelectPatient(node.id);
  }, [handleSelectPatient]);

  // ============ END twins ============

  // Init app data
  useEffect(() => {
    fetch(`${API_BASE}/api/patientInfo`)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(j => {
        const data = j.output;
        const meta = j.model_metadata;
        setAppData(data)
        setModelMeta(meta)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [API_BASE]);

  // Load initial patient "001" on mount only once
  useEffect(() => {
    isInitialLoadRef.current = true;
    pendingPatientIdRef.current = '001';
    setSelectedPatientId('001');
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    setTwinDataLoading(true);
    fetch('http://localhost:8000/api/predict/1', { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => {
        if (!controller.signal.aborted) {
          setData(d);
          if (d.graph) {
            const weights = (d.graph.links || []).map(l => l.value);
            const maxW = Math.max(...weights, 0.0001);
            const links = (d.graph.links || []).map(l => ({ ...l, normValue: l.value / maxW }));
            setGraphData({ nodes: d.graph.nodes || [], links });
          }
          setTwinDataLoading(false);
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setTwinDataLoading(false);
        }
      });
  }, []); // Runs only once on mount

  // Load twin patients list
  useEffect(() => {
    fetch(`${API_BASE}/api/patients`)
      .then(r => r.json())
      .then(d => {
        setPatients2(d.patients || []);
      })
      .catch(() => { });
  }, [API_BASE]);

  const selectedPatient = appData?.patients?.find(p => p.patient_id === selectedPatientId) ?? null

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (selectPatientTimeoutRef.current) {
        clearTimeout(selectPatientTimeoutRef.current);
      }
    };
  }, []);

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
                {activeTab == 'twins' && (
                  <TwinsPanel
                    selectedPatient={selectedPatient}
                    data={data}
                    setData={setData}
                    graphData={graphData}
                    setGraphData={setGraphData}
                    hoveredNode={hoveredNode}
                    setHoveredNode={setHoveredNode}
                    graphClickBanner={graphClickBanner}
                    setGraphClickBanner={setGraphClickBanner}
                    patients={patients2}
                    setPatients={setPatients2}
                    handleNodeClick={handleNodeClick}
                    nodeColor={nodeColor}
                    twinDataLoading={twinDataLoading}
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
