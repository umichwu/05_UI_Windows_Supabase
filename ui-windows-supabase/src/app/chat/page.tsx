'use client'

import { useState, useEffect } from 'react'
import { AuthGate } from '@/components/AuthGate'
import { ConversationList } from '@/components/ConversationList'
import { ChatHeader } from '@/components/ChatHeader'
import { MessageStream } from '@/components/MessageStream'
import { Composer } from '@/components/Composer'
import { DatabaseTest } from '@/components/DatabaseTest'
import { PerformanceMonitor } from '@/components/PerformanceMonitor'
import { ThinkingIndicator } from '@/components/ThinkingIndicator'
import { useConversations } from '@/hooks/useConversations'
import { useMessages } from '@/hooks/useMessages'

function ChatPageContent() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [isOnline] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showDatabaseTest, setShowDatabaseTest] = useState(false)
  const [selectedModel, setSelectedModel] = useState<'chatgpt' | 'gemini'>('chatgpt')

  const { conversations, createConversation } = useConversations()
  const { messages, sendMessage, deleteMessage, loading: messagesLoading } = useMessages(selectedConversationId)

  const selectedConversation = conversations.find(c => c.id === selectedConversationId) || null

  // Auto-select first conversation or create one if none exist
  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].id)
    }
  }, [conversations, selectedConversationId])

  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversationId(conversationId)
  }


const handleSendMessage = async (content: string, attachments?: File[], mode: 'dev' | 'outbox' = 'dev') => {
  let conversationId = selectedConversationId;

  if (!conversationId) {
    const title = (content.trim() || 'New chat').slice(0, 50);
    const newConv = await createConversation(title);
    if (!newConv) {
      console.error('Failed to create conversation');
      return;
    }
    conversationId = newConv.id;
    setSelectedConversationId(conversationId); // state may lag; use the local var below
  }

  setIsGenerating(true);
  try {
    const message = await sendMessage(content, conversationId, attachments, mode, selectedModel);
    if (!message) throw new Error('sendMessage returned null');
  } catch (e) {
    console.error('Error sending message:', e instanceof Error ? e.message : e);
  } finally {
    setIsGenerating(false);
  }
};


  const handleDeleteMessage = async (messageId: string) => {
    await deleteMessage(messageId)
  }

  // Sidebar content for mobile sheet
  const sidebarContent = (
    <ConversationList
      selectedConversationId={selectedConversationId}
      onConversationSelect={handleConversationSelect}
      className="h-full"
    />
  )

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-80 bg-white border-r">
        <ConversationList
          selectedConversationId={selectedConversationId}
          onConversationSelect={handleConversationSelect}
          className="h-full"
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <ChatHeader
          conversation={selectedConversation}
          isOnline={isOnline}
          sidebarContent={sidebarContent}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />

        {/* Database Test Toggle Button */}
        <div className="p-2 bg-yellow-50 border-b">
          <button
            onClick={() => setShowDatabaseTest(!showDatabaseTest)}
            className="text-sm text-blue-600 hover:underline"
          >
            {showDatabaseTest ? 'Hide Database Test' : 'Show Database Test'}
          </button>
        </div>

        {/* Database Test Panel */}
        {showDatabaseTest && (
          <div className="p-4 bg-gray-100 border-b">
            <DatabaseTest />
          </div>
        )}

        {/* Messages */}
        <MessageStream
          messages={messages}
          loading={messagesLoading}
          onDeleteMessage={handleDeleteMessage}
          className="flex-1"
        />

        {/* Thinking Indicator */}
        <ThinkingIndicator show={isGenerating} />

        {/* Composer */}
        <Composer
          onSendMessage={handleSendMessage}
          disabled={isGenerating}
          placeholder={
            selectedConversation
              ? "Type your message..."
              : "Type your message to start a new conversation..."
          }
        />
      </div>

      {/* Performance Monitor - floating overlay */}
      <PerformanceMonitor />
    </div>
  )
}

export default function ChatPage() {
  return (
    <AuthGate>
      <ChatPageContent />
    </AuthGate>
  )
}