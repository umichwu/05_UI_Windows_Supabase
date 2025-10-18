'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Search,
  Filter,
  Clock,
  MessageSquare,
  Brain,
  FileText,
  Star,
  Tag,
  ExternalLink,
  AlertCircle,
  Database
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { Message, UserMemory, ConversationSummary } from '@/lib/types'

interface RetrievalPanelProps {
  conversationId?: string
  className?: string
}

interface SearchResult {
  type: 'message' | 'memory' | 'summary'
  item: Message | UserMemory | ConversationSummary
  relevance?: number
  snippet?: string
}

interface SearchFilters {
  types: string[]
  dateRange: 'all' | 'week' | 'month' | 'year'
  minImportance?: number
}

export const RetrievalPanel = ({ conversationId, className }: RetrievalPanelProps) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<SearchFilters>({
    types: ['message', 'memory', 'summary'],
    dateRange: 'all',
    minImportance: undefined
  })
  const [showFilters, setShowFilters] = useState(false)
  const [searchMode, setSearchMode] = useState<'fts' | 'semantic'>('fts')

  // Perform full-text search
  const performFTSSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        throw new Error('Authentication required')
      }

      const results: SearchResult[] = []

      // Create date filter
      const getDateFilter = () => {
        const now = new Date()
        switch (filters.dateRange) {
          case 'week':
            return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
          case 'month':
            return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
          case 'year':
            return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()
          default:
            return null
        }
      }

      const dateFilter = getDateFilter()

      // Search messages if enabled
      if (filters.types.includes('message')) {
        let messageQuery = supabase
          .schema('app')
          .from('messages')
          .select('*')
          .eq('user_id', userData.user.id)
          .textSearch('content', query, { type: 'websearch' })

        if (conversationId) {
          messageQuery = messageQuery.eq('conversation_id', conversationId)
        }

        if (dateFilter) {
          messageQuery = messageQuery.gte('created_at', dateFilter)
        }

        const { data: messages, error: messageError } = await messageQuery.limit(20)

        if (messageError) {
          console.error('Message search error:', messageError)
        } else if (messages) {
          results.push(...messages.map(msg => ({
            type: 'message' as const,
            item: msg,
            snippet: generateSnippet(msg.content || '', query)
          })))
        }
      }

      // Search memories if enabled
      if (filters.types.includes('memory')) {
        let memoryQuery = supabase
          .schema('app')
          .from('user_memory')
          .select('*')
          .eq('user_id', userData.user.id)
          .textSearch('title,content', query, { type: 'websearch' })

        if (conversationId) {
          memoryQuery = memoryQuery.or(`conversation_id.eq.${conversationId},conversation_id.is.null`)
        }

        if (dateFilter) {
          memoryQuery = memoryQuery.gte('created_at', dateFilter)
        }

        if (filters.minImportance) {
          memoryQuery = memoryQuery.gte('importance', filters.minImportance)
        }

        const { data: memories, error: memoryError } = await memoryQuery.limit(20)

        if (memoryError) {
          console.error('Memory search error:', memoryError)
        } else if (memories) {
          results.push(...memories.map(memory => ({
            type: 'memory' as const,
            item: memory,
            snippet: generateSnippet(memory.content, query)
          })))
        }
      }

      // Search summaries if enabled
      if (filters.types.includes('summary')) {
        let summaryQuery = supabase
          .schema('app')
          .from('conversation_summaries')
          .select('*')
          .eq('user_id', userData.user.id)
          .textSearch('summary', query, { type: 'websearch' })

        if (conversationId) {
          summaryQuery = summaryQuery.eq('conversation_id', conversationId)
        }

        if (dateFilter) {
          summaryQuery = summaryQuery.gte('created_at', dateFilter)
        }

        const { data: summaries, error: summaryError } = await summaryQuery.limit(10)

        if (summaryError) {
          console.error('Summary search error:', summaryError)
        } else if (summaries) {
          results.push(...summaries.map(summary => ({
            type: 'summary' as const,
            item: summary,
            snippet: generateSnippet(summary.summary, query)
          })))
        }
      }

      // Sort results by relevance (for now, by date)
      results.sort((a, b) => {
        const aDate = new Date(a.item.created_at).getTime()
        const bDate = new Date(b.item.created_at).getTime()
        return bDate - aDate
      })

      setSearchResults(results)

    } catch (err) {
      console.error('Search error:', err)
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  // Generate text snippet with highlighted query terms
  const generateSnippet = (text: string, query: string, maxLength = 200) => {
    if (!text) return ''

    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0)
    const lowerText = text.toLowerCase()

    // Find the best position to start the snippet
    let bestPos = 0
    let maxMatches = 0

    for (let i = 0; i <= text.length - maxLength; i += 50) {
      const snippet = lowerText.slice(i, i + maxLength)
      const matches = queryTerms.reduce((count, term) => {
        return count + (snippet.includes(term) ? 1 : 0)
      }, 0)

      if (matches > maxMatches) {
        maxMatches = matches
        bestPos = i
      }
    }

    let snippet = text.slice(bestPos, bestPos + maxLength)
    if (bestPos > 0) snippet = '...' + snippet
    if (bestPos + maxLength < text.length) snippet += '...'

    return snippet
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

  // Get result icon
  const getResultIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="h-4 w-4" />
      case 'memory':
        return <Brain className="h-4 w-4" />
      case 'summary':
        return <FileText className="h-4 w-4" />
      default:
        return <Search className="h-4 w-4" />
    }
  }

  // Get result color
  const getResultColor = (type: string) => {
    switch (type) {
      case 'message':
        return 'bg-blue-100 text-blue-800'
      case 'memory':
        return 'bg-purple-100 text-purple-800'
      case 'summary':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Handle search input
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchMode === 'fts') {
      performFTSSearch(searchQuery)
    } else {
      // Vector search placeholder - keep API surface ready
      console.log('Vector search not implemented yet')
      setError('Vector search coming soon! Using full-text search instead.')
      performFTSSearch(searchQuery)
    }
  }

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        performFTSSearch(searchQuery)
      } else {
        setSearchResults([])
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, filters])

  // Filter results by type
  const filteredResults = useMemo(() => {
    return searchResults.filter(result => filters.types.includes(result.type))
  }, [searchResults, filters.types])

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Search & Retrieval
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search Form */}
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Search messages, memories, and summaries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={loading}>
              <Search className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          {/* Search Mode Tabs */}
          <Tabs value={searchMode} onValueChange={(value) => setSearchMode(value as 'fts' | 'semantic')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="fts" className="text-xs">
                <Database className="h-3 w-3 mr-1" />
                Full-Text Search
              </TabsTrigger>
              <TabsTrigger value="semantic" className="text-xs" disabled>
                <Brain className="h-3 w-3 mr-1" />
                Vector Search (Coming Soon)
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Filters */}
          {showFilters && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
              <div>
                <label className="text-sm font-medium mb-2 block">Content Types</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'message', label: 'Messages', icon: MessageSquare },
                    { id: 'memory', label: 'Memories', icon: Brain },
                    { id: 'summary', label: 'Summaries', icon: FileText }
                  ].map(({ id, label, icon: Icon }) => (
                    <Badge
                      key={id}
                      variant={filters.types.includes(id) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        setFilters(prev => ({
                          ...prev,
                          types: prev.types.includes(id)
                            ? prev.types.filter(t => t !== id)
                            : [...prev.types, id]
                        }))
                      }}
                    >
                      <Icon className="h-3 w-3 mr-1" />
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Date Range</label>
                  <select
                    className="p-1 border border-gray-300 rounded text-sm"
                    value={filters.dateRange}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      dateRange: e.target.value as 'all' | 'week' | 'month' | 'year'
                    }))}
                  >
                    <option value="all">All Time</option>
                    <option value="week">Past Week</option>
                    <option value="month">Past Month</option>
                    <option value="year">Past Year</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Min Importance (Memories)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    placeholder="Any"
                    className="w-16 p-1 border border-gray-300 rounded text-sm"
                    value={filters.minImportance || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      minImportance: e.target.value ? parseInt(e.target.value) : undefined
                    }))}
                  />
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Search Results */}
        <div className="space-y-3">
          {loading && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Searching...</p>
            </div>
          )}

          {!loading && searchQuery && filteredResults.length === 0 && (
            <div className="text-center py-8">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No results found for &quot;{searchQuery}&quot;</p>
              <p className="text-sm text-gray-400 mt-1">
                Try different keywords or adjust your filters
              </p>
            </div>
          )}

          {!loading && !searchQuery && (
            <div className="text-center py-8">
              <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Enter a search query to find content</p>
              <p className="text-sm text-gray-400 mt-1">
                Search across messages, memories, and conversation summaries
              </p>
            </div>
          )}

          {filteredResults.map((result, index) => {
            const isMessage = result.type === 'message'
            const isMemory = result.type === 'memory'
            const isSummary = result.type === 'summary'

            return (
              <div key={`${result.type}-${result.item.id}-${index}`} className="p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getResultColor(result.type)}>
                      {getResultIcon(result.type)}
                      <span className="ml-1 capitalize">{result.type}</span>
                    </Badge>
                    {isMessage && (
                      <Badge variant="outline">
                        {(result.item as Message).role}
                      </Badge>
                    )}
                    {isMemory && (
                      <>
                        <Badge variant="outline">
                          {(result.item as UserMemory).memory_type}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-500" />
                          <span className="text-xs text-gray-500">
                            {(result.item as UserMemory).importance}
                          </span>
                        </div>
                      </>
                    )}
                    {isSummary && (result.item as ConversationSummary).token_count && (
                      <span className="text-xs text-gray-500">
                        {(result.item as ConversationSummary).token_count} tokens
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    {formatDate(result.item.created_at)}
                  </div>
                </div>

                {isMemory && (
                  <h4 className="font-medium text-gray-900 mb-1">
                    {(result.item as UserMemory).title}
                  </h4>
                )}

                <p className="text-sm text-gray-700 leading-relaxed mb-2">
                  {result.snippet || (
                    isMessage ? (result.item as Message).content :
                    isMemory ? (result.item as UserMemory).content :
                    isSummary ? (result.item as ConversationSummary).summary :
                    'No content'
                  )}
                </p>

                {isMemory && (result.item as UserMemory).tags && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Tag className="h-3 w-3" />
                    {(result.item as UserMemory).tags!.join(', ')}
                  </div>
                )}

                {conversationId && result.item.conversation_id && result.item.conversation_id !== conversationId && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-1 text-xs text-blue-600">
                      <ExternalLink className="h-3 w-3" />
                      From different conversation
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {filteredResults.length > 0 && (
            <div className="text-center text-sm text-gray-500 pt-2">
              Showing {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''}
              {searchQuery && ` for "${searchQuery}"`}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}