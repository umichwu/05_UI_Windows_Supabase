'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  RefreshCw,
  MoreVertical,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Skull,
  Play,
  SkipForward,
  Eye,
  Calendar
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

interface OutboxEvent {
  id: string
  event_type: string
  status: string
  user_id: string
  conversation_id: string
  message_id?: string
  attempt_count: number
  last_error?: string
  payload: Record<string, unknown>
  scheduled_at: string
  created_at: string
  processed_at?: string
}

export const OutboxTable = () => {
  const [events, setEvents] = useState<OutboxEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<OutboxEvent | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showPayloadDialog, setShowPayloadDialog] = useState<OutboxEvent | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'failed' | 'dead'>('all')

  // Load outbox events
  const loadEvents = async () => {
    try {
      setLoading(true)

      let query = supabase
        .schema('app')
        .from('outbox_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error

      setEvents(data || [])
    } catch (err) {
      console.error('Error loading outbox events:', err)
    } finally {
      setLoading(false)
    }
  }

  // Retry a failed/dead event
  const retryEvent = async (eventId: string) => {
    try {
      setActionLoading(eventId)

      const { error } = await supabase
        .schema('app')
        .from('outbox_events')
        .update({
          status: 'pending',
          scheduled_at: new Date().toISOString(),
          last_error: null
        })
        .eq('id', eventId)

      if (error) throw error

      await loadEvents()
    } catch (err) {
      console.error('Error retrying event:', err)
    } finally {
      setActionLoading(null)
    }
  }

  // Skip an event (mark as ok)
  const skipEvent = async (eventId: string, markAs: 'ok' | 'dead') => {
    try {
      setActionLoading(eventId)

      const updateData: Record<string, string> = {
        status: markAs,
        processed_at: new Date().toISOString()
      }

      if (markAs === 'dead') {
        updateData['last_error'] = 'Manually marked as dead'
      }

      const { error } = await supabase
        .schema('app')
        .from('outbox_events')
        .update(updateData)
        .eq('id', eventId)

      if (error) throw error

      await loadEvents()
    } catch (err) {
      console.error('Error skipping event:', err)
    } finally {
      setActionLoading(null)
    }
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>
      case 'ok':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />OK</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
      case 'dead':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200"><Skull className="h-3 w-3 mr-1" />Dead</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Get event type badge
  const getEventTypeBadge = (eventType: string) => {
    switch (eventType) {
      case 'message.created':
        return <Badge variant="outline" className="text-blue-600">Message</Badge>
      case 'summary.request':
        return <Badge variant="outline" className="text-purple-600">Summary</Badge>
      case 'reply.request':
        return <Badge variant="outline" className="text-green-600">Reply</Badge>
      case 'push.request':
        return <Badge variant="outline" className="text-orange-600">Push</Badge>
      default:
        return <Badge variant="outline">{eventType}</Badge>
    }
  }

  // Check if event can be retried
  const canRetry = (event: OutboxEvent) => {
    return ['failed', 'dead'].includes(event.status)
  }

  // Check if event can be skipped
  const canSkip = (event: OutboxEvent) => {
    return ['pending', 'failed'].includes(event.status)
  }

  useEffect(() => {
    loadEvents()

    // Set up real-time subscription
    const subscription = (supabase as any)
      .schema('app')
      .channel('outbox_events')
      .on(
        'postgres_changes',
        {
          event: '*',
          table: 'outbox_events'
        },
        () => {
          loadEvents()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [filter])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Outbox Events
            </CardTitle>

            <div className="flex items-center gap-2">
              {/* Filter buttons */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                {(['all', 'pending', 'failed', 'dead'] as const).map((filterType) => (
                  <Button
                    key={filterType}
                    size="sm"
                    variant={filter === filterType ? 'default' : 'ghost'}
                    onClick={() => setFilter(filterType)}
                    className="capitalize text-xs"
                  >
                    {filterType}
                  </Button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={loadEvents}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No outbox events found</p>
              {filter !== 'all' && (
                <p className="text-sm mt-1">Try changing the filter to see more events</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="space-y-1">
                          {getEventTypeBadge(event.event_type)}
                          <div className="text-xs text-gray-500 font-mono">
                            {event.id.slice(0, 8)}...
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>{getStatusBadge(event.status)}</TableCell>

                      <TableCell>
                        <div className="text-sm">
                          {event.attempt_count}
                          {event.attempt_count > 0 && (
                            <span className="text-gray-500 ml-1">retries</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm">
                          {formatDate(event.scheduled_at)}
                          {new Date(event.scheduled_at) > new Date() && (
                            <div className="text-xs text-orange-600 flex items-center gap-1 mt-1">
                              <Calendar className="h-3 w-3" />
                              Future
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm text-gray-600">
                          {formatDate(event.created_at)}
                        </div>
                      </TableCell>

                      <TableCell>
                        {event.last_error ? (
                          <div className="max-w-xs">
                            <div className="text-xs text-red-600 truncate" title={event.last_error}>
                              {event.last_error}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={actionLoading === event.id}
                            >
                              {actionLoading === event.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreVertical className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setShowPayloadDialog(event)}
                              className="flex items-center gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              View Payload
                            </DropdownMenuItem>

                            {canRetry(event) && (
                              <DropdownMenuItem
                                onClick={() => retryEvent(event.id)}
                                className="flex items-center gap-2 text-blue-600"
                              >
                                <Play className="h-4 w-4" />
                                Retry (Pending)
                              </DropdownMenuItem>
                            )}

                            {canSkip(event) && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => skipEvent(event.id, 'ok')}
                                  className="flex items-center gap-2 text-green-600"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  Skip (OK)
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => skipEvent(event.id, 'dead')}
                                  className="flex items-center gap-2 text-gray-600"
                                >
                                  <Skull className="h-4 w-4" />
                                  Skip (Dead)
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {['pending', 'processing', 'ok', 'failed', 'dead'].map((status) => {
          const count = events.filter(e => e.status === status).length
          return (
            <Card key={status}>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm text-gray-600 capitalize">{status}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Payload Dialog */}
      <AlertDialog open={!!showPayloadDialog} onOpenChange={() => setShowPayloadDialog(null)}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Event Payload</AlertDialogTitle>
            <AlertDialogDescription>
              Event ID: {showPayloadDialog?.id}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-96 overflow-auto">
            <pre className="bg-gray-100 p-4 rounded text-xs">
              {showPayloadDialog && JSON.stringify(showPayloadDialog.payload, null, 2)}
            </pre>
          </div>

          <AlertDialogFooter>
            <AlertDialogAction>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}