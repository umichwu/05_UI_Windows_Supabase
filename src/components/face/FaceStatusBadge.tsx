'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { User, Smile, Frown, Angry, AlertTriangle, Heart, Zap } from 'lucide-react'

interface FaceStatusBadgeProps {
  recognizedUser: string | null
  dominantEmotion: string
  confidence: number
  emotionScores?: Record<string, number>
  className?: string
}

const getEmotionIcon = (emotion: string) => {
  const iconClass = "h-3 w-3"
  switch (emotion.toLowerCase()) {
    case 'happy': return <Smile className={iconClass} />
    case 'sad': return <Frown className={iconClass} />
    case 'angry': return <Angry className={iconClass} />
    case 'fear': return <AlertTriangle className={iconClass} />
    case 'surprise': return <Zap className={iconClass} />
    case 'disgust': return <AlertTriangle className={iconClass} />
    case 'neutral': return <Heart className={iconClass} />
    default: return <Heart className={iconClass} />
  }
}

const getEmotionColor = (emotion: string) => {
  switch (emotion.toLowerCase()) {
    case 'happy': return 'bg-green-100 text-green-800 border-green-200'
    case 'sad': return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'angry': return 'bg-red-100 text-red-800 border-red-200'
    case 'fear': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'surprise': return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'disgust': return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'neutral': return 'bg-gray-100 text-gray-800 border-gray-200'
    default: return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.8) return 'text-green-600'
  if (confidence >= 0.6) return 'text-yellow-600'
  return 'text-red-600'
}

export const FaceStatusBadge = ({
  recognizedUser,
  dominantEmotion,
  confidence,
  emotionScores,
  className = ''
}: FaceStatusBadgeProps) => {
  return (
    <Card className={`${className}`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* User Recognition Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">Identity:</span>
            </div>
            <Badge
              variant={recognizedUser ? "default" : "secondary"}
              className="flex items-center gap-1"
            >
              {recognizedUser || 'Unknown'}
            </Badge>
          </div>

          {/* Emotion Detection */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getEmotionIcon(dominantEmotion)}
              <span className="text-sm font-medium">Emotion:</span>
            </div>
            <Badge className={`flex items-center gap-1 ${getEmotionColor(dominantEmotion)}`}>
              {dominantEmotion}
            </Badge>
          </div>

          {/* Confidence Level */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Confidence:</span>
            <span className={`text-sm font-mono ${getConfidenceColor(confidence)}`}>
              {(confidence * 100).toFixed(1)}%
            </span>
          </div>

          {/* Detailed Emotion Scores */}
          {emotionScores && Object.keys(emotionScores).length > 0 && (
            <div className="pt-2 border-t border-gray-200">
              <div className="text-sm font-medium mb-2">Emotion Breakdown:</div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(emotionScores)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 6)
                  .map(([emotion, score]) => (
                    <div key={emotion} className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {getEmotionIcon(emotion)}
                        <span className="text-xs capitalize">{emotion}:</span>
                      </div>
                      <span className="text-xs font-mono">
                        {(score * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Status Indicator */}
          <div className="flex items-center justify-center pt-2">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
              confidence >= 0.7
                ? 'bg-green-50 text-green-700 border border-green-200'
                : confidence >= 0.5
                ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                confidence >= 0.7
                  ? 'bg-green-500'
                  : confidence >= 0.5
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`} />
              {confidence >= 0.7 ? 'High Confidence' :
               confidence >= 0.5 ? 'Medium Confidence' :
               'Low Confidence'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}