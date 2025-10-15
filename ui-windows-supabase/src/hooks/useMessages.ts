import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from '@/lib/auth-store'
import { Message } from '@/lib/types'
import { uploadToStorage, calculateSHA256, getSignedUrl } from '@/lib/storage'
import { callLLM } from '@/lib/llm'
import { startMessageMonitoring, endMessageMonitoring } from '@/lib/performance-monitor'

export const useMessages = (conversationId: string | null) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuthStore()

  const fetchMessages = useCallback(async () => {
    if (!conversationId || !user) return

    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .schema('app')
        .from('messages')
        .select(`
          *,
          attachments:messages_attachments(
            id,
            message_id,
            storage_object_path,
            mime_type,
            bytes,
            sha256,
            created_at
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) throw error

      setMessages(data || [])
    } catch (err: unknown) {
      const error = err as { message?: string; details?: string; hint?: string; code?: string }
      const errorMessage = error?.message || 'Unknown error occurred while fetching messages'
      setError(errorMessage)
      console.error('Error fetching messages:', errorMessage)
      console.error('Fetch messages error details:', {
        message: errorMessage,
        details: error?.details || null,
        hint: error?.hint || null,
        code: error?.code || null
      })
    } finally {
      setLoading(false)
    }
  }, [conversationId, user])

  const sendMessage = async (
    content: string,
    overrideConversationId?: string,
    attachments?: File[],
    mode: 'dev' | 'outbox' = 'dev',
    modelProvider?: 'chatgpt' | 'gemini'
  ) => {
    const cid = overrideConversationId ?? conversationId;
    if (!cid) throw new Error('No conversation id');
    if (!user) throw new Error('No user authenticated');

    // Start performance monitoring
    const messageId = `msg-${Date.now()}`
    const monitor = startMessageMonitoring(messageId)
    monitor.start('total-message-flow')

    // Create optimistic message
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`, // Temporary ID
      conversation_id: cid,
      user_id: user.id,
      role: 'user',
      content,
      metadata: null,
      created_at: new Date().toISOString()
    };

    // Add optimistic message immediately to UI
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      // Insert user message
      monitor.start('insert-user-message')
      const userMessageRow = {
        conversation_id: cid,
        role: 'user' as const,
        content,
        user_id: user.id,
      };

      const { data: userMessage, error: messageError } = await supabase
        .schema('app')
        .from('messages')
        .insert([userMessageRow])
        .select()
        .single();

      if (messageError) throw messageError;
      monitor.end('insert-user-message')

      // Replace optimistic message with real one
      setMessages(prev =>
        prev.map(msg =>
          msg.id === optimisticMessage.id ? userMessage as Message : msg
        )
      );

      // Handle file attachments and prepare for LLM
      let uploadResults: Array<{ success: boolean; path?: string }> = []
      let messageAttachments: { signedUrl: string; mimeType: string }[] = []

      if (attachments && attachments.length > 0) {
        try {
          monitor.start('upload-attachments', { fileCount: attachments.length })
          uploadResults = await uploadToStorage(attachments, user.id, cid, userMessage.id);
          monitor.end('upload-attachments')

          // Insert attachment records
          monitor.start('insert-attachment-records')
          const attachmentRecords = await Promise.all(
            attachments.map(async (file, index) => {
              const result = uploadResults[index];
              if (!result.success || !result.path) return null;

              const sha256 = await calculateSHA256(file);

              return {
                message_id: userMessage.id,
                storage_object_path: result.path,
                mime_type: file.type,
                bytes: file.size,
                sha256
              };
            })
          );

          const validAttachments = attachmentRecords.filter(Boolean);
          if (validAttachments.length > 0) {
            await supabase
              .schema('app')
              .from('messages_attachments')
              .insert(validAttachments);
          }
          monitor.end('insert-attachment-records')

          // Prepare image attachments for LLM
          monitor.start('prepare-signed-urls')
          console.log('Processing attachments for LLM:', attachments.map(f => ({ name: f.name, type: f.type, size: f.size })));
          console.log('Upload results:', uploadResults);

          messageAttachments = await Promise.all(
            attachments.map(async (file, index) => {
              const result = uploadResults[index];
              console.log(`Processing attachment ${index}:`, {
                fileName: file.name,
                fileType: file.type,
                isImage: file.type.startsWith('image/'),
                uploadSuccess: result.success,
                uploadPath: result.path
              });

              if (result.success && result.path && file.type.startsWith('image/')) {
                const signedUrl = await getSignedUrl(result.path, 3600); // 1 hour expiry
                console.log(`Signed URL for ${file.name}:`, signedUrl ? 'Generated successfully' : 'Failed to generate');

                return signedUrl ? {
                  signedUrl,
                  mimeType: file.type
                } : null;
              }
              return null;
            })
          ).then(results => {
            const validResults = results.filter(Boolean) as { signedUrl: string; mimeType: string }[];
            console.log('Final messageAttachments for LLM:', validResults.length, 'image(s)');
            monitor.end('prepare-signed-urls', { signedUrlCount: validResults.length })
            return validResults;
          });

        } catch (attachmentError) {
          console.error('Attachment upload error:', attachmentError);
          // Continue with message sending even if attachments fail
        }
      }

      // In dev mode, call LLM for response
      if (mode === 'dev' && (content.trim() || messageAttachments.length > 0)) {
        try {
          monitor.start('llm-call-and-save')
          const provider = modelProvider === 'gemini' ? 'gemini' : 'openai'
          const llmResponse = await callLLM(messages, content, messageAttachments, provider);

          if (llmResponse) {
            // Insert assistant message
            monitor.start('insert-assistant-message')
            const assistantMessageRow = {
              conversation_id: cid,
              role: 'assistant' as const,
              content: llmResponse,
              user_id: user.id,
            };

            const { data: assistantMessage, error: assistantError } = await supabase
              .schema('app')
              .from('messages')
              .insert([assistantMessageRow])
              .select()
              .single();

            if (assistantError) {
              console.error('Error inserting assistant message:', assistantError);
            } else {
              console.log('Assistant message inserted successfully:', {
                id: assistantMessage.id,
                contentLength: assistantMessage.content?.length,
                contentPreview: assistantMessage.content?.substring(0, 100)
              });
            }
            monitor.end('insert-assistant-message')

            // Note: The realtime subscription will handle updating the UI
          }
          monitor.end('llm-call-and-save')
        } catch (llmError) {
          console.error('LLM call error:', llmError);
          // Continue without LLM response if it fails
        }
      }

      monitor.end('total-message-flow')
      endMessageMonitoring()

      return userMessage;
    } catch (err: unknown) {
      // Remove optimistic message on error
      setMessages(prev =>
        prev.filter(msg => msg.id !== optimisticMessage.id)
      );

      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred while sending message';
      console.error('Error sending message:', errorMessage);
      setError(errorMessage);
      return null;
    }
  }

  const deleteMessage = async (id: string): Promise<boolean> => {
    if (!user) return false

    console.log('DELETE MESSAGE DEBUG:', {
      id,
      userId: user.id,
      supabaseClient: !!supabase,
      timestamp: new Date().toISOString()
    })

    try {
      const { error } = await supabase
        .schema('app')
        .from('messages')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      console.log('DELETE RESULT:', { error: error || 'SUCCESS' })

      if (error) throw error

      return true
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred while deleting message'
      console.error('DELETE ERROR FULL DETAILS:', {
        error: err,
        message: errorMessage,
        stack: err instanceof Error ? err.stack : null,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        timestamp: new Date().toISOString()
      })
      setError(errorMessage)
      return false
    }
  }

  useEffect(() => {
    if (conversationId && user) {
      fetchMessages()

      // Subscribe to new messages in this conversation
      const channel = supabase
        .channel(`app_messages:${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'app',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
          },
          (payload) => {
            const newMessage = payload.new as Message
            setMessages(prev => {
              // Prevent duplicates (including temporary optimistic messages)
              if (prev.some(msg => msg.id === newMessage.id || msg.content === newMessage.content)) {
                return prev
              }
              // If this is a real message that replaces an optimistic one, remove the temp one
              const withoutOptimistic = prev.filter(msg => !msg.id.startsWith('temp-'))
              return [...withoutOptimistic, newMessage].sort((a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              )
            })
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'app',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
          },
          (payload) => {
            const deletedMessage = payload.old as Message
            setMessages(prev => prev.filter(msg => msg.id !== deletedMessage.id))
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'app',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`
          },
          (payload) => {
            const updatedMessage = payload.new as Message
            setMessages(prev =>
              prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
            )
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    } else {
      setMessages([])
      setLoading(false)
    }
  }, [conversationId, user])

  return {
    messages,
    loading,
    error,
    sendMessage,
    deleteMessage,
    refetch: fetchMessages
  }
}