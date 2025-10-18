'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  Brain,
  Plus,
  Edit,
  Trash2,
  Tag,
  Clock,
  Star,
  MoreVertical,
  Lightbulb,
  AlertCircle,
  CheckSquare,
  MessageSquare
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { UserMemory, MemoryType, Message } from '@/lib/types'

interface MemoryPanelProps {
  conversationId?: string
  className?: string
}

interface MemoryFormData {
  title: string
  content: string
  memory_type: MemoryType
  importance: number
  tags: string[]
}

const MEMORY_TYPES: { value: MemoryType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'preference', label: 'Preference', icon: <Star className="h-4 w-4" />, color: 'bg-purple-100 text-purple-800' },
  { value: 'fact', label: 'Fact', icon: <Lightbulb className="h-4 w-4" />, color: 'bg-blue-100 text-blue-800' },
  { value: 'context', label: 'Context', icon: <MessageSquare className="h-4 w-4" />, color: 'bg-green-100 text-green-800' },
  { value: 'general', label: 'General', icon: <Brain className="h-4 w-4" />, color: 'bg-gray-100 text-gray-800' }
]

const IMPORTANCE_LEVELS = [
  { value: 1, label: 'Very Low', color: 'text-gray-400' },
  { value: 2, label: 'Low', color: 'text-gray-500' },
  { value: 3, label: 'Low-Medium', color: 'text-gray-600' },
  { value: 4, label: 'Medium-Low', color: 'text-yellow-600' },
  { value: 5, label: 'Medium', color: 'text-yellow-700' },
  { value: 6, label: 'Medium-High', color: 'text-orange-600' },
  { value: 7, label: 'High-Medium', color: 'text-orange-700' },
  { value: 8, label: 'High', color: 'text-red-600' },
  { value: 9, label: 'Very High', color: 'text-red-700' },
  { value: 10, label: 'Critical', color: 'text-red-800 font-bold' }
]

