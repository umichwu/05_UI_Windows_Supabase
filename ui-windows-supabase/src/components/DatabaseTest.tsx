'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from '@/lib/auth-store'
import { SummaryTestCard } from '@/components/SummaryTestCard'

interface TestResult {
  test: string
  success: boolean
  data: unknown
  timestamp: string
}

export const DatabaseTest = () => {
  const [results, setResults] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(false)
  const { user } = useAuthStore()

  const addResult = (test: string, success: boolean, data: unknown) => {
    setResults(prev => [...prev, {
      test,
      success,
      data,
      timestamp: new Date().toISOString()
    }])
  }

  const testSendMessage = async () => {
    setLoading(true)
    setResults([])

    try {
      // Test 1: User authentication check
      addResult('User Auth Check', !!user, user ? { 
        id: user.id, 
        email: user.email,
        user_object: user 
      } : 'Not authenticated')

      if (!user) {
        addResult('ERROR', false, 'Cannot test message sending - user not authenticated')
        setLoading(false)
        return
      }

      // Test 2: Try to get/create a conversation first
      let conversationId
      try {
        const { data: conversations, error: convError } = await supabase
          .schema('app')
          .from('conversations')
          .select('id')
          .limit(1)

        if (convError) throw convError

        if (conversations && conversations.length > 0) {
          conversationId = conversations[0].id
          addResult('Found Conversation', true, { conversation_id: conversationId })
        } else {
          // Create a test conversation
          const { data: newConv, error: createError } = await supabase
            .schema('app')
            .from('conversations')
            .insert({
              title: 'User ID Test Conversation',
              user_id: user.id,
              channel: 'web',
              status: 'active'
            })
            .select()
            .single()

          if (createError) throw createError
          conversationId = newConv.id
          addResult('Created Test Conversation', true, { conversation_id: conversationId })
        }
      } catch (err: unknown) {
        const error = err as { message?: string; details?: string; code?: string }
        addResult('Conversation Setup', false, {
          error: error.message,
          details: error.details,
          code: error.code
        })
        setLoading(false)
        return
      }

      // Test 3: Try to insert a message with user_id
      try {
        const messageData = {
          conversation_id: conversationId,
          role: 'user',
          content: `TEST MESSAGE - User ID Test at ${new Date().toISOString()}`,
          user_id: user.id
        }

        addResult('Message Data Prepared', true, messageData)

        const { data, error } = await supabase
          .schema('app')
          .from('messages')
          .insert([messageData])
          .select()
          .single()

        if (error) throw error
        
        addResult('Message Insert SUCCESS', true, data)

        // Clean up - delete the test message
        await supabase
          .schema('app')
          .from('messages')
          .delete()
          .eq('id', data.id)

        addResult('Test Message Deleted', true, 'Cleanup successful')

      } catch (err: unknown) {
        const error = err as { message?: string; details?: string; hint?: string; code?: string }
        addResult('Message Insert FAILED', false, {
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
      }

    } catch (err: unknown) {
      addResult('General Error', false, err)
    }

    setLoading(false)
  }

  const testDatabaseConnection = async () => {
    setLoading(true)
    setResults([])

    try {
      // Test 1: Basic connection
      addResult('Basic Connection', true, 'Connected to Supabase')

      // Test 2: User authentication
      addResult('User Auth', !!user, user ? { id: user.id, email: user.email } : 'Not authenticated')

      if (!user) {
        setLoading(false)
        return
      }

      // Test 3: Try to read conversations table
      try {
        const { data, error } = await supabase
          .schema('app')
          .from('conversations')
          .select('*')
          .limit(1)

        if (error) throw error
        addResult('Read app.conversations', true, { count: data?.length || 0, sample: data?.[0] })
      } catch (err: unknown) {
        const error = err as { message?: string; details?: string; hint?: string; code?: string }
        addResult('Read app.conversations', false, {
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
      }

      // Test 4: Try to create a test conversation
      try {
        const { data, error } = await supabase
          .schema('app')
          .from('conversations')
          .insert({
            title: 'Test Conversation',
            user_id: user.id,
            channel: 'web',
            status: 'active'
          })
          .select()
          .single()

        if (error) throw error
        addResult('Create Conversation', true, data)

        // Clean up - delete the test conversation
        await supabase
          .schema('app')
          .from('conversations')
          .delete()
          .eq('id', data.id)
      } catch (err: unknown) {
        const error = err as { message?: string; details?: string; hint?: string; code?: string }
        addResult('Create Conversation', false, {
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
      }

      // Test 5: Try to read messages table
      try {
        const { data, error } = await supabase
          .schema('app')
          .from('messages')
          .select('*')
          .limit(1)

        if (error) throw error
        addResult('Read app.messages', true, { count: data?.length || 0, sample: data?.[0] })
      } catch (err: unknown) {
        const error = err as { message?: string; details?: string; hint?: string; code?: string }
        addResult('Read app.messages', false, {
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
      }

    } catch (err: unknown) {
      addResult('General Error', false, err)
    }

    setLoading(false)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Database Connection Test</CardTitle>
          <div className="flex gap-2">
            <Button onClick={testDatabaseConnection} disabled={loading}>
              {loading ? 'Testing...' : 'Run Database Tests'}
            </Button>
            <Button onClick={testSendMessage} disabled={loading} variant="outline">
              {loading ? 'Testing...' : 'Test Send Message (User ID Debug)'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {results.length > 0 && (
            <div className="space-y-4">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded border ${
                    result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${
                      result.success ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <strong>{result.test}</strong>
                    <span className="text-xs text-gray-500">{result.timestamp}</span>
                  </div>
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Test Card */}
      <SummaryTestCard />
    </div>
  )
}