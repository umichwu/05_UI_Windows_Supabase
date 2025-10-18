/**
 * AttachmentGrid.tsx - Display and manage message attachments
 * Shows uploaded files with preview, download, and lightbox functionality
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  File,
  Image as ImageIcon,
  Video,
  AudioLines as Audio,
  Download,
  Eye,
  X,
  FileText,
  Archive
} from 'lucide-react'

interface Attachment {
  id: string
  storage_object_path: string
  mime_type?: string
  bytes?: number
  sha256?: string
  created_at: string
}

interface AttachmentGridProps {
  attachments: Attachment[]
  className?: string
}

export const AttachmentGrid = ({ attachments, className = '' }: AttachmentGridProps) => {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  // Get file icon based on mime type
  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return <File className="h-6 w-6" />

    if (mimeType.startsWith('image/')) return <ImageIcon className="h-6 w-6" />
    if (mimeType.startsWith('video/')) return <Video className="h-6 w-6" />
    if (mimeType.startsWith('audio/')) return <Audio className="h-6 w-6" />
    if (mimeType.includes('pdf')) return <FileText className="h-6 w-6" />
    if (mimeType.includes('zip') || mimeType.includes('rar')) return <Archive className="h-6 w-6" />

    return <File className="h-6 w-6" />
  }

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size'

    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'

    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  // Get file name from storage path
  const getFileName = (path: string) => {
    return path.split('/').pop() || 'Unknown file'
  }

  // Check if file is an image
  const isImage = (mimeType?: string) => {
    return mimeType?.startsWith('image/')
  }

  // Get Supabase storage URL (public bucket)
  const getStorageUrl = (path: string) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    return `${supabaseUrl}/storage/v1/object/public/chat-attachments/${path}`
  }

  // Handle image preview
  const handleImagePreview = (path: string) => {
    const url = getStorageUrl(path)
    setLightboxImage(url)
  }

  // Download file
  const handleDownload = (path: string, fileName: string) => {
    const url = getStorageUrl(path)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (!attachments || attachments.length === 0) {
    return null
  }

  return (
    <>
      <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 ${className}`}>
        {attachments.map((attachment) => {
          const fileName = getFileName(attachment.storage_object_path)
          const fileIcon = getFileIcon(attachment.mime_type)
          const fileSize = formatFileSize(attachment.bytes)
          const isImageFile = isImage(attachment.mime_type)
          const storageUrl = getStorageUrl(attachment.storage_object_path)

          return (
            <div
              key={attachment.id}
              className="border rounded-lg p-3 hover:shadow-sm transition-shadow bg-white"
            >
              {/* Image preview */}
              {isImageFile ? (
                <div className="relative mb-2">
                  <img
                    src={storageUrl}
                    alt={fileName}
                    className="w-full h-32 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => handleImagePreview(attachment.storage_object_path)}
                    onError={(e) => {
                      // Fallback to file icon if image fails to load
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 bg-white/80 hover:bg-white/90 h-6 w-6"
                    onClick={() => handleImagePreview(attachment.storage_object_path)}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center h-20 bg-gray-50 rounded mb-2 text-gray-400">
                  {fileIcon}
                </div>
              )}

              {/* File info */}
              <div className="space-y-2">
                <div className="min-h-0">
                  <p className="text-sm font-medium truncate" title={fileName}>
                    {fileName}
                  </p>
                  <p className="text-xs text-gray-500">{fileSize}</p>
                </div>

                {attachment.mime_type && (
                  <Badge variant="outline" className="text-xs">
                    {attachment.mime_type}
                  </Badge>
                )}

                {/* Actions */}
                <div className="flex gap-1">
                  {isImageFile && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => handleImagePreview(attachment.storage_object_path)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-2"
                    onClick={() => handleDownload(attachment.storage_object_path, fileName)}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Image Lightbox */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center justify-between">
              <span>Image Preview</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLightboxImage(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="p-4">
            {lightboxImage && (
              <img
                src={lightboxImage}
                alt="Preview"
                className="w-full h-auto max-h-[70vh] object-contain rounded"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}