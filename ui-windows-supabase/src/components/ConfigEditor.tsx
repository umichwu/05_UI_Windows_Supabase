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
  Save,
  RefreshCw,
  Brain,
  Clock,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  TestTube
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

interface ConfigItem {
  key: string
  value: LLMConfig | OutboxRetryConfig
  updated_at: string
}

interface LLMConfig {
  url: string
  model: string
  temperature: number
  max_tokens: number
  api_key: string
}

interface OutboxRetryConfig {
  backoff: number[]
  max_attempts: number
}

export const ConfigEditor = () => {
  const [configs, setConfigs] = useState<Record<string, ConfigItem>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState<string | null>(null)

  // Temporary state for form editing
  const [tempLLM, setTempLLM] = useState<LLMConfig>({
    url: '',
    model: '',
    temperature: 0.7,
    max_tokens: 1000,
    api_key: ''
  })

  const [tempRetry, setTempRetry] = useState<OutboxRetryConfig>({
    backoff: [5, 15, 60, 300, 900, 1800, 3600],
    max_attempts: 10
  })

  // Load configurations
  const loadConfigs = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .schema('app')
        .from('config')
        .select('*')
        .in('key', ['llm', 'outbox_retry'])

      if (error) throw error

      const configMap: Record<string, ConfigItem> = {}
      data?.forEach(config => {
        configMap[config.key] = config
      })

      setConfigs(configMap)

      // Update temp states
      if (configMap.llm) {
        setTempLLM(configMap.llm.value as LLMConfig)
      }
      if (configMap.outbox_retry) {
        setTempRetry(configMap.outbox_retry.value as OutboxRetryConfig)
      }

    } catch (err) {
      console.error('Error loading configs:', err)
      setError(err instanceof Error ? err.message : 'Failed to load configurations')
    } finally {
      setLoading(false)
    }
  }

  // Save LLM configuration
  const saveLLMConfig = async () => {
    try {
      setSaving('llm')
      setError(null)

      const { error } = await supabase
        .schema('app')
        .from('config')
        .upsert({
          key: 'llm',
          value: tempLLM,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      setSuccessMessage('LLM configuration saved successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
      await loadConfigs()

    } catch (err) {
      console.error('Error saving LLM config:', err)
      setError(err instanceof Error ? err.message : 'Failed to save LLM configuration')
    } finally {
      setSaving(null)
    }
  }

  // Save Outbox Retry configuration
  const saveRetryConfig = async () => {
    try {
      setSaving('outbox_retry')
      setError(null)

      const { error } = await supabase
        .schema('app')
        .from('config')
        .upsert({
          key: 'outbox_retry',
          value: tempRetry,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      setSuccessMessage('Outbox retry configuration saved successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
      await loadConfigs()

    } catch (err) {
      console.error('Error saving retry config:', err)
      setError(err instanceof Error ? err.message : 'Failed to save retry configuration')
    } finally {
      setSaving(null)
    }
  }

  // Test LLM connection
  const testLLMConnection = async () => {
    try {
      setTestingConnection(true)
      setError(null)

      // This would typically call your LLM service
      // For now, just validate the configuration
      if (!tempLLM.url || !tempLLM.model) {
        throw new Error('URL and model are required')
      }

      if (tempLLM.url.includes('openai.com') && !tempLLM.api_key) {
        throw new Error('API key is required for OpenAI')
      }

      setSuccessMessage('LLM configuration looks valid')
      setTimeout(() => setSuccessMessage(null), 3000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed')
    } finally {
      setTestingConnection(false)
    }
  }

  // Reset to defaults
  const resetToDefaults = async (configKey: string) => {
    try {
      setSaving(configKey)
      setError(null)

      let defaultValue: LLMConfig | OutboxRetryConfig | null = null
      if (configKey === 'llm') {
        defaultValue = {
          url: 'https://api.openai.com/v1/chat/completions',
          model: 'gpt-4o-mini',
          temperature: 0.7,
          max_tokens: 1000,
          api_key: ''
        }
        setTempLLM(defaultValue)
      } else if (configKey === 'outbox_retry') {
        defaultValue = {
          backoff: [5, 15, 60, 300, 900, 1800, 3600],
          max_attempts: 10
        }
        setTempRetry(defaultValue)
      }

      if (!defaultValue) {
        throw new Error('Invalid config key')
      }

      const { error } = await supabase
        .schema('app')
        .from('config')
        .upsert({
          key: configKey,
          value: defaultValue,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      setSuccessMessage(`${configKey} reset to defaults`)
      setTimeout(() => setSuccessMessage(null), 3000)
      await loadConfigs()

    } catch (err) {
      console.error('Error resetting config:', err)
      setError(err instanceof Error ? err.message : 'Failed to reset configuration')
    } finally {
      setSaving(null)
      setShowResetDialog(null)
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  // Predefined models
  const commonModels = [
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-3.5-turbo',
    'claude-3-haiku-20240307',
    'claude-3-sonnet-20240229',
    'llama3.2:3b',
    'llama3.2:7b'
  ]

  useEffect(() => {
    loadConfigs()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          {successMessage}
        </div>
      )}

      {/* LLM Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              LLM Configuration
            </CardTitle>
            <div className="flex items-center gap-2">
              {configs.llm && (
                <Badge variant="outline" className="text-xs">
                  Updated: {formatDate(configs.llm.updated_at)}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResetDialog('llm')}
                disabled={saving === 'llm'}
              >
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* URL */}
            <div className="space-y-2">
              <Label htmlFor="llm-url">API URL</Label>
              <Input
                id="llm-url"
                placeholder="https://api.openai.com/v1/chat/completions"
                value={tempLLM.url}
                onChange={(e) => setTempLLM(prev => ({ ...prev, url: e.target.value }))}
              />
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label htmlFor="llm-model">Model</Label>
              <div className="flex gap-2">
                <Select
                  value={tempLLM.model}
                  onValueChange={(value) => setTempLLM(prev => ({ ...prev, model: value }))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {commonModels.map(model => (
                      <SelectItem key={model} value={model}>{model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Custom model"
                  value={tempLLM.model}
                  onChange={(e) => setTempLLM(prev => ({ ...prev, model: e.target.value }))}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Temperature */}
            <div className="space-y-2">
              <Label htmlFor="llm-temperature">Temperature</Label>
              <Input
                id="llm-temperature"
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={tempLLM.temperature}
                onChange={(e) => setTempLLM(prev => ({ ...prev, temperature: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            {/* Max Tokens */}
            <div className="space-y-2">
              <Label htmlFor="llm-tokens">Max Tokens</Label>
              <Input
                id="llm-tokens"
                type="number"
                min="1"
                max="8192"
                value={tempLLM.max_tokens}
                onChange={(e) => setTempLLM(prev => ({ ...prev, max_tokens: parseInt(e.target.value) || 1000 }))}
              />
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="llm-key">API Key</Label>
            <div className="flex gap-2">
              <Input
                id="llm-key"
                type={showApiKey ? 'text' : 'password'}
                placeholder="Enter your API key"
                value={tempLLM.api_key}
                onChange={(e) => setTempLLM(prev => ({ ...prev, api_key: e.target.value }))}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={saveLLMConfig}
              disabled={saving === 'llm'}
              className="flex items-center gap-2"
            >
              {saving === 'llm' ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save LLM Config
            </Button>

            <Button
              variant="outline"
              onClick={testLLMConnection}
              disabled={testingConnection}
              className="flex items-center gap-2"
            >
              {testingConnection ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4" />
              )}
              Test Connection
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Outbox Retry Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Outbox Retry Configuration
            </CardTitle>
            <div className="flex items-center gap-2">
              {configs.outbox_retry && (
                <Badge variant="outline" className="text-xs">
                  Updated: {formatDate(configs.outbox_retry.updated_at)}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResetDialog('outbox_retry')}
                disabled={saving === 'outbox_retry'}
              >
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Max Attempts */}
          <div className="space-y-2">
            <Label htmlFor="retry-max">Max Attempts</Label>
            <Input
              id="retry-max"
              type="number"
              min="1"
              max="50"
              value={tempRetry.max_attempts}
              onChange={(e) => setTempRetry(prev => ({ ...prev, max_attempts: parseInt(e.target.value) || 10 }))}
            />
            <p className="text-sm text-gray-600">
              Maximum number of retry attempts before marking as dead
            </p>
          </div>

          {/* Backoff Schedule */}
          <div className="space-y-2">
            <Label htmlFor="retry-backoff">Backoff Schedule (seconds)</Label>
            <Textarea
              id="retry-backoff"
              placeholder="5, 15, 60, 300, 900, 1800, 3600"
              value={tempRetry.backoff.join(', ')}
              onChange={(e) => {
                const values = e.target.value
                  .split(',')
                  .map(v => parseInt(v.trim()))
                  .filter(v => !isNaN(v))
                setTempRetry(prev => ({ ...prev, backoff: values }))
              }}
            />
            <p className="text-sm text-gray-600">
              Comma-separated delay times in seconds. Events will wait these intervals between retries.
            </p>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 p-4 rounded border">
            <h4 className="font-medium mb-2">Retry Schedule Preview:</h4>
            <div className="space-y-1 text-sm">
              {tempRetry.backoff.map((seconds, index) => (
                <div key={index} className="flex justify-between">
                  <span>Attempt {index + 1}:</span>
                  <span>{seconds}s ({Math.floor(seconds / 60)}m {seconds % 60}s)</span>
                </div>
              ))}
              <div className="border-t pt-1 mt-2 font-medium">
                <div className="flex justify-between">
                  <span>Max attempts:</span>
                  <span>{tempRetry.max_attempts}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={saveRetryConfig}
              disabled={saving === 'outbox_retry'}
              className="flex items-center gap-2"
            >
              {saving === 'outbox_retry' ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Retry Config
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset Dialog */}
      <AlertDialog open={!!showResetDialog} onOpenChange={() => setShowResetDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reset the {showResetDialog} configuration to defaults? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showResetDialog && resetToDefaults(showResetDialog)}
              className="bg-red-600 hover:bg-red-700"
            >
              Reset to Defaults
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}