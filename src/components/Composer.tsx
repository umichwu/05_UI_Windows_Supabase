'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, Smile, Square, Settings, Upload, X } from 'lucide-react'

interface ComposerProps {
  onSendMessage: (message: string, attachments?: File[], mode?: 'dev' | 'outbox') => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

type ComposerMode = 'dev' | 'outbox'

export const Composer = ({
  onSendMessage,
  disabled = false,
  placeholder = "Type your message... (Ctrl+V to paste images)",
  className
}: ComposerProps) => {
  const [message, setMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [mode, setMode] = useState<ComposerMode>('dev')
  const [attachments, setAttachments] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [pasteSuccess, setPasteSuccess] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSendMessage = () => {
    const trimmedMessage = message.trim()
    if ((!trimmedMessage && attachments.length === 0) || disabled || isProcessing) return

    // Set processing state immediately
    setIsProcessing(true)

    onSendMessage(trimmedMessage, attachments, mode)
    setMessage('')
    setAttachments([])
    setIsTyping(false)

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // Reset processing state after a short delay (in case the parent doesn't set disabled)
    setTimeout(() => {
      if (!disabled) {
        setIsProcessing(false)
      }
    }, 1000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    const imageItems = Array.from(items).filter(item => item.type.startsWith('image/'))
    if (imageItems.length === 0) return

    e.preventDefault()

    let pastedCount = 0
    for (const item of imageItems) {
      const file = item.getAsFile()
      if (file) {
        // Validate file size
        const maxSize = 50 * 1024 * 1024 // 50MB
        if (file.size > maxSize) {
          setUploadError(`Pasted image too large: ${file.name || 'clipboard-image'}. Maximum size is 50MB.`)
          continue
        }

        // Create a file with a proper name if it doesn't have one
        const fileName = file.name || `clipboard-image-${Date.now()}.png`
        const renamedFile = new File([file], fileName, { type: file.type })

        setAttachments(prev => [...prev, renamedFile])
        setUploadError(null)
        pastedCount++
      }
    }

    // Show success message
    if (pastedCount > 0) {
      setPasteSuccess(`✅ ${pastedCount} image${pastedCount > 1 ? 's' : ''} pasted from clipboard`)
      setTimeout(() => setPasteSuccess(null), 3000)
    }
  }

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
    }
  }

  useEffect(() => {
    adjustTextareaHeight()
  }, [message])

  useEffect(() => {
    if (disabled) {
      setIsProcessing(false)
    }
  }, [disabled])

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setMessage(value)
    setIsTyping(value.length > 0)
  }

  const handleStopGenerating = () => {
    // This would be used to stop AI generation in a real implementation
    console.log('Stop generating (not implemented)')
  }

  // File upload handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setUploadError(null)

    // Validate file sizes
    const maxSize = 50 * 1024 * 1024 // 50MB
    const oversizedFiles = files.filter(file => file.size > maxSize)

    if (oversizedFiles.length > 0) {
      setUploadError(`File(s) too large: ${oversizedFiles.map(f => f.name).join(', ')}. Maximum size is 50MB.`)
      return
    }

    setAttachments(prev => [...prev, ...files])
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    setUploadError(null)

    // Validate file sizes
    const maxSize = 50 * 1024 * 1024 // 50MB
    const oversizedFiles = files.filter(file => file.size > maxSize)

    if (oversizedFiles.length > 0) {
      setUploadError(`File(s) too large: ${oversizedFiles.map(f => f.name).join(', ')}. Maximum size is 50MB.`)
      return
    }

    setAttachments(prev => [...prev, ...files])
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className={`bg-white border-t p-4 ${className}`}>
      {/* Mode Toggle */}
      <div className="flex items-center justify-between mb-3 max-w-4xl mx-auto">
        <div className="flex items-center gap-2">
          <Badge
            variant={mode === 'dev' ? 'default' : 'secondary'}
            className="cursor-pointer"
            onClick={() => setMode('dev')}
          >
            <Settings className="h-3 w-3 mr-1" />
            Dev Mode
          </Badge>
          <Badge
            variant={mode === 'outbox' ? 'default' : 'secondary'}
            className="cursor-pointer"
            onClick={() => setMode('outbox')}
          >
            Outbox Mode
          </Badge>
        </div>
        <div className="text-xs text-gray-500">
          {mode === 'dev' ? 'LLM will respond automatically' : 'Messages queued for processing'}
        </div>
      </div>

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="mb-3 max-w-4xl mx-auto">
          <div className="flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div key={index} className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1 text-sm">
                <Paperclip className="h-3 w-3" />
                <span className="truncate max-w-[150px]">{file.name}</span>
                <span className="text-gray-500">({formatFileSize(file.size)})</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-red-100"
                  onClick={() => removeAttachment(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Error */}
      {uploadError && (
        <div className="mb-3 max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-sm text-red-600">
            {uploadError}
            <button
              onClick={() => setUploadError(null)}
              className="ml-2 text-red-400 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Paste Success */}
      {pasteSuccess && (
        <div className="mb-3 max-w-4xl mx-auto">
          <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-sm text-green-600">
            {pasteSuccess}
            <button
              onClick={() => setPasteSuccess(null)}
              className="ml-2 text-green-400 hover:text-green-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div
        className={`flex items-end gap-2 max-w-4xl mx-auto ${
          isDragging ? 'bg-blue-50 border-blue-200 border-2 border-dashed rounded-lg p-2' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* File Upload Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
        />

        {/* Attachment Button */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 flex-shrink-0"
          disabled={disabled || isProcessing}
          onClick={() => fileInputRef.current?.click()}
          title="Attach files (drag & drop supported)"
        >
          <Upload className="h-4 w-4" />
        </Button>

        {/* Message Input Container */}
        <div className="flex-1 relative">
          <div className="relative border border-gray-300 rounded-lg focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={placeholder}
              disabled={disabled || isProcessing}
              rows={1}
              className="w-full px-3 py-2 pr-12 bg-transparent resize-none outline-none text-sm placeholder-gray-500 min-h-[40px] max-h-[120px]"
              style={{ height: 'auto' }}
            />
            
            {/* Character/Word Counter (optional) */}
            {message.length > 200 && (
              <div className="absolute bottom-1 left-3 text-xs text-gray-400">
                {message.length}/1000
              </div>
            )}

            {/* Emoji Button */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute bottom-1 right-1 h-6 w-6 p-0"
              disabled={disabled}
              title="Add emoji (coming soon)"
            >
              <Smile className="h-3 w-3" />
            </Button>
          </div>

          {/* Typing Indicator */}
          {isTyping && !isProcessing && (
            <div className="absolute -top-6 left-0 text-xs text-gray-500">
              Press Enter to send, Shift+Enter for new line
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="absolute -top-6 left-0 text-xs text-blue-600 flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              Processing your message...
            </div>
          )}
        </div>

        {/* Send/Stop Button */}
        {disabled ? (
          <Button
            onClick={handleStopGenerating}
            variant="outline"
            size="sm"
            className="mb-2 flex-shrink-0 bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
            title="Stop generating"
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || disabled || isProcessing}
            size="sm"
            className="mb-2 flex-shrink-0"
            title="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between text-xs text-gray-500 mt-2 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <span>AI Assistant can make mistakes. Verify important information.</span>
        </div>
        <div className="flex items-center gap-2">
          {isProcessing && !disabled && (
            <>
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <span>Processing...</span>
            </>
          )}
          {disabled && (
            <>
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
              <span>AI is typing...</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}