import './DementiaPanel.css'

export default function DementiaPanel({ patient }) {
  const hasImage = !!patient.image_url

  return (
    <div className="analysis-panel-layout">
      <div className="analysis-grid">
        {/* Normative Percentiles & Z-Scores */}
        <div className={`analysis-card ${!hasImage ? 'pending' : ''}`}>
          <div className="analysis-card-header">
            <span className="analysis-card-title">Normative Percentiles & Z-Scores</span>
            <span className="badge badge-neutral">Pending</span>
          </div>
          <div className="analysis-card-body">
            {!hasImage ? (
              <div className="analysis-placeholder">
                <p>Upload a scan to analyze brain structure percentiles.</p>
              </div>
            ) : (
              <div className="analysis-placeholder active">
                <div className="analysis-spinner" />
                <p>Calculating z-scores relative to age-matched normative database...</p>
              </div>
            )}
          </div>
        </div>

        {/* Brain Age Estimation */}
        <div className={`analysis-card ${!hasImage ? 'pending' : ''}`}>
          <div className="analysis-card-header">
            <span className="analysis-card-title">Brain Age Estimation</span>
            <span className="badge badge-neutral">Pending</span>
          </div>
          <div className="analysis-card-body">
            {!hasImage ? (
              <div className="analysis-placeholder">
                <p>Upload a scan to estimate brain age.</p>
              </div>
            ) : (
              <div className="analysis-placeholder active">
                <div className="analysis-spinner" />
                <p>Applying deep learning model to estimate neurobiological age...</p>
              </div>
            )}
          </div>
        </div>

        {/* Predictive Conversion Risk */}
        <div className={`analysis-card ${!hasImage ? 'pending' : ''}`}>
          <div className="analysis-card-header">
            <span className="analysis-card-title">Predictive Conversion Risk</span>
            <span className="badge badge-neutral">Pending</span>
          </div>
          <div className="analysis-card-body">
            {!hasImage ? (
              <div className="analysis-placeholder">
                <p>Upload a scan to predict conversion risk.</p>
              </div>
            ) : (
              <div className="analysis-placeholder active">
                <div className="analysis-spinner" />
                <p>Estimating probability of conversion to Alzheimer's Disease...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
