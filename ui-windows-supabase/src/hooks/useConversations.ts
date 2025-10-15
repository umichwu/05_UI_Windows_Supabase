import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from '@/lib/auth-store'
import { Conversation } from '@/lib/types'

export const useConversations = () => {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuthStore()

  const fetchConversations = async () => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .schema('app')
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['active', 'archived'])
        .order('last_message_at', { ascending: false })

      if (error) throw error

      setConversations(data || [])
    } catch (err: unknown) {
      const error = err as { message?: string; details?: string; hint?: string; code?: string }
      const errorMessage = error?.message || 'Unknown error occurred while fetching conversations'
      console.error('Error fetching conversations:', errorMessage)
      console.error('Error details:', {
        message: errorMessage,
        details: error?.details || null,
        hint: error?.hint || null,
        code: error?.code || null
      })
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const createConversation = async (title: string): Promise<Conversation | null> => {
    if (!user) return null

    try {
      const { data, error } = await supabase
        .schema('app')
        .from('conversations')
        .insert({
          title,
          user_id: user.id,
          channel: 'web' as const,
          status: 'active'
        })
        .select()
        .single()

      if (error) throw error

      const newConversation = data as Conversation
      setConversations(prev => [newConversation, ...prev])
      return newConversation
    } catch (err: unknown) {
      const error = err as { message?: string; details?: string; hint?: string; code?: string }
      const errorMessage = error?.message || 'Unknown error occurred while creating conversation'
      console.error('Error creating conversation:', errorMessage)
      console.error('Error details:', {
        message: errorMessage,
        details: error?.details || null,
        hint: error?.hint || null,
        code: error?.code || null,
        data: { title, user_id: user.id }
      })
      setError(errorMessage)
      return null
    }
  }

  const renameConversation = async (id: string, title: string): Promise<boolean> => {
    if (!user) return false

    try {
      const { error } = await supabase
        .schema('app')
        .from('conversations')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error

      setConversations(prev =>
        prev.map(conv =>
          conv.id === id ? { ...conv, title, updated_at: new Date().toISOString() } : conv
        )
      )
      return true
    } catch (err: unknown) {
      const error = err as { message?: string }
      setError(error.message || 'Failed to rename conversation')
      console.error('Error renaming conversation:', err)
      return false
    }
  }

  const archiveConversation = async (id: string, archived: boolean = true): Promise<boolean> => {
    if (!user) return false

    try {
      const { error } = await supabase
        .schema('app')
        .from('conversations')
        .update({ 
          status: archived ? 'archived' : 'active', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error

      setConversations(prev =>
        prev.map(conv =>
          conv.id === id ? { ...conv, status: archived ? 'archived' : 'active', updated_at: new Date().toISOString() } : conv
        )
      )
      return true
    } catch (err: unknown) {
      const error = err as { message?: string }
      setError(error.message || 'Failed to archive conversation')
      console.error('Error archiving conversation:', err)
      return false
    }
  }

  const deleteConversation = async (id: string): Promise<boolean> => {
    if (!user) return false

    try {
      const { error } = await supabase
        .schema('app')
        .from('conversations')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error

      setConversations(prev => prev.filter(conv => conv.id !== id))
      return true
    } catch (err: unknown) {
      const error = err as { message?: string }
      setError(error.message || 'Failed to delete conversation')
      console.error('Error deleting conversation:', err)
      return false
    }
  }

  useEffect(() => {
    if (user) {
      fetchConversations()

      // Subscribe to conversation changes
      const channel = supabase
        .channel('app_conversations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'app',
            table: 'conversations',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            fetchConversations()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    } else {
      setConversations([])
      setLoading(false)
    }
  }, [user])

  return {
    conversations,
    loading,
    error,
    createConversation,
    renameConversation,
    archiveConversation,
    deleteConversation,
    refetch: fetchConversations
  }
}