import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { API_BASE } from '../config'
import { formatSize, formatTimeRemaining } from '../utils'

function DownloadPage() {
  const { transferId } = useParams()
  const [transfer, setTransfer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedFolders, setExpandedFolders] = useState({})

  useEffect(() => {
    fetchTransfer()
  }, [transferId])

  const fetchTransfer = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/transfer/${transferId}`)

      if (response.status === 404) {
        setError('This transfer does not exist or has expired')
        setLoading(false)
        return
      }

      if (!response.ok) {
        throw new Error('Error loading transfer')
      }

      const data = await response.json()
      setTransfer(data)
    } catch (err) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const downloadFile = (fileName) => {
    window.location.href = `${API_BASE}/api/download/${transferId}/${encodeURIComponent(fileName)}`
  }

  const downloadAll = () => {
    transfer.files.forEach((file, index) => {
      setTimeout(() => {
        downloadFile(file.name)
      }, index * 500)
    })
  }

  const toggleFolder = (folderPath) => {
    setExpandedFolders(prev => ({ ...prev, [folderPath]: !prev[folderPath] }))
  }

  // Group files by top-level folder
  const groupFiles = (files) => {
    const groups = { __root: [] }

    files.forEach(file => {
      const parts = file.name.split('/')
      if (parts.length === 1) {
        groups.__root.push({ ...file, displayName: file.name })
      } else {
        const folder = parts[0]
        if (!groups[folder]) {
          groups[folder] = []
        }
        groups[folder].push({
          ...file,
          displayName: parts.slice(1).join('/'),
          shortName: parts[parts.length - 1]
        })
      }
    })

    return groups
  }

  if (loading) {
    return (
      <div className="download-page">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="download-page">
        <div className="error-state">
          <div className="error-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="13"></line>
              <circle cx="12" cy="16.5" r="0.5" fill="currentColor"></circle>
            </svg>
          </div>
          <h2>Oops!</h2>
          <p>{error}</p>
          <a href="/" className="btn-secondary">Create a new transfer</a>
        </div>
      </div>
    )
  }

  const totalSize = transfer.files.reduce((sum, f) => sum + f.size, 0)
  const grouped = groupFiles(transfer.files)
  const folders = Object.keys(grouped).filter(k => k !== '__root').sort()
  const rootFiles = grouped.__root

  return (
    <div className="download-page">
      <div className="download-header">
        <h2>{transfer.files.length} file{transfer.files.length > 1 ? 's' : ''}</h2>
        <p className="download-meta">
          {formatSize(totalSize)} · {formatTimeRemaining(transfer.expiresAt)}
        </p>
      </div>

      <ul className="file-list">
        {/* Folders */}
        {folders.map(folder => {
          const folderFiles = grouped[folder]
          const folderSize = folderFiles.reduce((sum, f) => sum + f.size, 0)
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
                  {folderFiles.map((file, index) => (
                    <li key={index} className="file-item file-item-download file-item-nested">
                      <div className="file-info">
                        <span className="file-name">{file.shortName}</span>
                        <span className="file-size">{formatSize(file.size)}</span>
                      </div>
                      <button
                        className="btn-download-single"
                        onClick={(e) => { e.stopPropagation(); downloadFile(file.name) }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
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
        {rootFiles.map((file, index) => (
          <li key={index} className="file-item file-item-download">
            <div className="file-info">
              <span className="file-name">{file.displayName}</span>
              <span className="file-size">{formatSize(file.size)}</span>
            </div>
            <button
              className="btn-download-single"
              onClick={() => downloadFile(file.name)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
          </li>
        ))}
      </ul>

      {transfer.files.length > 1 && (
        <button onClick={downloadAll} className="btn-primary">
          Download all
        </button>
      )}
    </div>
  )
}

export default DownloadPage
