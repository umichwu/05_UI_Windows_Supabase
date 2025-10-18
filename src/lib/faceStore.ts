import { create } from 'zustand'

export type FaceResult = {
  bbox: [number, number, number, number]
  identity?: {
    user_id?: string
    label: string
    distance?: number
  }
  emotion: {
    dominant: string
    scores: Record<string, number>
    confidence: number
  }
  spoof?: boolean
}

export type RecognizeResponse = {
  frameId: string
  latency_ms: number
  faces: FaceResult[]
}

export type PersonIdentity = {
  key: string
  user_id?: string
  label: string
  lastSeen: Date
  emotion: string
  confidence: number
  distance?: number
  bbox: [number, number, number, number] // [x, y, width, height]
}

export type EmotionDistribution = {
  happy: number
  sad: number
  angry: number
  fear: number
  surprise: number
  neutral: number
  disgusted?: number
}

export type SessionCounters = {
  totalFrames: number
  totalFaces: number
  uniquePeople: number
}

type RingBufferBucket = {
  timestamp: number
  emotions: EmotionDistribution
}

interface FaceState {
  // People tracking
  peopleMap: Map<string, PersonIdentity>
  sessionCounters: SessionCounters

  // Metrics
  fps: number
  latency_ms: number

  // Ring buffer for 10s emotion distribution (1 bucket per second)
  ringBuffer10s: RingBufferBucket[]
  currentBucketIndex: number

  // UI State
  recording: boolean
  zoom: number
  debugMode: boolean

  // Camera settings
  cameraInterval: number

  // Actions
  updateFaceResults: (results: FaceResult[], latency: number) => void
  removeStalePeople: () => void
  toggleRecording: () => void
  setZoom: (zoom: number) => void
  toggleDebugMode: () => void
  updateFps: (fps: number) => void
  getEmotionDistribution: () => EmotionDistribution
  clearSession: () => void
}

const RING_BUFFER_SIZE = 10 // 10 seconds
const STALE_TIMEOUT_MS = 3000 // 3 seconds

export const useFaceStore = create<FaceState>((set, get) => ({
  peopleMap: new Map(),
  sessionCounters: {
    totalFrames: 0,
    totalFaces: 0,
    uniquePeople: 0
  },
  fps: 0,
  latency_ms: 0,
  ringBuffer10s: Array(RING_BUFFER_SIZE).fill(null).map(() => ({
    timestamp: 0,
    emotions: { happy: 0, sad: 0, angry: 0, fear: 0, surprise: 0, neutral: 0, disgusted: 0 }
  })),
  currentBucketIndex: 0,
  recording: false,
  zoom: 1,
  debugMode: false,
  cameraInterval: parseInt(process.env.NEXT_PUBLIC_CAMERA_INTERVAL_MS || '1000'),

  updateFaceResults: (results: FaceResult[], latency: number) => {
    const state = get()
    const now = Date.now()
    const currentTime = new Date()

    // Initialize timestamps on first use (client-side only)
    if (state.ringBuffer10s[0].timestamp === 0) {
      const initializedBuffer = state.ringBuffer10s.map(() => ({
        timestamp: now,
        emotions: { happy: 0, sad: 0, angry: 0, fear: 0, surprise: 0, neutral: 0, disgusted: 0 }
      }))
      set({ ringBuffer10s: initializedBuffer })
    }

    // Update latency
    set({ latency_ms: latency })

    // Update people map
    const newPeopleMap = new Map(state.peopleMap)
    const newCounters = { ...state.sessionCounters }

    newCounters.totalFrames += 1
    newCounters.totalFaces += results.length

    // Process each detected face
    results.forEach((face, index) => {
      const key = face.identity?.user_id ?? face.identity?.label ?? `unknown_${now}_${index}`

      const person: PersonIdentity = {
        key,
        user_id: face.identity?.user_id,
        label: face.identity?.label || 'Unknown',
        lastSeen: currentTime,
        emotion: face.emotion.dominant,
        confidence: face.emotion.confidence,
        distance: face.identity?.distance,
        bbox: face.bbox
      }

      if (!newPeopleMap.has(key)) {
        newCounters.uniquePeople += 1
      }

      newPeopleMap.set(key, person)
    })

    // Update ring buffer with current frame emotions
    const currentBucket = state.ringBuffer10s[state.currentBucketIndex]
    const emotionCounts: EmotionDistribution = {
      happy: 0, sad: 0, angry: 0, fear: 0, surprise: 0, neutral: 0, disgusted: 0
    }

    results.forEach((face) => {
      const emotion = face.emotion.dominant.toLowerCase()
      if (emotion in emotionCounts) {
        emotionCounts[emotion as keyof EmotionDistribution] += 1
      }
    })

    // Advance bucket if enough time has passed (1 second)
    let newBucketIndex = state.currentBucketIndex
    if (now - currentBucket.timestamp >= 1000) {
      newBucketIndex = (state.currentBucketIndex + 1) % RING_BUFFER_SIZE
      state.ringBuffer10s[newBucketIndex] = {
        timestamp: now,
        emotions: emotionCounts
      }
    } else {
      // Update current bucket
      state.ringBuffer10s[state.currentBucketIndex].emotions = emotionCounts
    }

    set({
      peopleMap: newPeopleMap,
      sessionCounters: newCounters,
      currentBucketIndex: newBucketIndex
    })
  },

  removeStalePeople: () => {
    const state = get()
    const now = new Date()
    const newPeopleMap = new Map()

    state.peopleMap.forEach((person, key) => {
      if (now.getTime() - person.lastSeen.getTime() <= STALE_TIMEOUT_MS) {
        newPeopleMap.set(key, person)
      }
    })

    if (newPeopleMap.size !== state.peopleMap.size) {
      set({ peopleMap: newPeopleMap })
    }
  },

  toggleRecording: () => {
    set((state) => ({ recording: !state.recording }))
  },

  setZoom: (zoom: number) => {
    set({ zoom: Math.max(0.5, Math.min(3, zoom)) })
  },

  toggleDebugMode: () => {
    set((state) => ({ debugMode: !state.debugMode }))
  },

  updateFps: (fps: number) => {
    set({ fps })
  },

  getEmotionDistribution: (): EmotionDistribution => {
    const state = get()
    const totalCounts: EmotionDistribution = {
      happy: 0, sad: 0, angry: 0, fear: 0, surprise: 0, neutral: 0, disgusted: 0
    }

    // Sum up emotions from all buckets
    state.ringBuffer10s.forEach((bucket) => {
      Object.keys(totalCounts).forEach((emotion) => {
        totalCounts[emotion as keyof EmotionDistribution] +=
          bucket.emotions[emotion as keyof EmotionDistribution] || 0
      })
    })

    // Convert to percentages
    const total = Object.values(totalCounts).reduce((sum, count) => sum + count, 0)
    if (total === 0) return totalCounts

    Object.keys(totalCounts).forEach((emotion) => {
      const key = emotion as keyof EmotionDistribution
      const count = totalCounts[key] || 0
      totalCounts[key] = Math.round((count / total) * 100)
    })

    return totalCounts
  },

  clearSession: () => {
    set({
      peopleMap: new Map(),
      sessionCounters: {
        totalFrames: 0,
        totalFaces: 0,
        uniquePeople: 0
      },
      ringBuffer10s: Array(RING_BUFFER_SIZE).fill(null).map(() => ({
        timestamp: 0,
        emotions: { happy: 0, sad: 0, angry: 0, fear: 0, surprise: 0, neutral: 0, disgusted: 0 }
      })),
      currentBucketIndex: 0,
      fps: 0,
      latency_ms: 0
    })
  }
}))