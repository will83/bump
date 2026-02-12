import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { API_BASE } from '../config'
import { formatSize, formatTimeRemaining } from '../utils'

// Tree node component for download folder structure
function DownloadTreeNode({ folder, path, collapsed, toggleFolder, downloadFile, formatSize }) {
  const folderNames = Object.keys(folder.__folders).sort()
  const files = folder.__files

  return (
    <>
      {/* Render subfolders */}
      {folderNames.map(name => {
        const subFolder = folder.__folders[name]
        const fullPath = path ? `${path}/${name}` : name
        const isCollapsed = collapsed[fullPath]
        const fileCount = getFolderFileCount(subFolder)
        const folderSize = getFolderSize(subFolder)

        return (
          <div key={fullPath} className="tree-folder">
            <div
              className="tree-folder-header"
              onClick={() => toggleFolder(fullPath)}
            >
              <span className={`tree-chevron ${isCollapsed ? 'collapsed' : ''}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </span>
              <span className="tree-folder-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/>
                </svg>
              </span>
              <span className="tree-folder-name">{name}</span>
              <span className="tree-folder-meta">{fileCount} file{fileCount > 1 ? 's' : ''} · {formatSize(folderSize)}</span>
            </div>
            {!isCollapsed && (
              <div className="tree-folder-content">
                <DownloadTreeNode
                  folder={subFolder}
                  path={fullPath}
                  collapsed={collapsed}
                  toggleFolder={toggleFolder}
                  downloadFile={downloadFile}
                  formatSize={formatSize}
                />
              </div>
            )}
          </div>
        )
      })}

      {/* Render files at this level */}
      {files.map(({ file, name }) => (
        <div key={file.name} className="tree-file">
          <span className="tree-file-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </span>
          <span className="tree-file-name">{name}</span>
          <span className="tree-file-size">{formatSize(file.size)}</span>
          <button
            className="tree-file-download"
            onClick={() => downloadFile(file.name)}
            aria-label="Download"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
        </div>
      ))}
    </>
  )
}

// Helper functions for tree
function getFolderSize(folder) {
  let size = folder.__files.reduce((sum, f) => sum + f.file.size, 0)
  Object.values(folder.__folders).forEach(sub => {
    size += getFolderSize(sub)
  })
  return size
}

function getFolderFileCount(folder) {
  let count = folder.__files.length
  Object.values(folder.__folders).forEach(sub => {
    count += getFolderFileCount(sub)
  })
  return count
}

function buildTree(files) {
  const tree = { __files: [], __folders: {} }

  files.forEach((file) => {
    const parts = file.name.split('/')
    let current = tree

    for (let i = 0; i < parts.length - 1; i++) {
      const folder = parts[i]
      if (!current.__folders[folder]) {
        current.__folders[folder] = { __files: [], __folders: {} }
      }
      current = current.__folders[folder]
    }

    current.__files.push({ file, name: parts[parts.length - 1] })
  })

  return tree
}

function DownloadPage() {
  const { transferId } = useParams()
  const [transfer, setTransfer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [collapsed, setCollapsed] = useState({})

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

  const toggleFolder = (path) => {
    setCollapsed(prev => ({ ...prev, [path]: !prev[path] }))
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
  const fileTree = buildTree(transfer.files)
  const hasSubfolders = Object.keys(fileTree.__folders).length > 0

  return (
    <div className="download-page">
      <div className="download-header">
        <h2>{transfer.files.length} file{transfer.files.length > 1 ? 's' : ''}</h2>
        <p className="download-meta">
          {formatSize(totalSize)} · {formatTimeRemaining(transfer.expiresAt)}
        </p>
      </div>

      <div className="file-tree">
        <DownloadTreeNode
          folder={fileTree}
          path=""
          collapsed={collapsed}
          toggleFolder={toggleFolder}
          downloadFile={downloadFile}
          formatSize={formatSize}
        />
      </div>

      {transfer.files.length > 1 && (
        <button onClick={downloadAll} className="btn-primary">
          Download all
        </button>
      )}
    </div>
  )
}

export default DownloadPage
