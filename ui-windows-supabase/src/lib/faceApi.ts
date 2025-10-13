import { FaceResult, RecognizeResponse } from './faceStore'

const FACE_API_BASE_URL = process.env.NEXT_PUBLIC_FACE_API_BASE_URL || 'http://localhost:8000'

export async function recognizeFaces(imageBase64: string): Promise<RecognizeResponse> {
  const startTime = performance.now()
  const frameId = `frame_${startTime}`

  try {
    // Try the real API first since deepface is running
    console.log('🔍 Calling real face recognition API...')
    const response = await fetch('/api/face/recognize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: imageBase64,
        frameId
      })
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }

    const data = await response.json()
    const latency = performance.now() - startTime

    console.log('✅ Real API response:', data)

    return {
      frameId,
      latency_ms: latency,
      faces: data.faces || []
    }
  } catch (error) {
    console.warn('Face recognition API failed, using mock data:', error)
    const latency = performance.now() - startTime
    return createMockResponse(frameId, latency)
  }
}

export async function enrollFace(label: string, images: string[]): Promise<{
  success: boolean
  profiles_created: number
  error?: string
}> {
  try {
    if (!FACE_API_BASE_URL || FACE_API_BASE_URL === 'mock') {
      // Mock enrollment response
      return {
        success: true,
        profiles_created: images.length
      }
    }

    const response = await fetch('/api/face/enroll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        label,
        images
      })
    })

    if (!response.ok) {
      throw new Error(`Enrollment failed: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Face enrollment failed:', error)
    return {
      success: false,
      profiles_created: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Seeded random number generator for consistent results
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Mock face recognition for development
function createMockResponse(frameId: string, latency: number): RecognizeResponse {
  const mockFaces: FaceResult[] = []

  // Use frame timestamp as seed for consistent results per frame
  const seed = parseFloat(frameId.split('_')[1]) || 1000

  // Generate exactly 1 face for testing purposes
  const numFaces = 1

  for (let i = 0; i < numFaces; i++) {
    const emotions = ['happy', 'sad', 'angry', 'fear', 'surprise', 'neutral']
    const names = ['John Doe', 'Jane Smith', 'Alice Johnson', 'Bob Wilson', 'Carol Brown']

    const seedOffset = seed + i * 1000

    const dominantEmotion = emotions[Math.floor(seededRandom(seedOffset) * emotions.length)]
    const confidence = 0.6 + seededRandom(seedOffset + 100) * 0.4 // 60-100%
    const distance = seededRandom(seedOffset + 200) * 0.4 // 0-0.4 for cosine distance

    // Generate emotion scores
    const emotionScores: Record<string, number> = {}
    emotions.forEach((emotion, idx) => {
      if (emotion === dominantEmotion) {
        emotionScores[emotion] = confidence
      } else {
        emotionScores[emotion] = seededRandom(seedOffset + 300 + idx) * (1 - confidence) / emotions.length
      }
    })

    mockFaces.push({
      bbox: [
        seededRandom(seedOffset + 400) * 400, // x
        seededRandom(seedOffset + 500) * 300, // y
        100 + seededRandom(seedOffset + 600) * 100, // width
        120 + seededRandom(seedOffset + 700) * 100  // height
      ],
      identity: {
        user_id: `user_${i}`,
        label: names[Math.floor(seededRandom(seedOffset + 900) * names.length)],
        distance
      },
      emotion: {
        dominant: dominantEmotion,
        scores: emotionScores,
        confidence
      },
      spoof: seededRandom(seedOffset + 1000) > 0.95 // Very rare spoof detection
    })
  }

  return {
    frameId,
    latency_ms: latency,
    faces: mockFaces
  }
}

// Utility function to convert canvas to base64 JPEG
export function canvasToBase64(canvas: HTMLCanvasElement, quality: number = 0.8): string {
  return canvas.toDataURL('image/jpeg', quality)
}

// Utility function to downscale canvas to target width while maintaining aspect ratio
export function downscaleCanvas(
  sourceCanvas: HTMLCanvasElement,
  targetWidth: number = 640
): HTMLCanvasElement {
  const sourceCtx = sourceCanvas.getContext('2d')
  if (!sourceCtx) throw new Error('Could not get source canvas context')

  const aspectRatio = sourceCanvas.height / sourceCanvas.width
  const targetHeight = Math.round(targetWidth * aspectRatio)

  const targetCanvas = document.createElement('canvas')
  targetCanvas.width = targetWidth
  targetCanvas.height = targetHeight

  const targetCtx = targetCanvas.getContext('2d')
  if (!targetCtx) throw new Error('Could not get target canvas context')

  // Use high-quality scaling
  targetCtx.imageSmoothingEnabled = true
  targetCtx.imageSmoothingQuality = 'high'

  targetCtx.drawImage(
    sourceCanvas,
    0, 0, sourceCanvas.width, sourceCanvas.height,
    0, 0, targetWidth, targetHeight
  )

  return targetCanvas
}

// Utility function to capture frame from video element
export function captureVideoFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context')

  ctx.drawImage(video, 0, 0)
  return canvas
}

// Health check for face API
export async function checkFaceApiHealth(): Promise<boolean> {
  try {
    if (!FACE_API_BASE_URL || FACE_API_BASE_URL === 'mock') {
      return true // Mock API is always "healthy"
    }

    const response = await fetch(`${FACE_API_BASE_URL}/`, {
      method: 'GET',
      timeout: 5000
    } as RequestInit)

    return response.ok
  } catch (error) {
    console.warn('Face API health check failed:', error)
    return false
  }
}