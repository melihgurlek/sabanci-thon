import { useState, useRef } from 'react'
import './PatientOverview.css'

export default function PatientOverview({ patient, onUpdate, setActiveTab }) {
  const fileInputRef = useRef(null)
  
  // Use a local preview for the image if it's not already in the patient object
  const previewUrl = patient.image_url || null

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const url = URL.createObjectURL(file)
      onUpdate({ ...patient, image_url: url })
    }
  }

  const triggerUpload = () => {
    fileInputRef.current.click()
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    onUpdate({ ...patient, image_url: null })
  }

  return (
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
  )
}
