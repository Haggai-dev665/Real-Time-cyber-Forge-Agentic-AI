import Head from 'next/head'
import { motion } from 'framer-motion'
import { 
  ShieldCheckIcon, 
  CpuChipIcon, 
  EyeIcon, 
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  CloudIcon
} from '@heroicons/react/24/outline'

import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Features from '../components/Features'
import HowItWorks from '../components/HowItWorks'
import Download from '../components/Download'
import Footer from '../components/Footer'

export default function Home() {
  return (
    <>
      <Head>
        <title>Cyber Forge AI - Real-Time Security Analysis</title>
        <meta name="description" content="Advanced cybersecurity platform with AI-powered threat detection and real-time browser monitoring" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <meta property="og:title" content="Cyber Forge AI - Real-Time Security Analysis" />
        <meta property="og:description" content="Protect your digital life with AI-powered cybersecurity monitoring" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <div className="min-h-screen bg-cyber-gradient">
        <Navbar />
        <Hero />
        <Features />
        <HowItWorks />
        <Download />
        <Footer />
      </div>
    </>
  )
}