import { Routes, Route } from 'react-router-dom'
import UploadPage from './pages/UploadPage'
import DownloadPage from './pages/DownloadPage'

function App() {
  return (
    <div className="app">
      <header className="header">
        <a href="/" className="logo">
          bump<span className="logo-dot">.</span>
        </a>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/d/:transferId" element={<DownloadPage />} />
        </Routes>
      </main>
      <footer className="footer">
        <p>Fichiers supprimés automatiquement après 7 jours</p>
      </footer>
    </div>
  )
}

export default App
