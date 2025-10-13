import { supabase } from './supabaseClient'

export interface AttachmentUpload {
  file: File
  path: string
  bytes: number
  mimeType: string
  sha256?: string
}

export interface UploadResult {
  success: boolean
  path?: string
  url?: string
  error?: string
}

/**
 * Upload files to Supabase storage
 * Path convention: {user_id}/{conversation_id}/{message_id}/filename
 */
export const uploadToStorage = async (
  files: File[],
  userId: string,
  conversationId: string,
  messageId: string
): Promise<UploadResult[]> => {
  const results: UploadResult[] = []

  for (const file of files) {
    try {
      // Generate storage path
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const filePath = `${userId}/${conversationId}/${messageId}/${fileName}`

      // Upload to storage
      const { data, error } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('Upload error:', error)
        let errorMessage = error.message

        // Provide specific error messages
        if (error.message?.includes('Bucket not found')) {
          errorMessage = 'Storage bucket not found. Please run the fix-storage-bucket.sql script in Supabase.'
        } else if (error.message?.includes('new row violates row-level security')) {
          errorMessage = 'Permission denied. Please check storage policies.'
        } else if (error.message?.includes('File size too large')) {
          errorMessage = `File too large. Maximum size is 50MB.`
        }

        results.push({
          success: false,
          error: errorMessage
        })
        continue
      }

      // Get public URL (will be signed URL for private bucket)
      const { data: urlData } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(data.path)

      results.push({
        success: true,
        path: data.path,
        url: urlData.publicUrl
      })

    } catch (err) {
      console.error('Unexpected upload error:', err)
      results.push({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown upload error'
      })
    }
  }

  return results
}

/**
 * Get public URL for file access (works for both public and private buckets)
 * For public buckets, returns direct public URL
 * For private buckets, returns signed URL
 */
export const getSignedUrl = async (path: string, expiresIn = 3600): Promise<string | null> => {
  try {
    console.log('Getting URL for path:', path);

    // First try to get public URL (works for public buckets)
    const { data: publicUrlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(path)

    if (publicUrlData?.publicUrl) {
      console.log('Using public URL:', publicUrlData.publicUrl.substring(0, 100) + '...');

      // Test if the public URL is accessible
      try {
        const testResponse = await fetch(publicUrlData.publicUrl, { method: 'HEAD' });
        console.log('Public URL accessibility test:', testResponse.ok ? 'ACCESSIBLE' : 'NOT ACCESSIBLE', testResponse.status);

        if (testResponse.ok) {
          return publicUrlData.publicUrl;
        }
      } catch (testError) {
        console.log('Public URL test failed, falling back to signed URL:', testError);
      }
    }

    // Fallback to signed URL for private buckets
    const { data, error } = await supabase.storage
      .from('chat-attachments')
      .createSignedUrl(path, expiresIn)

    if (error) {
      console.error('Signed URL error:', error)
      return null
    }

    console.log('Signed URL generated successfully:', data.signedUrl ? 'YES' : 'NO');

    // Test if the URL is accessible
    if (data.signedUrl) {
      try {
        const testResponse = await fetch(data.signedUrl, { method: 'HEAD' });
        console.log('Signed URL accessibility test:', testResponse.ok ? 'ACCESSIBLE' : 'NOT ACCESSIBLE', testResponse.status);
      } catch (testError) {
        console.error('Signed URL test failed:', testError);
      }
    }

    return data.signedUrl
  } catch (err) {
    console.error('Unexpected URL generation error:', err)
    return null
  }
}

/**
 * Calculate SHA256 hash of file (for integrity checking)
 */
export const calculateSHA256 = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Check if file type is supported image for thumbnail generation
 */
export const isImageFile = (file: File | string): boolean => {
  const mimeType = typeof file === 'string' ? file : file.type
  return mimeType.startsWith('image/') && ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)
}

/**
 * Check if file type is supported video
 */
export const isVideoFile = (file: File | string): boolean => {
  const mimeType = typeof file === 'string' ? file : file.type
  return mimeType.startsWith('video/')
}

/**
 * Get file icon based on type
 */
export const getFileIcon = (file: File | string) => {
  const mimeType = typeof file === 'string' ? file : file.type

  if (isImageFile(mimeType)) return '🖼️'
  if (isVideoFile(mimeType)) return '🎥'
  if (mimeType.includes('audio')) return '🎵'
  if (mimeType.includes('pdf')) return '📄'
  if (mimeType.includes('document') || mimeType.includes('word')) return '📝'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📊'
  if (mimeType.includes('text')) return '📄'
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return '🗜️'
  return '📎'
}