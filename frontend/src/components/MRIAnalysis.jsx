import { useState, useRef, useCallback, useEffect } from 'react'
import './MRIAnalysis.css'

function getApiUrl() {
  return localStorage.getItem('neurobridge_api_url') || 'http://localhost:8000'
}

function formatPct(v) {
  return (v * 100).toFixed(1) + '%'
}

function confidenceLevel(uncertainty) {
  if (uncertainty < 0.10) return { label: 'High Confidence', cls: 'mri-conf-high' }
  if (uncertainty < 0.20) return { label: 'Moderate',        cls: 'mri-conf-moderate' }
  return                          { label: 'Low Confidence',  cls: 'mri-conf-low' }
}

function ClassificationCard({ title, result, accentVar }) {
  if (!result) return null
  const conf = confidenceLevel(result.uncertainty)
  return (
    <div className="card mri-result-card">
      <div className="card-header">
        <span className="card-title">{title}</span>
        <span className={`badge ${conf.cls}`}>{conf.label}</span>
      </div>
      <div className="card-body">
        <div className="mri-finding" style={{ color: `var(${accentVar})` }}>
          {result.finding}
        </div>
        <div className="mri-stats">
          <span>Confidence <strong>{formatPct(result.confidence)}</strong></span>
          <span className="mri-stats-sep">·</span>
          <span>Uncertainty <strong>{formatPct(result.uncertainty)}</strong></span>
        </div>
        <div className="mri-probs">
          {Object.entries(result.probabilities).map(([lbl, prob]) => (
            <div key={lbl} className="mri-prob-row">
              <span className="mri-prob-label">{lbl}</span>
              <div className="mri-prob-bar-track">
                <div
                  className="mri-prob-bar-fill"
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
    <div className={`mri-bubble-wrap ${isUser ? 'mri-bubble-user' : 'mri-bubble-ai'}`}>
      <div className={`mri-bubble ${isUser ? 'mri-bubble--user' : 'mri-bubble--ai'}`}>
        {content}
      </div>
    </div>
  )
}

export default function MRIAnalysis({ patient }) {
  const [file, setFile]           = useState(null)
  const [preview, setPreview]     = useState(null)
  const [dragging, setDragging]   = useState(false)
  const [scanning, setScanning]   = useState(false)
  const [loadStep, setLoadStep]   = useState('')
  const [results, setResults]     = useState(null)
  const [error, setError]         = useState(null)
  const [showHeat, setShowHeat]   = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatLog, setChatLog]     = useState([])
  const [chatBusy, setChatBusy]   = useState(false)
  const chatEndRef  = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatLog, chatBusy])

  const handleFile = useCallback((f) => {
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResults(null)
    setError(null)
    setShowHeat(false)
    setChatLog([])
  }, [])

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const analyze = async () => {
    if (!file) return
    setScanning(true)
    setResults(null)
    setError(null)
    setShowHeat(false)

    const steps = [
      'Initializing models…',
      'Running inference…',
      'Computing Grad-CAM…',
      'Generating clinical note…',
    ]
    let stepIdx = 0
    setLoadStep(steps[0])
    const stepTimer = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1)
      setLoadStep(steps[stepIdx])
    }, 1800)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${getApiUrl()}/analyze`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || data.detail || `Server error ${res.status}`)
        return
      }
      setResults(data)
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

  const hasResults = results && !results.error

  return (
    <div className="mri-panel">

      {/* Disclaimer */}
      <div className="mri-disclaimer">
        <span className="mri-disclaimer-icon">⚠</span>
        For research and demonstration only — not a substitute for professional clinical diagnosis.
        Connects to the NeuroBridge FastAPI backend (configure URL in Settings).
      </div>

      {/* Upload zone */}
      <div
        className={`card mri-upload-zone ${dragging ? 'mri-upload-zone--drag' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="mri-upload-inner">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => fileInputRef.current?.click()}
          >
            Select MRI Image
          </button>
          <div className="mri-upload-info">
            {file
              ? <><span className="mri-upload-filename">{file.name}</span>{' '}&mdash; {(file.size / 1024).toFixed(0)} KB</>
              : <span className="mri-upload-placeholder">Drop a brain MRI image here, or click to select &middot; JPG / PNG</span>
            }
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={analyze}
            disabled={!file || scanning}
          >
            {scanning ? loadStep : 'Run Analysis'}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mri-error">
          <strong>Analysis failed —</strong> {error}
        </div>
      )}

      {/* Main grid: viewer + results */}
      <div className="mri-main-grid">

        {/* Scan viewer */}
        <div className="card mri-viewer-card">
          <div className="card-header">
            <span className="card-title">Scan Viewer</span>
            {hasResults && results.heatmap_base64 && (
              <button
                className={`btn btn-sm ${showHeat ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setShowHeat(h => !h)}
              >
                {showHeat ? 'Grad-CAM On' : 'Grad-CAM Off'}
              </button>
            )}
          </div>
          <div className="mri-viewer-body">
            {preview ? (
              <div className="mri-img-wrap">
                <img
                  src={preview}
                  alt="MRI scan"
                  className="mri-img"
                  style={{ opacity: showHeat ? 0 : 1 }}
                />
                {hasResults && results.heatmap_base64 && (
                  <img
                    src={`data:image/png;base64,${results.heatmap_base64}`}
                    alt="Grad-CAM heatmap"
                    className="mri-img"
                    style={{ opacity: showHeat ? 1 : 0 }}
                  />
                )}
                <div className="mri-corner mri-corner--tl" />
                <div className="mri-corner mri-corner--tr" />
                <div className="mri-corner mri-corner--bl" />
                <div className="mri-corner mri-corner--br" />
              </div>
            ) : (
              <div className="mri-viewer-empty">
                <svg width="52" height="52" viewBox="0 0 48 48" fill="none" opacity="0.25">
                  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1" />
                  <circle cx="24" cy="24" r="12" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
                  <circle cx="24" cy="24" r="4" fill="currentColor" opacity="0.5" />
                </svg>
                <span>No scan loaded</span>
              </div>
            )}
            {scanning && (
              <div className="mri-viewer-overlay">
                <div className="spinner" />
                <span>{loadStep}</span>
              </div>
            )}
          </div>
          {preview && (
            <div className="mri-viewer-caption">
              {hasResults && results.heatmap_base64
                ? (showHeat
                    ? 'Heatmap — regions influencing primary prediction'
                    : 'Original scan — toggle Grad-CAM to overlay heatmap')
                : scanning ? loadStep : 'Ready for analysis'
              }
            </div>
          )}
        </div>

        {/* Results column */}
        <div className="mri-results-col">
          {hasResults ? (
            <>
              <div className="mri-primary-task-badge">
                <span className="badge badge-teal">
                  Primary analysis: <strong>{results.primary_task}</strong>
                </span>
              </div>
              <ClassificationCard
                title="Alzheimer Staging"
                result={results.alzheimer}
                accentVar="--teal-deep"
              />
              <ClassificationCard
                title="Brain Tumor Classification"
                result={results.tumor}
                accentVar="--status-low"
              />
            </>
          ) : (
            <div className="card mri-awaiting">
              {scanning ? (
                <>
                  <div className="spinner" />
                  <span>{loadStep}</span>
                  <span className="mri-awaiting-sub">EfficientNet-B3 × 2</span>
                </>
              ) : (
                <>
                  <span className="mri-awaiting-icon">🧠</span>
                  <span>Awaiting input</span>
                  <span className="mri-awaiting-sub">Upload and run analysis to see results</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Clinical note */}
      {hasResults && results.clinical_note && (
        <div className="card" style={{ animation: 'fadeIn 0.25s ease' }}>
          <div className="card-header">
            <span className="card-title">Clinical Summary</span>
            <span className="badge badge-neutral">AI Generated</span>
          </div>
          <div className="card-body">
            <p className="mri-note-text">{results.clinical_note}</p>
          </div>
        </div>
      )}

      {/* Follow-up chat */}
      {hasResults && (
        <div className="card" style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="card-header">
            <span className="card-title">Follow-up Consultation</span>
            <span className="badge badge-neutral">NeuroBridge AI</span>
          </div>
          <div className="card-body mri-chat-body">
            {chatLog.length === 0 && (
              <div className="mri-chat-suggestions">
                {[
                  'What does this finding mean?',
                  'Should I be concerned?',
                  'What follow-up is recommended?',
                ].map(q => (
                  <button
                    key={q}
                    className="btn btn-ghost btn-sm"
                    onClick={() => setChatInput(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div className="mri-chat-log">
              {chatLog.map((m, i) => (
                <ChatBubble key={i} role={m.role} content={m.content} />
              ))}
              {chatBusy && (
                <div className="mri-bubble-wrap mri-bubble-ai">
                  <div className="mri-bubble mri-bubble--ai mri-bubble--thinking">
                    <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, flexShrink: 0 }} />
                    Analyzing…
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="mri-chat-input-row">
              <input
                className="mri-chat-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChat()}
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
        </div>
      )}
    </div>
  )
}
