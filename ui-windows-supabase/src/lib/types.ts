import { User } from '@supabase/supabase-js'

export type Channel = 'web' | 'line' | 'wechat' | 'google'
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'
export type EventType = 'message.created' | 'reply.request' | 'reply.completed' | 'summary.request' | 'summary.completed' | 'push.request' | 'push.completed'
export type EventStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
export type MemoryType = 'preference' | 'fact' | 'context' | 'general'

export interface Database {
  app: {
    Tables: {
      conversations: {
        Row: {
          id: string
          user_id: string
          channel: Channel
          channel_account_id: string | null
          title: string | null
          status: string
          msg_count: number
          last_message_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          channel?: Channel
          channel_account_id?: string | null
          title?: string | null
          status?: string
          msg_count?: number
          last_message_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          channel?: Channel
          channel_account_id?: string | null
          title?: string | null
          status?: string
          msg_count?: number
          last_message_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          user_id: string
          role: MessageRole
          content: string | null
          metadata: any | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          user_id: string
          role: MessageRole
          content?: string | null
          metadata?: any | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          user_id?: string
          role?: MessageRole
          content?: string | null
          metadata?: any | null
          created_at?: string
        }
      }
      conversation_summaries: {
        Row: {
          id: string
          conversation_id: string
          user_id: string
          summary: string
          token_count: number | null
          is_latest: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          user_id: string
          summary: string
          token_count?: number | null
          is_latest?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          user_id?: string
          summary?: string
          token_count?: number | null
          is_latest?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_memory: {
        Row: {
          id: string
          user_id: string
          conversation_id: string | null
          memory_type: MemoryType
          title: string
          content: string
          importance: number
          tags: string[] | null
          metadata: any | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          conversation_id?: string | null
          memory_type?: MemoryType
          title: string
          content: string
          importance?: number
          tags?: string[] | null
          metadata?: any | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          conversation_id?: string | null
          memory_type?: MemoryType
          title?: string
          content?: string
          importance?: number
          tags?: string[] | null
          metadata?: any | null
          created_at?: string
          updated_at?: string
        }
      }
      outbox_events: {
        Row: {
          id: string
          user_id: string
          conversation_id: string | null
          event_type: string
          payload: any
          status: EventStatus
          priority: number
          scheduled_at: string
          processed_at: string | null
          error_message: string | null
          retry_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          conversation_id?: string | null
          event_type: string
          payload?: any
          status?: EventStatus
          priority?: number
          scheduled_at?: string
          processed_at?: string | null
          error_message?: string | null
          retry_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          conversation_id?: string | null
          event_type?: string
          payload?: any
          status?: EventStatus
          priority?: number
          scheduled_at?: string
          processed_at?: string | null
          error_message?: string | null
          retry_count?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export interface AuthUser extends User {
  profile?: any // For now, as we don't have a profiles table defined
}

export interface AuthState {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

export interface Conversation {
  id: string
  user_id: string
  channel: Channel
  channel_account_id: string | null
  title: string | null
  status: string
  msg_count: number
  last_message_at: string | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  user_id: string
  role: MessageRole
  content: string | null
  metadata: any | null
  created_at: string
  attachments?: MessageAttachment[]
}

export interface MessageAttachment {
  id: string
  message_id: string
  storage_object_path: string
  mime_type: string | null
  bytes: number | null
  sha256: string | null
  created_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface ConversationSummary {
  id: string
  conversation_id: string
  user_id: string
  summary: string
  token_count: number | null
  is_latest: boolean
  created_at: string
  updated_at: string
}

export interface UserMemory {
  id: string
  user_id: string
  conversation_id: string | null
  memory_type: MemoryType
  title: string
  content: string
  importance: number
  tags: string[] | null
  metadata: any | null
  created_at: string
  updated_at: string
}

export interface OutboxEvent {
  id: string
  user_id: string
  conversation_id: string | null
  event_type: string
  payload: any
  status: EventStatus
  priority: number
  scheduled_at: string
  processed_at: string | null
  error_message: string | null
  retry_count: number
  created_at: string
  updated_at: string
}