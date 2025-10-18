'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useState } from 'react'
import { Plus, MessageCircle, Archive, MoreHorizontal, Edit2, Trash2, ArchiveRestore } from 'lucide-react'
import { useConversations } from '@/hooks/useConversations'
import { Conversation } from '@/lib/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ConversationListProps {
  selectedConversationId: string | null
  onConversationSelect: (conversationId: string) => void
  className?: string
}

export const ConversationList = ({ selectedConversationId, onConversationSelect, className }: ConversationListProps) => {
  const {
    conversations,
    loading,
    error,
    createConversation,
    renameConversation,
    archiveConversation,
    deleteConversation
  } = useConversations()

  const [isCreating, setIsCreating] = useState(false)
  const [newConversationTitle, setNewConversationTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null)

  const activeConversations = conversations.filter(c => c.status === 'active')
  const archivedConversations = conversations.filter(c => c.status === 'archived')

  const handleCreateConversation = async () => {
    if (!newConversationTitle.trim()) return

    const conversation = await createConversation(newConversationTitle.trim())
    if (conversation) {
      onConversationSelect(conversation.id)
      setNewConversationTitle('')
      setIsCreating(false)
    }
  }

  const handleRenameConversation = async (id: string) => {
    if (!editTitle.trim()) return

    const success = await renameConversation(id, editTitle.trim())
    if (success) {
      setEditingId(null)
      setEditTitle('')
    }
  }

  const handleDeleteConversation = async (id: string) => {
    const success = await deleteConversation(id)
    if (success) {
      if (selectedConversationId === id) {
        onConversationSelect('')
      }
      setDeleteDialogId(null)
    }
  }

  const ConversationItem = ({ conversation, showArchived = false }: { conversation: Conversation; showArchived?: boolean }) => {
    const isSelected = selectedConversationId === conversation.id
    const isEditing = editingId === conversation.id

    return (
      <div
        key={conversation.id}
        className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
          isSelected ? 'bg-blue-100 border-blue-200' : 'hover:bg-gray-100'
        }`}
        onClick={() => !isEditing && onConversationSelect(conversation.id)}
      >
        <MessageCircle className="h-4 w-4 text-gray-500 flex-shrink-0" />
        
        {isEditing ? (
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameConversation(conversation.id)
              if (e.key === 'Escape') {
                setEditingId(null)
                setEditTitle('')
              }
            }}
            onBlur={() => handleRenameConversation(conversation.id)}
            className="flex-1 h-6 text-sm"
            autoFocus
          />
        ) : (
          <span className="flex-1 text-sm truncate">
            {conversation.title || 'New Conversation'}
          </span>
        )}

        {showArchived && (
          <Badge variant="secondary" className="text-xs">
            Archived
          </Badge>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                setEditingId(conversation.id)
                setEditTitle(conversation.title || '')
              }}
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                archiveConversation(conversation.id, conversation.status !== 'archived')
              }}
            >
              {conversation.status === 'archived' ? (
                <>
                  <ArchiveRestore className="h-4 w-4 mr-2" />
                  Unarchive
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                setDeleteDialogId(conversation.id)
              }}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="text-sm text-gray-500">Loading conversations...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="text-sm text-red-500">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Conversations</h2>
          <Button
            onClick={() => setIsCreating(!isCreating)}
            size="sm"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {isCreating && (
          <div className="flex gap-2">
            <Input
              value={newConversationTitle}
              onChange={(e) => setNewConversationTitle(e.target.value)}
              placeholder="Conversation title..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateConversation()
                if (e.key === 'Escape') {
                  setIsCreating(false)
                  setNewConversationTitle('')
                }
              }}
              className="flex-1"
              autoFocus
            />
            <Button onClick={handleCreateConversation} size="sm">
              Create
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="recent" className="h-full flex flex-col">
          <div className="px-4 pt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="recent">Recent ({activeConversations.length})</TabsTrigger>
              <TabsTrigger value="archived">Archived ({archivedConversations.length})</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="recent" className="flex-1 overflow-auto px-4 pb-4">
            <div className="space-y-1">
              {activeConversations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No conversations yet</p>
                  <p className="text-xs">Create your first conversation to get started</p>
                </div>
              ) : (
                activeConversations.map(conversation => (
                  <ConversationItem key={conversation.id} conversation={conversation} />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="archived" className="flex-1 overflow-auto px-4 pb-4">
            <div className="space-y-1">
              {archivedConversations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Archive className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No archived conversations</p>
                </div>
              ) : (
                archivedConversations.map(conversation => (
                  <ConversationItem key={conversation.id} conversation={conversation} showArchived />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialogId} onOpenChange={() => setDeleteDialogId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this conversation? This action cannot be undone and all messages will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteDialogId && handleDeleteConversation(deleteDialogId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}