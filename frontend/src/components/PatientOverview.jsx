import { useState, useRef, useCallback, useEffect } from 'react'
import './PatientOverview.css'

const GENETIC_OPTIONS = ['APOE ε4 Negative', 'APOE ε4 Heterozygous', 'APOE ε4 Homozygous', 'BRCA1 Mutation', 'BRCA2 Mutation', 'TP53 Mutation']
const CANCER_OPTIONS  = ['None', 'Breast Cancer', 'Lung Cancer', 'Prostate Cancer', 'Colorectal Cancer', 'Skin Cancer', 'Leukemia']

const ANALYZE_STEPS = [
  'Initializing models…',
  'Running inference…',
  'Computing Grad-CAM…',
  'Generating clinical note…',
]

function getApiUrl() {
  return localStorage.getItem('neurobridge_api_url') || 'http://localhost:8000'
}

function formatPct(v) { return (v * 100).toFixed(1) + '%' }

function confidenceBadge(uncertainty) {
  if (uncertainty < 0.10) return { label: 'High Confidence', cls: 'mri-conf-high' }
  if (uncertainty < 0.20) return { label: 'Moderate',        cls: 'mri-conf-moderate' }
  return                          { label: 'Low Confidence',  cls: 'mri-conf-low' }
}

function InfoField({ label, children }) {
  return (
    <div className="info-field">
      <label className="info-field-label">{label}</label>
      <div className="info-field-control">{children}</div>
    </div>
  )
}

