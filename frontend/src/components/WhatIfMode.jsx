import { useState, useMemo } from 'react'
import './WhatIfMode.css'

/**
 * Client-side risk recalculation using exported model coefficients.
 * sigmoid(intercept + sum(coef_i * (x_i - mean_i) / std_i))
 */
function sigmoid(z) {
  return 1 / (1 + Math.exp(-z))
}

function predict(values, coef, intercept, means, stds) {
  let z = intercept
  for (let i = 0; i < coef.length; i++) {
    const scaled = (values[i] - means[i]) / (stds[i] || 1)
    z += coef[i] * scaled
  }
  return sigmoid(z)
}

function getRiskTier(prob, thresholds) {
  if (!thresholds) return { label: '—', color: 'var(--text-muted)' }
  if (prob >= thresholds.high_threshold) return { label: 'High', color: 'var(--risk-high)' }
  if (prob >= thresholds.low_threshold) return { label: 'Moderate', color: 'var(--risk-moderate)' }
  return { label: 'Low', color: 'var(--risk-safe)' }
}

const CATEGORICAL_DISPLAY = {
  sex: { label: 'Sex', options: [{ v: 0, label: 'Female' }, { v: 1, label: 'Male' }] },
  smoking_status: { label: 'Smoking', options: [{ v: 0, label: 'Non-smoker' }, { v: 1, label: 'Former' }, { v: 2, label: 'Smoker' }] },
  pT_stage_norm: {
    label: 'Tumor Stage (pT)',
    options: [{ v: 0, label: 'pT1' }, { v: 1, label: 'pT2' }, { v: 2, label: 'pT3' }, { v: 3, label: 'pT4' }],
  },
  pN_stage_norm: {
    label: 'Node Stage (pN)',
    options: [{ v: 0, label: 'NX' }, { v: 1, label: 'pN0' }, { v: 2, label: 'pN1' }, { v: 3, label: 'pN2' }, { v: 4, label: 'pN3' }],
  },
}

const NUMERIC_SLIDERS = {
  age:                         { label: 'Age',                  min: 20, max: 90,  step: 1,    unit: 'yrs' },
  infiltration_depth_in_mm:    { label: 'Infiltration Depth',   min: 0,  max: 50,  step: 0.5,  unit: 'mm' },
  number_of_positive_lymph_nodes: { label: 'Positive Lymph Nodes', min: 0, max: 30, step: 1,  unit: '' },
}

const BLOOD_SLIDERS = {
  CRP:        { label: 'CRP',        min: 0,   max: 200, step: 0.5,  unit: 'mg/l' },
  Hemoglobin: { label: 'Hemoglobin', min: 6,   max: 18,  step: 0.1,  unit: 'g/dl' },
  Leukocytes: { label: 'Leukocytes', min: 1,   max: 30,  step: 0.1,  unit: 'x10³/µl' },
  Lymphocytes:{ label: 'Lymphocytes',min: 0.2, max: 5,   step: 0.1,  unit: 'x10³/µl' },
  Albumin:    { label: 'Albumin',    min: 20,  max: 60,  step: 0.5,  unit: 'g/l' },
}

function buildInitialValues(patient, modelMeta) {
  if (!modelMeta) return {}
  const { feature_names, categorical_features } = modelMeta
  const values = {}

  feature_names.forEach(name => {
    if (name.startsWith('blood_')) {
      const analyte = name.replace('blood_', '')
      values[name] = patient.analyte_values?.[analyte] ?? null
    } else if (name in categorical_features) {
      const levels = categorical_features[name]
      const rawVal = patient[name]
      const idx = levels.indexOf(rawVal)
      values[name] = idx >= 0 ? idx : null
    } else {
      values[name] = patient[name] ?? null
    }
  })

  return values
}

function impute(values, modelMeta) {
  if (!modelMeta) return values
  const out = { ...values }
  // If null, use mean (mean in scaled space = 0, so use raw mean from scaler)
  modelMeta.feature_names.forEach((name, i) => {
    if (out[name] == null || isNaN(out[name])) {
      out[name] = modelMeta.scaler_mean[i]
    }
  })
  return out
}

