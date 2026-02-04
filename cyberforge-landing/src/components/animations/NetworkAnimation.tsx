import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

interface Node {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  type: 'safe' | 'threat' | 'scanning'
}

interface Connection {
  from: number
  to: number
  active: boolean
}

export function NetworkAnimation() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes] = useState<Node[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!containerRef.current) return

    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return

    // Initialize nodes
    const nodeCount = 20
    const initialNodes: Node[] = Array.from({ length: nodeCount }, (_, i) => ({
      id: i,
      x: Math.random() * dimensions.width,
      y: Math.random() * dimensions.height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      type: i % 10 === 0 ? 'threat' : i % 5 === 0 ? 'scanning' : 'safe',
    }))
    setNodes(initialNodes)

    // Animation loop
    const animate = () => {
      setNodes((prevNodes) => {
        return prevNodes.map((node) => {
          let newX = node.x + node.vx
          let newY = node.y + node.vy
          let newVx = node.vx
          let newVy = node.vy

          // Bounce off walls
          if (newX < 0 || newX > dimensions.width) {
            newVx = -newVx
            newX = Math.max(0, Math.min(dimensions.width, newX))
          }
          if (newY < 0 || newY > dimensions.height) {
            newVy = -newVy
            newY = Math.max(0, Math.min(dimensions.height, newY))
          }

          return { ...node, x: newX, y: newY, vx: newVx, vy: newVy }
        })
      })
    }

    const interval = setInterval(animate, 50)
    return () => clearInterval(interval)
  }, [dimensions])

  // Update connections based on proximity
  useEffect(() => {
    const maxDistance = 150
    const newConnections: Connection[] = []

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x
        const dy = nodes[i].y - nodes[j].y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < maxDistance) {
          newConnections.push({
            from: i,
            to: j,
            active: nodes[i].type === 'threat' || nodes[j].type === 'threat',
          })
        }
      }
    }

    setConnections(newConnections)
  }, [nodes])

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <svg className="w-full h-full">
        {/* Connections */}
        {connections.map((conn, i) => {
          const fromNode = nodes[conn.from]
          const toNode = nodes[conn.to]
          if (!fromNode || !toNode) return null

          return (
            <line
              key={i}
              x1={fromNode.x}
              y1={fromNode.y}
              x2={toNode.x}
              y2={toNode.y}
              stroke={conn.active ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.1)'}
              strokeWidth={conn.active ? 2 : 1}
            />
          )
        })}

        {/* Nodes */}
        {nodes.map((node) => (
          <g key={node.id}>
            <circle
              cx={node.x}
              cy={node.y}
              r={node.type === 'threat' ? 6 : 4}
              fill={
                node.type === 'threat'
                  ? '#ef4444'
                  : node.type === 'scanning'
                  ? '#3b82f6'
                  : '#10b981'
              }
              opacity={node.type === 'threat' ? 1 : 0.6}
            />
            {node.type === 'threat' && (
              <motion.circle
                cx={node.x}
                cy={node.y}
                r={12}
                fill="none"
                stroke="#ef4444"
                strokeWidth={1}
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 1.5, opacity: 0 }}
                transition={{ repeat: Infinity, duration: 1 }}
              />
            )}
            {node.type === 'scanning' && (
              <motion.circle
                cx={node.x}
                cy={node.y}
                r={8}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={1}
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}
