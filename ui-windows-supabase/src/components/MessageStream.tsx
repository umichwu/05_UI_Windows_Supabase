'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useEffect, useRef, useState } from 'react'
import { Bot, User, Copy, Trash2, MoreHorizontal, Download, Eye } from 'lucide-react'
import { Message, MessageAttachment } from '@/lib/types'
import { useAuthStore } from '@/lib/auth-store'
import { getSignedUrl, getFileIcon, isImageFile, isVideoFile } from '@/lib/storage'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface MessageStreamProps {
  messages: Message[]
  loading?: boolean
  onDeleteMessage?: (messageId: string) => void
  className?: string
}

export const MessageStream = ({ 
  messages, 
  loading = false, 
  onDeleteMessage,
  className 
}: MessageStreamProps) => {
  const { user } = useAuthStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString()
    }
  }

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { [key: string]: Message[] } = {}
    
    messages.forEach(message => {
      const date = new Date(message.created_at).toDateString()
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(message)
    })
    
    return Object.entries(groups)
  }

  // Attachment component
  const AttachmentItem = ({ attachment }: { attachment: MessageAttachment }) => {
    const [signedUrl, setSignedUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const loadSignedUrl = async () => {
      if (loading || signedUrl) return
      setLoading(true)
      const url = await getSignedUrl(attachment.storage_object_path)
      setSignedUrl(url)
      setLoading(false)
    }

    useEffect(() => {
      loadSignedUrl()
    }, [attachment.storage_object_path])

    const fileName = attachment.storage_object_path.split('/').pop() || 'file'
    const fileSize = attachment.bytes ? Math.round(attachment.bytes / 1024) : 0
    const isImage = isImageFile(attachment.mime_type || '')
    const isVideo = isVideoFile(attachment.mime_type || '')

    const handleDownload = async () => {
      if (!signedUrl) return
      const link = document.createElement('a')
      link.href = signedUrl
      link.download = fileName
      link.click()
    }

    const handlePreview = () => {
      if (!signedUrl) return
      window.open(signedUrl, '_blank')
    }

    return (
      <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 mt-2">
        {/* Thumbnail for images */}
        {isImage && signedUrl && (
          <div className="w-16 h-16 rounded overflow-hidden bg-gray-200 flex-shrink-0">
            <img
              src={signedUrl}
              alt={fileName}
              className="w-full h-full object-cover cursor-pointer"
              onClick={handlePreview}
            />
          </div>
        )}

        {/* Video thumbnail */}
        {isVideo && signedUrl && (
          <div className="w-16 h-16 rounded overflow-hidden bg-gray-200 flex-shrink-0 relative">
            <video
              src={signedUrl}
              className="w-full h-full object-cover cursor-pointer"
              onClick={handlePreview}
            />
            <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
              <Eye className="h-6 w-6 text-white" />
            </div>
          </div>
        )}

        {/* File icon for other types */}
        {!isImage && !isVideo && (
          <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center text-lg">
            {getFileIcon(attachment.mime_type || '')}
          </div>
        )}

        {/* File info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{fileName}</div>
          <div className="text-xs text-gray-500">
            {attachment.mime_type} • {fileSize}KB
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1">
          {(isImage || isVideo) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handlePreview}
              disabled={!signedUrl}
              title="Preview"
            >
              <Eye className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleDownload}
            disabled={!signedUrl}
            title="Download"
          >
            <Download className="h-3 w-3" />
          </Button>
        </div>
      </div>
    )
  }

  const MessageItem = ({ message }: { message: Message }) => {
    const isBot = message.role === 'assistant' || message.role === 'system'
    const canDelete = !isBot && user && message.user_id === user.id

    return (
      <div
        className={`flex gap-3 ${isBot ? 'justify-start' : 'justify-end'} group`}
      >
        {/* Bot Avatar */}
        {isBot && (
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
            <Bot className="h-4 w-4 text-white" />
          </div>
        )}

        {/* Message Content */}
        <div className={`max-w-[70%] ${isBot ? '' : 'order-1'}`}>
          <Card 
            className={`${
              isBot 
                ? 'bg-white border-gray-200' 
                : 'bg-blue-500 text-white border-blue-500'
            }`}
          >
            <CardContent className="p-3">
              {message.content && (
                <p className="text-sm whitespace-pre-wrap break-words">
                  {message.content}
                </p>
              )}

              {/* Display attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className={message.content ? 'mt-2' : ''}>
                  {message.attachments.map((attachment) => (
                    <AttachmentItem key={attachment.id} attachment={attachment} />
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-2">
                <p className={`text-xs ${
                  isBot ? 'text-gray-500' : 'text-blue-100'
                }`}>
                  {formatTime(message.created_at)}
                </p>
                
                {/* Message Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-6 w-6 p-0 ${
                      isBot 
                        ? 'hover:bg-gray-100' 
                        : 'hover:bg-blue-400 text-blue-100 hover:text-white'
                    }`}
                    onClick={() => copyToClipboard(message.content || '')}
                    title="Copy message"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  
                  {canDelete && onDeleteMessage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-blue-400 text-blue-100 hover:text-white"
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onDeleteMessage(message.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Avatar */}
        {!isBot && (
          <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center flex-shrink-0 order-2">
            <User className="h-4 w-4 text-white" />
          </div>
        )}
      </div>
    )
  }

  if (loading && messages.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Loading messages...</p>
        </div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot className="h-8 w-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Start a conversation</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            Send a message to begin your conversation with the AI assistant.
          </p>
        </div>
      </div>
    )
  }

  const messageGroups = groupMessagesByDate(messages)

  return (
    <div 
      ref={containerRef}
      className={`flex-1 overflow-auto p-4 space-y-4 ${className}`}
    >
      {messageGroups.map(([dateString, dateMessages]) => (
        <div key={dateString}>
          {/* Date Separator */}
          <div className="flex items-center justify-center my-4">
            <div className="bg-gray-100 px-3 py-1 rounded-full">
              <span className="text-xs text-gray-500 font-medium">
                {formatDate(dateMessages[0].created_at)}
              </span>
            </div>
          </div>
          
          {/* Messages for this date */}
          <div className="space-y-4">
            {dateMessages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))}
          </div>
        </div>
      ))}
      
      {loading && (
        <div className="flex justify-start">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div className="ml-3 flex items-center space-x-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          </div>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  )
}