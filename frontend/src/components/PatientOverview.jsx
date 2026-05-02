import { useRef } from 'react'
import './PatientOverview.css'

const GENETIC_OPTIONS = ['APOE ε4 Negative', 'APOE ε4 Heterozygous', 'APOE ε4 Homozygous', 'BRCA1 Mutation', 'BRCA2 Mutation', 'TP53 Mutation']
const CANCER_OPTIONS = ['None', 'Breast Cancer', 'Lung Cancer', 'Prostate Cancer', 'Colorectal Cancer', 'Skin Cancer', 'Leukemia']

function InfoField({ label, children }) {
  return (
    <div className="info-field">
      <label className="info-field-label">{label}</label>
      <div className="info-field-control">{children}</div>
    </div>
  )
}

export default function PatientOverview({ patient, onUpdate, setActiveTab }) {
  const fileInputRef = useRef(null)
  const previewUrl = patient.image_url || null

  const handleChange = (field, value) => {
    onUpdate({ ...patient, [field]: value })
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const url = URL.createObjectURL(file)
      handleChange('image_url', url)
    }
  }

  const triggerUpload = () => {
    fileInputRef.current.click()
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    handleChange('image_url', null)
  }

  const toggleCancer = (cancer) => {
    const current = patient.cancer_history || []
    if (current.includes(cancer)) {
      handleChange('cancer_history', current.filter(c => c !== cancer))
    } else {
      handleChange('cancer_history', [...current, cancer])
    }
  }

  return (
    <div className="patient-overview-wrapper">
      {/* Top Demographics Section */}
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

      {/* Image Portal Section */}
      <div className="image-overview-container">
        {/* Main Upload / Display Zone */}
        <div className="image-main-wrapper">
          <div 
            className={`image-main-zone ${!previewUrl ? 'empty' : ''}`}
            onClick={!previewUrl ? triggerUpload : undefined}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Patient Scan" className="uploaded-image" />
            ) : (
              <div className="upload-cta">
                <span className="upload-icon">📁</span>
                <h3>Upload Medical Image</h3>
                <p>Click to select a scan (MRI, CT, PET) for this patient</p>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              style={{ display: 'none' }} 
              accept="image/*"
            />
          </div>

          {previewUrl && (
            <div className="image-actions">
              <button className="btn btn-ghost btn-sm" onClick={triggerUpload}>
                Change Image
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleDelete}>
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Side Status Panels */}
        <div className="image-side-panels">
          <div 
            className={`side-panel-card ${!previewUrl ? 'empty' : 'clickable'}`}
            onClick={previewUrl ? () => setActiveTab('tumor') : undefined}
          >
            <div className="panel-header">Tumor Overview</div>
            {previewUrl && <div className="panel-content">Analysis Pending...</div>}
          </div>
          
          <div 
            className={`side-panel-card ${!previewUrl ? 'empty' : 'clickable'}`}
            onClick={previewUrl ? () => setActiveTab('dementia') : undefined}
          >
            <div className="panel-header">Dementia Overview</div>
            {previewUrl && <div className="panel-content">Analysis Pending...</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
