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

interface EnrollmentResponse {
  success: boolean
  profiles_created: number
  embeddings: Array<{
    label: string
    model: string
    embedding: number[]
  }>
}

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    let userId: string
    if (token) {
      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (error || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
    } else {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }

    const formData = await request.formData()
    const label = formData.get('label') as string
    const images = formData.getAll('images') as File[]

    if (!label || images.length === 0) {
      return NextResponse.json(
        { error: 'Label and at least one image are required' },
        { status: 400 }
      )
    }

    let enrollmentResults: EnrollmentResponse

    if (FACE_API_BASE_URL) {
      // Call real face API service
      const apiFormData = new FormData()
      apiFormData.append('label', label)
      images.forEach(image => {
        apiFormData.append('images', image)
      })

      const response = await fetch(`${FACE_API_BASE_URL}/enroll`, {
        method: 'POST',
        body: apiFormData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Face API enrollment failed')
      }

      enrollmentResults = await response.json()
    } else {
      // Mock response for development
      console.log('Using mock face enrollment (FACE_API_BASE_URL not set)')

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Generate mock embeddings (512-dimensional for Facenet512)
      const mockEmbeddings = images.map(() => ({
        label,
        model: 'Facenet512',
        embedding: Array.from({ length: 512 }, () => Math.random() * 2 - 1) // Random values between -1 and 1
      }))

      enrollmentResults = {
        success: true,
        profiles_created: images.length,
        embeddings: mockEmbeddings
      }
    }

    // Store embeddings in database
    const profilesData = enrollmentResults.embeddings.map(item => ({
      user_id: userId,
      label: item.label,
      model: item.model,
      embedding: `[${item.embedding.join(',')}]` // Convert array to vector string
    }))

    const { error: insertError } = await supabase
      .schema('app')
      .from('face_profiles')
      .insert(profilesData)

    if (insertError) {
      throw new Error(`Database insertion failed: ${insertError.message}`)
    }

    return NextResponse.json({
      success: true,
      profiles_created: enrollmentResults.profiles_created,
      message: `Successfully enrolled ${enrollmentResults.profiles_created} face profile(s) for "${label}"`
    })

  } catch (error) {
    console.error('Face enrollment error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Face enrollment failed',
        success: false
      },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'