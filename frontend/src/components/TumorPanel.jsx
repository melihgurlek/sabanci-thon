import './TumorPanel.css'

export default function TumorPanel({ patient }) {
  const hasImage = !!patient.image_url
  const hasResults = !!patient.mri_results

  return (
    <div className="analysis-panel-layout">
      <div className="analysis-grid">
        <div className={`analysis-card ${!hasResults ? 'pending' : ''}`}>
          <div className="analysis-card-header">
            <span className="analysis-card-title">Survival & Prognostic Modeling</span>
            <span className="badge badge-neutral">
              {!hasImage ? 'Scan Required' : !hasResults ? 'Analysis Required' : 'Processing'}
            </span>
          </div>
          <div className="analysis-card-body">
            {!hasResults ? (
              <div className="analysis-placeholder">
                <span className="placeholder-icon">{!hasImage ? '📷' : '🧠'}</span>
                <p>
                  {!hasImage 
                    ? 'Please upload a medical scan in the Overview tab to begin survival modeling.' 
                    : 'Please run the Brain MRI Analysis in the Overview tab to generate survival predictions.'}
                </p>
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