export const MemoryPanel = ({ conversationId, className }: MemoryPanelProps) => {
  const [memories, setMemories] = useState<UserMemory[]>([])
  const [recentMessages, setRecentMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingMemory, setEditingMemory] = useState<UserMemory | null>(null)
  const [formData, setFormData] = useState<MemoryFormData>({
    title: '',
    content: '',
    memory_type: 'general',
    importance: 5,
    tags: []
  })
  const [tagInput, setTagInput] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showDistillDialog, setShowDistillDialog] = useState(false)
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set())

  // Load memories
  const loadMemories = async () => {
    try {
      setError(null)
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        throw new Error('Authentication required')
      }

      let query = supabase
        .schema('app')
        .from('user_memory')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('importance', { ascending: false })
        .order('updated_at', { ascending: false })

      if (conversationId) {
        query = query.or(`conversation_id.eq.${conversationId},conversation_id.is.null`)
      }

      const { data, error: memoryError } = await query
      if (memoryError) throw memoryError

      setMemories(data || [])
    } catch (err) {
      console.error('Error loading memories:', err)
      setError(err instanceof Error ? err.message : 'Failed to load memories')
    }
  }

  // Load recent messages for distillation
  const loadRecentMessages = async () => {
    if (!conversationId) return

    try {
      const { data, error } = await supabase
        .schema('app')
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setRecentMessages(data || [])
    } catch (err) {
      console.error('Error loading recent messages:', err)
    }
  }

  // Save memory (create or update)
  const saveMemory = async () => {
    try {
      setSaving(true)
      setError(null)

      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        throw new Error('Authentication required')
      }

      const memoryData = {
        user_id: userData.user.id,
        conversation_id: conversationId || null,
        title: formData.title.trim(),
        content: formData.content.trim(),
        memory_type: formData.memory_type,
        importance: formData.importance,
        tags: formData.tags.length > 0 ? formData.tags : null
      }

      if (editingMemory) {
        // Update existing memory
        const { error: updateError } = await supabase
          .schema('app')
          .from('user_memory')
          .update(memoryData)
          .eq('id', editingMemory.id)

        if (updateError) throw updateError
      } else {
        // Create new memory
        const { error: insertError } = await supabase
          .schema('app')
          .from('user_memory')
          .insert(memoryData)

        if (insertError) throw insertError
      }

      // Reset form and reload memories
      resetForm()
      await loadMemories()
    } catch (err) {
      console.error('Error saving memory:', err)
      setError(err instanceof Error ? err.message : 'Failed to save memory')
    } finally {
      setSaving(false)
    }
  }

  // Delete memory
  const deleteMemory = async (memoryId: string) => {
    try {
      setError(null)
      const { error } = await supabase
        .schema('app')
        .from('user_memory')
        .delete()
        .eq('id', memoryId)

      if (error) throw error
      await loadMemories()
    } catch (err) {
      console.error('Error deleting memory:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete memory')
    }
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      memory_type: 'general',
      importance: 5,
      tags: []
    })
    setTagInput('')
    setEditingMemory(null)
    setShowAddForm(false)
  }

  // Start editing memory
  const startEdit = (memory: UserMemory) => {
    setFormData({
      title: memory.title,
      content: memory.content,
      memory_type: memory.memory_type,
      importance: memory.importance,
      tags: memory.tags || []
    })
    setEditingMemory(memory)
    setShowAddForm(true)
  }

  // Add tag
  const addTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }))
      setTagInput('')
    }
  }

  // Remove tag
  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  // Bulk create memories from selected messages
  const distillFromMessages = async () => {
    if (selectedMessages.size === 0) return

    try {
      setSaving(true)
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        throw new Error('Authentication required')
      }

      const selectedMessageData = recentMessages.filter(msg => selectedMessages.has(msg.id))
      const memoriesToCreate = selectedMessageData.map(msg => ({
        user_id: userData.user.id,
        conversation_id: conversationId,
        title: `From ${msg.role} message`,
        content: msg.content || '',
        memory_type: 'context' as MemoryType,
        importance: 5,
        metadata: { source_message_id: msg.id, distilled_at: new Date().toISOString() }
      }))

      const { error } = await supabase
        .schema('app')
        .from('user_memory')
        .insert(memoriesToCreate)

      if (error) throw error

      setShowDistillDialog(false)
      setSelectedMessages(new Set())
      await loadMemories()
    } catch (err) {
      console.error('Error distilling messages:', err)
      setError(err instanceof Error ? err.message : 'Failed to distill messages')
    } finally {
      setSaving(false)
    }
  }

  // Get memory type info
  const getMemoryTypeInfo = (type: MemoryType) => {
    return MEMORY_TYPES.find(t => t.value === type) || MEMORY_TYPES[3]
  }

  // Get importance info
  const getImportanceInfo = (importance: number) => {
    return IMPORTANCE_LEVELS.find(l => l.value === importance) || IMPORTANCE_LEVELS[4]
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  useEffect(() => {
    const initialize = async () => {
      setLoading(true)
      await Promise.all([loadMemories(), loadRecentMessages()])
      setLoading(false)
    }
    initialize()
  }, [conversationId])

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="p-3 border rounded">
                  <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Memory ({memories.length})
          </CardTitle>
          <div className="flex gap-2">
            {conversationId && recentMessages.length > 0 && (
              <Dialog open={showDistillDialog} onOpenChange={setShowDistillDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-1">
                    <CheckSquare className="h-4 w-4" />
                    Distill
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Distill from Recent Messages</DialogTitle>
                  </DialogHeader>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {recentMessages.map(msg => (
                      <div
                        key={msg.id}
                        className={`p-3 border rounded cursor-pointer transition-colors ${
                          selectedMessages.has(msg.id)
                            ? 'bg-blue-50 border-blue-200'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => {
                          const newSelected = new Set(selectedMessages)
                          if (newSelected.has(msg.id)) {
                            newSelected.delete(msg.id)
                          } else {
                            newSelected.add(msg.id)
                          }
                          setSelectedMessages(newSelected)
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline">{msg.role}</Badge>
                          <span className="text-xs text-gray-500">{formatDate(msg.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {msg.content || 'No content'}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between pt-4">
                    <span className="text-sm text-gray-500">
                      {selectedMessages.size} selected
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setShowDistillDialog(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={distillFromMessages}
                        disabled={selectedMessages.size === 0 || saving}
                      >
                        Create {selectedMessages.size} Memories
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <Button
              size="sm"
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Memory
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">
                {editingMemory ? 'Edit Memory' : 'Add New Memory'}
              </h3>
              <Button variant="ghost" size="sm" onClick={resetForm}>
                Cancel
              </Button>
            </div>

            <div className="grid gap-4">
              <Input
                placeholder="Memory title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              />

              <Textarea
                placeholder="Memory content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                rows={3}
              />

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">Type</label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    value={formData.memory_type}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      memory_type: e.target.value as MemoryType
                    }))}
                  >
                    {MEMORY_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">Importance</label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={formData.importance}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      importance: parseInt(e.target.value)
                    }))}
                    className="w-full"
                  />
                  <div className="text-xs text-center text-gray-500 mt-1">
                    {getImportanceInfo(formData.importance).label} ({formData.importance})
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Tags</label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="Add tag"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {formData.tags.map(tag => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeTag(tag)}
                    >
                      {tag} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <Button
                onClick={saveMemory}
                disabled={!formData.title.trim() || !formData.content.trim() || saving}
              >
                {saving ? 'Saving...' : editingMemory ? 'Update Memory' : 'Save Memory'}
              </Button>
            </div>
          </div>
        )}

        {/* Memories List */}
        <div className="space-y-3">
          {memories.length === 0 ? (
            <div className="text-center py-8">
              <Brain className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-2">No memories yet</p>
              <p className="text-sm text-gray-400">
                Add memories to help the AI remember important information about you
              </p>
            </div>
          ) : (
            memories.map(memory => {
              const typeInfo = getMemoryTypeInfo(memory.memory_type)
              const importanceInfo = getImportanceInfo(memory.importance)

              return (
                <div
                  key={memory.id}
                  className="p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1">
                      <h4 className="font-medium text-gray-900">{memory.title}</h4>
                      <Badge className={typeInfo.color}>
                        {typeInfo.icon}
                        <span className="ml-1">{typeInfo.label}</span>
                      </Badge>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => startEdit(memory)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => deleteMemory(memory.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                    {memory.content}
                  </p>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        <span className={importanceInfo.color}>
                          {importanceInfo.label}
                        </span>
                      </div>
                      {memory.tags && memory.tags.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          <span>{memory.tags.join(', ')}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(memory.updated_at)}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}