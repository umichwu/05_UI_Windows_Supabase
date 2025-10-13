import { NextRequest, NextResponse } from 'next/server'

const FACE_API_BASE_URL = process.env.FACE_API_BASE_URL

interface AnalysisResponse {
  success: boolean
  emotion_scores: Record<string, number>
  dominant_emotion: string
  confidence: number
  face_detected: boolean
  age?: number
  gender?: string
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const image = formData.get('image') as File

    if (!image) {
      return NextResponse.json(
        { error: 'Image is required' },
        { status: 400 }
      )
    }

    let analysisResult: AnalysisResponse

    if (FACE_API_BASE_URL) {
      // Call real face API service
      const apiFormData = new FormData()
      apiFormData.append('image', image)

      const response = await fetch(`${FACE_API_BASE_URL}/analyze`, {
        method: 'POST',
        body: apiFormData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Face API analysis failed')
      }

      analysisResult = await response.json()
    } else {
      // Mock response for development
      console.log('Using mock face analysis (FACE_API_BASE_URL not set)')

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 300))

      // Generate mock emotion scores
      const emotions = ['angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral']
      const mockEmotionScores: Record<string, number> = {}
      let total = 0

      emotions.forEach(emotion => {
        const score = Math.random()
        mockEmotionScores[emotion] = score
        total += score
      })

      // Normalize scores to sum to 1
      Object.keys(mockEmotionScores).forEach(emotion => {
        mockEmotionScores[emotion] = mockEmotionScores[emotion] / total
      })

      // Find dominant emotion
      const dominantEmotion = Object.entries(mockEmotionScores)
        .reduce((a, b) => a[1] > b[1] ? a : b)[0]

      analysisResult = {
        success: true,
        emotion_scores: mockEmotionScores,
        dominant_emotion: dominantEmotion,
        confidence: mockEmotionScores[dominantEmotion],
        face_detected: Math.random() > 0.1, // 90% chance of face detection
        age: Math.floor(Math.random() * 50) + 20, // Age between 20-70
        gender: Math.random() > 0.5 ? 'male' : 'female'
      }
    }

    return NextResponse.json(analysisResult)

  } catch (error) {
    console.error('Face analysis error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Face analysis failed',
        success: false
      },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'