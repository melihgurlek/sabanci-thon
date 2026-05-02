import './TumorPanel.css'

export default function TumorPanel({ patient }) {
  const hasImage = !!patient.image_url

  return (
    <div className="analysis-panel-layout">
      <div className="analysis-grid">
        <div className={`analysis-card ${!hasImage ? 'pending' : ''}`}>
          <div className="analysis-card-header">
            <span className="analysis-card-title">Survival & Prognostic Modeling</span>
            <span className="badge badge-neutral">Analysis {hasImage ? 'Pending' : 'Required'}</span>
          </div>
          <div className="analysis-card-body">
            {!hasImage ? (
              <div className="analysis-placeholder">
                <span className="placeholder-icon">📷</span>
                <p>Please upload a medical scan in the Overview tab to begin survival modeling.</p>
              </div>
            ) : (
              <div className="analysis-placeholder active">
                <div className="analysis-spinner" />
                <p>Processing survival and prognostic factors based on scan and clinical data...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
