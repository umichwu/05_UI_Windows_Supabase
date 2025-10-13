'use client'

import { AuthGate } from '@/components/AuthGate'
import { CameraPanel } from '@/components/face/CameraPanel'
import { EnrollmentDialog } from '@/components/face/EnrollmentDialog'
import { CareCenter } from '@/components/face/CareCenter'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Camera, UserPlus, Heart } from 'lucide-react'

export default function FaceRecognitionPage() {
  const handleEnrollmentComplete = () => {
    // Reload any necessary data after enrollment
    console.log('Face enrollment completed')
  }

  return (
    <AuthGate>
      <div className="container mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Face Recognition & Emotion Detection
          </h1>
          <p className="text-gray-600">
            Advanced facial recognition with real-time emotion analysis and care monitoring
          </p>
        </div>

        <div className="flex justify-center gap-4 mb-8">
          <EnrollmentDialog onEnrollmentComplete={handleEnrollmentComplete}>
            <Button variant="outline">
              <UserPlus className="h-4 w-4 mr-2" />
              Enroll Your Face
            </Button>
          </EnrollmentDialog>
        </div>

        <Tabs defaultValue="camera" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto">
            <TabsTrigger value="camera" className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Camera
            </TabsTrigger>
            <TabsTrigger value="care" className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Care Center
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="camera" className="space-y-6">
            <div className="max-w-4xl mx-auto">
              <CameraPanel />
            </div>
          </TabsContent>

          <TabsContent value="care" className="space-y-6">
            <CareCenter />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <div className="max-w-2xl mx-auto">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Configuration Settings</h3>
                <p className="text-gray-600 mb-4">
                  Face recognition and emotion detection settings will be available here.
                </p>
                <p className="text-sm text-gray-500">
                  Configure detection thresholds, emotion sensitivity, and care rule preferences.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Information Cards */}
        <div className="mt-12 grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <Camera className="h-6 w-6 text-blue-600" />
              <h3 className="font-semibold text-blue-900">Real-time Detection</h3>
            </div>
            <p className="text-blue-700 text-sm">
              Continuous face recognition and emotion analysis using advanced AI models.
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <UserPlus className="h-6 w-6 text-green-600" />
              <h3 className="font-semibold text-green-900">Face Enrollment</h3>
            </div>
            <p className="text-green-700 text-sm">
              Secure face profile registration with multiple image samples for accuracy.
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <Heart className="h-6 w-6 text-red-600" />
              <h3 className="font-semibold text-red-900">Emotion Care</h3>
            </div>
            <p className="text-red-700 text-sm">
              Automated care triggers based on emotional patterns and wellbeing monitoring.
            </p>
          </div>
        </div>
      </div>
    </AuthGate>
  )
}