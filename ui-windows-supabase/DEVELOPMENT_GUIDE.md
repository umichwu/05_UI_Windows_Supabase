# Development Guide - Face Recognition Lab

## Project Structure

```
ui-windows-supabase/
├── src/
│   ├── app/
│   │   ├── facelab/
│   │   │   └── page.tsx                 # Main face lab interface
│   │   ├── api/
│   │   │   └── face/
│   │   │       └── recognize/
│   │   │           └── route.ts         # Face detection API endpoint
│   │   ├── globals.css                  # Global styles
│   │   └── layout.tsx                   # Root layout
│   ├── components/
│   │   ├── ui/                          # Shadcn/UI components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── sonner.tsx               # Toast notifications
│   │   │   └── ...
│   │   └── facelab/                     # Face recognition components
│   │       ├── CameraPreview.tsx        # 📸 Main camera component
│   │       ├── OverlayCanvas.tsx        # 🎯 Face box overlay
│   │       ├── PeoplePanel.tsx          # 👥 Detected people list
│   │       ├── ControlsBar.tsx          # ⚙️ Settings controls
│   │       └── StatusBar.tsx            # 📊 System status
│   └── lib/
│       ├── faceApi.ts                   # Face API client functions
│       ├── faceStore.ts                 # Zustand state management
│       ├── types.ts                     # TypeScript type definitions
│       └── utils.ts                     # Utility functions
├── face-detect.py                       # 🐍 Python DeepFace script
├── supabase_face_pro.sql               # 🗄️ Database schema
├── package.json                         # Dependencies
├── tailwind.config.js                  # Styling configuration
├── .env.local                          # Environment variables
└── next.config.js                      # Next.js configuration
```

## Key Development Patterns

### 1. Face Detection Flow
```typescript
// Camera → Canvas → Base64 → API → Python → Database → UI Update

// CameraPreview.tsx - Capture and process
const intervalRef = setInterval(async () => {
  // 1. Capture frame from video
  const canvas = captureVideoFrame(videoRef.current)

  // 2. Downscale for efficiency
  const downscaled = downscaleCanvas(canvas, 640)
  const base64Image = canvasToBase64(downscaled, 0.8)

  // 3. Call API
  const results = await recognizeFaces(base64Image)

  // 4. Update state
  updateFaceResults(results.faces, latency)
}, cameraInterval)
```

### 2. State Management with Zustand
```typescript
// lib/faceStore.ts - Central state
interface FaceStore {
  peopleMap: Map<string, Person>     // Active detections
  fps: number                        // Performance metrics
  cameraInterval: number             // Detection frequency
  updateFaceResults: (faces, latency) => void
  removeStalePeople: () => void      // Cleanup expired detections
}

// Usage in components
const { peopleMap, updateFaceResults } = useFaceStore()
```

### 3. Real-time Overlay System
```typescript
// OverlayCanvas.tsx - Live drawing
const drawFaces = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  peopleMap.forEach(person => {
    person.faces.forEach(face => {
      const [x, y, w, h] = face.bbox

      // Scale to canvas dimensions
      const scaleX = canvas.width / videoWidth
      const scaleY = canvas.height / videoHeight

      // Draw green rectangle
      ctx.strokeStyle = '#00ff00'
      ctx.strokeRect(x * scaleX, y * scaleY, w * scaleX, h * scaleY)
    })
  })
}
```

### 4. Python Integration Pattern
```typescript
// API Route - Safe Python execution
const tempFile = `/tmp/face_input_${Date.now()}.txt`
fs.writeFileSync(tempFile, imageBase64)

const { stdout, stderr } = await execAsync(
  `python3 face-detect.py "$(cat ${tempFile})" && rm ${tempFile}`,
  { timeout: 15000 }
)

const pythonResult = JSON.parse(stdout)
```

### 5. Database Integration
```typescript
// Store detection results
const faceEventData = {
  user_id: currentUserId,
  recognized_user_id: recognitionResult.recognized_user,
  dominant_emotion: recognitionResult.dominant_emotion,
  emotion_scores: recognitionResult.emotion_scores,
  confidence: recognitionResult.confidence,
  // ... other fields
}

await supabase.schema('app').from('face_events').insert([faceEventData])
```

## Development Workflow

### Setting Up Development Environment

1. **Install Dependencies**
```bash
npm install
```

2. **Environment Configuration**
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_CAMERA_INTERVAL_MS=1000

