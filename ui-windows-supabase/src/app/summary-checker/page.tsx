'use client'

import { AuthGate } from '@/components/AuthGate'
import { ConversationSummaryChecker } from '@/components/ConversationSummaryChecker'

export default function SummaryCheckerPage() {
  return (
    <AuthGate>
      <div className="container mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Conversation Summary Checker
          </h1>
          <p className="text-gray-600">
            View all your conversations with their summaries and messages
          </p>
        </div>

        <ConversationSummaryChecker />
      </div>
    </AuthGate>
  )
}