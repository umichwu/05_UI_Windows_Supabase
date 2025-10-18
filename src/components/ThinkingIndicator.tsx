'use client'

interface ThinkingIndicatorProps {
  show: boolean
}

export function ThinkingIndicator({ show }: ThinkingIndicatorProps) {
  if (!show) return null

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border-t border-blue-100">
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <span className="text-sm text-blue-700 font-medium">Thinking...</span>
    </div>
  )
}
