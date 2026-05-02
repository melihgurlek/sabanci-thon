import './DementiaPanel.css'

export default function DementiaPanel({ patient }) {
  const hasImage = !!patient.image_url
  const hasResults = !!patient.mri_results

  return (
    <div className="analysis-panel-layout">
      <div className="analysis-grid">
        {/* Normative Percentiles & Z-Scores */}
        <div className={`analysis-card ${!hasResults ? 'pending' : ''}`}>
          <div className="analysis-card-header">
            <span className="analysis-card-title">Normative Percentiles & Z-Scores</span>
            <span className="badge badge-neutral">
               {!hasImage ? 'Scan Required' : !hasResults ? 'Analysis Required' : 'Processing'}
            </span>
          </div>
          <div className="analysis-card-body">
            {!hasResults ? (
              <div className="analysis-placeholder">
                <p>
                  {!hasImage 
                    ? 'Upload a scan to analyze brain structure percentiles.' 
                    : 'Run analysis to calculate z-scores.'}
                </p>
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
        <div className={`analysis-card ${!hasResults ? 'pending' : ''}`}>
          <div className="analysis-card-header">
            <span className="analysis-card-title">Brain Age Estimation</span>
            <span className="badge badge-neutral">
               {!hasImage ? 'Scan Required' : !hasResults ? 'Analysis Required' : 'Processing'}
            </span>
          </div>
          <div className="analysis-card-body">
            {!hasResults ? (
              <div className="analysis-placeholder">
                <p>
                  {!hasImage 
                    ? 'Upload a scan to estimate brain age.' 
                    : 'Run analysis to estimate neurobiological age.'}
                </p>
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
        <div className={`analysis-card ${!hasResults ? 'pending' : ''}`}>
          <div className="analysis-card-header">
            <span className="analysis-card-title">Predictive Conversion Risk</span>
            <span className="badge badge-neutral">
               {!hasImage ? 'Scan Required' : !hasResults ? 'Analysis Required' : 'Processing'}
            </span>
          </div>
          <div className="analysis-card-body">
            {!hasResults ? (
              <div className="analysis-placeholder">
                <p>
                  {!hasImage 
                    ? 'Upload a scan to predict conversion risk.' 
                    : 'Run analysis to estimate probability of conversion.'}
                </p>
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
