'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Heart, TrendingUp, AlertCircle, Settings, CheckCircle2, Clock, Plus, Edit, Trash2 } from 'lucide-react'
// Import recharts components individually to avoid barrel optimization issues
import { LineChart } from 'recharts/lib/chart/LineChart'
import { Line } from 'recharts/lib/cartesian/Line'
import { XAxis } from 'recharts/lib/cartesian/XAxis'
import { YAxis } from 'recharts/lib/cartesian/YAxis'
import { CartesianGrid } from 'recharts/lib/cartesian/CartesianGrid'
import { Tooltip } from 'recharts/lib/component/Tooltip'
import { ResponsiveContainer } from 'recharts/lib/component/ResponsiveContainer'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from '@/lib/auth-store'

interface MoodWindow {
  id: string
  window_sec: number
  window_end: string
  samples: number
  counts: Record<string, number>
  dominant_emotion: string
  ratio: number
  avg_confidence: number
}

interface CareIncident {
  id: string
  rule_id: string
  status: 'open' | 'ack' | 'closed'
  first_detected_at: string
  last_detected_at: string
  context: { ratio: number; hit: number; total: number } | null
  care_rules?: {
    name: string
    description: string
  }
}

interface CareRule {
  id?: string
  name: string
  description: string
  target_emotions: string[]
  window_sec: number
  min_ratio: number
  min_confidence: number
  cooldown_sec: number
  active: boolean
  action: {
    template?: string
    notify_channel?: string
    severity?: string
  }
}

const EMOTIONS = ['angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral', 'unknown']
const EMOTION_COLORS = {
  happy: '#10b981',
  sad: '#3b82f6',
  angry: '#ef4444',
  fear: '#f59e0b',
  surprise: '#8b5cf6',
  disgust: '#f97316',
  neutral: '#6b7280',
  unknown: '#9ca3af'
}

