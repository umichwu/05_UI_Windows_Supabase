import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client with service role key for backend operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/gemini
 *
 * Backend API route for Gemini with Google Search Grounding enabled
 * This ensures real-time, up-to-date responses for current events, stock prices, etc.
 */
export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json()
    const { messages, userId, temperature = 0.7, maxTokens = 1000 } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required for authentication' },
        { status: 401 }
      )
    }

    // Fetch Gemini configuration from Supabase
    const { data: configData, error: configError } = await supabase
      .schema('app')
      .from('config')
      .select('value')
      .eq('key', 'gemini')
      .single()

    if (configError || !configData) {
      console.error('Error fetching Gemini config:', configError)
      return NextResponse.json(
        { error: 'Gemini configuration not found' },
        { status: 500 }
      )
    }

    const config = configData.value as {
      api_key: string
      model: string
      temperature: number
      max_tokens?: number
    }

    if (!config.api_key) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    // Initialize Google Generative AI with API key
    const genAI = new GoogleGenerativeAI(config.api_key)

    // Get the Gemini model with Google Search grounding
    // Note: Use 'googleSearch' for Gemini 2.0+ or 'google_search_retrieval' for Gemini 1.5
    const model = genAI.getGenerativeModel({
      model: config.model || 'gemini-1.5-flash',
      // Enable Google Search tool for real-time grounding
      tools: [
        {
          googleSearch: {} // Correct tool name for Google Search grounding
        }
      ] as any // Using 'as any' due to SDK type limitations
    })

    // Convert messages to Gemini format
    // Filter out system messages and convert roles
    const geminiContents = messages
      .filter((m: { role: string }) => m.role !== 'system')
      .map((msg: { role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: typeof msg.content === 'string'
          ? [{ text: msg.content }]
          : msg.content.map(part =>
              part.type === 'text'
                ? { text: part.text || '' }
                : {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: part.image_url?.url || ''
                    }
                  }
            )
      }))

    // Add system message as context if present
    const systemMessage = messages.find((m: { role: string }) => m.role === 'system')
    if (systemMessage && typeof systemMessage.content === 'string') {
      // Prepend system message to the first user message
      if (geminiContents.length > 0 && geminiContents[0].role === 'user') {
        const firstUserPart = geminiContents[0].parts[0]
        if (firstUserPart && 'text' in firstUserPart) {
          firstUserPart.text = `${systemMessage.content}\n\n${firstUserPart.text}`
        }
      }
    }

    console.log('Calling Gemini with Google Search grounding:', {
      model: config.model,
      messageCount: geminiContents.length,
      hasSearchTool: true
    })

    // Start chat session with history
    const chat = model.startChat({
      history: geminiContents.slice(0, -1), // All messages except the last one
      generationConfig: {
        temperature: temperature || config.temperature,
        maxOutputTokens: maxTokens || config.max_tokens || 1000
      }
    })

    // Send the last message and get response
    const lastMessage = geminiContents[geminiContents.length - 1]
    const lastMessageText = lastMessage.parts[0] && 'text' in lastMessage.parts[0]
      ? lastMessage.parts[0].text || ''
      : ''

    const result = await chat.sendMessage(lastMessageText)
    const response = result.response
    const responseText = response.text()

    // Extract grounding metadata if available
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata

    console.log('Gemini response received:', {
      responseLength: responseText.length,
      hasGroundingMetadata: !!groundingMetadata,
      groundingChunks: groundingMetadata?.groundingChunks?.length || 0
    })

    // Return response with grounding metadata
    return NextResponse.json({
      success: true,
      response: responseText,
      groundingMetadata: groundingMetadata || null,
      model: config.model
    })

  } catch (error) {
    console.error('Gemini API error:', error)

    return NextResponse.json(
      {
        error: 'Failed to generate response',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/gemini
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Gemini API route with Google Search grounding is ready',
    features: ['google-search-grounding', 'real-time-information']
  })
}
