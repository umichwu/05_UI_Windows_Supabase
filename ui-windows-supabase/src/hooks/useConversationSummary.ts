import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from '@/lib/auth-store'
import { ConversationSummary, Message } from '@/lib/types'

interface ConversationWithSummary {
  conversationId: string
  summary: ConversationSummary | null
  messages: Message[]
  messageCount: number
  lastUpdated: string
}

export const useConversationSummary = () => {
  const [summaries, setSummaries] = useState<ConversationWithSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuthStore()

  const fetchConversationSummaries = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      // Get all conversations for the user
      const { data: conversations, error: convError } = await supabase
        .schema('app')
        .from('conversations')
        .select('id, title, last_message_at, updated_at')
        .eq('user_id', user.id)
        .in('status', ['active', 'archived'])
        .order('last_message_at', { ascending: false })

      if (convError) throw convError

      if (!conversations?.length) {
        setSummaries([])
        return
      }

      // Get summaries for all conversations
      const { data: summariesData, error: summariesError } = await supabase
        .schema('app')
        .from('conversation_summaries')
        .select('*')
        .in('conversation_id', conversations.map(c => c.id))
        .eq('is_latest', true)

      if (summariesError) throw summariesError

      // Get message counts for all conversations
      const { data: messageCounts, error: countError } = await supabase
        .schema('app')
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', conversations.map(c => c.id))

      if (countError) throw countError

      // Combine data
      const result: ConversationWithSummary[] = conversations.map(conv => {
        const summary = summariesData?.find(s => s.conversation_id === conv.id) || null
        const convMessageCount = messageCounts?.filter(m => m.conversation_id === conv.id).length || 0

        return {
          conversationId: conv.id,
          summary,
          messages: [], // We'll load messages separately when needed
          messageCount: convMessageCount,
          lastUpdated: conv.last_message_at || conv.updated_at
        }
      })

      setSummaries(result)
    } catch (err: unknown) {
      const error = err as { message?: string }
      const errorMessage = error?.message || 'Unknown error occurred while fetching conversation summaries'
      console.error('Error fetching conversation summaries:', errorMessage)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const getConversationWithMessages = async (conversationId: string): Promise<{
    summary: ConversationSummary | null
    messages: Message[]
  } | null> => {
    if (!user) return null

    try {
      // Get the latest summary
      const { data: summaryData, error: summaryError } = await supabase
        .schema('app')
        .from('conversation_summaries')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('is_latest', true)
        .maybeSingle()

      if (summaryError && summaryError.code !== 'PGRST116') {
        throw summaryError
      }

      // Get all messages for this conversation
      const { data: messagesData, error: messagesError } = await supabase
        .schema('app')
        .from('messages')
        .select(`
          *,
          attachments:messages_attachments(
            id,
            message_id,
            storage_object_path,
            mime_type,
            bytes,
            sha256,
            created_at
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (messagesError) throw messagesError

      return {
        summary: summaryData,
        messages: messagesData || []
      }
    } catch (err: unknown) {
      const error = err as { message?: string }
      console.error('Error fetching conversation details:', err)
      setError(error?.message || 'Failed to fetch conversation details')
      return null
    }
  }

  const checkSummaryStatus = async (conversationId: string): Promise<{
    hasSummary: boolean
    isUpToDate: boolean
    lastSummaryDate: string | null
    messagesSinceLastSummary: number
  }> => {
    if (!user) {
      return {
        hasSummary: false,
        isUpToDate: false,
        lastSummaryDate: null,
        messagesSinceLastSummary: 0
      }
    }

    try {
      // Get the latest summary
      const { data: summary, error: summaryError } = await supabase
        .schema('app')
        .from('conversation_summaries')
        .select('created_at')
        .eq('conversation_id', conversationId)
        .eq('is_latest', true)
        .maybeSingle()

      if (summaryError && summaryError.code !== 'PGRST116') {
        throw summaryError
      }

      if (!summary) {
        // No summary exists, count all messages
        const { count, error: countError } = await supabase
          .schema('app')
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conversationId)

        if (countError) throw countError

        return {
          hasSummary: false,
          isUpToDate: false,
          lastSummaryDate: null,
          messagesSinceLastSummary: count || 0
        }
      }

      // Count messages created after the last summary
      const { count, error: countError } = await supabase
        .schema('app')
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .gt('created_at', summary.created_at)

      if (countError) throw countError

      return {
        hasSummary: true,
        isUpToDate: (count || 0) === 0,
        lastSummaryDate: summary.created_at,
        messagesSinceLastSummary: count || 0
      }
    } catch (err: unknown) {
      console.error('Error checking summary status:', err)
      return {
        hasSummary: false,
        isUpToDate: false,
        lastSummaryDate: null,
        messagesSinceLastSummary: 0
      }
    }
  }

  useEffect(() => {
    if (user) {
      fetchConversationSummaries()

      // Note: Removed real-time subscriptions for now to avoid the channel error
      // They can be added back once the schema issue is resolved
    } else {
      setSummaries([])
      setLoading(false)
    }
  }, [user])

  return {
    summaries,
    loading,
    error,
    getConversationWithMessages,
    checkSummaryStatus,
    refetch: fetchConversationSummaries
  }
}