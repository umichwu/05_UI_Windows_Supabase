'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Clock, FileText, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { ConversationSummary, OutboxEvent } from '@/lib/types'

interface SummaryCardProps {
  conversationId: string
  className?: string
}

export const SummaryCard = ({ conversationId, className }: SummaryCardProps) => {
  const [summary, setSummary] = useState<ConversationSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingRequest, setPendingRequest] = useState<OutboxEvent | null>(null)

  // Load the latest summary for this conversation
  const loadSummary = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: summaryError } = await supabase
        .schema('app')
        .from('conversation_summaries')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('is_latest', true)
        .single()

      if (summaryError && summaryError.code !== 'PGRST116') { // PGRST116 = no rows found
        throw summaryError
      }

      setSummary(data)
    } catch (err) {
      console.error('Error loading summary:', err)
      setError(err instanceof Error ? err.message : 'Failed to load summary')
    } finally {
      setLoading(false)
    }
  }

  // Check for pending summary requests
  const checkPendingRequest = async () => {
    try {
      const { data, error } = await supabase
        .schema('app')
        .from('outbox_events')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('event_type', 'summary.request')
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        throw error
      }

      setPendingRequest(data)
    } catch (err) {
      console.error('Error checking pending requests:', err)
    }
  }

  // Request a new summary by inserting into outbox_events
  const requestSummary = async () => {
    try {
      setRefreshing(true)
      setError(null)

      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        throw new Error('Authentication required')
      }

      const { error: insertError } = await supabase
        .schema('app')
        .from('outbox_events')
        .insert({
          user_id: userData.user.id,
          conversation_id: conversationId,
          event_type: 'summary.request',
          payload: {
            conversation_id: conversationId,
            requested_at: new Date().toISOString()
          },
          priority: 3
        })

      if (insertError) {
        throw insertError
      }

      // Check for the pending request
      await checkPendingRequest()
    } catch (err) {
      console.error('Error requesting summary:', err)
      setError(err instanceof Error ? err.message : 'Failed to request summary')
    } finally {
      setRefreshing(false)
    }
  }

  // Format the summary date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  useEffect(() => {
    loadSummary()
    checkPendingRequest()

    // Set up real-time subscription for summary updates
    const summarySubscription = supabase
      .channel('conversation_summaries')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'app',
          table: 'conversation_summaries',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          console.log('Summary changed:', payload)
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            if ((payload.new as ConversationSummary).is_latest) {
              setSummary(payload.new as ConversationSummary)
            }
          }
        }
      )
      .subscribe()

    // Set up real-time subscription for outbox events
    const outboxSubscription = supabase
      .channel('outbox_events')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'app',
          table: 'outbox_events',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          console.log('Outbox event changed:', payload)
          const event = payload.new as OutboxEvent
          if (event?.event_type === 'summary.request') {
            if (event.status === 'pending' || event.status === 'processing') {
              setPendingRequest(event)
            } else {
              setPendingRequest(null)
              // Reload summary if completed
              if (event.status === 'completed') {
                loadSummary()
              }
            }
          }
        }
      )
      .subscribe()

    return () => {
      summarySubscription.unsubscribe()
      outboxSubscription.unsubscribe()
    }
  }, [conversationId])

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Conversation Summary
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={requestSummary}
            disabled={refreshing || !!pendingRequest}
            className="flex items-center gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {pendingRequest && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-600">Summary request in progress</span>
              </div>
              <Badge className={getStatusColor(pendingRequest.status)}>
                {pendingRequest.status}
              </Badge>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Requested: {formatDate(pendingRequest.created_at)}
            </p>
          </div>
        )}

        {summary ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Generated: {formatDate(summary.created_at)}</span>
              {summary.token_count && (
                <span>{summary.token_count} tokens</span>
              )}
            </div>

            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {summary.summary}
              </p>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <Badge variant="outline" className="text-xs">
                Latest Summary
              </Badge>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-3">No summary available for this conversation</p>
            <p className="text-sm text-gray-400 mb-4">
              Click &quot;Refresh&quot; to generate a summary of the conversation
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}