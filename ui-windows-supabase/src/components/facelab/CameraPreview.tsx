'use client'

import { useRef, useEffect, useState } from 'react'
import { useFaceStore } from '@/lib/faceStore'
import { recognizeFaces, captureVideoFrame, downscaleCanvas, canvasToBase64 } from '@/lib/faceApi'
import { OverlayCanvas } from './OverlayCanvas'
import { Button } from '@/components/ui/button'
import { Video, VideoOff, RotateCcw, TestTube } from 'lucide-react'
import { toast } from 'sonner'

export function CameraPreview() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [testResults, setTestResults] = useState<{
    originalImage: string
    detectedImage: string
    faces: Array<{ bbox?: number[]; emotion?: { dominant: string; confidence: number } }>
  } | null>(null)

  const {
    zoom,
    cameraInterval,
    updateFaceResults,
    updateFps,
    recording
  } = useFaceStore()

  // Frame capture interval
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const frameCountRef = useRef(0)
  const lastFpsUpdateRef = useRef(0)

  // Start camera
  const startCamera = async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setIsStreaming(true)
        startFrameCapture()
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera'
      setError(errorMessage)
      toast.error('Camera Error', { description: errorMessage })
    }
  }

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    setIsStreaming(false)
    stopFrameCapture()
  }

  // Frame capture and processing
  const startFrameCapture = () => {
    if (intervalRef.current) return

    console.log('🎬 Starting frame capture interval...')

    intervalRef.current = setInterval(async () => {
      console.log('⏰ Frame capture interval triggered', {
        hasVideo: !!videoRef.current,
        isStreaming,
        isProcessing,
        videoReady: videoRef.current?.readyState === 4
      })

      if (!videoRef.current || !isStreaming || isProcessing) return

      console.log('📸 Processing frame...')
      setIsProcessing(true)

      try {
        // Capture frame
        const canvas = captureVideoFrame(videoRef.current)

        // Downscale for API call
        const downscaled = downscaleCanvas(canvas, 640)
        const base64Image = canvasToBase64(downscaled, 0.8)

        // Call recognition API
        const startTime = Date.now()
        console.log('🔍 Calling face recognition API...', { frameSize: base64Image.length })
        const results = await recognizeFaces(base64Image)
        const latency = Date.now() - startTime

        console.log('✅ Face recognition response:', {
          faces: results.faces.length,
          latency,
          facesData: results.faces.map(f => ({
            bbox: f.bbox,
            label: f.identity?.label,
            emotion: f.emotion.dominant
          }))
        })

        // Update store with results
        updateFaceResults(results.faces, latency)

        console.log('📊 Store updated, current people count:', useFaceStore.getState().peopleMap.size)

        // Update FPS counter
        frameCountRef.current++
        const now = Date.now()
        if (lastFpsUpdateRef.current === 0) {
          lastFpsUpdateRef.current = now
        }
        if (now - lastFpsUpdateRef.current >= 2000) {
          const fps = Math.round((frameCountRef.current * 1000) / (now - lastFpsUpdateRef.current))
          updateFps(fps)
          frameCountRef.current = 0
          lastFpsUpdateRef.current = now
        }

      } catch (err) {
        console.error('Frame processing error:', err)
        toast.error('Processing Error', {
          description: 'Failed to process video frame'
        })
      } finally {
        setIsProcessing(false)
      }
    }, cameraInterval)
  }

  const stopFrameCapture = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  // Test function: capture frame and run detection
  const runDetectionTest = async () => {
    if (!videoRef.current || !isStreaming) {
      toast.error('Camera not ready')
      return
    }

    try {
      setIsProcessing(true)
      const video = videoRef.current

      // Create canvas to capture frame
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')!

      // Draw current video frame
      ctx.drawImage(video, 0, 0)

      // Get original image as base64
      const originalImageData = canvas.toDataURL('image/jpeg', 0.8)

      // Convert to base64 for API (ensure JPEG format without alpha)
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.8)

      console.log('🧪 Running detection test...')
      console.log('📸 Captured frame:', canvas.width, 'x', canvas.height)

      // Run face detection
      const results = await recognizeFaces(imageBase64)
      console.log('🔍 Detection results:', results)

      // Create detected image with green boxes
      const detectedCanvas = document.createElement('canvas')
      detectedCanvas.width = canvas.width
      detectedCanvas.height = canvas.height
      const detectedCtx = detectedCanvas.getContext('2d')!

      // Draw original image
      detectedCtx.drawImage(canvas, 0, 0)

      // Draw green boxes
      if (results.faces && results.faces.length > 0) {
        detectedCtx.strokeStyle = '#00ff00'
        detectedCtx.lineWidth = 3
        detectedCtx.font = '16px Arial'
        detectedCtx.fillStyle = '#00ff00'

        results.faces.forEach((face, index) => {
          if (face.bbox) {
            const [x, y, w, h] = face.bbox
            console.log(`📦 Drawing box ${index + 1}: [${x}, ${y}, ${w}, ${h}]`)

            // Draw rectangle
            detectedCtx.strokeRect(x, y, w, h)

            // Draw label
            const label = `Face ${index + 1}: ${face.emotion?.dominant || 'unknown'}`
            const labelY = y > 20 ? y - 5 : y + h + 20

            // Label background
            const labelMetrics = detectedCtx.measureText(label)
            detectedCtx.fillRect(x, labelY - 15, labelMetrics.width + 10, 20)

            // Label text
            detectedCtx.fillStyle = '#000000'
            detectedCtx.fillText(label, x + 5, labelY)
            detectedCtx.fillStyle = '#00ff00'
          }
        })
      }

      const detectedImageData = detectedCanvas.toDataURL('image/jpeg', 0.8)

      // Store results
      setTestResults({
        originalImage: originalImageData,
        detectedImage: detectedImageData,
        faces: results.faces || []
      })

      console.log('✅ Test completed, found', results.faces?.length || 0, 'faces')
      toast.success(`Detection test completed! Found ${results.faces?.length || 0} faces`)

    } catch (error) {
      console.error('❌ Test failed:', error)
      toast.error('Detection test failed')
    } finally {
      setIsProcessing(false)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
      stopFrameCapture()
    }
  }, [])

  // Restart capture when interval changes
  useEffect(() => {
    if (isStreaming) {
      stopFrameCapture()
      startFrameCapture()
    }
  }, [cameraInterval])

  const handleToggleCamera = () => {
    if (isStreaming) {
      stopCamera()
    } else {
      startCamera()
    }
  }

  return (
    <div className="space-y-4">
      {/* Camera Controls */}
      <div className="flex gap-2 justify-center">
        <Button
          onClick={handleToggleCamera}
          variant={isStreaming ? 'destructive' : 'default'}
          size="sm"
        >
          {isStreaming ? (
            <>
              <VideoOff className="w-4 h-4 mr-2" />
              Stop Camera
            </>
          ) : (
            <>
              <Video className="w-4 h-4 mr-2" />
              Start Camera
            </>
          )}
        </Button>

        {isStreaming && (
          <>
            <Button
              onClick={() => {
                stopCamera()
                setTimeout(startCamera, 100)
              }}
              variant="outline"
              size="sm"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restart
            </Button>

            <Button
              onClick={runDetectionTest}
              variant="outline"
              size="sm"
              disabled={isProcessing}
            >
              <TestTube className="w-4 h-4 mr-2" />
              {isProcessing ? 'Testing...' : 'Test Detection'}
            </Button>
          </>
        )}
      </div>

      {/* Video Container */}
      <div
        ref={containerRef}
        className="relative bg-black rounded-lg overflow-hidden aspect-video max-w-full mx-auto"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'center'
        }}
      >
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900/20">
            <div className="text-center text-red-400">
              <p className="font-medium">Camera Error</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {!isStreaming && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center text-gray-400">
              <Video className="w-12 h-12 mx-auto mb-2" />
              <p>Camera not started</p>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />

        {/* Face Detection Overlay */}
        {isStreaming && videoRef.current && (
          <OverlayCanvas
            videoElement={videoRef.current}
            className="absolute inset-0 pointer-events-none"
          />
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded text-xs">
            Processing...
          </div>
        )}

        {/* Recording Indicator */}
        {recording && (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs flex items-center">
            <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></div>
            REC
          </div>
        )}
      </div>

      {/* Test Results */}
      {testResults && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Detection Test Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Original Image */}
            <div>
              <h4 className="text-sm font-medium mb-2">Original Image</h4>
              <img
                src={testResults.originalImage}
                alt="Original"
                className="w-full border rounded-lg"
              />
            </div>

            {/* Detected Image */}
            <div>
              <h4 className="text-sm font-medium mb-2">
                Detected Results ({testResults.faces.length} faces)
              </h4>
              <img
                src={testResults.detectedImage}
                alt="Detected"
                className="w-full border rounded-lg"
              />
            </div>
          </div>

          {/* Face Details */}
          {testResults.faces.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Face Details</h4>
              <div className="space-y-2">
                {testResults.faces.map((face, index) => (
                  <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                    <strong>Face {index + 1}:</strong>
                    {face.bbox && ` Bbox: [${face.bbox.join(', ')}]`}
                    {face.emotion && ` Emotion: ${face.emotion.dominant} (${(face.emotion.confidence * 100).toFixed(1)}%)`}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clear Button */}
          <Button
            onClick={() => setTestResults(null)}
            variant="outline"
            size="sm"
            className="mt-4"
          >
            Clear Results
          </Button>
        </div>
      )}
    </div>
  )
}