'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  TestTube,
  MessageSquare,
  FileText,
  Send,
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

interface TestEvent {
  id: string
  event_type: string
  status: string
  payload: any
  created_at: string
  scheduled_at: string
}

export const EventSandbox = () => {
  const [conversations, setConversations] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [recentEvents, setRecentEvents] = useState<TestEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState<string>('')
  const [selectedMessage, setSelectedMessage] = useState<string>('')
  const [user, setUser] = useState<any>(null)

  // Form states
  const [messageContent, setMessageContent] = useState('This is a test message for outbox event generation.')
  const [customPayload, setCustomPayload] = useState('{\n  "test": true,\n  "description": "Custom test event"\n}')
  const [eventPriority, setEventPriority] = useState(5)
  const [scheduledDelay, setScheduledDelay] = useState(0)

  // Load user and conversations
  const loadInitialData = async () => {
    try {
      // Get current user
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        throw new Error('Please sign in to use the event sandbox')
      }
      setUser(userData.user)

      // Load conversations
      const { data: convData, error: convError } = await supabase
        .schema('app')
        .from('conversations')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('last_message_at', { ascending: false })
        .limit(10)

      if (convError) throw convError
      setConversations(convData || [])

      // Auto-select first conversation
      if (convData && convData.length > 0) {
        setSelectedConversation(convData[0].id)
        await loadMessages(convData[0].id)
      }

    } catch (err) {
      console.error('Error loading initial data:', err)
    }
  }

  // Load messages for selected conversation
  const loadMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .schema('app')
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setMessages(data || [])

      // Auto-select first message
      if (data && data.length > 0) {
        setSelectedMessage(data[0].id)
      }
    } catch (err) {
      console.error('Error loading messages:', err)
    }
  }

  // Load recent test events
  const loadRecentEvents = async () => {
    try {
      const { data, error } = await supabase
        .schema('app')
        .from('outbox_events')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      setRecentEvents(data || [])
    } catch (err) {
      console.error('Error loading recent events:', err)
    }
  }

  // Create message.created event
  const createMessageEvent = async () => {
    if (!user || !selectedConversation) return

    try {
      setLoading(true)

      const scheduledAt = new Date()
      if (scheduledDelay > 0) {
        scheduledAt.setSeconds(scheduledAt.getSeconds() + scheduledDelay)
      }

      // First create a test message if needed
      let messageId = selectedMessage
      if (!messageId || messageContent.trim()) {
        const { data: newMessage, error: msgError } = await supabase
          .schema('app')
          .from('messages')
          .insert({
            conversation_id: selectedConversation,
            user_id: user.id,
            role: 'user',
            content: messageContent
          })
          .select()
          .single()

        if (msgError) throw msgError
        messageId = newMessage.id
        await loadMessages(selectedConversation)
      }

      // Create the outbox event
      const { error } = await supabase
        .schema('app')
        .from('outbox_events')
        .insert({
          event_type: 'message.created',
          user_id: user.id,
          conversation_id: selectedConversation,
          message_id: messageId,
          payload: {
            message_id: messageId,
            conversation_id: selectedConversation,
            content: messageContent,
            test_mode: true,
            created_by: 'event_sandbox'
          },
          status: 'pending',
          priority: eventPriority,
          scheduled_at: scheduledAt.toISOString()
        })

      if (error) throw error

      await loadRecentEvents()
      setMessageContent('This is a test message for outbox event generation.')

    } catch (err) {
      console.error('Error creating message event:', err)
    } finally {
      setLoading(false)
    }
  }

  // Create summary.request event
  const createSummaryEvent = async () => {
    if (!user || !selectedConversation) return

    try {
      setLoading(true)

      const scheduledAt = new Date()
      if (scheduledDelay > 0) {
        scheduledAt.setSeconds(scheduledAt.getSeconds() + scheduledDelay)
      }

      const { error } = await supabase
        .schema('app')
        .from('outbox_events')
        .insert({
          event_type: 'summary.request',
          user_id: user.id,
          conversation_id: selectedConversation,
          payload: {
            conversation_id: selectedConversation,
            requested_at: new Date().toISOString(),
            test_mode: true,
            manual_trigger: true,
            created_by: 'event_sandbox'
          },
          status: 'pending',
          priority: eventPriority,
          scheduled_at: scheduledAt.toISOString()
        })

      if (error) throw error

      await loadRecentEvents()

    } catch (err) {
      console.error('Error creating summary event:', err)
    } finally {
      setLoading(false)
    }
  }

  // Create custom event
  const createCustomEvent = async (eventType: string) => {
    if (!user) return

    try {
      setLoading(true)

      const scheduledAt = new Date()
      if (scheduledDelay > 0) {
        scheduledAt.setSeconds(scheduledAt.getSeconds() + scheduledDelay)
      }

      let payload
      try {
        payload = JSON.parse(customPayload)
      } catch {
        payload = { raw: customPayload, created_by: 'event_sandbox' }
      }

      const { error } = await supabase
        .schema('app')
        .from('outbox_events')
        .insert({
          event_type: eventType,
          user_id: user.id,
          conversation_id: selectedConversation || null,
          payload: {
            ...payload,
            test_mode: true,
            created_by: 'event_sandbox',
            timestamp: new Date().toISOString()
          },
          status: 'pending',
          priority: eventPriority,
          scheduled_at: scheduledAt.toISOString()
        })

      if (error) throw error

      await loadRecentEvents()

    } catch (err) {
      console.error('Error creating custom event:', err)
    } finally {
      setLoading(false)
    }
  }

  // Clear all test events
  const clearTestEvents = async () => {
    if (!user) return

    try {
      setLoading(true)

      const { error } = await supabase
        .schema('app')
        .from('outbox_events')
        .delete()
        .eq('user_id', user.id)
        .like('payload->>created_by', 'event_sandbox')

      if (error) throw error

      await loadRecentEvents()

    } catch (err) {
      console.error('Error clearing test events:', err)
    } finally {
      setLoading(false)
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>
      case 'ok':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />OK</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>
      case 'dead':
        return <Badge className="bg-gray-100 text-gray-800">Dead</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation)
    }
  }, [selectedConversation])

  useEffect(() => {
    if (user) {
      loadRecentEvents()

      // Set up real-time subscription
      const subscription = (supabase as any)
        .schema('app')
        .channel('outbox_events_sandbox')
        .on(
          'postgres_changes',
          {
            event: '*',
            table: 'outbox_events',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            loadRecentEvents()
          }
        )
        .subscribe()

      return () => {
        subscription.unsubscribe()
      }
    }
  }, [user])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Event Sandbox
            <Badge variant="outline" className="ml-2">Testing Environment</Badge>
          </CardTitle>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="message" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="message" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Message Events
              </TabsTrigger>
              <TabsTrigger value="summary" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Summary Events
              </TabsTrigger>
              <TabsTrigger value="custom" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Custom Events
              </TabsTrigger>
            </TabsList>

            {/* Common Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="space-y-2">
                <Label>Conversation</Label>
                <Select value={selectedConversation} onValueChange={setSelectedConversation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select conversation" />
                  </SelectTrigger>
                  <SelectContent>
                    {conversations.map(conv => (
                      <SelectItem key={conv.id} value={conv.id}>
                        {conv.title || 'Untitled'} ({conv.msg_count} msgs)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority (1-10)</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={eventPriority}
                  onChange={(e) => setEventPriority(parseInt(e.target.value) || 5)}
                />
              </div>

              <div className="space-y-2">
                <Label>Delay (seconds)</Label>
                <Input
                  type="number"
                  min="0"
                  value={scheduledDelay}
                  onChange={(e) => setScheduledDelay(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Message Events Tab */}
            <TabsContent value="message" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Test Message Content</Label>
                  <Textarea
                    placeholder="Enter test message content"
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Existing Message</Label>
                  <Select value={selectedMessage} onValueChange={setSelectedMessage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select existing message" />
                    </SelectTrigger>
                    <SelectContent>
                      {messages.map(msg => (
                        <SelectItem key={msg.id} value={msg.id}>
                          {msg.role}: {msg.content?.slice(0, 50)}...
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={createMessageEvent}
                  disabled={loading || !selectedConversation}
                  className="flex items-center gap-2"
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Create Message Event
                </Button>
              </div>
            </TabsContent>

            {/* Summary Events Tab */}
            <TabsContent value="summary" className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Summary Request Event</h4>
                  <p className="text-sm text-blue-700">
                    This will create a summary.request event for the selected conversation.
                    The event will be processed by your external summary service.
                  </p>
                </div>

                <Button
                  onClick={createSummaryEvent}
                  disabled={loading || !selectedConversation}
                  className="flex items-center gap-2"
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  Create Summary Request
                </Button>
              </div>
            </TabsContent>

            {/* Custom Events Tab */}
            <TabsContent value="custom" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Custom Payload (JSON)</Label>
                  <Textarea
                    placeholder="Enter custom JSON payload"
                    value={customPayload}
                    onChange={(e) => setCustomPayload(e.target.value)}
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {['reply.request', 'reply.completed', 'push.request', 'push.completed'].map(eventType => (
                    <Button
                      key={eventType}
                      variant="outline"
                      onClick={() => createCustomEvent(eventType)}
                      disabled={loading}
                      className="text-xs"
                    >
                      {eventType}
                    </Button>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Test Events</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadRecentEvents}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearTestEvents}
                disabled={loading || recentEvents.length === 0}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Test Events
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {recentEvents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <TestTube className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No test events created yet</p>
              <p className="text-sm">Use the tabs above to create test events</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{event.event_type}</Badge>
                    {getStatusBadge(event.status)}
                    <span className="text-sm text-gray-600">
                      {formatDate(event.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {new Date(event.scheduled_at) > new Date() && (
                      <Badge variant="outline" className="text-orange-600">
                        <Clock className="h-3 w-3 mr-1" />
                        Scheduled
                      </Badge>
                    )}
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {event.id.slice(0, 8)}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}