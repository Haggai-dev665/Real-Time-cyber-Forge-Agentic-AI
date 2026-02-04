import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { Download } from './components/Download'
import { Capabilities } from './components/Capabilities'
import { RoleFeatures } from './components/RoleFeatures'
import { AgenticAI } from './components/AgenticAI'
import { Trust } from './components/Trust'
import { Footer } from './components/Footer'

function App() {
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

export default App
