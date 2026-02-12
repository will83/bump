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
  const [expandedFolders, setExpandedFolders] = useState({})
  const inputRef = useRef(null)

  const totalSize = files.reduce((sum, f) => sum + f.size, 0)

  // Group files by top-level folder
  const groupFiles = (files) => {
    const groups = { __root: [] }

    files.forEach((file, index) => {
      const parts = file.name.split('/')
      if (parts.length === 1) {
        groups.__root.push({ file, index, displayName: file.name })
      } else {
        const folder = parts[0]
        if (!groups[folder]) {
          groups[folder] = []
        }
        groups[folder].push({
          file,
          index,
          displayName: parts.slice(1).join('/'),
          shortName: parts[parts.length - 1]
        })
      }
    })

    return groups
  }

  const toggleFolder = (folderPath) => {
    setExpandedFolders(prev => ({ ...prev, [folderPath]: !prev[folderPath] }))
  }

  const handleFiles = (newFiles) => {
    const fileArray = Array.from(newFiles).filter(file => {
      // Ignore hidden files and system files
      const name = file.name.split('/').pop()
      return !name.startsWith('.') && name !== 'Thumbs.db' && name !== 'desktop.ini'
    })
    setFiles(prev => [...prev, ...fileArray])
    setError(null)
  }

  // Parcourt récursivement un dossier pour extraire tous les fichiers
  const traverseDirectory = async (entry, path = '') => {
    const files = []

    if (entry.isFile) {
      const file = await new Promise((resolve) => entry.file(resolve))
      // Ajoute le chemin relatif au nom si dans un sous-dossier
      if (path) {
        Object.defineProperty(file, 'name', {
          value: `${path}/${file.name}`,
          writable: false
        })
      }
      files.push(file)
    } else if (entry.isDirectory) {
      const reader = entry.createReader()
      const entries = await new Promise((resolve) => {
        const allEntries = []
        const readEntries = () => {
          reader.readEntries(async (batch) => {
            if (batch.length === 0) {
              resolve(allEntries)
            } else {
              allEntries.push(...batch)
              readEntries()
            }
          })
        }
        readEntries()
      })

      for (const childEntry of entries) {
        const childFiles = await traverseDirectory(
          childEntry,
          path ? `${path}/${entry.name}` : entry.name
        )
        files.push(...childFiles)
      }
    }

    return files
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

  const handleDrop = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const items = e.dataTransfer.items
    if (!items || items.length === 0) return

    // Collecter les entries SYNCHRONEMENT avant tout await
    // car dataTransfer.items est une collection "live" qui se vide
    const entries = []
    const directFiles = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const entry = item.webkitGetAsEntry?.()
      if (entry) {
        entries.push(entry)
      } else if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) directFiles.push(file)
      }
    }

    // Maintenant on peut faire les awaits
    const allFiles = [...directFiles]

    for (const entry of entries) {
      const files = await traverseDirectory(entry)
      allFiles.push(...files)
    }

    if (allFiles.length > 0) {
      handleFiles(allFiles)
    }
  }

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Upload direct vers R2 via presigned URL
  const uploadFile = async (file, transferId, onProgress) => {
    const encodedName = encodeURIComponent(file.name)

    // 1. Obtenir la presigned URL
    const presignResponse = await fetch(
      `${API_BASE}/api/presign/${transferId}/${encodedName}`
    )

    if (!presignResponse.ok) {
      throw new Error(`Erreur presign: ${presignResponse.status}`)
    }

    const { url } = await presignResponse.json()

    // 2. Upload direct vers R2
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(e.loaded, e.total)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(`Erreur upload: ${xhr.status}`))
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Erreur réseau'))
      })

      xhr.open('PUT', url)
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
      xhr.send(file)
    })
  }

  const uploadFiles = async () => {
    if (files.length === 0) return

    setUploading(true)
    setProgress(0)
    setError(null)

    const transferId = generateTransferId()
    let totalUploaded = 0

    try {
      // Upload chaque fichier
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const previousFilesSize = files.slice(0, i).reduce((sum, f) => sum + f.size, 0)

        await uploadFile(file, transferId, (loaded, total) => {
          const overallProgress = previousFilesSize + loaded
          setProgress(Math.round((overallProgress / totalSize) * 100))
        })

        totalUploaded += file.size
        setProgress(Math.round((totalUploaded / totalSize) * 100))
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
        <h2>Ready to share!</h2>
        <p className="success-subtitle">{files.length} file{files.length > 1 ? 's' : ''} ready to share</p>

        <div className="share-link-container">
          <input
            type="text"
            value={shareUrl}
            readOnly
            className="share-link-input"
          />
          <button onClick={handleCopy} className="copy-btn">
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <button onClick={reset} className="btn-secondary">
          New transfer
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
        <p className="upload-progress-text">{progress}% — Uploading...</p>
      </div>
    )
  }

  const grouped = groupFiles(files)
  const folders = Object.keys(grouped).filter(k => k !== '__root').sort()
  const rootFiles = grouped.__root

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
            <p className="dropzone-text">Drop your files here</p>
            <p className="dropzone-subtext">or click to select · up to 5 GB</p>
          </>
        ) : (
          <p className="dropzone-add-more">+ Add more files</p>
        )}
      </div>

      {files.length > 0 && (
        <>
          <ul className="file-list">
            {/* Folders */}
            {folders.map(folder => {
              const folderFiles = grouped[folder]
              const folderSize = folderFiles.reduce((sum, f) => sum + f.file.size, 0)
              const isExpanded = expandedFolders[folder]

              return (
                <li key={folder} className="folder-group">
                  <div
                    className="file-item file-item-folder"
                    onClick={() => toggleFolder(folder)}
                  >
                    <span className={`folder-chevron ${isExpanded ? 'expanded' : ''}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </span>
                    <span className="folder-icon">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/>
                      </svg>
                    </span>
                    <span className="file-name">{folder}</span>
                    <span className="file-size">{folderFiles.length} file{folderFiles.length > 1 ? 's' : ''} · {formatSize(folderSize)}</span>
                  </div>

                  {isExpanded && (
                    <ul className="folder-contents">
                      {folderFiles.map((item) => (
                        <li key={item.index} className="file-item file-item-nested">
                          <div className="file-info">
                            <span className="file-name">{item.shortName}</span>
                            <span className="file-size">{formatSize(item.file.size)}</span>
                          </div>
                          <button
                            className="file-remove"
                            onClick={(e) => { e.stopPropagation(); removeFile(item.index) }}
                            aria-label="Remove"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18"></line>
                              <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}

            {/* Root files */}
            {rootFiles.map((item) => (
              <li key={item.index} className="file-item">
                <div className="file-info">
                  <span className="file-name">{item.displayName}</span>
                  <span className="file-size">{formatSize(item.file.size)}</span>
                </div>
                <button
                  className="file-remove"
                  onClick={() => removeFile(item.index)}
                  aria-label="Remove"
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
            Bump {files.length} file{files.length > 1 ? 's' : ''} · {formatSize(totalSize)}
          </button>
        </>
      )}
    </div>
  )
}

export default UploadPage
