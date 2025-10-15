'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface PerformanceMetric {
  operationName: string
  duration: number
  percentage: number
  metadata?: Record<string, unknown>
}

interface PerformanceSummary {
  sessionId: string
  totalTime: number
  metrics: PerformanceMetric[]
  bottleneck: PerformanceMetric | null
}

export const PerformanceDisplay = () => {
  const [lastPerformance] = useState<PerformanceSummary | null>(null)

  useEffect(() => {
    // Listen for performance data from console
    const originalLog = console.log
    console.log = (...args: unknown[]) => {
      originalLog(...args)

      // Check if this is a performance summary
      if (typeof args[0] === 'string' && args[0].includes('Performance Report')) {
        // This is a simple implementation - in production you'd use a custom event system
      }
    }

    return () => {
      console.log = originalLog
    }
  }, [])

  if (!lastPerformance) {
    return (
      <Card className="p-4 bg-gray-50">
        <p className="text-sm text-gray-600">
          Performance metrics will appear here after sending a message
        </p>
      </Card>
    )
  }

  const getBadgeColor = (percentage: number): 'default' | 'secondary' | 'destructive' => {
    if (percentage > 50) return 'destructive'
    if (percentage > 20) return 'default'
    return 'secondary'
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Performance Metrics</h3>
          <Badge variant="outline">
            Total: {lastPerformance.totalTime.toFixed(0)}ms
          </Badge>
        </div>

        {lastPerformance.bottleneck && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-red-600 font-semibold">🔴 Bottleneck Detected</span>
            </div>
            <div className="text-sm">
              <span className="font-medium">{lastPerformance.bottleneck.operationName}</span>
              <span className="text-gray-600 ml-2">
                {lastPerformance.bottleneck.duration.toFixed(0)}ms
                ({lastPerformance.bottleneck.percentage.toFixed(1)}%)
              </span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {lastPerformance.metrics
            .sort((a, b) => b.duration - a.duration)
            .map((metric, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {metric.operationName}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      {metric.duration.toFixed(0)}ms
                    </span>
                    <Badge variant={getBadgeColor(metric.percentage)} className="text-xs">
                      {metric.percentage.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      metric.percentage > 50
                        ? 'bg-red-500'
                        : metric.percentage > 20
                        ? 'bg-blue-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(metric.percentage, 100)}%` }}
                  />
                </div>
                {metric.metadata && Object.keys(metric.metadata).length > 0 && (
                  <div className="text-xs text-gray-500 ml-2">
                    {JSON.stringify(metric.metadata)}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </Card>
  )
}
