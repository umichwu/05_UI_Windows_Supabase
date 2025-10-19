import { supabase } from './supabaseClient'
import { Message } from './types'
import { getCurrentMonitor } from './performance-monitor'

export interface LLMConfig {
  url: string
  model: string
  temperature: number
  max_tokens?: number
  api_key?: string
  provider?: 'openai' | 'gemini'
}

export interface GeminiConfig {
  url: string
  model: string
  temperature: number
  max_tokens?: number
  api_key: string
  provider: 'gemini'
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<{
    type: 'text' | 'image_url'
    text?: string
    image_url?: {
      url: string
      detail?: 'low' | 'high' | 'auto'
    }
  }>
}

/**
 * Get LLM configuration from app.config table
 */
export const getLLMConfig = async (configKey: string = 'llm'): Promise<LLMConfig | null> => {
  const monitor = getCurrentMonitor()
  monitor?.start('fetch-llm-config', { configKey })

  try {
    const { data, error } = await supabase
      .schema('app')
      .from('config')
      .select('value')
      .eq('key', configKey)
      .single()

    if (error) {
      console.error('Error fetching LLM config:', error)
      monitor?.end('fetch-llm-config', { success: false, error: error.message })
      return null
    }

    monitor?.end('fetch-llm-config', { success: true })
    return data.value as LLMConfig
  } catch (err) {
    console.error('Unexpected error fetching LLM config:', err)
    monitor?.end('fetch-llm-config', { success: false, error: String(err) })
    return null
  }
}

/**
 * Get Gemini configuration from app.config table
 */
export const getGeminiConfig = async (): Promise<GeminiConfig | null> => {
  return getLLMConfig('gemini') as Promise<GeminiConfig | null>
}

/**
 * Convert database messages to LLM format
 */
export const formatMessagesForLLM = (messages: Message[]): LLMMessage[] => {
  const monitor = getCurrentMonitor()
  monitor?.start('format-messages', { messageCount: messages.length })

  const formatted = messages
    .filter(msg => msg.role !== 'tool') // Filter out tool messages for now
    .map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content || ''
    }))
    .slice(-20) // Keep last 20 messages for context

  monitor?.end('format-messages', { formattedCount: formatted.length })
  return formatted
}

/**
 * Call Gemini API via backend route with Google Search grounding
 */
const callGemini = async (
  config: GeminiConfig,
  messages: LLMMessage[],
  userId: string
): Promise<string | null> => {
  const monitor = getCurrentMonitor()
  monitor?.start('gemini-api-call', { model: config.model, messageCount: messages.length })

  try {
    console.log('Calling Gemini via backend API with Google Search grounding:', {
      model: config.model,
      messageCount: messages.length,
      userId: userId ? '[REDACTED]' : 'MISSING'
    })

    monitor?.start('gemini-backend-request')
    // Call the backend API route instead of directly calling Gemini
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages,
        userId,
        temperature: config.temperature,
        maxTokens: config.max_tokens || 1000
      })
    })
    monitor?.end('gemini-backend-request', { status: response.status })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini backend API error:', response.status, errorText)
      monitor?.end('gemini-api-call', { success: false, error: errorText })
      return null
    }

    monitor?.start('gemini-parse-response')
    const result = await response.json()
    monitor?.end('gemini-parse-response')

    if (result.success && result.response) {
      console.log('Gemini response received:', {
        responseLength: result.response.length,
        hasGroundingMetadata: !!result.groundingMetadata,
        groundingChunks: result.groundingMetadata?.groundingChunks?.length || 0
      })

      monitor?.end('gemini-api-call', {
        success: true,
        responseLength: result.response.length,
        grounded: !!result.groundingMetadata
      })
      return result.response
    }

    console.error('Unexpected backend response format:', result)
    monitor?.end('gemini-api-call', { success: false, error: 'Unexpected response format' })
    return null
  } catch (err) {
    console.error('Gemini call error:', err)
    monitor?.end('gemini-api-call', { success: false, error: String(err) })
    return null
  }
}

/**
 * Call OpenAI-compatible API
 */
