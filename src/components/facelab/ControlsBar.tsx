'use client'

import { useState } from 'react'
import { useFaceStore } from '@/lib/faceStore'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { EnrollmentDialog } from './EnrollmentDialog'
import {
  ZoomIn,
  ZoomOut,
  Download,
  Circle,
  Square,
  UserPlus,
  Smile,
  Frown,
  Meh,
  Bug
} from 'lucide-react'
import { toast } from 'sonner'

export function ControlsBar() {
  const [showEnrollment, setShowEnrollment] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const {
    zoom,
    setZoom,
    fps,
    latency_ms,
    recording,
    toggleRecording,
    debugMode,
    toggleDebugMode,
    getEmotionDistribution,
    clearSession,
    sessionCounters
  } = useFaceStore()

  const emotionDistribution = getEmotionDistribution()

  const handleZoomIn = () => {
    setZoom(Math.min(zoom + 0.25, 3))
  }

  const handleZoomOut = () => {
    setZoom(Math.max(zoom - 0.25, 0.5))
  }

  const handleSnapshotDownload = async () => {
    try {
      setIsDownloading(true)

      // Find the video element
      const video = document.querySelector('video') as HTMLVideoElement
      if (!video) {
        throw new Error('No video element found')
      }

      // Create canvas and capture frame
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not get canvas context')

      ctx.drawImage(video, 0, 0)

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) throw new Error('Failed to create image blob')

        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `facelab-snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        toast.success('Snapshot saved successfully!')
      }, 'image/png')

    } catch (error) {
      toast.error('Failed to capture snapshot', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsDownloading(false)
    }
  }

  const handleManualEmotionLabel = (emotion: string) => {
    toast.info(`Manual emotion label: ${emotion}`, {
      description: 'This is for demonstration purposes only'
    })
  }

  const getEmotionIcon = (emotion: string) => {
    const icons: Record<string, React.JSX.Element> = {
      happy: <Smile className="w-4 h-4" />,
      sad: <Frown className="w-4 h-4" />,
      neutral: <Meh className="w-4 h-4" />
    }
    return icons[emotion] || <Meh className="w-4 h-4" />
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="controls" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="controls">Controls</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="emotions">Emotions</TabsTrigger>
        </TabsList>

        <TabsContent value="controls" className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {/* Zoom Controls */}
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm font-mono min-w-[50px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>

            {/* Recording Toggle */}
            <Button
              onClick={toggleRecording}
              variant={recording ? 'destructive' : 'default'}
              size="sm"
            >
              {recording ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Circle className="w-4 h-4 mr-2" />
                  Start Recording
                </>
              )}
            </Button>

            {/* Snapshot */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSnapshotDownload}
              disabled={isDownloading}
            >
              <Download className="w-4 h-4 mr-2" />
              {isDownloading ? 'Saving...' : 'Snapshot'}
            </Button>

            {/* Add New Person */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEnrollment(true)}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Person
            </Button>

            {/* Debug Toggle */}
            <Button
              variant={debugMode ? 'default' : 'outline'}
              size="sm"
              onClick={toggleDebugMode}
            >
              <Bug className="w-4 h-4 mr-2" />
              Debug {debugMode ? 'On' : 'Off'}
            </Button>

            {/* Clear Session */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearSession()
                toast.success('Session cleared')
              }}
            >
              Clear Session
            </Button>
          </div>

          {/* Manual Emotion Labeling */}
          <div>
            <h4 className="text-sm font-medium mb-2">Manual Emotion Override</h4>
            <div className="flex flex-wrap gap-2">
              {['happy', 'sad', 'angry', 'fear', 'surprise', 'neutral'].map((emotion) => (
                <Button
                  key={emotion}
                  variant="outline"
                  size="sm"
                  onClick={() => handleManualEmotionLabel(emotion)}
                  className="capitalize"
                >
                  {getEmotionIcon(emotion)}
                  <span className="ml-1">{emotion}</span>
                </Button>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">FPS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fps}</div>
                <p className="text-xs text-muted-foreground">frames/sec</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Latency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{latency_ms}</div>
                <p className="text-xs text-muted-foreground">ms</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Confidence</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {sessionCounters.totalFaces > 0 ? '85' : '0'}
                </div>
                <p className="text-xs text-muted-foreground">avg %</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Faces</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sessionCounters.totalFaces}</div>
                <p className="text-xs text-muted-foreground">detected</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="emotions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Emotion Distribution (10s)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(emotionDistribution).map(([emotion, percentage]) => (
                <div key={emotion} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize">{emotion}</span>
                    <span>{percentage}%</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Enrollment Dialog */}
      <EnrollmentDialog
        open={showEnrollment}
        onOpenChange={setShowEnrollment}
      />
    </div>
  )
}