# Face API disabled to use Python script
# FACE_API_BASE_URL=http://localhost:8000
```

3. **Python Environment**
```bash
pip install deepface opencv-python pillow numpy
```

4. **Database Setup**
```bash
# Run the SQL schema file in Supabase
psql $DATABASE_URL -f supabase_face_pro.sql
```

5. **Start Development Server**
```bash
npm run dev
```

### Common Development Tasks

#### Adding New Face Detection Features
1. **Modify Python Script** (`face-detect.py`)
2. **Update API Response Format** (`route.ts`)
3. **Handle New Data in Frontend** (`faceStore.ts`, components)
4. **Test with Debug Button** (CameraPreview test feature)

#### Performance Optimization
```typescript
// Adjustable parameters
const DETECTION_INTERVAL = 1000    // ms between detections
const MAX_IMAGE_SIZE = 640         // px for API calls
const JPEG_QUALITY = 0.8           // compression level
const PROCESSING_TIMEOUT = 15000   // ms for Python script
```

#### Adding New Emotion Actions
1. **Update Care Rules** (database)
2. **Modify Trigger Logic** (PostgreSQL function)
3. **Handle Outbox Events** (n8n integration)

## Testing and Debugging

### Face Detection Testing
- Use the **"Test Detection"** button in CameraPreview
- Check console logs for detailed pipeline information
- Compare original vs detected images side-by-side

### Debug Logging Levels
```typescript
// Comprehensive logging throughout pipeline
console.log('📸 Processing frame...')          // Frame capture
console.log('🔍 Calling face recognition API...') // API call
console.log('✅ Face recognition response:', results) // Results
console.log('📊 Store updated, people count:', count) // State updates
```

### Performance Monitoring
- FPS counter in status bar
- Processing time measurements
- Memory usage tracking
- GPU acceleration status

## Component Responsibilities

### CameraPreview.tsx
- **Primary Role**: Camera stream management and frame processing
- **Key Features**:
  - Video stream control (start/stop/restart)
  - Automatic frame capture at intervals
  - Test detection functionality
  - Processing status indicators

### OverlayCanvas.tsx
- **Primary Role**: Real-time face box rendering
- **Key Features**:
  - Coordinate scaling from detection to display
  - Green box drawing with emotion labels
  - Smooth animation updates

### PeoplePanel.tsx
- **Primary Role**: Display detected people information
- **Key Features**:
  - Live person list with emotions
  - Identity information (when available)
  - Detection confidence scores

### ControlsBar.tsx
- **Primary Role**: System configuration interface
- **Key Features**:
  - Detection interval adjustment
  - Camera zoom controls
  - Recording controls

### StatusBar.tsx
- **Primary Role**: System metrics display
- **Key Features**:
  - FPS counter
  - Processing latency
  - Active detection count

## Error Handling Patterns

### Graceful Degradation
```typescript
try {
  const results = await recognizeFaces(imageBase64)
  updateFaceResults(results.faces, latency)
} catch (error) {
  console.error('Face detection failed:', error)
  // Continue operation without failing completely
  toast.error('Detection temporarily unavailable')
}
```

### Retry Logic
```typescript
// Python script timeout handling
const { stdout, stderr } = await execAsync(pythonCommand, {
  timeout: 15000
})

// Fallback response on failure
recognitionResult = {
  success: true,
  recognized_user: null,
  dominant_emotion: 'unknown',
  emotion_scores: {},
  confidence: 0
}
```

## Configuration Management

### Environment-based Configuration
```typescript
// Dynamic backend selection
if (FACE_API_BASE_URL) {
  // Use external face API service
  const response = await fetch(`${FACE_API_BASE_URL}/recognize`)
} else {
  // Use local Python DeepFace script
  const pythonResult = await execAsync('python3 face-detect.py')
}
```

### Performance Tuning
```typescript
// Adjustable detection parameters
const config = {
  cameraInterval: parseInt(process.env.NEXT_PUBLIC_CAMERA_INTERVAL_MS) || 1000,
  maxImageSize: 640,
  jpegQuality: 0.8,
  detectorBackend: 'mtcnn',  // opencv, mtcnn, retinaface
  confidenceThreshold: 0.6
}
```

## Security Considerations

### Image Data Handling
- Base64 encoding for API transport
- Temporary file cleanup after processing
- No persistent image storage (GDPR compliance)

### Database Security
- Row Level Security (RLS) on all tables
- Service role key for API routes only
- User-scoped data access policies

### API Security
- Request validation and sanitization
- Timeout protection on Python calls
- Error message sanitization

## Deployment Considerations

### Performance Requirements
- **CPU**: Python DeepFace processing (CPU-intensive)
- **Memory**: OpenCV image processing
- **GPU**: Optional CUDA acceleration
- **Network**: Real-time camera stream processing

### Scaling Considerations
- Horizontal scaling with external Face API
- Redis for shared state (if multi-instance)
- CDN for static assets
- Database connection pooling

This guide provides the foundation for maintaining and extending the face recognition system. The modular architecture allows for independent development of components while maintaining system cohesion.