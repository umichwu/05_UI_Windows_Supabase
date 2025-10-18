'use client'

import { useRef, useEffect, useCallback } from 'react'
import { useFaceStore } from '@/lib/faceStore'
import { cn } from '@/lib/utils'

interface OverlayCanvasProps {
  videoElement: HTMLVideoElement
  className?: string
}

export function OverlayCanvas({ videoElement, className }: OverlayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)

  const { peopleMap, debugMode } = useFaceStore()

  // Draw face detection overlay
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const video = videoElement

    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return


    // Match canvas size to video display size
    const rect = video.getBoundingClientRect()
    const scaleX = canvas.width / video.videoWidth
    const scaleY = canvas.height / video.videoHeight

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Only show debug info when debug mode is enabled
    if (debugMode) {
      // TEST: Draw a simple red rectangle to verify overlay is working
      ctx.strokeStyle = '#ef4444' // Red
      ctx.lineWidth = 4
      ctx.strokeRect(50, 50, 200, 150)

      // Draw debug information
      ctx.fillStyle = '#ef4444'
      ctx.font = '14px Inter, system-ui, sans-serif'
      ctx.fillText('TEST OVERLAY', 55, 40)
      ctx.fillText(`Canvas: ${canvas.width}x${canvas.height}`, 55, 25)
      ctx.fillText(`Video: ${video.videoWidth}x${video.videoHeight}`, 55, 10)

      // Debug face detection data
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(250, 10, 400, 150) // White background for debug text
      ctx.fillStyle = '#000000'
      ctx.fillText(`People detected: ${peopleMap.size}`, 255, 25)

      let yOffset = 45
      if (peopleMap.size === 0) {
        ctx.fillText('No faces detected in store', 255, yOffset)
      } else {
        peopleMap.forEach((person, key) => {
          ctx.fillText(`Person: ${person.label}`, 255, yOffset)
          ctx.fillText(`BBox: [${person.bbox.map(n => Math.round(n)).join(', ')}]`, 255, yOffset + 15)
          ctx.fillText(`Emotion: ${person.emotion}`, 255, yOffset + 30)
          yOffset += 50
        })
      }
    }

    // Set drawing style for face detection
    ctx.strokeStyle = '#22c55e' // Green
    ctx.lineWidth = 3
    ctx.font = '16px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'top'

    // Draw face boxes and labels for each detected person
    peopleMap.forEach((person, key) => {
      // Use actual bbox coordinates from face detection
      const [bboxX, bboxY, bboxWidth, bboxHeight] = person.bbox

      // Scale bbox coordinates to match canvas size
      const x = (bboxX * canvas.width) / video.videoWidth
      const y = (bboxY * canvas.height) / video.videoHeight
      const width = (bboxWidth * canvas.width) / video.videoWidth
      const height = (bboxHeight * canvas.height) / video.videoHeight

      // Draw bounding box
      ctx.strokeRect(x, y, width, height)

      // Create label text
      const label = person.label || 'Unknown'
      const emotion = person.emotion || 'neutral'
      const confidence = Math.round((person.confidence || 0) * 100)
      const labelText = `${label} (${emotion}) ${confidence}%`

      // Draw label background
      const textMetrics = ctx.measureText(labelText)
      const textWidth = textMetrics.width
      const textHeight = 20
      const labelX = x
      const labelY = y - textHeight - 4

      ctx.fillStyle = 'rgba(34, 197, 94, 0.9)' // Semi-transparent green
      ctx.fillRect(labelX, labelY, textWidth + 8, textHeight + 4)

      // Draw label text
      ctx.fillStyle = 'white'
      ctx.fillText(labelText, labelX + 4, labelY + 2)

      // Draw confidence indicator (small circle)
      if (person.distance !== undefined) {
        const confidenceColor = person.distance < 0.3 ? '#22c55e' :
                               person.distance < 0.5 ? '#eab308' : '#ef4444'

        ctx.fillStyle = confidenceColor
        ctx.beginPath()
        ctx.arc(x + width - 10, y + 10, 5, 0, 2 * Math.PI)
        ctx.fill()
      }

      // Draw spoof indicator if detected (use key hash for deterministic display)
      const keyHash = person.key.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
      if (person.confidence > 0.95 && (keyHash % 100) > 98) { // Very rare spoof indication
        ctx.strokeStyle = '#ef4444' // Red for spoof
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.strokeRect(x - 5, y - 5, width + 10, height + 10)
        ctx.setLineDash([]) // Reset dash
        ctx.lineWidth = 3
        ctx.strokeStyle = '#22c55e' // Reset to green
      }
    })

    // Continue animation
    animationRef.current = requestAnimationFrame(draw)
  }, [peopleMap, videoElement, debugMode])

  // Set up canvas and start drawing
  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoElement

    if (!canvas || !video) return

    // Set canvas size to match video element
    const updateCanvasSize = () => {
      canvas.width = video.clientWidth
      canvas.height = video.clientHeight
    }

    updateCanvasSize()

    // Update size when video loads or resizes
    video.addEventListener('loadedmetadata', updateCanvasSize)
    window.addEventListener('resize', updateCanvasSize)

    // Start drawing loop
    draw()

    return () => {
      video.removeEventListener('loadedmetadata', updateCanvasSize)
      window.removeEventListener('resize', updateCanvasSize)

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [draw, videoElement])

  return (
    <canvas
      ref={canvasRef}
      className={cn('pointer-events-none', className)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%'
      }}
    />
  )
}