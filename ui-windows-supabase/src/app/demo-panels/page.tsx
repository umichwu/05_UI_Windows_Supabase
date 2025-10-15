'use client'

import { MemoryPanel } from '@/components/MemoryPanel'
import { RetrievalPanel } from '@/components/RetrievalPanel'
import { SummaryTestCard } from '@/components/SummaryTestCard'
import { DynamicSummaryCard } from '@/components/DynamicSummaryCard'
import { ConversationSummaryChecker } from '@/components/ConversationSummaryChecker'

export default function DemoPanelsPage() {
  // Example conversation ID - replace with actual conversation ID
  const exampleConversationId = '12345678-1234-1234-1234-123456789012'

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Conversation Analysis Components
        </h1>
        <p className="text-gray-600">
          SummaryCard, MemoryPanel, RetrievalPanel, and ConversationSummaryChecker components showcase
        </p>
      </div>

      <div className="grid gap-8">
        {/* Conversation Summary Checker */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            🔍 Conversation Summary Checker
          </h2>
          <p className="text-gray-600 mb-4">
            View all conversations with their summaries and messages. Check summary status and view detailed conversation content.
          </p>
          <ConversationSummaryChecker />
        </section>

        {/* Summary Test Card */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            🧪 Summary Test Suite
          </h2>
          <p className="text-gray-600 mb-4">
            Click &quot;Run Summary Test&quot; to create sample data and test the entire summary workflow
          </p>
          <SummaryTestCard className="max-w-2xl" />
        </section>

        {/* Dynamic Summary Card */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            📄 Summary Card (Dynamic)
          </h2>
          <p className="text-gray-600 mb-4">
            Select a conversation to view its summary. After running the test above, you can use the generated conversation ID here.
          </p>
          <DynamicSummaryCard className="max-w-2xl" />
        </section>

        {/* Memory Panel */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            🧠 Memory Panel
          </h2>
          <p className="text-gray-600 mb-4">
            CRUD interface for user memories with bulk import from conversation messages
          </p>
          <MemoryPanel
            conversationId={exampleConversationId}
            className="max-w-4xl"
          />
        </section>

        {/* Retrieval Panel */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            🔍 Retrieval Panel
          </h2>
          <p className="text-gray-600 mb-4">
            Full-text search across messages, memories, and summaries with vector search API ready
          </p>
          <RetrievalPanel
            conversationId={exampleConversationId}
            className="max-w-4xl"
          />
        </section>
      </div>

      {/* Database Setup Instructions */}
      <section className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">
          📋 Setup Required
        </h3>
        <p className="text-yellow-700 mb-3">
          To use these components, you need to run the database setup script:
        </p>
        <code className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm">
          create-new-tables.sql
        </code>
        <p className="text-yellow-700 mt-2 text-sm">
          This creates the conversation_summaries, user_memory, and outbox_events tables with proper RLS policies.
        </p>
      </section>
    </div>
  )
}