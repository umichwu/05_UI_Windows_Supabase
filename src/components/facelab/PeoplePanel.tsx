'use client'

import { useFaceStore } from '@/lib/faceStore'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDistanceToNow } from 'date-fns'

export function PeoplePanel() {
  const { peopleMap, sessionCounters } = useFaceStore()

  const peopleArray = Array.from(peopleMap.values())

  const getEmotionColor = (emotion: string) => {
    const colors: Record<string, string> = {
      happy: 'bg-green-500',
      sad: 'bg-blue-500',
      angry: 'bg-red-500',
      fear: 'bg-purple-500',
      surprise: 'bg-yellow-500',
      neutral: 'bg-gray-500',
      disgusted: 'bg-orange-500'
    }
    return colors[emotion.toLowerCase()] || 'bg-gray-500'
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600'
    if (confidence >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getDistanceColor = (distance?: number) => {
    if (!distance) return 'text-gray-500'
    if (distance <= 0.3) return 'text-green-600'
    if (distance <= 0.5) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">
          People detected: {peopleArray.length}
        </h3>
        <div className="text-sm text-muted-foreground mt-1">
          <p>Unique people: {sessionCounters.uniquePeople}</p>
          <p>Total faces: {sessionCounters.totalFaces}</p>
          <p>Frames processed: {sessionCounters.totalFrames}</p>
        </div>
      </div>

      {/* People Table */}
      {peopleArray.length > 0 ? (
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Identity</TableHead>
                <TableHead>Emotion</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {peopleArray.map((person) => (
                <TableRow key={person.key}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {person.label || 'Unknown'}
                      </div>
                      {person.user_id && (
                        <div className="text-xs text-muted-foreground">
                          {person.user_id.slice(0, 8)}...
                        </div>
                      )}
                      {person.distance !== undefined && (
                        <div className={`text-xs ${getDistanceColor(person.distance)}`}>
                          Distance: {person.distance.toFixed(3)}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`${getEmotionColor(person.emotion)} text-white capitalize`}
                    >
                      {person.emotion}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={getConfidenceColor(person.confidence)}>
                      {Math.round(person.confidence * 100)}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(person.lastSeen, { addSuffix: true })}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p>No faces detected yet</p>
          <p className="text-sm mt-1">Start your camera to begin detection</p>
        </div>
      )}

      {/* Session Statistics */}
      <div className="border-t pt-4 space-y-2">
        <h4 className="font-medium">Session Statistics</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Avg. Confidence:</span>
            <div className="font-mono">
              {peopleArray.length > 0
                ? Math.round(
                    peopleArray.reduce((acc, p) => acc + p.confidence, 0) / peopleArray.length * 100
                  )
                : 0}%
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Recognition Rate:</span>
            <div className="font-mono">
              {peopleArray.length > 0
                ? Math.round(
                    (peopleArray.filter(p => p.user_id).length / peopleArray.length) * 100
                  )
                : 0}%
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Add missing date-fns dependency
// Note: You'll need to install date-fns: npm install date-fns