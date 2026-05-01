import './PatientOverview.css'

function InfoRow({ label, value, mono }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className={`info-value ${mono ? 'mono' : ''}`}>{value}</span>
    </div>
  )
}

function SectionCard({ title, children }) {
  return (
    <div className="card overview-section">
      <div className="card-header">
        <span className="card-title">{title}</span>
      </div>
      <div className="card-body info-grid">
        {children}
      </div>
    </div>
  )
}

function formatYesNo(val) {
  if (val === 'yes') return '✓ Yes'
  if (val === 'no') return '✗ No'
  return val
}

function formatSurvivalDays(days) {
  if (!days) return null
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  if (years > 0) return `${years}y ${months}m (${days} days)`
  return `${months}m (${days} days)`
}

export default function PatientOverview({ patient }) {
  const isDeceased = patient.survival_status === 'deceased'
  const hasRecurrence = patient.recurrence === 'yes'
  const isIncomplete = patient.blood_completeness < 0.5

  return (
    <div className="overview-layout">
      {/* Summary banner */}
      <div className={`summary-banner ${isDeceased ? 'deceased' : 'living'}`}>
        <div className="summary-banner-left">
          <div className="summary-patient-id">
            Patient <span className="mono">#{patient.patient_id}</span>
          </div>
          <div className="summary-descriptors">
            <span>{patient.age ? `${patient.age} years` : '—'}</span>
            <span className="sep">·</span>
            <span style={{ textTransform: 'capitalize' }}>{patient.sex || '—'}</span>
            <span className="sep">·</span>
            <span>{patient.primary_tumor_site || '—'}</span>
            <span className="sep">·</span>
            <span>{patient.pT_stage || '—'} / {patient.pN_stage || '—'}</span>
          </div>
        </div>
        <div className="summary-banner-right">
          <span className={`badge badge-${patient.survival_status}`}>
            {patient.survival_status === 'living' ? '● Living' : '● Deceased'}
          </span>
          {hasRecurrence && <span className="badge badge-yes">Recurrence</span>}
          {isIncomplete && (
            <span className="badge badge-incomplete" title={`${Math.round(patient.blood_completeness * 100)}% blood data`}>
              ⚠ Incomplete Blood Data
            </span>
          )}
        </div>
      </div>

      <div className="overview-grid">
        <SectionCard title="Clinical Profile">
          <InfoRow label="Age at Diagnosis" value={patient.age ? `${patient.age} years` : null} />
          <InfoRow label="Sex" value={patient.sex} />
          <InfoRow label="Smoking Status" value={patient.smoking_status} />
          <InfoRow label="Diagnosis Year" value={patient.year_of_initial_diagnosis} />
          <InfoRow label="Follow-up Duration" value={formatSurvivalDays(patient.days_to_last_information)} />
          <InfoRow label="Primary Metastasis" value={formatYesNo(patient.primarily_metastasis)} />
        </SectionCard>

        <SectionCard title="Pathological Profile">
          <InfoRow label="Tumor Site" value={patient.primary_tumor_site} />
          <InfoRow label="pT Stage" value={patient.pT_stage} mono />
          <InfoRow label="pN Stage" value={patient.pN_stage} mono />
          <InfoRow label="Grade" value={patient.grading} mono />
          <InfoRow label="HPV / p16" value={patient.hpv_association_p16} />
          <InfoRow label="Histologic Type" value={patient.histologic_type} />
          <InfoRow label="Resection Status" value={patient.resection_status} mono />
          <InfoRow label="Infiltration Depth" value={patient.infiltration_depth_in_mm != null ? `${patient.infiltration_depth_in_mm} mm` : null} />
          <InfoRow label="Positive Lymph Nodes" value={patient.number_of_positive_lymph_nodes} />
          <InfoRow label="Perinodal Invasion" value={formatYesNo(patient.perinodal_invasion)} />
          <InfoRow label="Lymphovascular Invasion" value={formatYesNo(patient.lymphovascular_invasion_L)} />
        </SectionCard>

        <SectionCard title="Treatment">
          <InfoRow label="Intent" value={patient.first_treatment_intent} />
          <InfoRow label="Modality" value={patient.first_treatment_modality} />
          <InfoRow label="Days to Treatment" value={patient.days_to_first_treatment != null ? `${patient.days_to_first_treatment} days` : null} />
          <InfoRow label="Adjuvant RT" value={formatYesNo(patient.adjuvant_radiotherapy)} />
          <InfoRow label="Adjuvant Systemic" value={formatYesNo(patient.adjuvant_systemic_therapy)} />
          <InfoRow label="Adjuvant Radiochemotherapy" value={formatYesNo(patient.adjuvant_radiochemotherapy)} />
        </SectionCard>

        <SectionCard title="Outcomes">
          <InfoRow label="Survival Status" value={patient.survival_status} />
          <InfoRow label="Recurrence" value={formatYesNo(patient.recurrence)} />
          {patient.days_to_recurrence && (
            <InfoRow label="Days to Recurrence" value={`${patient.days_to_recurrence} days`} />
          )}
          {patient.metastasis_locations?.length > 0 && (
            <InfoRow label="Metastasis Locations" value={patient.metastasis_locations.join(', ')} />
          )}
          <InfoRow
            label="Blood Data Completeness"
            value={`${Math.round(patient.blood_completeness * 100)}% (${patient.blood_analyte_count} analytes)`}
          />
        </SectionCard>
      </div>
    </div>
  )
}
