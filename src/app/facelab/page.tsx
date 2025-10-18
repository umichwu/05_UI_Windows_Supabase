'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { useFaceStore } from '@/lib/faceStore'
import { CameraPreview } from '@/components/facelab/CameraPreview'
import { PeoplePanel } from '@/components/facelab/PeoplePanel'
import { ControlsBar } from '@/components/facelab/ControlsBar'
import { StatusBar } from '@/components/facelab/StatusBar'
import { Toaster } from '@/components/ui/sonner'

export default function FaceLabPage() {
  const [isHydrated, setIsHydrated] = useState(false)
  const { removeStalePeople } = useFaceStore()

  // Prevent hydration mismatch
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Clean up stale people every second
  useEffect(() => {
    const interval = setInterval(() => {
      removeStalePeople()
    }, 1000)

    return () => clearInterval(interval)
  }, [removeStalePeople])

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Face Recognition Lab</h1>
            <p className="text-muted-foreground mt-2">
              Loading...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Face Recognition Lab</h1>
          <p className="text-muted-foreground mt-2">
            Real-time face detection, recognition, and emotion analysis (v1.8.5)
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Left: Camera Preview */}
          <div className="lg:col-span-2">
            <Card className="p-4">
              <h2 className="text-xl font-semibold mb-4">Camera Preview</h2>
              <CameraPreview />
            </Card>
          </div>

          {/* Right: People Panel */}
          <div className="lg:col-span-1">
            <Card className="p-4">
              <PeoplePanel />
            </Card>
          </div>
        </div>

        {/* Bottom: Controls */}
        <div className="grid grid-cols-1 gap-6">
          <Card className="p-4">
            <ControlsBar />
          </Card>
        </div>

        {/* Status Bar */}
        <div className="mt-6">
          <StatusBar />
        </div>
      </div>

      <Toaster />
    </div>
  )
}