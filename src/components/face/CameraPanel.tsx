'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Camera, CameraOff, RotateCcw, Pause, Play, AlertCircle, CheckCircle2, User, Smile } from 'lucide-react'
import { FaceStatusBadge } from './FaceStatusBadge'

interface FaceDetectionResult {
  recognized_user: string | null
  dominant_emotion: string
  confidence: number
  emotion_scores: Record<string, number>
  distance?: number
}

interface ConsentDialogProps {
  open: boolean
  onConsent: () => void
  onDecline: () => void
}

const ConsentDialog = ({ open, onConsent, onDecline }: ConsentDialogProps) => (
  <Dialog open={open}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Camera Permission Request
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">Face Recognition & Emotion Detection</h4>
              <p className="text-sm text-blue-700 mt-1">
                We need access to your camera to:
              </p>
              <ul className="text-sm text-blue-700 mt-2 list-disc list-inside space-y-1">
                <li>Recognize your identity for personalized experience</li>
                <li>Detect emotions for care and wellbeing monitoring</li>
                <li>Capture frames every {process.env.NEXT_PUBLIC_CAMERA_INTERVAL_MS || 5000}ms for analysis</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900">Privacy Information</h4>
          <p className="text-sm text-gray-600 mt-1">
            • Video frames are processed locally and securely<br/>
            • Only analysis results (emotions, identity) are stored<br/>
            • You can pause or stop recording at any time<br/>
            • No video recordings are permanently stored
          </p>
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onDecline}>
            Decline
          </Button>
          <Button onClick={onConsent} className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Allow Camera Access
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
)

