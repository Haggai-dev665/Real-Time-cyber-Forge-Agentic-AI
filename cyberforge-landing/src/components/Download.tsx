import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Monitor, 
  Apple, 
  Smartphone, 
  Download as DownloadIcon,
  CheckCircle,
  Clock
} from 'lucide-react'

type OS = 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'unknown'

interface Platform {
  id: OS
  name: string
  icon: React.ReactNode
  available: boolean
  version: string
  size: string
  downloadUrl: string
}

const platforms: Platform[] = [
  {
    id: 'windows',
    name: 'Windows',
    icon: <Monitor className="w-8 h-8" />,
    available: true,
    version: '1.4.2',
    size: '85 MB',
    downloadUrl: '#download-windows',
  },
  {
    id: 'macos',
    name: 'macOS',
    icon: <Apple className="w-8 h-8" />,
    available: true,
    version: '1.4.2',
    size: '92 MB',
    downloadUrl: '#download-macos',
  },
  {
    id: 'linux',
    name: 'Linux',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489.117.779.567 1.563 1.334 2.16.762.597 1.863 1.079 3.375 1.34 2.248.406 5.007.178 7.543-.795 2.095-.803 3.926-2.063 4.932-3.695.494-.802.72-1.654.69-2.477-.024-.824-.363-1.63-.934-2.364-.56-.722-1.35-1.398-2.28-1.969-1.012-.622-2.131-1.123-3.219-1.48a8.47 8.47 0 0 1-.254-.08c.086-.65.119-1.325.062-1.996-.062-.699-.23-1.427-.584-2.083-.356-.66-.89-1.247-1.607-1.677-.726-.433-1.611-.693-2.635-.693zm.029 1.377c.802 0 1.41.186 1.867.463.459.277.773.64 1.003 1.052.234.413.357.854.418 1.287.062.436.062.857.03 1.262-.032.404-.095.79-.175 1.152-.082.358-.18.693-.276.998a10.67 10.67 0 0 0-.133.392c-.031.096-.05.155-.05.155l.167.062.378.129c.208.07.444.151.703.25.783.298 1.733.723 2.635 1.262.912.543 1.76 1.196 2.374 1.9.612.704.971 1.457.994 2.172.022.716-.195 1.404-.602 2.064-.814 1.318-2.338 2.479-4.295 3.227-2.366.906-5.07 1.114-7.23.721-1.431-.259-2.422-.708-3.09-1.23-.672-.522-1.04-1.103-1.14-1.71-.099-.599.029-1.255.274-1.945.493-1.38 1.57-3.004 2.483-4.08.912-1.076 1.163-2.109 1.26-3.428.12-1.641-.532-5.193 3.069-5.522.152-.012.31-.019.47-.019z" />
      </svg>
    ),
    available: true,
    version: '1.4.2',
    size: '78 MB',
    downloadUrl: '#download-linux',
  },
  {
    id: 'android',
    name: 'Android',
    icon: <Smartphone className="w-8 h-8" />,
    available: true,
    version: '1.2.0',
    size: '45 MB',
    downloadUrl: '#download-android',
  },
  {
    id: 'ios',
    name: 'iOS',
    icon: <Smartphone className="w-8 h-8" />,
    available: false,
    version: '-',
    size: '-',
    downloadUrl: '#',
  },
]

function detectOS(): OS {
  if (typeof window === 'undefined') return 'unknown'
  
  const userAgent = navigator.userAgent.toLowerCase()
  const platform = navigator.platform.toLowerCase()

  if (userAgent.includes('android')) return 'android'
  if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'ios'
  if (platform.includes('mac') || userAgent.includes('mac')) return 'macos'
  if (platform.includes('win') || userAgent.includes('win')) return 'windows'
  if (platform.includes('linux') || userAgent.includes('linux')) return 'linux'
  
  return 'unknown'
}

export function Download() {
  const [detectedOS, setDetectedOS] = useState<OS>('unknown')

  useEffect(() => {
    setDetectedOS(detectOS())
  }, [])

  const recommendedPlatform = platforms.find((p) => p.id === detectedOS)

  return (
    <section id="download" className="section-padding bg-cyber-900/30">
      <div className="container-section">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="heading-secondary text-white mb-4">
            Download CyberForge
          </h2>
          <p className="text-body max-w-2xl mx-auto">
            Get protected in under a minute. Select your platform and start 
            monitoring your digital environment immediately.
          </p>
        </motion.div>

        {/* Recommended Download */}
        {recommendedPlatform && recommendedPlatform.available && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-12"
          >
            <div className="max-w-xl mx-auto bg-cyber-800/50 border border-status-safe/30 rounded-2xl p-8 text-center relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="flex items-center gap-2 px-3 py-1 bg-status-safe/20 rounded-full"
                >
                  <span className="status-dot status-dot-active" />
                  <span className="text-xs font-medium text-status-safe">Recommended</span>
                </motion.div>
              </div>

              <div className="mb-4 text-status-safe">{recommendedPlatform.icon}</div>
              <h3 className="text-2xl font-bold text-white mb-2">
                CyberForge for {recommendedPlatform.name}
              </h3>
              <p className="text-cyber-400 mb-1">
                Version {recommendedPlatform.version} • {recommendedPlatform.size}
              </p>
              <p className="text-sm text-cyber-500 mb-6">
                Detected: You're running {recommendedPlatform.name}
              </p>

              <a href={recommendedPlatform.downloadUrl} className="btn-primary text-lg px-8 py-4">
                <DownloadIcon className="w-5 h-5" />
                Download for {recommendedPlatform.name}
              </a>
            </div>
          </motion.div>
        )}

        {/* All Platforms */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {platforms.map((platform, index) => (
            <motion.div
              key={platform.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <PlatformCard
                platform={platform}
                isRecommended={platform.id === detectedOS}
              />
            </motion.div>
          ))}
        </div>

        {/* System Requirements Note */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <p className="text-sm text-cyber-500">
            Minimum requirements: 4GB RAM, 100MB disk space. 
            Works with all modern browsers.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

function PlatformCard({ 
  platform, 
  isRecommended 
}: { 
  platform: Platform
  isRecommended: boolean 
}) {
  return (
    <motion.div
      whileHover={platform.available ? { scale: 1.02, y: -4 } : {}}
      className={`card ${platform.available ? 'card-hover cursor-pointer' : 'opacity-60'} 
        ${isRecommended ? 'border-status-safe/50 ring-1 ring-status-safe/20' : ''}`}
    >
      <div className="flex flex-col items-center text-center">
        <motion.div
          animate={isRecommended ? { scale: [1, 1.1, 1] } : {}}
          transition={{ repeat: Infinity, duration: 2 }}
          className={`mb-4 ${isRecommended ? 'text-status-safe' : 'text-cyber-400'}`}
        >
          {platform.icon}
        </motion.div>
        
        <h3 className="font-semibold text-white mb-1">{platform.name}</h3>
        
        {platform.available ? (
          <>
            <p className="text-xs text-cyber-500 mb-3">v{platform.version}</p>
            <div className="flex items-center gap-1 text-status-safe text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>Available</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1 text-cyber-500 text-sm mt-2">
            <Clock className="w-4 h-4" />
            <span>Coming Soon</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
