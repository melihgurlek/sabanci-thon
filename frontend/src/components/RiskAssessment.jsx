import './RiskAssessment.css'

function getRiskTier(prob, thresholds) {
  if (!thresholds) return { label: 'Unknown', color: 'var(--text-muted)', level: 0 }
  if (prob >= thresholds.high_threshold) return { label: 'High', color: 'var(--risk-high)', level: 2 }
  if (prob >= thresholds.low_threshold) return { label: 'Moderate', color: 'var(--risk-moderate)', level: 1 }
  return { label: 'Low', color: 'var(--risk-safe)', level: 0 }
}

function RiskBar({ prob, thresholds, label }) {
  const tier = getRiskTier(prob, thresholds)
  const pct = Math.round(prob * 100)
  const lt = thresholds?.low_threshold ? Math.round(thresholds.low_threshold * 100) : 33
  const ht = thresholds?.high_threshold ? Math.round(thresholds.high_threshold * 100) : 66

  return (
    <div className="risk-bar-section">
      <div className="risk-bar-header">
        <span className="risk-bar-label">{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="risk-pct" style={{ color: tier.color }}>{pct}%</span>
          <span className="risk-tier-badge" style={{ background: tier.color + '18', color: tier.color }}>
            {tier.label} Risk
          </span>
        </div>
      </div>

      {/* Track with zone markers */}
      <div className="risk-track-wrap">
        <div className="risk-track">
          <div className="risk-zone zone-low" style={{ width: `${lt}%` }} />
          <div className="risk-zone zone-mod" style={{ width: `${ht - lt}%` }} />
          <div className="risk-zone zone-high" style={{ width: `${100 - ht}%` }} />
          <div
            className="risk-fill"
            style={{ '--target-width': `${pct}%`, width: `${pct}%`, background: tier.color }}
          />
          <div
            className="risk-thumb"
            style={{ left: `${pct}%`, background: tier.color }}
            title={`${pct}%`}
          />
          {/* Zone markers */}
          <div className="risk-marker" style={{ left: `${lt}%` }} />
          <div className="risk-marker" style={{ left: `${ht}%` }} />
        </div>
        <div className="risk-track-labels">
          <span>Low</span>
          <span style={{ marginLeft: `${lt}%` }}>Moderate</span>
          <span style={{ marginLeft: `${ht - lt}%` }}>High</span>
        </div>
      </div>
    </div>
  )
}

function FactorRow({ factor, index }) {
  const isRisk = factor.direction === 'increases_risk'
  const barWidth = Math.min(100, Math.abs(factor.contribution) * 80)

  return (
    <div className="factor-row" style={{ animationDelay: `${index * 0.06}s` }}>
      <div className="factor-rank">{index + 1}</div>
      <div className="factor-info">
        <div className="factor-label">{factor.label || factor.feature}</div>
        <div className="factor-bar-wrap">
          <div
            className={`factor-bar ${isRisk ? 'risk' : 'protective'}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
      <div className="factor-direction" style={{ color: isRisk ? 'var(--risk-high)' : 'var(--risk-safe)' }}>
        {isRisk ? '↑ Risk' : '↓ Risk'}
      </div>
    </div>
  )
}

export default function RiskAssessment({ patient, modelMeta }) {
  const survThresholds = modelMeta?.survival_thresholds
  const recThresholds = modelMeta?.recurrence_thresholds

  const isIncomplete = patient.blood_completeness < 0.5
  const completenessLabel = `${Math.round(patient.blood_completeness * 100)}%`

  return (
    <div className="risk-layout">
      {/* Confidence warning */}
      {isIncomplete && (
        <div className="confidence-warning">
          <span className="warning-icon">⚠</span>
          <div>
            <strong>Reduced confidence</strong> — Blood panel incomplete ({completenessLabel} present).
            Risk estimates are based on staging and pathology only; interpret with caution.
          </div>
        </div>
      )}

      {/* Confidence bar */}
      <div className="card confidence-card">
        <div className="card-header">
          <span className="card-title">Data Confidence</span>
          <span
            className={`badge ${patient.blood_completeness >= 0.8 ? 'badge-teal' : patient.blood_completeness >= 0.5 ? 'badge-neutral' : 'badge-incomplete'}`}
          >
            {completenessLabel} complete
          </span>
        </div>
        <div className="card-body" style={{ paddingTop: 12, paddingBottom: 12 }}>
          <div className="confidence-bar-track">
            <div
              className="confidence-bar-fill"
              style={{ width: completenessLabel }}
            />
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8 }}>
            {patient.blood_analyte_count} of {Object.keys(patient.biomarker_flags || {}).length} analytes measured
          </p>
        </div>
      </div>

      {/* Risk bars */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Survival Risk</span>
          <span className="badge badge-neutral">Logistic Regression · AUC 0.75</span>
        </div>
        <div className="card-body">
          <RiskBar
            prob={patient.survival_prob}
            thresholds={survThresholds}
            label="Mortality probability (model-estimated)"
          />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Recurrence Risk</span>
          <span className="badge badge-neutral">Logistic Regression · AUC 0.68</span>
        </div>
        <div className="card-body">
          <RiskBar
            prob={patient.recurrence_prob}
            thresholds={recThresholds}
            label="Recurrence probability (model-estimated)"
          />
        </div>
      </div>

      {/* Factor explanations */}
      <div className="factors-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Top Survival Risk Factors</span>
          </div>
          <div className="card-body" style={{ paddingTop: 12 }}>
            {(patient.survival_factors || []).map((f, i) => (
              <FactorRow key={f.feature} factor={f} index={i} />
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Top Recurrence Risk Factors</span>
          </div>
          <div className="card-body" style={{ paddingTop: 12 }}>
            {(patient.recurrence_factors || []).map((f, i) => (
              <FactorRow key={f.feature} factor={f} index={i} />
            ))}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="risk-disclaimer">
        These risk estimates are generated by a logistic regression model trained on 693 HNSCC patients
        and are intended as decision support only. They do not replace clinical judgment. Model accuracy
        is approximately 68–75% AUC. Always consider the full clinical picture.
      </p>
    </div>
  )
}
