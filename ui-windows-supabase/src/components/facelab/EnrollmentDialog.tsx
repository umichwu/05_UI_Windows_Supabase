'use client'

import { useState, useRef, useCallback } from 'react'
import { enrollFace } from '@/lib/faceApi'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Camera,
  Trash,
  UserPlus,
  CheckCircle
} from 'lucide-react'
import { toast } from 'sonner'

interface EnrollmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EnrollmentDialog({ open, onOpenChange }: EnrollmentDialogProps) {
  const [label, setLabel] = useState('')
  const [capturedImages, setCapturedImages] = useState<string[]>([])
  const [isCapturing, setIsCapturing] = useState(false)
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [step, setStep] = useState<'input' | 'capture' | 'success'>('input')

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const requiredImages = 5
  const progress = (capturedImages.length / requiredImages) * 100

  // Start camera for enrollment
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setIsCapturing(true)
    } catch (error) {
      toast.error('Camera Error', {
        description: 'Failed to access camera for enrollment'
      })
    }
  }, [])

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setIsCapturing(false)
  }, [])

  // Capture image from video
  const captureImage = useCallback(() => {
    if (!videoRef.current || capturedImages.length >= requiredImages) return

    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(videoRef.current, 0, 0)

    // Convert to base64
    const base64Image = canvas.toDataURL('image/jpeg', 0.8)
    setCapturedImages(prev => [...prev, base64Image])

    toast.success(`Image ${capturedImages.length + 1}/${requiredImages} captured!`)

    // Auto advance to enrollment if we have enough images
    if (capturedImages.length + 1 >= requiredImages) {
      setTimeout(() => {
        stopCamera()
      }, 1000)
    }
  }, [capturedImages.length, requiredImages, stopCamera])

  // Remove captured image
  const removeImage = useCallback((index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index))
  }, [])

  // Submit enrollment
  const handleEnroll = useCallback(async () => {
    if (!label.trim() || capturedImages.length < 3) {
      toast.error('Enrollment Error', {
        description: 'Please provide a name and capture at least 3 images'
      })
      return
    }

    setIsEnrolling(true)

    try {
      const result = await enrollFace(label.trim(), capturedImages)

      if (result.success) {
        toast.success('Enrollment Successful!', {
          description: `Created ${result.profiles_created} face profile(s) for ${label}`
        })
        setStep('success')

        // Auto close after 2 seconds
        setTimeout(() => {
          handleClose()
        }, 2000)
      } else {
        throw new Error(result.error || 'Enrollment failed')
      }
    } catch (error) {
      toast.error('Enrollment Failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsEnrolling(false)
    }
  }, [label, capturedImages])

  // Reset and close dialog
  const handleClose = useCallback(() => {
    stopCamera()
    setLabel('')
    setCapturedImages([])
    setStep('input')
    setIsCapturing(false)
    setIsEnrolling(false)
    onOpenChange(false)
  }, [onOpenChange, stopCamera])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Person</DialogTitle>
          <DialogDescription>
            Enroll a new person for face recognition. Capture 3-5 clear photos of their face.
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="person-name">Person's Name</Label>
              <Input
                id="person-name"
                placeholder="Enter full name..."
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && label.trim()) {
                    setStep('capture')
                    startCamera()
                  }
                }}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setStep('capture')
                  startCamera()
                }}
                disabled={!label.trim()}
              >
                Start Capture
              </Button>
            </div>
          </div>
        )}

        {step === 'capture' && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-medium">Capturing photos for: {label}</h3>
              <Progress value={progress} className="mt-2" />
              <p className="text-sm text-muted-foreground mt-1">
                {capturedImages.length}/{requiredImages} images captured
              </p>
            </div>

            {/* Video Preview */}
            <Card className="relative">
              <CardContent className="p-4">
                <video
                  ref={videoRef}
                  className="w-full max-w-md mx-auto rounded-lg bg-black"
                  autoPlay
                  muted
                  playsInline
                />

                {isCapturing && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Button
                      size="lg"
                      onClick={captureImage}
                      disabled={capturedImages.length >= requiredImages}
                      className="bg-white/20 backdrop-blur-sm hover:bg-white/30"
                    >
                      <Camera className="w-6 h-6 mr-2" />
                      Capture ({capturedImages.length + 1}/{requiredImages})
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Captured Images Grid */}
            {capturedImages.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Captured Images:</h4>
                <div className="grid grid-cols-3 gap-2">
                  {capturedImages.map((image, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={image}
                        alt={`Capture ${index + 1}`}
                        className="w-full h-24 object-cover rounded border"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(index)}
                      >
                        <Trash className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>

              <div className="space-x-2">
                <Button
                  variant="outline"
                  onClick={stopCamera}
                  disabled={capturedImages.length === 0}
                >
                  Stop Camera
                </Button>
                <Button
                  onClick={handleEnroll}
                  disabled={capturedImages.length < 3 || isEnrolling}
                >
                  {isEnrolling ? (
                    <>Enrolling...</>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Enroll Person
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-8 space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <h3 className="text-lg font-medium">Enrollment Successful!</h3>
            <p className="text-muted-foreground">
              {label} has been successfully enrolled for face recognition.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}