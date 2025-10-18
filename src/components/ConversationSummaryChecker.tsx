'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useConversationSummary } from '@/hooks/useConversationSummary'
import { ConversationSummary, Message } from '@/lib/types'
import {
  FileText,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw
} from 'lucide-react'

interface ConversationDetailModalProps {
  conversationId: string
  onClose?: () => void
}

const ConversationDetailModal = ({ conversationId }: ConversationDetailModalProps) => {
  const [details, setDetails] = useState<{ summary: ConversationSummary | null, messages: Message[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const { getConversationWithMessages } = useConversationSummary()

  const loadDetails = async () => {
    setLoading(true)
    try {
      const data = await getConversationWithMessages(conversationId)
      setDetails(data)
    } catch (error) {
      console.error('Failed to load conversation details:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatRole = (role: string) => {
    switch (role) {
      case 'user': return 'User'
      case 'assistant': return 'Assistant'
      case 'system': return 'System'
      default: return role
    }
  }

  // Auto-load details when conversationId changes
  useEffect(() => {
    if (conversationId) {
      loadDetails()
    }
  }, [conversationId])

  return (
    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Conversation Details</DialogTitle>
      </DialogHeader>

      <div className="space-y-6">
          {!details && !loading && (
            <div className="text-center py-8">
              <Button onClick={loadDetails}>Load Conversation Details</Button>
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p>Loading conversation details...</p>
            </div>
          )}

          {details && (
            <>
              {/* Summary Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {details.summary ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>Generated: {formatDate(details.summary.created_at)}</span>
                        {details.summary.token_count && (
                          <span>{details.summary.token_count} tokens</span>
                        )}
                      </div>
                      <div className="prose prose-sm max-w-none">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {details.summary.summary}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Latest Summary
                      </Badge>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p>No summary available for this conversation</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Messages Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Messages ({details.messages.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {details.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`p-3 rounded-lg border ${
                          message.role === 'user'
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="text-xs">
                            {formatRole(message.role)}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {formatDate(message.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {message.content || '<No content>'}
                        </p>
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {message.attachments.length} attachment(s)
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
    </DialogContent>
  )
}

export const ConversationSummaryChecker = () => {
  const { summaries, loading, error, refetch } = useConversationSummary()
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getSummaryStatusBadge = (summary: ConversationSummary | null) => {
    if (!summary) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          No Summary
        </Badge>
      )
    }

    return (
      <Badge variant="default" className="flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Summarized
      </Badge>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Conversation Summary Checker
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {summaries.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No conversations found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {summaries.map((item) => (
              <div
                key={item.conversationId}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getSummaryStatusBadge(item.summary)}
                    <Badge variant="outline" className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {item.messageCount} messages
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(item.lastUpdated)}
                    </span>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      </DialogTrigger>
                      <ConversationDetailModal
                        conversationId={item.conversationId}
                      />
                    </Dialog>
                  </div>
                </div>

                <div className="text-sm text-gray-600">
                  <p className="font-medium mb-1">Conversation ID: {item.conversationId}</p>
                  {item.summary && (
                    <p className="text-gray-500 line-clamp-2">
                      Summary: {item.summary.summary.substring(0, 150)}
                      {item.summary.summary.length > 150 ? '...' : ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}