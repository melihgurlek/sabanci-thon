/**
 * Static explanation panel that synthesizes risk factors into plain language.
 * This renders pre-computed explanations without requiring the AI API.
 */
import './ExplanationPanel.css'

function formatPct(prob) {
  return `${Math.round(prob * 100)}%`
}

function factorSentence(factor) {
  const dir = factor.direction === 'increases_risk' ? 'raises' : 'reduces'
  return `${factor.label} ${dir} the estimated risk.`
}

export default function ExplanationPanel({ patient, modelMeta }) {
  const survThresholds = modelMeta?.survival_thresholds
  const recThresholds = modelMeta?.recurrence_thresholds

  const survTier = (() => {
    if (!survThresholds) return 'unknown'
    if (patient.survival_prob >= survThresholds.high_threshold) return 'high'
    if (patient.survival_prob >= survThresholds.low_threshold) return 'moderate'
    return 'low'
  })()

  const recTier = (() => {
    if (!recThresholds) return 'unknown'
    if (patient.recurrence_prob >= recThresholds.high_threshold) return 'high'
    if (patient.recurrence_prob >= recThresholds.low_threshold) return 'moderate'
    return 'low'
  })()

  const abnormalFlags = Object.entries(patient.biomarker_flags || {})
    .filter(([, f]) => f === 'high' || f === 'low')
    .map(([name, f]) => ({ name, flag: f }))

  return (
    <div className="explanation-panel">
      <div className="card">
        <div className="card-header">
          <span className="card-title">Plain-Language Summary</span>
          <span className="badge badge-neutral">Auto-generated</span>
        </div>
        <div className="card-body explanation-body">

          <div className="exp-section">
            <div className="exp-section-title">Patient Profile</div>
            <p>
              Patient <strong>#{patient.patient_id}</strong> is a{' '}
              {patient.age && <>{patient.age}-year-old</>} {patient.sex || 'patient'} diagnosed with{' '}
              <strong>{patient.primary_tumor_site || 'head & neck cancer'}</strong> ({patient.pT_stage}/{patient.pN_stage}).
              {patient.hpv_association_p16 === 'positive' && ' HPV/p16 positive.'}
              {patient.grading && ` Graded ${patient.grading}.`}
            </p>
          </div>

          <div className="exp-section">
            <div className="exp-section-title">Survival Risk</div>
            <p>
              The model estimates a <strong>{formatPct(patient.survival_prob)}</strong> mortality probability
              — classified as <strong className={`tier-label tier-${survTier}`}>{survTier} risk</strong> relative
              to this cohort.
              {patient.survival_status === 'living'
                ? ' The patient is currently recorded as living.'
                : ' The patient is recorded as deceased.'}
            </p>
            {(patient.survival_factors || []).slice(0, 3).length > 0 && (
              <ul className="exp-factor-list">
                {patient.survival_factors.slice(0, 3).map(f => (
                  <li key={f.feature}>
                    <span className={`factor-dot ${f.direction === 'increases_risk' ? 'risk' : 'protect'}`} />
                    {factorSentence(f)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="exp-section">
            <div className="exp-section-title">Recurrence Risk</div>
            <p>
              Recurrence probability is estimated at <strong>{formatPct(patient.recurrence_prob)}</strong> —
              classified as <strong className={`tier-label tier-${recTier}`}>{recTier} risk</strong>.
              {patient.recurrence === 'yes'
                ? ` Recurrence has been recorded${patient.days_to_recurrence ? ` at day ${patient.days_to_recurrence}` : ''}.`
                : ' No recurrence is recorded in this dataset.'}
            </p>
            {(patient.recurrence_factors || []).slice(0, 3).length > 0 && (
              <ul className="exp-factor-list">
                {patient.recurrence_factors.slice(0, 3).map(f => (
                  <li key={f.feature}>
                    <span className={`factor-dot ${f.direction === 'increases_risk' ? 'risk' : 'protect'}`} />
                    {factorSentence(f)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {abnormalFlags.length > 0 && (
            <div className="exp-section">
              <div className="exp-section-title">Abnormal Biomarkers ({abnormalFlags.length})</div>
              <div className="abnormal-chips">
                {abnormalFlags.map(({ name, flag }) => (
                  <span
                    key={name}
                    className={`abnormal-chip chip-${flag}`}
                  >
                    {name} {flag === 'high' ? '▲' : '▼'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {patient.blood_completeness < 0.5 && (
            <div className="exp-section exp-warning">
              <div className="exp-section-title">⚠ Data Completeness Note</div>
              <p>
                Only {Math.round(patient.blood_completeness * 100)}% of blood analytes are available for
                this patient. Risk estimates rely more heavily on staging and pathological features.
                Confidence in the blood-based components is reduced.
              </p>
            </div>
          )}

          <p className="exp-disclaimer">
            This summary is auto-generated from pre-computed model outputs. Use the{' '}
            <strong>AI Assistant</strong> tab to ask follow-up clinical questions.
          </p>
        </div>
      </div>
    </div>
  )
}