export const CareCenter = () => {
  const { user } = useAuthStore()
  const [moodData, setMoodData] = useState<MoodWindow[]>([])
  const [incidents, setIncidents] = useState<CareIncident[]>([])
  const [careRules, setCareRules] = useState<CareRule[]>([])
  const [selectedTimeframe, setSelectedTimeframe] = useState<1 | 5 | 15>(5)
  const [loading, setLoading] = useState(true)
  const [showRuleDialog, setShowRuleDialog] = useState(false)
  const [editingRule, setEditingRule] = useState<CareRule | null>(null)

  // Load mood windows data
  const loadMoodData = async (windowSec: number) => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .schema('app')
        .from('mood_windows')
        .select('*')
        .eq('user_id', user?.id)
        .eq('window_sec', windowSec * 60)
        .order('window_end', { ascending: true })
        .limit(50)

      if (error) throw error
      setMoodData(data || [])
    } catch (err) {
      console.error('Failed to load mood data:', err)
    }
  }

  // Load care incidents
  const loadIncidents = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .schema('app')
        .from('care_incidents')
        .select(`
          *,
          care_rules (name, description)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setIncidents(data || [])
    } catch (err) {
      console.error('Failed to load incidents:', err)
    }
  }

  // Load care rules
  const loadCareRules = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .schema('app')
        .from('care_rules')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCareRules(data?.map(rule => ({
        ...rule,
        action: rule.action || {}
      })) || [])
    } catch (err) {
      console.error('Failed to load care rules:', err)
    }
  }

  // Close incident
  const closeIncident = async (incidentId: string) => {
    try {
      const { error } = await supabase
        .schema('app')
        .from('care_incidents')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', incidentId)
        .eq('user_id', user?.id)

      if (error) throw error
      loadIncidents()
    } catch (err) {
      console.error('Failed to close incident:', err)
    }
  }

  // Save care rule
  const saveCareRule = async (rule: CareRule) => {
    try {
      const ruleData = {
        ...rule,
        user_id: user?.id,
        updated_at: new Date().toISOString()
      }

      if (rule.id) {
        const { error } = await supabase
          .schema('app')
          .from('care_rules')
          .update(ruleData)
          .eq('id', rule.id)
          .eq('user_id', user?.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .schema('app')
          .from('care_rules')
          .insert([ruleData])

        if (error) throw error
      }

      loadCareRules()
      setShowRuleDialog(false)
      setEditingRule(null)
    } catch (err) {
      console.error('Failed to save care rule:', err)
    }
  }

  // Delete care rule
  const deleteCareRule = async (ruleId: string) => {
    try {
      const { error } = await supabase
        .schema('app')
        .from('care_rules')
        .delete()
        .eq('id', ruleId)
        .eq('user_id', user?.id)

      if (error) throw error
      loadCareRules()
    } catch (err) {
      console.error('Failed to delete care rule:', err)
    }
  }

  // Trigger mood rollup
  const triggerMoodRollup = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('rollup_mood_windows', {
        p_user: user?.id,
        p_window_sec: selectedTimeframe * 60
      })

      if (error) throw error
      loadMoodData(selectedTimeframe)
    } catch (err) {
      console.error('Failed to trigger mood rollup:', err)
    }
  }

  useEffect(() => {
    if (user) {
      setLoading(true)
      Promise.all([
        loadMoodData(selectedTimeframe),
        loadIncidents(),
        loadCareRules()
      ]).finally(() => setLoading(false))
    }
  }, [user, selectedTimeframe])

  const formatChartData = (data: MoodWindow[]) => {
    return data.map(item => ({
      time: new Date(item.window_end).toLocaleTimeString(),
      ...item.counts,
      dominant: item.dominant_emotion,
      ratio: item.ratio * 100,
      confidence: item.avg_confidence * 100
    }))
  }

  const CareRuleDialog = () => {
    const [formData, setFormData] = useState<CareRule>(
      editingRule || {
        name: '',
        description: '',
        target_emotions: ['sad'],
        window_sec: 180,
        min_ratio: 0.6,
        min_confidence: 0.6,
        cooldown_sec: 1800,
        active: true,
        action: {
          template: 'I noticed you might be feeling down. Is everything okay?',
          notify_channel: 'line',
          severity: 'info'
        }
      }
    )

    return (
      <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Edit Care Rule' : 'Create Care Rule'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rule Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Sadness Detection"
                />
              </div>
              <div className="space-y-2">
                <Label>Active</Label>
                <Select
                  value={formData.active.toString()}
                  onValueChange={(value) => setFormData({ ...formData, active: value === 'true' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detects when user shows signs of sadness"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Time Window (seconds)</Label>
                <Input
                  type="number"
                  value={formData.window_sec}
                  onChange={(e) => setFormData({ ...formData, window_sec: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cooldown (seconds)</Label>
                <Input
                  type="number"
                  value={formData.cooldown_sec}
                  onChange={(e) => setFormData({ ...formData, cooldown_sec: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Minimum Ratio</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={formData.min_ratio}
                  onChange={(e) => setFormData({ ...formData, min_ratio: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Minimum Confidence</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={formData.min_confidence}
                  onChange={(e) => setFormData({ ...formData, min_confidence: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Target Emotions</Label>
              <div className="grid grid-cols-4 gap-2">
                {EMOTIONS.map(emotion => (
                  <label key={emotion} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.target_emotions.includes(emotion)}
                      onChange={(e) => {
                        const emotions = e.target.checked
                          ? [...formData.target_emotions, emotion]
                          : formData.target_emotions.filter(e => e !== emotion)
                        setFormData({ ...formData, target_emotions: emotions })
                      }}
                    />
                    <span className="text-sm capitalize">{emotion}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Care Message Template</Label>
              <Textarea
                value={formData.action.template || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  action: { ...formData.action, template: e.target.value }
                })}
                placeholder="I noticed you might be feeling down. Is everything okay?"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRuleDialog(false)
                  setEditingRule(null)
                }}
              >
                Cancel
              </Button>
              <Button onClick={() => saveCareRule(formData)}>
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="h-6 w-6 text-red-500" />
          <h1 className="text-2xl font-bold">Care Center</h1>
        </div>
        <Button onClick={triggerMoodRollup} variant="outline" size="sm">
          <TrendingUp className="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      <Tabs defaultValue="trends" className="space-y-6">
        <TabsList>
          <TabsTrigger value="trends">Mood Trends</TabsTrigger>
          <TabsTrigger value="incidents">Care Incidents</TabsTrigger>
          <TabsTrigger value="rules">Care Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Emotion Trends
                </CardTitle>
                <Select
                  value={selectedTimeframe.toString()}
                  onValueChange={(value) => setSelectedTimeframe(parseInt(value) as 1 | 5 | 15)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 minute</SelectItem>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {moodData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={formatChartData(moodData)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    {EMOTIONS.map(emotion => (
                      <Line
                        key={emotion}
                        type="monotone"
                        dataKey={emotion}
                        stroke={EMOTION_COLORS[emotion as keyof typeof EMOTION_COLORS]}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No mood data available. Start the camera to begin collecting data.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4">
          {incidents.map(incident => (
            <Card key={incident.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          incident.status === 'open' ? 'destructive' :
                          incident.status === 'ack' ? 'default' : 'secondary'
                        }
                      >
                        {incident.status.toUpperCase()}
                      </Badge>
                      <span className="font-medium">
                        {incident.care_rules?.name || 'Unknown Rule'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {incident.care_rules?.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Detected: {new Date(incident.first_detected_at).toLocaleString()}</span>
                      <span>Last: {new Date(incident.last_detected_at).toLocaleString()}</span>
                      {incident.context && (
                        <span>
                          Ratio: {(incident.context.ratio * 100).toFixed(1)}%
                          ({incident.context.hit}/{incident.context.total} samples)
                        </span>
                      )}
                    </div>
                  </div>

                  {incident.status !== 'closed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => closeIncident(incident.id)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      I&apos;m OK now
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {incidents.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No care incidents recorded</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => {
              setEditingRule(null)
              setShowRuleDialog(true)
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Care Rule
            </Button>
          </div>

          {careRules.map(rule => (
            <Card key={rule.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{rule.name}</span>
                      <Badge variant={rule.active ? 'default' : 'secondary'}>
                        {rule.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{rule.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {rule.target_emotions.map(emotion => (
                        <Badge key={emotion} variant="outline" className="text-xs">
                          {emotion}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 space-y-1">
                      <div>Window: {rule.window_sec}s | Ratio: {rule.min_ratio} | Confidence: {rule.min_confidence}</div>
                      <div>Cooldown: {rule.cooldown_sec}s</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingRule(rule)
                        setShowRuleDialog(true)
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => rule.id && deleteCareRule(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {careRules.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Settings className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-4">No care rules configured</p>
                <Button onClick={() => {
                  setEditingRule(null)
                  setShowRuleDialog(true)
                }}>
                  Create Your First Rule
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <CareRuleDialog />
    </div>
  )
}