'use client'

import { useEffect, useState } from 'react'
import { useFaceStore } from '@/lib/faceStore'
import { checkFaceApiHealth } from '@/lib/faceApi'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Database,
  Camera,
  Wifi
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function StatusBar() {
  const { recording, sessionCounters, fps } = useFaceStore()
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(null)
  const [faceApiConnected, setFaceApiConnected] = useState<boolean | null>(null)

  // Check Supabase connection
  useEffect(() => {
    const checkSupabaseConnection = async () => {
      try {
        // Use conversations table instead of profiles (which doesn't exist)
        const { data, error } = await supabase
          .from('conversations')
          .select('id')
          .limit(1)

        setSupabaseConnected(!error)
      } catch (error) {
        setSupabaseConnected(false)
      }
    }

    checkSupabaseConnection()

    // Check every 30 seconds
    const interval = setInterval(checkSupabaseConnection, 30000)
    return () => clearInterval(interval)
  }, [])

  // Check Face API connection
  useEffect(() => {
    const checkFaceApi = async () => {
      const isHealthy = await checkFaceApiHealth()
      setFaceApiConnected(isHealthy)
    }

    checkFaceApi()

    // Check every 30 seconds
    const interval = setInterval(checkFaceApi, 30000)
    return () => clearInterval(interval)
  }, [])

  const getConnectionIcon = (connected: boolean | null) => {
    if (connected === null) return <AlertCircle className="w-4 h-4" />
    return connected
      ? <CheckCircle className="w-4 h-4 text-green-500" />
      : <XCircle className="w-4 h-4 text-red-500" />
  }

  const getConnectionStatus = (connected: boolean | null) => {
    if (connected === null) return 'checking...'
    return connected ? 'connected' : 'disconnected'
  }

  const getConnectionColor = (connected: boolean | null) => {
    if (connected === null) return 'secondary'
    return connected ? 'default' : 'destructive'
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Connection Status */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4" />
              <span className="text-sm">Supabase:</span>
              <Badge variant={getConnectionColor(supabaseConnected)}>
                {getConnectionIcon(supabaseConnected)}
                <span className="ml-1">{getConnectionStatus(supabaseConnected)}</span>
              </Badge>
            </div>

            <div className="flex items-center space-x-2">
              <Wifi className="w-4 h-4" />
              <span className="text-sm">Face API:</span>
              <Badge variant={getConnectionColor(faceApiConnected)}>
                {getConnectionIcon(faceApiConnected)}
                <span className="ml-1">{getConnectionStatus(faceApiConnected)}</span>
              </Badge>
            </div>
          </div>

          {/* Recording Status */}
          <div className="flex items-center space-x-2">
            <Camera className="w-4 h-4" />
            <span className="text-sm">Recording:</span>
            <Badge variant={recording ? 'default' : 'secondary'}>
              {recording ? 'ON' : 'OFF'}
            </Badge>
          </div>

          {/* Session Info */}
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <span>FPS: {fps}</span>
            <span>Faces: {sessionCounters.totalFaces}</span>
            <span>Frames: {sessionCounters.totalFrames}</span>
          </div>

          {/* Environment Info */}
          <div className="text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              v1.7.0 - {new Date().toLocaleTimeString()}
            </Badge>
            {process.env.NODE_ENV === 'development' && (
              <Badge variant="outline" className="text-xs ml-2">
                DEV MODE
              </Badge>
            )}
            {!process.env.NEXT_PUBLIC_FACE_API_BASE_URL && (
              <Badge variant="outline" className="text-xs ml-2">
                MOCK API
              </Badge>
            )}
          </div>
        </div>

        {/* Warnings */}
        {!supabaseConnected && (
          <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
            ⚠️ Database connection failed - face events will not be stored
          </div>
        )}

        {!faceApiConnected && (
          <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
            ⚠️ Face API unreachable - using mock recognition data
          </div>
        )}
      </CardContent>
    </Card>
  )
}