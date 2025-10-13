'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Menu, LogOut, Bot, User, Settings } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { Conversation } from '@/lib/types'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ChatHeaderProps {
  conversation: Conversation | null
  isOnline?: boolean
  onMobileMenuOpen?: () => void
  sidebarContent?: React.ReactNode
  selectedModel?: 'chatgpt' | 'gemini'
  onModelChange?: (model: 'chatgpt' | 'gemini') => void
}

export const ChatHeader = ({
  conversation,
  isOnline = true,
  onMobileMenuOpen,
  sidebarContent,
  selectedModel = 'chatgpt',
  onModelChange
}: ChatHeaderProps) => {
  const { signOut, user } = useAuthStore()

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  return (
    <div className="flex items-center justify-between p-4 bg-white border-b">
      <div className="flex items-center gap-3">
        {/* Mobile Menu Button */}
        {sidebarContent && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="md:hidden">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80">
              <SheetHeader>
                <SheetTitle>Conversations</SheetTitle>
                <SheetDescription>
                  Manage your conversations
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 h-full">
                {sidebarContent}
              </div>
            </SheetContent>
          </Sheet>
        )}

        {/* Chat Info */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold">
              {conversation ? (conversation.title || 'New Conversation') : 'AI Assistant'}
            </h1>
            {conversation && (
              <span className="text-xs text-gray-500">
                {conversation.msg_count} messages • {new Date(conversation.created_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* User Info */}
        <div className="hidden sm:flex items-center gap-2 ml-4 px-3 py-1 bg-gray-50 rounded-full">
          <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center">
            <User className="h-3 w-3 text-white" />
          </div>
          <span className="text-sm text-gray-600 truncate max-w-[150px]">
            {user?.email}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Model Selection */}
        {onModelChange && (
          <Select value={selectedModel} onValueChange={onModelChange}>
            <SelectTrigger className="w-[140px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="chatgpt">ChatGPT</SelectItem>
              <SelectItem value="gemini">Gemini</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Connection Status */}
        <Badge variant={isOnline ? 'default' : 'secondary'} className="hidden sm:inline-flex">
          <div className={`w-2 h-2 rounded-full mr-1 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          {isOnline ? 'Connected' : 'Disconnected'}
        </Badge>

        {/* Settings Button */}
        <Button
          variant="ghost"
          size="sm"
          title="Settings"
          className="hidden sm:inline-flex"
        >
          <Settings className="h-4 w-4" />
        </Button>

        {/* Sign Out Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}