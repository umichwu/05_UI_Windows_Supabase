'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Settings,
  Clock,
  MessageSquare,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

interface AutoSummaryConfig {
  enabled: boolean
  message_threshold: number
  priority: number
  description: string
}

interface ConversationStatus {
  conversation_id: string
  title: string
  msg_count: number
  messages_since_last_summary: number
  progress_percentage: number
  has_pending_summary: boolean
  next_summary_at_count: number
}

export const AutoSummarySettings = () => {
  const [config, setConfig] = useState<AutoSummaryConfig | null>(null)
  const [conversationStats, setConversationStats] = useState<ConversationStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tempThreshold, setTempThreshold] = useState<number>(20)

  // Load current configuration
  const loadConfig = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await (supabase as any).rpc('get_auto_summary_settings')

      if (error) throw error

      setConfig(data)
      setTempThreshold((data as any)?.message_threshold || 5)
    } catch (err) {
      console.error('Error loading config:', err)
      setError(err instanceof Error ? err.message : 'Failed to load configuration')
    } finally {
      setLoading(false)
    }
  }

  // Load conversation statistics
  const loadConversationStats = async () => {
    try {
      const { data, error } = await supabase
        .schema('app')
        .from('auto_summary_status')
        .select('*')
        .limit(10)

      if (error) throw error

      setConversationStats(data || [])
    } catch (err) {
      console.error('Error loading conversation stats:', err)
    }
  }

  // Toggle auto-summary enabled/disabled
  const toggleEnabled = async (enabled: boolean) => {
    try {
      setSaving(true)
      setError(null)

      const { error } = await (supabase as any).rpc('set_auto_summary_enabled', {
        enabled: enabled
      })

      if (error) throw error

      setConfig(prev => prev ? { ...prev, enabled } : null)
    } catch (err) {
      console.error('Error toggling auto-summary:', err)
      setError(err instanceof Error ? err.message : 'Failed to update setting')
    } finally {
      setSaving(false)
    }
  }

  // Update message threshold
  const updateThreshold = async () => {
    if (!config || tempThreshold === config.message_threshold) return

    try {
      setSaving(true)
      setError(null)

      const { error } = await (supabase as any).rpc('set_auto_summary_threshold', {
        threshold: tempThreshold
      })

      if (error) throw error

      setConfig(prev => prev ? { ...prev, message_threshold: tempThreshold } : null)
      await loadConversationStats() // Refresh stats with new threshold
    } catch (err) {
      console.error('Error updating threshold:', err)
      setError(err instanceof Error ? err.message : 'Failed to update threshold')
      setTempThreshold(config.message_threshold) // Reset on error
    } finally {
      setSaving(false)
    }
  }

  // Refresh all data
  const refreshData = async () => {
    await Promise.all([loadConfig(), loadConversationStats()])
  }

  useEffect(() => {
    refreshData()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Auto-Summary Configuration
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {config && (
            <>
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label className="text-base font-medium">
                    Auto-Summary Generation
                  </Label>
                  <p className="text-sm text-gray-600">
                    Automatically create summaries after reaching message threshold
                  </p>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={toggleEnabled}
                  disabled={saving}
                />
              </div>

              {/* Message Threshold Setting */}
              <div className="space-y-3 p-4 border rounded-lg">
                <Label className="text-base font-medium">
                  Message Threshold
                </Label>
                <p className="text-sm text-gray-600">
                  Generate summary after every N messages (5-100)
                </p>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={5}
                    max={100}
                    value={tempThreshold}
                    onChange={(e) => setTempThreshold(parseInt(e.target.value) || 20)}
                    className="w-24"
                    disabled={saving}
                  />
                  <span className="text-sm text-gray-500">messages</span>
                  {tempThreshold !== config.message_threshold && (
                    <Button
                      size="sm"
                      onClick={updateThreshold}
                      disabled={saving || tempThreshold < 5 || tempThreshold > 100}
                    >
                      {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Update'}
                    </Button>
                  )}
                </div>
              </div>

              {/* Status Display */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${config.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="font-medium">
                    {config.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <Badge variant="outline">
                  Every {config.message_threshold} messages
                </Badge>
              </div>
            </>
          )}

          {/* Refresh Button */}
          <div className="flex justify-end">
            <Button variant="outline" onClick={refreshData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conversation Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Conversation Summary Status
          </CardTitle>
        </CardHeader>

        <CardContent>
          {conversationStats.length > 0 ? (
            <div className="space-y-3">
              {conversationStats.map((conv) => (
                <div
                  key={conv.conversation_id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm truncate">
                        {conv.title || 'Untitled Conversation'}
                      </h4>
                      {conv.has_pending_summary && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          Processing
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span>{conv.msg_count} total messages</span>
                      <span>
                        {conv.messages_since_last_summary} since last summary
                      </span>
                      <span>{conv.progress_percentage}% to next</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Progress indicator */}
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          conv.progress_percentage >= 100
                            ? 'bg-green-500'
                            : conv.progress_percentage >= 80
                            ? 'bg-yellow-500'
                            : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(conv.progress_percentage, 100)}%` }}
                      />
                    </div>

                    {conv.progress_percentage >= 100 && !conv.has_pending_summary && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <Info className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p>No active conversations found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}