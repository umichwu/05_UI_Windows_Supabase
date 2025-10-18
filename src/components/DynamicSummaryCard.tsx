'use client'

import { useState, useEffect } from 'react'
import { SummaryCard } from './SummaryCard'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Search } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

interface DynamicSummaryCardProps {
  className?: string
}

export const DynamicSummaryCard = ({ className }: DynamicSummaryCardProps) => {
  const [conversationId, setConversationId] = useState('')
  const [recentConversations, setRecentConversations] = useState<Array<{
    id: string
    title: string | null
    created_at: string
  }>>([])
  const [loading, setLoading] = useState(false)

  // Load recent conversations for the user
  const loadRecentConversations = async () => {
    try {
      setLoading(true)
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) return

      const { data, error } = await supabase
        .schema('app')
        .from('conversations')
        .select('id, title, created_at')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) {
        console.error('Error loading conversations:', error)
        return
      }

      setRecentConversations(data || [])

      // Auto-select the most recent conversation
      if (data && data.length > 0 && !conversationId) {
        setConversationId(data[0].id)
      }
    } catch (err) {
      console.error('Error loading conversations:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecentConversations()
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className={className}>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5" />
            Select Conversation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Manual Input */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Enter Conversation ID:
            </label>
            <Input
              placeholder="Paste conversation ID here..."
              value={conversationId}
              onChange={(e) => setConversationId(e.target.value)}
            />
          </div>

          {/* Recent Conversations */}
          {recentConversations.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                Or select from recent conversations:
              </label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {recentConversations.map((conv) => (
                  <Button
                    key={conv.id}
                    variant={conversationId === conv.id ? 'default' : 'outline'}
                    className="w-full justify-between h-auto p-3"
                    onClick={() => setConversationId(conv.id)}
                  >
                    <div className="text-left">
                      <div className="font-medium text-sm">
                        {conv.title || 'Untitled Conversation'}
                      </div>
                      <div className="text-xs opacity-70">
                        {conv.id.slice(0, 8)}...
                      </div>
                    </div>
                    <div className="text-xs opacity-70">
                      {formatDate(conv.created_at)}
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="text-sm text-gray-500 text-center py-2">
              Loading conversations...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Card */}
      {conversationId && (
        <SummaryCard
          conversationId={conversationId}
          key={conversationId} // Force re-render when conversation changes
        />
      )}

      {!conversationId && (
        <Card>
          <CardContent className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              Select a conversation ID to view its summary
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}