export default function WhatIfMode({ patient, modelMeta }) {
  const initialValues = useMemo(
    () => buildInitialValues(patient, modelMeta),
    [patient, modelMeta]
  )

  const [overrides, setOverrides] = useState({})

  const currentValues = useMemo(() => {
    const merged = { ...initialValues, ...overrides }
    return impute(merged, modelMeta)
  }, [initialValues, overrides, modelMeta])

  const { survProb, recProb } = useMemo(() => {
    if (!modelMeta) return { survProb: null, recProb: null }
    const { feature_names, scaler_mean, scaler_std, survival_coef, survival_intercept, recurrence_coef, recurrence_intercept } = modelMeta
    const vec = feature_names.map(n => currentValues[n] ?? scaler_mean[feature_names.indexOf(n)])
    return {
      survProb: predict(vec, survival_coef, survival_intercept, scaler_mean, scaler_std),
      recProb: predict(vec, recurrence_coef, recurrence_intercept, scaler_mean, scaler_std),
    }
  }, [currentValues, modelMeta])

  const origSurvProb = patient.survival_prob
  const origRecProb = patient.recurrence_prob

  const survDelta = survProb != null ? survProb - origSurvProb : 0
  const recDelta = recProb != null ? recProb - origRecProb : 0

  const survTier = getRiskTier(survProb, modelMeta?.survival_thresholds)
  const recTier = getRiskTier(recProb, modelMeta?.recurrence_thresholds)

  const hasChanges = Object.keys(overrides).length > 0

  function setVal(name, val) {
    setOverrides(prev => ({ ...prev, [name]: val }))
  }

  function reset() {
    setOverrides({})
  }

  function formatDelta(delta) {
    const sign = delta > 0 ? '+' : ''
    return `${sign}${Math.round(delta * 100)}%`
  }

  if (!modelMeta) return <div className="empty-state"><h3>Model metadata not loaded.</h3></div>

  return (
    <div className="whatif-layout">
      {/* Results panel */}
      <div className="whatif-results">
        <div className="whatif-result-card">
          <div className="result-label">Survival Risk</div>
          <div className="result-prob" style={{ color: survTier.color }}>
            {survProb != null ? `${Math.round(survProb * 100)}%` : '—'}
          </div>
          <div className="result-tier" style={{ color: survTier.color }}>{survTier.label}</div>
          {hasChanges && survDelta !== 0 && (
            <div className={`result-delta ${survDelta > 0 ? 'up' : 'down'}`}>
              {formatDelta(survDelta)} from baseline
            </div>
          )}
        </div>

        <div className="whatif-result-divider" />

        <div className="whatif-result-card">
          <div className="result-label">Recurrence Risk</div>
          <div className="result-prob" style={{ color: recTier.color }}>
            {recProb != null ? `${Math.round(recProb * 100)}%` : '—'}
          </div>
          <div className="result-tier" style={{ color: recTier.color }}>{recTier.label}</div>
          {hasChanges && recDelta !== 0 && (
            <div className={`result-delta ${recDelta > 0 ? 'up' : 'down'}`}>
              {formatDelta(recDelta)} from baseline
            </div>
          )}
        </div>

        {hasChanges && (
          <button className="btn btn-ghost btn-sm whatif-reset" onClick={reset}>
            ↺ Reset to Patient Values
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="whatif-controls-grid">
        {/* Categorical selectors */}
        <div className="card whatif-section">
          <div className="card-header"><span className="card-title">Staging & Demographics</span></div>
          <div className="card-body whatif-sliders">
            {Object.entries(CATEGORICAL_DISPLAY).map(([name, cfg]) => {
              const featureIdx = modelMeta.feature_names.indexOf(name)
              if (featureIdx === -1) return null
              const currentIdx = overrides[name] ?? initialValues[name] ?? 0
              return (
                <div key={name} className="slider-group">
                  <div className="slider-label-row">
                    <label>{cfg.label}</label>
                    <span className="slider-val-display">{cfg.options.find(o => o.v === currentIdx)?.label || '—'}</span>
                  </div>
                  <div className="option-btns">
                    {cfg.options.map(opt => (
                      <button
                        key={opt.v}
                        className={`option-btn ${currentIdx === opt.v ? 'active' : ''}`}
                        onClick={() => setVal(name, opt.v)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Numeric sliders */}
            {Object.entries(NUMERIC_SLIDERS).map(([name, cfg]) => {
              const featureIdx = modelMeta.feature_names.indexOf(name)
              if (featureIdx === -1) return null
              const current = overrides[name] ?? initialValues[name] ?? cfg.min
              return (
                <div key={name} className="slider-group">
                  <div className="slider-label-row">
                    <label>{cfg.label}</label>
                    <span className="slider-val-display">{current}{cfg.unit ? ` ${cfg.unit}` : ''}</span>
                  </div>
                  <input
                    type="range"
                    min={cfg.min}
                    max={cfg.max}
                    step={cfg.step}
                    value={current ?? cfg.min}
                    onChange={e => setVal(name, parseFloat(e.target.value))}
                    className="slider"
                  />
                  <div className="slider-extremes">
                    <span>{cfg.min}</span>
                    <span>{cfg.max}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Blood markers */}
        <div className="card whatif-section">
          <div className="card-header"><span className="card-title">Key Blood Markers</span></div>
          <div className="card-body whatif-sliders">
            {Object.entries(BLOOD_SLIDERS).map(([analyte, cfg]) => {
              const featureName = `blood_${analyte}`
              const featureIdx = modelMeta.feature_names.indexOf(featureName)
              if (featureIdx === -1) return null
              const current = overrides[featureName] ?? initialValues[featureName] ?? ((cfg.min + cfg.max) / 2)
              const displayVal = current != null ? parseFloat(current.toFixed(2)) : '—'
              return (
                <div key={analyte} className="slider-group">
                  <div className="slider-label-row">
                    <label>{cfg.label}</label>
                    <span className="slider-val-display">{displayVal} {cfg.unit}</span>
                  </div>
                  <input
                    type="range"
                    min={cfg.min}
                    max={cfg.max}
                    step={cfg.step}
                    value={current ?? (cfg.min + cfg.max) / 2}
                    onChange={e => setVal(featureName, parseFloat(e.target.value))}
                    className="slider"
                  />
                  <div className="slider-extremes">
                    <span>{cfg.min}</span>
                    <span>{cfg.max}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <p className="whatif-note">
        Adjusting these values recalculates risk scores in real-time using the same logistic regression
        coefficients as the main model. This mode is for educational exploration only — results are not
        clinical predictions.
      </p>
    </div>
  )
}