const callOpenAI = async (
  config: LLMConfig,
  messages: LLMMessage[]
): Promise<string | null> => {
  const monitor = getCurrentMonitor()
  monitor?.start('openai-api-call', { model: config.model, messageCount: messages.length })

  try {
    monitor?.start('openai-format-request')
    const requestPayload = {
      model: config.model,
      messages: messages,
      temperature: config.temperature,
      max_tokens: config.max_tokens || 1000,
      stream: false
    }
    monitor?.end('openai-format-request')

    console.log('Calling OpenAI-compatible API with:', {
      config: { ...config, api_key: config.api_key ? '[REDACTED]' : 'MISSING' },
      messageCount: messages.length
    })

    monitor?.start('openai-network-request')
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.api_key ? `Bearer ${config.api_key}` : ''
      },
      body: JSON.stringify(requestPayload)
    })
    monitor?.end('openai-network-request', { status: response.status })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI API error:', response.status, errorText)
      monitor?.end('openai-api-call', { success: false, error: errorText })
      return null
    }

    monitor?.start('openai-parse-response')
    const result = await response.json()
    monitor?.end('openai-parse-response')

    // Handle OpenAI-style response
    if (result.choices && result.choices.length > 0) {
      const responseText = result.choices[0].message?.content || result.choices[0].text
      monitor?.end('openai-api-call', {
        success: true,
        responseLength: responseText?.length
      })
      return responseText
    }

    // Handle other response formats
    if (result.content) {
      monitor?.end('openai-api-call', {
        success: true,
        responseLength: result.content?.length
      })
      return result.content
    }

    if (result.response) {
      monitor?.end('openai-api-call', {
        success: true,
        responseLength: result.response?.length
      })
      return result.response
    }

    console.error('Unexpected OpenAI response format:', result)
    monitor?.end('openai-api-call', { success: false, error: 'Unexpected response format' })
    return null
  } catch (err) {
    console.error('OpenAI call error:', err)
    monitor?.end('openai-api-call', { success: false, error: String(err) })
    return null
  }
}

/**
 * Call LLM API with conversation context and attachments
 */
export const callLLM = async (
  messages: Message[],
  newUserMessage: string,
  messageAttachments?: { signedUrl: string; mimeType: string }[],
  modelProvider?: 'openai' | 'gemini',
  userId?: string
): Promise<string | null> => {
  try {
    const configKey = modelProvider === 'gemini' ? 'gemini' : 'llm'
    const config = await getLLMConfig(configKey)
    if (!config) {
      console.error(`No ${configKey} config found`)
      return null
    }

    // Format conversation history
    const conversationHistory = formatMessagesForLLM(messages)

    // Prepare the new user message content
    let userMessageContent: LLMMessage['content'] = newUserMessage

    // Handle image attachments for vision models
    if (messageAttachments && messageAttachments.length > 0) {
      const imageAttachments = messageAttachments.filter(att =>
        att.mimeType.startsWith('image/')
      )

      if (imageAttachments.length > 0) {
        // Use multimodal content format for vision models
        const contentParts: Array<{
          type: 'text' | 'image_url'
          text?: string
          image_url?: { url: string; detail?: 'low' | 'high' | 'auto' }
        }> = []

        // Add text content if present
        if (newUserMessage.trim()) {
          contentParts.push({
            type: 'text',
            text: newUserMessage
          })
        }

        // Add image attachments
        imageAttachments.forEach(attachment => {
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: attachment.signedUrl,
              detail: 'high' // Use high detail for better image analysis
            }
          })
        })

        userMessageContent = contentParts
      }
    }

    // Add the new user message
    const llmMessages: LLMMessage[] = [
      ...conversationHistory,
      { role: 'user', content: userMessageContent }
    ]

    // Add system message if none exists
    if (!llmMessages.some(m => m.role === 'system')) {
      const hasImages = messageAttachments?.some(att => att.mimeType.startsWith('image/'))
      llmMessages.unshift({
        role: 'system',
        content: hasImages
          ? 'You are a helpful AI assistant with vision capabilities. You can analyze and describe images in detail. Be concise and helpful in your responses.'
          : 'You are a helpful AI assistant. Be concise and helpful in your responses.'
      })
    }

    console.log('Calling LLM with:', {
      provider: modelProvider || 'openai',
      messageCount: llmMessages.length,
      hasImages: messageAttachments && messageAttachments.length > 0
    })

    // Route to appropriate API based on provider
    if (modelProvider === 'gemini') {
      if (!userId) {
        console.error('User ID is required for Gemini API calls')
        return null
      }
      return callGemini(config as GeminiConfig, llmMessages, userId)
    } else {
      return callOpenAI(config, llmMessages)
    }

  } catch (err) {
    console.error('LLM call error:', err)
    return null
  }
}

/**
 * Generate conversation title using LLM
 */
export const generateConversationTitle = async (firstMessage: string): Promise<string | null> => {
  try {
    const config = await getLLMConfig()
    if (!config) return null

    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.api_key ? `Bearer ${config.api_key}` : '',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: 'Generate a short, descriptive title (max 50 characters) for a conversation that starts with the following message. Return only the title, no quotes or extra text.'
          },
          {
            role: 'user',
            content: firstMessage
          }
        ],
        temperature: 0.7,
        max_tokens: 50
      })
    })

    if (!response.ok) return null

    const result = await response.json()

    if (result.choices && result.choices.length > 0) {
      return result.choices[0].message?.content?.trim() || null
    }

    return null
  } catch (err) {
    console.error('Title generation error:', err)
    return null
  }
}