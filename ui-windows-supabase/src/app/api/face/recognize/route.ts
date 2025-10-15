import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/types'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const FACE_API_BASE_URL = process.env.FACE_API_BASE_URL

interface RecognitionResponse {
  success: boolean
  recognized_user: string | null
  distance?: number
  dominant_emotion: string
  emotion_scores: Record<string, number>
  confidence: number
  is_spoof?: boolean
  embedding?: number[]
  bbox?: number[]
}

export async function POST(request: NextRequest) {
  try {
    // Get current user (optional for recognition)
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    let currentUserId: string | null = null
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token)
      currentUserId = user?.id || null
    }

    // Handle both JSON and FormData requests
    let image: File | string | null = null
    let frameId: string = `frame_${Date.now()}`

    const contentType = request.headers.get('content-type')

    if (contentType?.includes('application/json')) {
      // JSON request from frontend with base64 image
      const body = await request.json()
      image = body.image
      frameId = body.frameId || frameId

      if (!image) {
        return NextResponse.json(
          { error: 'Image is required' },
          { status: 400 }
        )
      }
    } else {
      // FormData request
      const formData = await request.formData()
      image = formData.get('image') as File

      if (!image) {
        return NextResponse.json(
          { error: 'Image is required' },
          { status: 400 }
        )
      }
    }

    let recognitionResult: RecognitionResponse

    if (FACE_API_BASE_URL) {
      // Call real face API service
      const apiFormData = new FormData()

      if (typeof image === 'string') {
        // Convert base64 to blob for Face API
        const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')
        const blob = new Blob([buffer], { type: 'image/jpeg' })
        apiFormData.append('image', blob, 'image.jpg')
      } else {
        // File object
        apiFormData.append('image', image)
      }

      const response = await fetch(`${FACE_API_BASE_URL}/recognize`, {
        method: 'POST',
        body: apiFormData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Face API recognition failed')
      }

      recognitionResult = await response.json()
    } else {
      // Use Python DeepFace script for actual face detection
      console.log('Using Python DeepFace script for face detection')

      try {
        const { exec } = await import('child_process')
        const { promisify } = await import('util')
        const execAsync = promisify(exec)

        // Convert image to base64 if it's a File
        let imageBase64: string
        if (typeof image === 'string') {
          imageBase64 = image
        } else {
          // Convert File to base64
          const buffer = Buffer.from(await image.arrayBuffer())
          imageBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`
        }

        // Call Python script with safer approach - avoid shell escaping issues
        console.log('📦 Image data length:', imageBase64.length)
        console.log('📦 Image data preview:', imageBase64.substring(0, 50) + '...')

        // Write image data to temp file to avoid shell escaping issues
        const fs = await import('fs')
        const tempFile = `/tmp/face_input_${Date.now()}.txt`
        fs.writeFileSync(tempFile, imageBase64)

        const { stdout, stderr } = await execAsync(
          `python3 face-detect.py "$(cat ${tempFile})" && rm ${tempFile}`,
          { timeout: 15000 } // 15 second timeout
        )

        if (stderr) {
          console.warn('Python script stderr:', stderr)
        }

        const pythonResult = JSON.parse(stdout)
        console.log('Python face detection result:', pythonResult)

        if (!pythonResult.success) {
          throw new Error(pythonResult.error || 'Python face detection failed')
        }

        // Convert Python result to our expected format
        if (pythonResult.faces && pythonResult.faces.length > 0) {
          const firstFace = pythonResult.faces[0]
          recognitionResult = {
            success: true,
            recognized_user: null, // No user recognition yet
            dominant_emotion: firstFace.emotion?.dominant || 'neutral',
            emotion_scores: firstFace.emotion?.scores || {},
            confidence: firstFace.emotion?.confidence || 0.5,
            is_spoof: firstFace.spoof || false,
            bbox: firstFace.bbox
          }
        } else {
          // No faces detected
          recognitionResult = {
            success: true,
            recognized_user: null,
            dominant_emotion: 'unknown',
            emotion_scores: {},
            confidence: 0,
            is_spoof: false
            // No bbox when no face detected
          }
        }
      } catch (error) {
        console.error('Python face detection failed:', error)
        // Fallback to indicating no face detected
        recognitionResult = {
          success: true,
          recognized_user: null,
          dominant_emotion: 'unknown',
          emotion_scores: {},
          confidence: 0,
          is_spoof: false
        }
      }
    }

    // Store face event in database only if a face was detected
    if (recognitionResult.bbox && recognitionResult.dominant_emotion !== 'unknown') {
      const faceEventData = {
        user_id: currentUserId,
        recognized_user_id: recognitionResult.recognized_user,
        dominant_emotion: recognitionResult.dominant_emotion,
        emotion_scores: recognitionResult.emotion_scores,
        confidence: recognitionResult.confidence,
        distance: recognitionResult.distance,
        is_spoof: recognitionResult.is_spoof,
        source: 'camera',
        frame_ts: new Date().toISOString(),
        metadata: {
          model: 'Facenet512',
          detector: 'retinaface',
          threshold: 0.30
        }
      }

      const { error: insertError } = await supabase
        .schema('app')
        .from('face_events')
        .insert([faceEventData])

      if (insertError) {
        console.error('Failed to store face event:', insertError)
        // Don't fail the request if DB insert fails
      }
    }

    // Update current conversation message with emotion (demo feature)
    if (currentUserId && recognitionResult.dominant_emotion) {
      try {
        // Get the most recent user message from the last 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

        const { data: recentMessages } = await supabase
          .schema('app')
          .from('messages')
          .select('id, metadata')
          .eq('user_id', currentUserId)
          .eq('role', 'user')
          .gte('created_at', fiveMinutesAgo)
          .order('created_at', { ascending: false })
          .limit(1)

        if (recentMessages && recentMessages.length > 0) {
          const message = recentMessages[0]
          const updatedMetadata = {
            ...message.metadata,
            emotion: recognitionResult.dominant_emotion,
            emotion_confidence: recognitionResult.confidence
          }

          await supabase
            .schema('app')
            .from('messages')
            .update({ metadata: updatedMetadata })
            .eq('id', message.id)
        }
      } catch (err) {
        console.error('Failed to update message with emotion:', err)
      }
    }

    // Format response to match frontend expectations
    const faces = []

    // Only add face data if a face was actually detected (has bbox)
    if (recognitionResult.bbox && recognitionResult.dominant_emotion !== 'unknown') {
      faces.push({
        bbox: recognitionResult.bbox,
        identity: recognitionResult.recognized_user ? {
          user_id: recognitionResult.recognized_user,
          label: 'Unknown User', // We'd need to look this up from the database
          distance: recognitionResult.distance || 0
        } : undefined,
        emotion: {
          dominant: recognitionResult.dominant_emotion,
          scores: recognitionResult.emotion_scores,
          confidence: recognitionResult.confidence
        },
        spoof: recognitionResult.is_spoof || false
      })
    }

    return NextResponse.json({
      frameId,
      faces,
      latency_ms: Date.now() - parseInt(frameId.split('_')[1])
    })

  } catch (error) {
    console.error('Face recognition error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Face recognition failed'
      },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'