function ClassificationCard({ title, result, accentVar }) {
  if (!result) return null
  const { label, cls } = confidenceBadge(result.uncertainty)
  return (
    <div className="card mri-cls-card">
      <div className="card-header">
        <span className="card-title" style={{ fontSize: '0.88rem' }}>{title}</span>
        <span className={`badge ${cls}`}>{label}</span>
      </div>
      <div className="card-body">
        <p className="mri-finding" style={{ color: `var(${accentVar})` }}>{result.finding}</p>
        <div className="mri-stats">
          <span>Confidence <strong>{formatPct(result.confidence)}</strong></span>
          <span className="mri-stats-sep">·</span>
          <span>Uncertainty <strong>{formatPct(result.uncertainty)}</strong></span>
        </div>
        <div className="mri-probs">
          {Object.entries(result.probabilities).map(([lbl, prob]) => (
            <div key={lbl} className="mri-prob-row">
              <span className="mri-prob-label">{lbl}</span>
              <div className="mri-prob-track">
                <div
                  className="mri-prob-fill"
                  style={{
                    width: `${(prob * 100).toFixed(1)}%`,
                    background: prob > 0.5 ? `var(${accentVar})` : 'var(--border-strong)',
                  }}
                />
              </div>
              <span className="mri-prob-pct">{formatPct(prob)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ChatBubble({ role, content }) {
  const isUser = role === 'user'
  return (
    <div className={`mri-bubble-wrap ${isUser ? 'mri-bubble-right' : 'mri-bubble-left'}`}>
      <div className={`mri-bubble ${isUser ? 'mri-bubble--user' : 'mri-bubble--ai'}`}>
        {content}
      </div>
    </div>
  )
}

export default function PatientOverview({ patient, onUpdate }) {
  const fileInputRef = useRef(null)
  const chatEndRef   = useRef(null)

  const [dragging, setDragging]   = useState(false)
  const [scanning, setScanning]   = useState(false)
  const [loadStep, setLoadStep]   = useState('')
  const [error, setError]         = useState(null)
  const [showHeat, setShowHeat]   = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatLog, setChatLog]     = useState([])
  const [chatBusy, setChatBusy]   = useState(false)

  // Reset ephemeral state when patient switches
  useEffect(() => {
    setChatLog([])
    setShowHeat(false)
    setError(null)
  }, [patient.patient_id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatLog, chatBusy])

  const handleChange = (field, value) => {
    onUpdate({ ...patient, [field]: value })
  }

  // Convert file to base64 data URL so it persists in localStorage
  const handleFile = useCallback((file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      onUpdate({ ...patient, image_url: e.target.result, mri_results: null })
    }
    reader.readAsDataURL(file)
    setError(null)
    setShowHeat(false)
    setChatLog([])
  }, [patient, onUpdate])

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    onUpdate({ ...patient, image_url: null, mri_results: null })
    setShowHeat(false)
    setError(null)
    setChatLog([])
  }

  const analyze = async () => {
    const imageUrl = patient.image_url
    if (!imageUrl || scanning) return
    setScanning(true)
    setError(null)
    setShowHeat(false)

    let stepIdx = 0
    setLoadStep(ANALYZE_STEPS[0])
    const stepTimer = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, ANALYZE_STEPS.length - 1)
      setLoadStep(ANALYZE_STEPS[stepIdx])
    }, 1800)

    try {
      // Re-hydrate base64 data URL → Blob for FormData
      const fetchRes = await fetch(imageUrl)
      const blob = await fetchRes.blob()
      const fd = new FormData()
      fd.append('file', blob, 'scan.jpg')

      const res = await fetch(`${getApiUrl()}/analyze`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || data.detail || `Server error ${res.status}`)
        return
      }
      onUpdate({ ...patient, mri_results: data })
    } catch (err) {
      setError(`Network error: ${err.message}`)
    } finally {
      clearInterval(stepTimer)
      setScanning(false)
      setLoadStep('')
    }
  }

  const sendChat = async () => {
    const msg = chatInput.trim()
    const results = patient.mri_results
    if (!msg || !results || chatBusy) return
    setChatInput('')
    setChatLog(l => [...l, { role: 'user', content: msg }])
    setChatBusy(true)
    try {
      const res = await fetch(`${getApiUrl()}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: chatLog, results }),
      })
      const data = await res.json()
      setChatLog(l => [...l, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setChatLog(l => [...l, { role: 'assistant', content: `Error: ${err.message}` }])
    } finally {
      setChatBusy(false)
    }
  }

  const toggleCancer = (cancer) => {
    const current = patient.cancer_history || []
    handleChange('cancer_history', current.includes(cancer)
      ? current.filter(c => c !== cancer)
      : [...current, cancer]
    )
  }

  const imageUrl   = patient.image_url   || null
  const mriResults = patient.mri_results || null
  const hasResults = mriResults && !mriResults.error

  return (
    <div className="patient-overview-wrapper">

      {/* Demographics */}
      <section className="demographics-section card">
        <div className="card-header">
          <span className="card-title">Patient Information</span>
        </div>
        <div className="card-body demographics-grid">
          <InfoField label="Patient Name">
            <input
              type="text"
              value={patient.name || ''}
              onChange={e => handleChange('name', e.target.value)}
              placeholder="Full Name"
              className="demo-input"
            />
          </InfoField>

          <InfoField label="Date of Birth">
            <input
              type="date"
              value={patient.dob || ''}
              onChange={e => handleChange('dob', e.target.value)}
              className="demo-input"
            />
          </InfoField>

          <InfoField label="Sex">
            <select
              value={patient.sex || ''}
              onChange={e => handleChange('sex', e.target.value)}
              className="demo-input"
            >
              <option value="">Select Sex</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </InfoField>

          <InfoField label="Handedness">
            <select
              value={patient.handedness || ''}
              onChange={e => handleChange('handedness', e.target.value)}
              className="demo-input"
            >
              <option value="">Select Handedness</option>
              <option value="right">Right</option>
              <option value="left">Left</option>
              <option value="ambidextrous">Ambidextrous</option>
            </select>
          </InfoField>

          <InfoField label="Education (Years)">
            <input
              type="number"
              value={patient.education || ''}
              onChange={e => handleChange('education', e.target.value)}
              placeholder="e.g. 12"
              className="demo-input"
            />
          </InfoField>

          <InfoField label="Genetic Biomarkers">
            <select
              value={patient.genetic_biomarkers || ''}
              onChange={e => handleChange('genetic_biomarkers', e.target.value)}
              className="demo-input"
            >
              <option value="">Select Biomarker</option>
              {GENETIC_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </InfoField>

          <InfoField label="Cardiovascular History">
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  checked={patient.cv_history === 'yes'}
                  onChange={() => handleChange('cv_history', 'yes')}
                /> Yes
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  checked={patient.cv_history === 'no'}
                  onChange={() => handleChange('cv_history', 'no')}
                /> No
              </label>
            </div>
          </InfoField>

          <InfoField label="Previous Cancers">
            <div className="multi-select-chips">
              {CANCER_OPTIONS.map(cancer => (
                <button
                  key={cancer}
                  className={`chip-btn ${patient.cancer_history?.includes(cancer) ? 'active' : ''}`}
                  onClick={() => toggleCancer(cancer)}
                >
                  {cancer}
                </button>
              ))}
            </div>
          </InfoField>
        </div>
      </section>

      {/* MRI Analysis */}
      <section className="card">
        <div className="card-header">
          <span className="card-title">Brain MRI Analysis</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {imageUrl && hasResults && (
              <button
                className={`btn btn-sm ${showHeat ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setShowHeat(h => !h)}
              >
                {showHeat ? 'Grad-CAM On' : 'Grad-CAM Off'}
              </button>
            )}
            {imageUrl && !scanning && (
              <button className="btn btn-primary btn-sm" onClick={analyze}>
                {hasResults ? 'Re-analyse' : 'Analyse'}
              </button>
            )}
            {imageUrl && (
              <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()}>
                Change
              </button>
            )}
            {imageUrl && (
              <button className="btn btn-danger btn-sm" onClick={handleDelete}>
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mri-disclaimer">
          <span>⚠</span>
          For research purposes only — not a clinical diagnosis. Requires NeuroBridge backend (configure URL in ⚙ Settings).
        </div>

        {/* Error */}
        {error && <div className="mri-error"><strong>Analysis failed —</strong> {error}</div>}

        {/* Scan grid */}
        <div className="mri-scan-grid">

          {/* Viewer */}
          <div
            className={`mri-viewer ${dragging ? 'mri-viewer--drag' : ''} ${!imageUrl ? 'mri-viewer--empty' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={!imageUrl ? () => fileInputRef.current?.click() : undefined}
          >
            {imageUrl ? (
              <>
                <img
                  src={imageUrl}
                  alt="MRI scan"
                  className="mri-img"
                  style={{ opacity: showHeat ? 0 : 1 }}
                />
                {hasResults && mriResults.heatmap_base64 && (
                  <img
                    src={`data:image/png;base64,${mriResults.heatmap_base64}`}
                    alt="Grad-CAM heatmap"
                    className="mri-img"
                    style={{ opacity: showHeat ? 1 : 0 }}
                  />
                )}
                {/* Corner markers */}
                <div className="mri-corner mri-corner--tl" />
                <div className="mri-corner mri-corner--tr" />
                <div className="mri-corner mri-corner--bl" />
                <div className="mri-corner mri-corner--br" />
              </>
            ) : (
              <div className="mri-upload-cta">
                <svg width="44" height="44" viewBox="0 0 48 48" fill="none" opacity="0.3">
                  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.2" />
                  <circle cx="24" cy="24" r="12" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
                  <circle cx="24" cy="24" r="4" fill="currentColor" opacity="0.5" />
                </svg>
                <span>Drop a brain MRI here</span>
                <span className="mri-upload-sub">or click to select · JPG / PNG</span>
              </div>
            )}
            {scanning && (
              <div className="mri-viewer-overlay">
                <div className="spinner" />
                <span>{loadStep}</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files[0])}
            />
          </div>

          {/* Results panel */}
          <div className="mri-results-panel">
            {hasResults ? (
              <>
                <div className="mri-primary-badge">
                  <span className="badge badge-teal">
                    Primary: <strong>{mriResults.primary_task}</strong>
                  </span>
                </div>
                <ClassificationCard
                  title="Alzheimer Staging"
                  result={mriResults.alzheimer}
                  accentVar="--teal-deep"
                />
                <ClassificationCard
                  title="Brain Tumor Classification"
                  result={mriResults.tumor}
                  accentVar="--status-low"
                />
              </>
            ) : (
              <div className="mri-awaiting">
                {scanning ? (
                  <>
                    <div className="spinner" />
                    <span>{loadStep}</span>
                    <span className="mri-awaiting-sub">EfficientNet-B3 × 2</span>
                  </>
                ) : imageUrl ? (
                  <>
                    <span className="mri-awaiting-icon">🧠</span>
                    <span>Ready to analyse</span>
                    <span className="mri-awaiting-sub">Click "Analyse" to run the NeuroBridge models</span>
                  </>
                ) : (
                  <>
                    <span className="mri-awaiting-icon">📁</span>
                    <span>No scan uploaded</span>
                    <span className="mri-awaiting-sub">Upload a brain MRI image to begin</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Clinical note */}
        {hasResults && mriResults.clinical_note && (
          <div className="mri-clinical-note">
            <div className="mri-section-label">
              Clinical Summary <span className="badge badge-neutral" style={{ marginLeft: 8 }}>AI Generated</span>
            </div>
            <p className="mri-note-text">{mriResults.clinical_note}</p>
          </div>
        )}

        {/* Follow-up chat */}
        {hasResults && (
          <div className="mri-chat-section">
            <div className="mri-section-label">Follow-up Consultation</div>

            {chatLog.length === 0 && (
              <div className="mri-suggestions">
                {['What does this finding mean?', 'Should I be concerned?', 'What follow-up is recommended?'].map(q => (
                  <button key={q} className="btn btn-ghost btn-sm" onClick={() => setChatInput(q)}>
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div className="mri-chat-log">
              {chatLog.map((m, i) => <ChatBubble key={i} role={m.role} content={m.content} />)}
              {chatBusy && (
                <div className="mri-bubble-wrap mri-bubble-left">
                  <div className="mri-bubble mri-bubble--ai" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, flexShrink: 0 }} />
                    Analyzing…
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="mri-chat-row">
              <input
                className="mri-chat-input"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
                placeholder="Ask about the findings…"
                disabled={chatBusy}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={sendChat}
                disabled={chatBusy || !chatInput.trim()}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
