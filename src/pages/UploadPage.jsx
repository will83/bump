import { useState, useRef } from 'react'
import { API_BASE } from '../config'
import { generateTransferId, formatSize, copyToClipboard } from '../utils'

function UploadPage() {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [shareUrl, setShareUrl] = useState(null)
  const [copied, setCopied] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const totalSize = files.reduce((sum, f) => sum + f.size, 0)

  const handleFiles = (newFiles) => {
    const fileArray = Array.from(newFiles)
    setFiles(prev => [...prev, ...fileArray])
    setError(null)
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const uploadFiles = async () => {
    if (files.length === 0) return

    setUploading(true)
    setProgress(0)
    setError(null)

    const transferId = generateTransferId()
    let uploadedBytes = 0

    try {
      // Upload chaque fichier
      for (const file of files) {
        const response = await fetch(
          `${API_BASE}/api/upload/${transferId}/${encodeURIComponent(file.name)}`,
          {
            method: 'POST',
            body: file,
            headers: {
              'Content-Type': file.type || 'application/octet-stream'
            }
          }
        )

        if (!response.ok) {
          throw new Error(`Erreur upload: ${response.status}`)
        }

        uploadedBytes += file.size
        setProgress(Math.round((uploadedBytes / totalSize) * 100))
      }

      // Finaliser le transfert
      const finalizeResponse = await fetch(
        `${API_BASE}/api/finalize/${transferId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: files.map(f => ({ name: f.name, size: f.size }))
          })
        }
      )

      if (!finalizeResponse.ok) {
        throw new Error(`Erreur finalisation: ${finalizeResponse.status}`)
      }

      const url = `${window.location.origin}/d/${transferId}`
      setShareUrl(url)
    } catch (err) {
      setError(err.message || 'Une erreur est survenue')
      setUploading(false)
    }
  }

  const handleCopy = async () => {
    const success = await copyToClipboard(shareUrl)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const reset = () => {
    setFiles([])
    setShareUrl(null)
    setProgress(0)
    setUploading(false)
    setCopied(false)
    setError(null)
  }

  // État succès - affiche le lien de partage
  if (shareUrl) {
    return (
      <div className="upload-success">
        <div className="success-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <h2>C'est parti !</h2>
        <p className="success-subtitle">{files.length} fichier{files.length > 1 ? 's' : ''} prêt{files.length > 1 ? 's' : ''} à partager</p>

        <div className="share-link-container">
          <input
            type="text"
            value={shareUrl}
            readOnly
            className="share-link-input"
          />
          <button onClick={handleCopy} className="copy-btn">
            {copied ? 'Copié !' : 'Copier'}
          </button>
        </div>

        <button onClick={reset} className="btn-secondary">
          Nouveau transfert
        </button>
      </div>
    )
  }

  // État upload en cours
  if (uploading) {
    return (
      <div className="uploading">
        <div className="upload-progress-container">
          <div className="upload-progress-bar" style={{ width: `${progress}%` }}></div>
        </div>
        <p className="upload-progress-text">{progress}% — Upload en cours...</p>
      </div>
    )
  }

  // État par défaut - sélection de fichiers
  return (
    <div className="upload-page">
      <div
        className={`dropzone ${dragActive ? 'drag-active' : ''} ${files.length > 0 ? 'has-files' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          hidden
        />

        {files.length === 0 ? (
          <>
            <div className="dropzone-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </div>
            <p className="dropzone-text">Glisse tes fichiers ici</p>
            <p className="dropzone-subtext">ou clique pour sélectionner</p>
          </>
        ) : (
          <p className="dropzone-add-more">+ Ajouter d'autres fichiers</p>
        )}
      </div>

      {files.length > 0 && (
        <>
          <ul className="file-list">
            {files.map((file, index) => (
              <li key={index} className="file-item">
                <span className="file-name">{file.name}</span>
                <span className="file-size">{formatSize(file.size)}</span>
                <button
                  className="file-remove"
                  onClick={(e) => { e.stopPropagation(); removeFile(index) }}
                  aria-label="Supprimer"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </li>
            ))}
          </ul>

          {error && <p className="error-message">{error}</p>}

          <button onClick={uploadFiles} className="btn-primary">
            Bump {files.length} fichier{files.length > 1 ? 's' : ''} · {formatSize(totalSize)}
          </button>
        </>
      )}
    </div>
  )
}

export default UploadPage
