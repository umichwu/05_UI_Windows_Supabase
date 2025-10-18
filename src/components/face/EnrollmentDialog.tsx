'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Upload, Camera, X, CheckCircle2, AlertCircle, UserPlus } from 'lucide-react'

interface EnrollmentSample {
  file: File
  preview: string
  processed: boolean
  error?: string
}

interface EnrollmentDialogProps {
  children?: React.ReactNode
  onEnrollmentComplete?: () => void
}

export const EnrollmentDialog = ({ children, onEnrollmentComplete }: EnrollmentDialogProps) => {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [samples, setSamples] = useState<EnrollmentSample[]>([])
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [enrollmentResult, setEnrollmentResult] = useState<{ success: boolean; message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])

    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const preview = e.target?.result as string
          setSamples(prev => [...prev, {
            file,
            preview,
            processed: false
          }])
        }
        reader.readAsDataURL(file)
      }
    })

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const removeSample = useCallback((index: number) => {
    setSamples(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleEnrollment = useCallback(async () => {
    if (!label.trim() || samples.length === 0) {
      setEnrollmentResult({ success: false, message: 'Please provide a label and at least one image' })
      return
    }

    setIsEnrolling(true)
    setEnrollmentResult(null)

    try {
      const formData = new FormData()
      formData.append('label', label.trim())

      samples.forEach((sample, index) => {
        formData.append(`images`, sample.file)
      })

      const response = await fetch('/api/face/enroll', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (response.ok) {
        setEnrollmentResult({
          success: true,
          message: `Successfully enrolled ${result.profiles_created} face profile(s) for "${label}"`
        })

        // Reset form
        setTimeout(() => {
          setLabel('')
          setSamples([])
          setEnrollmentResult(null)
          setOpen(false)
          onEnrollmentComplete?.()
        }, 2000)
      } else {
        setEnrollmentResult({
          success: false,
          message: result.error || 'Enrollment failed'
        })
      }
    } catch (error) {
      console.error('Enrollment error:', error)
      setEnrollmentResult({
        success: false,
        message: 'Network error during enrollment'
      })
    } finally {
      setIsEnrolling(false)
    }
  }, [label, samples, onEnrollmentComplete])

  const handleReset = useCallback(() => {
    setLabel('')
    setSamples([])
    setEnrollmentResult(null)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline">
            <UserPlus className="h-4 w-4 mr-2" />
            Enroll Face
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Face Enrollment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Enrollment Guidelines</h4>
            <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
              <li>Upload 3-5 clear photos of your face</li>
              <li>Use different angles and lighting conditions</li>
              <li>Ensure your face is clearly visible and unobstructed</li>
              <li>Avoid blurry or low-quality images</li>
            </ul>
          </div>

          {/* Label Input */}
          <div className="space-y-2">
            <Label htmlFor="label">Profile Label</Label>
            <Input
              id="label"
              placeholder="e.g., 'John Doe' or 'Primary User'"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={isEnrolling}
            />
          </div>

          {/* File Upload */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Face Images ({samples.length}/5)</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isEnrolling || samples.length >= 5}
              >
                <Upload className="h-4 w-4 mr-2" />
                Add Images
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Sample Preview Grid */}
            {samples.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {samples.map((sample, index) => (
                  <Card key={index} className="relative">
                    <CardContent className="p-3">
                      <div className="relative">
                        <img
                          src={sample.preview}
                          alt={`Sample ${index + 1}`}
                          className="w-full h-24 object-cover rounded"
                        />
                        {!isEnrolling && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-6 w-6 p-0"
                            onClick={() => removeSample(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                        {sample.processed && (
                          <Badge
                            variant="default"
                            className="absolute bottom-1 left-1 text-xs"
                          >
                            ✓
                          </Badge>
                        )}
                        {sample.error && (
                          <Badge
                            variant="destructive"
                            className="absolute bottom-1 left-1 text-xs"
                          >
                            ✗
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {samples.length === 0 && (
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-1">Click to upload face images</p>
                <p className="text-sm text-gray-500">3-5 images recommended</p>
              </div>
            )}
          </div>

          {/* Results */}
          {enrollmentResult && (
            <div className={`rounded-lg p-4 flex items-start gap-3 ${
              enrollmentResult.success
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              {enrollmentResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${
                  enrollmentResult.success ? 'text-green-900' : 'text-red-900'
                }`}>
                  {enrollmentResult.success ? 'Enrollment Successful' : 'Enrollment Failed'}
                </p>
                <p className={`text-sm mt-1 ${
                  enrollmentResult.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {enrollmentResult.message}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={isEnrolling}
            >
              Reset
            </Button>
            <Button
              onClick={handleEnrollment}
              disabled={isEnrolling || !label.trim() || samples.length === 0}
              className="min-w-32"
            >
              {isEnrolling ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Enrolling...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Enroll Face
                </>
              )}
            </Button>
          </div>

          {/* Min samples recommendation */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Minimum 1 image required, 3-5 images recommended for better accuracy
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}