export const CameraPanel = () => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [showConsent, setShowConsent] = useState(false)
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('')
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([])
  const [lastResult, setLastResult] = useState<FaceDetectionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [detectedFaces, setDetectedFaces] = useState<Array<{
    bbox?: number[];
    identity?: { label: string; user_id: string; distance: number };
    emotion?: { dominant: string; confidence: number; scores: Record<string, number> };
    spoof?: boolean;
  }>>([])

  const CAPTURE_INTERVAL = parseInt(process.env.NEXT_PUBLIC_CAMERA_INTERVAL_MS || '1000') // More frequent like your friend's code

  const drawFaceOverlays = useCallback(() => {
    if (!videoRef.current || !overlayCanvasRef.current) {
      console.log('🚫 Missing video or canvas refs')
      return
    }

    if (!detectedFaces.length) {
      console.log('🚫 No faces to draw')
      // Clear the canvas when no faces
      const canvas = overlayCanvasRef.current
      const context = canvas.getContext('2d')
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height)
      }
      return
    }

    console.log(`🎨 Drawing overlays for ${detectedFaces.length} face(s)`)

    const video = videoRef.current
    const canvas = overlayCanvasRef.current
    const context = canvas.getContext('2d')

    if (!context || video.videoWidth === 0) {
      console.log('🚫 No context or video not ready')
      return
    }

    // Set canvas size to match video
    canvas.width = video.offsetWidth
    canvas.height = video.offsetHeight

    // Clear previous drawings
    context.clearRect(0, 0, canvas.width, canvas.height)

    // Scale factor from processed image (640px) to actual video size, then to canvas
    const processedWidth = 640
    const processedHeight = video.videoHeight * (640 / video.videoWidth)
    const videoToCanvasScaleX = canvas.width / video.videoWidth
    const videoToCanvasScaleY = canvas.height / video.videoHeight
    const processedToVideoScaleX = video.videoWidth / processedWidth
    const processedToVideoScaleY = video.videoHeight / processedHeight

    detectedFaces.forEach((face, index) => {
      console.log(`🎯 Processing face ${index + 1}:`, face)

      if (face.bbox) {
        const [x, y, width, height] = face.bbox
        console.log(`📦 Original bbox: [${x}, ${y}, ${width}, ${height}]`)

        // Scale coordinates from processed image to actual video, then to canvas
        const videoX = x * processedToVideoScaleX
        const videoY = y * processedToVideoScaleY
        const videoWidth = width * processedToVideoScaleX
        const videoHeight = height * processedToVideoScaleY

        const scaledX = videoX * videoToCanvasScaleX
        const scaledY = videoY * videoToCanvasScaleY
        const scaledWidth = videoWidth * videoToCanvasScaleX
        const scaledHeight = videoHeight * videoToCanvasScaleY

        console.log(`📐 Scaled bbox: [${scaledX.toFixed(1)}, ${scaledY.toFixed(1)}, ${scaledWidth.toFixed(1)}, ${scaledHeight.toFixed(1)}]`)

        // Draw green rectangle (like your friend's code)
        context.strokeStyle = '#00ff00'
        context.lineWidth = 3
        context.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight)

        // Draw label background
        const label = face.identity ?
          `${face.identity.label} (${face.emotion?.dominant}) ${((face.emotion?.confidence || 0) * 100).toFixed(0)}%` :
          `${face.emotion?.dominant} ${((face.emotion?.confidence || 0) * 100).toFixed(0)}%`

        context.font = '16px Arial'
        const labelMetrics = context.measureText(label)
        const labelHeight = 20
        const labelY = scaledY > labelHeight ? scaledY - 5 : scaledY + scaledHeight + labelHeight

        // Label background
        context.fillStyle = '#00ff00'
        context.fillRect(scaledX, labelY - labelHeight, labelMetrics.width + 10, labelHeight)

        // Label text
        context.fillStyle = '#000000'
        context.fillText(label, scaledX + 5, labelY - 5)

        console.log(`✅ Drew green box and label: "${label}"`)
      } else {
        console.log(`❌ Face ${index + 1} has no bbox`)
      }
    })
  }, [detectedFaces])

  const getAvailableDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      setAvailableDevices(videoDevices)
      if (videoDevices.length > 0 && !currentDeviceId) {
        setCurrentDeviceId(videoDevices[0].deviceId)
      }
    } catch (err) {
      console.error('Failed to get devices:', err)
      setError('Failed to enumerate camera devices')
    }
  }, [currentDeviceId])

  const startCamera = useCallback(async (deviceId?: string) => {
    try {
      setError(null)

      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: deviceId ? undefined : 'user'
        }
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(mediaStream)

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        await videoRef.current.play()
      }

      await getAvailableDevices()
      setIsRecording(true)
      startProcessing()
    } catch (err) {
      console.error('Failed to start camera:', err)
      setError('Failed to access camera. Please check permissions.')
    }
  }, [stream, getAvailableDevices])

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsRecording(false)
    setIsPaused(false)
    setLastResult(null)
    setDetectedFaces([])
  }, [stream])

  const captureFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isPaused || isProcessing) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context || video.videoWidth === 0) return

    try {
      setIsProcessing(true)

      // Set canvas size and scale down to 640px width
      const scale = 640 / video.videoWidth
      canvas.width = 640
      canvas.height = video.videoHeight * scale

      // Draw and capture frame
      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Convert to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.8)
      })

      // Send to recognition API
      const formData = new FormData()
      formData.append('image', blob, 'frame.jpg')

      const response = await fetch('/api/face/recognize', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const result = await response.json()
        console.log('🔍 Face detection result:', result)
        setLastResult(result)
        setError(null)

        // Store detected faces for overlay drawing
        if (result.faces && result.faces.length > 0) {
          console.log(`✅ ${result.faces.length} face(s) detected, drawing overlays`)
          setDetectedFaces(result.faces)
        } else {
          console.log('❌ No faces detected in current frame')
          setDetectedFaces([])
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Recognition failed:', errorData)
        setError(errorData.error || 'Recognition failed')
        setDetectedFaces([])
      }
    } catch (err) {
      console.error('Frame capture failed:', err)
      setError('Frame capture failed')
    } finally {
      setIsProcessing(false)
    }
  }, [isPaused, isProcessing])

  const startProcessing = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    intervalRef.current = setInterval(() => {
      captureFrame()
    }, CAPTURE_INTERVAL)

    // Capture first frame immediately
    setTimeout(captureFrame, 1000)
  }, [captureFrame, CAPTURE_INTERVAL])

  const togglePause = useCallback(() => {
    if (isPaused) {
      setIsPaused(false)
      startProcessing()
    } else {
      setIsPaused(true)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isPaused, startProcessing])

  const switchCamera = useCallback(async () => {
    if (availableDevices.length <= 1) return

    const currentIndex = availableDevices.findIndex(device => device.deviceId === currentDeviceId)
    const nextIndex = (currentIndex + 1) % availableDevices.length
    const nextDevice = availableDevices[nextIndex]

    setCurrentDeviceId(nextDevice.deviceId)
    await startCamera(nextDevice.deviceId)
  }, [availableDevices, currentDeviceId, startCamera])

  const handleCameraRequest = useCallback(() => {
    setShowConsent(true)
  }, [])

  const handleConsent = useCallback(() => {
    setShowConsent(false)
    startCamera()
  }, [startCamera])

  const handleDecline = useCallback(() => {
    setShowConsent(false)
    setError('Camera access required for face recognition')
  }, [])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  // Redraw overlays when faces are detected
  useEffect(() => {
    drawFaceOverlays()
  }, [detectedFaces, drawFaceOverlays])

  // Redraw overlays when video resizes
  useEffect(() => {
    const handleResize = () => {
      drawFaceOverlays()
    }

    if (videoRef.current) {
      videoRef.current.addEventListener('loadedmetadata', handleResize)
      window.addEventListener('resize', handleResize)

      return () => {
        videoRef.current?.removeEventListener('loadedmetadata', handleResize)
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [drawFaceOverlays])

  return (
    <>
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Face Recognition Camera
            {isRecording && (
              <Badge variant="destructive" className="ml-2 animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full mr-1" />
                {isPaused ? 'PAUSED' : 'RECORDING'}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {lastResult && (
            <FaceStatusBadge
              recognizedUser={lastResult.recognized_user}
              dominantEmotion={lastResult.dominant_emotion}
              confidence={lastResult.confidence}
              emotionScores={lastResult.emotion_scores}
            />
          )}

          <div className="relative bg-gray-100 rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              className="w-full max-h-96 object-cover"
              playsInline
              muted
            />
            <canvas
              ref={overlayCanvasRef}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{ zIndex: 10 }}
            />
            <canvas ref={canvasRef} className="hidden" />

            {isProcessing && (
              <div className="absolute top-2 right-2">
                <Badge variant="secondary" className="animate-pulse">
                  Processing...
                </Badge>
              </div>
            )}

            {!stream && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                <div className="text-center">
                  <Camera className="h-16 w-16 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-4">Camera access required</p>
                  <Button onClick={handleCameraRequest}>
                    Start Camera
                  </Button>
                </div>
              </div>
            )}
          </div>

          {stream && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={isRecording && !isPaused ? "destructive" : "default"}
                onClick={isRecording ? stopCamera : () => startCamera()}
              >
                {isRecording ? (
                  <>
                    <CameraOff className="h-4 w-4 mr-2" />
                    Stop
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 mr-2" />
                    Start
                  </>
                )}
              </Button>

              {isRecording && (
                <Button variant="outline" onClick={togglePause}>
                  {isPaused ? (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </>
                  )}
                </Button>
              )}

              {availableDevices.length > 1 && (
                <Button variant="outline" onClick={switchCamera}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Switch Camera
                </Button>
              )}

              <div className="text-sm text-gray-500">
                Capture interval: {CAPTURE_INTERVAL}ms
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConsentDialog
        open={showConsent}
        onConsent={handleConsent}
        onDecline={handleDecline}
      />
    </>
  )
}