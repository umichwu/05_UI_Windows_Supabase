'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  TestTube,
  Plus,
  FileText,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Loader2,
  Database
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

interface SummaryTestCardProps {
  className?: string
}

export const SummaryTestCard = ({ className }: SummaryTestCardProps) => {
  const [testing, setTesting] = useState(false)
  const [testStep, setTestStep] = useState<string>('')
  const [results, setResults] = useState<{
    conversationCreated?: boolean
    messagesCreated?: boolean
    summaryRequested?: boolean
    testSummaryCreated?: boolean
    conversationId?: string
    error?: string
  }>({})

  const createTestData = async () => {
    try {
      setTesting(true)
      setResults({})

      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        throw new Error('Please sign in to test summary functionality')
      }

      const userId = userData.user.id

      // Step 1: Create a test conversation
      setTestStep('Creating test conversation...')
      const conversationId = crypto.randomUUID()

      const { error: conversationError } = await supabase
        .schema('app')
        .from('conversations')
        .insert({
          id: conversationId,
          user_id: userId,
          title: 'Test Conversation for Summary',
          channel: 'web',
          status: 'active'
        })

      if (conversationError) {
        throw new Error(`Failed to create conversation: ${conversationError.message}`)
      }

      setResults(prev => ({ ...prev, conversationCreated: true, conversationId }))

      // Step 2: Create test messages
      setTestStep('Creating test messages...')
      const testMessages = [
        {
          id: crypto.randomUUID(),
          conversation_id: conversationId,
          user_id: userId,
          role: 'user',
          content: 'Hello! I\'d like to discuss project planning for our upcoming product launch.'
        },
        {
          id: crypto.randomUUID(),
          conversation_id: conversationId,
          user_id: userId,
          role: 'assistant',
          content: 'I\'d be happy to help you with project planning! Let\'s start by identifying the key milestones and deliverables for your product launch.'
        },
        {
          id: crypto.randomUUID(),
          conversation_id: conversationId,
          user_id: userId,
          role: 'user',
          content: 'Great! We need to coordinate marketing, development, and sales teams. The launch is planned for Q2 2024.'
        },
        {
          id: crypto.randomUUID(),
          conversation_id: conversationId,
          user_id: userId,
          role: 'assistant',
          content: 'Perfect! For a Q2 2024 launch, I recommend creating a timeline that works backward from your launch date. Key areas to focus on: 1) Product development completion, 2) Marketing campaign preparation, 3) Sales team training, 4) Beta testing phase.'
        },
        {
          id: crypto.randomUUID(),
          conversation_id: conversationId,
          user_id: userId,
          role: 'user',
          content: 'That makes sense. What about budget allocation? We have $500K total budget.'
        },
        {
          id: crypto.randomUUID(),
          conversation_id: conversationId,
          user_id: userId,
          role: 'assistant',
          content: 'With a $500K budget, I\'d suggest: 40% for development ($200K), 35% for marketing ($175K), 15% for operations ($75K), and 10% contingency ($50K). This allows for comprehensive coverage while maintaining flexibility.'
        }
      ]

      const { error: messagesError } = await supabase
        .schema('app')
        .from('messages')
        .insert(testMessages)

      if (messagesError) {
        throw new Error(`Failed to create messages: ${messagesError.message}`)
      }

      setResults(prev => ({ ...prev, messagesCreated: true }))

      // Step 3: Create a summary request in outbox_events
      setTestStep('Creating summary request...')
      const { error: outboxError } = await supabase
        .schema('app')
        .from('outbox_events')
        .insert({
          user_id: userId,
          conversation_id: conversationId,
          event_type: 'summary.request',
          payload: {
            conversation_id: conversationId,
            requested_at: new Date().toISOString(),
            test_mode: true
          },
          status: 'pending',
          priority: 1
        })

      if (outboxError) {
        throw new Error(`Failed to create summary request: ${outboxError.message}`)
      }

      setResults(prev => ({ ...prev, summaryRequested: true }))

      // Step 4: Simulate processing and create a test summary
      setTestStep('Simulating AI summary generation...')
      await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate processing delay

      const testSummary = `**Project Planning Discussion Summary**

**Topic**: Product launch planning for Q2 2024
**Budget**: $500K total allocation

**Key Discussion Points**:
• Coordination needed between marketing, development, and sales teams
• Launch timeline working backward from Q2 2024 target
• Four main focus areas identified: product completion, marketing prep, sales training, beta testing

**Budget Allocation Recommended**:
• Development: $200K (40%)
• Marketing: $175K (35%)
• Operations: $75K (15%)
• Contingency: $50K (10%)

**Next Steps**: Create detailed timeline and begin cross-team coordination`

      // Mark the outbox event as completed and create the summary
      const { error: updateError } = await supabase
        .schema('app')
        .from('outbox_events')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString()
        })
        .eq('conversation_id', conversationId)
        .eq('event_type', 'summary.request')
        .eq('status', 'pending')

      if (updateError) {
        console.error('Failed to update outbox event:', updateError)
      }

      // Create the summary
      const { error: summaryError } = await supabase
        .schema('app')
        .from('conversation_summaries')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          summary: testSummary,
          token_count: 156,
          is_latest: true
        })

      if (summaryError) {
        throw new Error(`Failed to create summary: ${summaryError.message}`)
      }

      setResults(prev => ({ ...prev, testSummaryCreated: true }))
      setTestStep('Test completed successfully!')

    } catch (err) {
      console.error('Test error:', err)
      setResults(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Test failed'
      }))
      setTestStep('Test failed')
    } finally {
      setTesting(false)
    }
  }

  const getStepIcon = (completed: boolean | undefined, error?: string) => {
    if (error) return <AlertCircle className="h-4 w-4 text-red-500" />
    if (completed) return <CheckCircle className="h-4 w-4 text-green-500" />
    return <div className="h-4 w-4 border-2 border-gray-300 rounded-full" />
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Summary Test Suite
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Test Button */}
        <div className="flex gap-2">
          <Button
            onClick={createTestData}
            disabled={testing}
            className="flex items-center gap-2"
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4" />
            )}
            Run Summary Test
          </Button>
        </div>

        {/* Current Status */}
        {testing && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              {testStep}
            </div>
          </div>
        )}

        {/* Error Display */}
        {results.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              {results.error}
            </div>
          </div>
        )}

        {/* Test Results */}
        {Object.keys(results).length > 0 && !testing && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Test Results:</h4>

            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                {getStepIcon(results.conversationCreated, results.error)}
                <span className="text-sm">Create test conversation</span>
                {results.conversationCreated && <Badge variant="outline">Created</Badge>}
              </div>

              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                {getStepIcon(results.messagesCreated, results.error)}
                <span className="text-sm">Create sample messages</span>
                {results.messagesCreated && <Badge variant="outline">6 messages</Badge>}
              </div>

              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                {getStepIcon(results.summaryRequested, results.error)}
                <span className="text-sm">Request summary via outbox_events</span>
                {results.summaryRequested && <Badge variant="outline">Requested</Badge>}
              </div>

              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                {getStepIcon(results.testSummaryCreated, results.error)}
                <span className="text-sm">Generate test summary</span>
                {results.testSummaryCreated && <Badge variant="outline">Generated</Badge>}
              </div>
            </div>

            {results.conversationId && results.testSummaryCreated && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-800">Test Completed Successfully!</p>
                    <p className="text-sm text-green-600 mt-1">
                      Test conversation ID: <code className="bg-green-100 px-1 rounded text-xs">{results.conversationId}</code>
                    </p>
                    <p className="text-sm text-green-600 mt-1">
                      Now you can test the SummaryCard component with real data!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
            <Database className="h-4 w-4" />
            What this test does:
          </h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Creates a test conversation with sample messages</li>
            <li>• Inserts a summary.request into outbox_events table</li>
            <li>• Simulates AI processing and generates a test summary</li>
            <li>• Stores the summary in conversation_summaries table</li>
            <li>• You can then use the conversation ID to test SummaryCard</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}