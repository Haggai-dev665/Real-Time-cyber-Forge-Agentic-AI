import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { Download } from './components/Download'
import { Capabilities } from './components/Capabilities'
import { RoleFeatures } from './components/RoleFeatures'
import { AgenticAI } from './components/AgenticAI'
import { Trust } from './components/Trust'
import { Footer } from './components/Footer'
import { 
  Documentation, 
  Changelog, 
  ApiReference, 
  SecurityBlog, 
  ThreatResearch, 
  About, 
  OpenSource, 
  Privacy, 
  Terms 
} from './pages'

function HomePage() {
  return (
    <div className="min-h-screen bg-cyber-950 bg-grid">
      <Header />
      <main>
        <Hero />
        <Download />
        <Capabilities />
        <RoleFeatures />
        <AgenticAI />
        <Trust />
      </main>
      <Footer />
    </div>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/docs" element={<Documentation />} />
        <Route path="/changelog" element={<Changelog />} />
        <Route path="/api" element={<ApiReference />} />
        <Route path="/blog" element={<SecurityBlog />} />
        <Route path="/research" element={<ThreatResearch />} />
        <Route path="/about" element={<About />} />
        <Route path="/open-source" element={<OpenSource />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
      </Routes>
    </Router>
  )
}

export default App
