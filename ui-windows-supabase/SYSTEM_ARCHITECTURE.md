# Face Recognition Lab - System Architecture Documentation

## Overview
This is a Next.js web application that provides real-time face detection, recognition, and emotion analysis using a camera feed. The system combines web technologies with Python-based DeepFace AI processing.

## Technology Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Zustand** - State management
- **Shadcn/UI** - Component library
- **Sonner** - Toast notifications

### Backend
- **Next.js API Routes** - Server-side endpoints
- **Python 3** - AI processing with DeepFace
- **DeepFace** - Face detection and emotion analysis
- **OpenCV** - Image processing
- **NumPy/PIL** - Image manipulation

### Database
- **Supabase** - PostgreSQL database with real-time features
- **Row Level Security (RLS)** - Data access control

## System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Browser   │───▶│   Next.js App   │───▶│   Supabase DB   │
│  (Camera Feed)  │    │  (API Routes)   │    │ (Face Events)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│  Canvas Capture │    │  Python Script  │
│  (Base64 Image) │───▶│   (DeepFace)    │
└─────────────────┘    └─────────────────┘
```

## Face Detection Pipeline

### 1. Camera Stream Processing
```typescript
// CameraPreview.tsx - Main flow
const intervalRef = setInterval(async () => {
  // Capture frame from video element
  const canvas = captureVideoFrame(videoRef.current)

  // Downscale for API efficiency (640px max)
  const downscaled = downscaleCanvas(canvas, 640)
  const base64Image = canvasToBase64(downscaled, 0.8)

  // Call recognition API
  const results = await recognizeFaces(base64Image)

  // Update UI state with results
  updateFaceResults(results.faces, latency)
}, cameraInterval)
```

### 2. API Processing Flow
```typescript
// /api/face/recognize/route.ts
export async function POST(request: NextRequest) {
  // 1. Extract base64 image from request
  const { image, frameId } = await request.json()

  // 2. Call Python DeepFace script
  const tempFile = `/tmp/face_input_${Date.now()}.txt`
  fs.writeFileSync(tempFile, imageBase64)
  const { stdout } = await execAsync(
    `python3 face-detect.py "$(cat ${tempFile})" && rm ${tempFile}`
  )

  // 3. Parse Python results
  const pythonResult = JSON.parse(stdout)

  // 4. Store face events in Supabase
  await supabase.from('face_events').insert(faceEventData)

  // 5. Return formatted response
  return NextResponse.json({ frameId, faces, latency_ms })
}
```

### 3. Python DeepFace Processing
```python
# face-detect.py - Core detection logic
def detect_faces(image_base64):
    # 1. Decode base64 → PIL Image → NumPy array
    image_data = base64.b64decode(image_base64.split(',')[1])
    img_array = np.array(Image.open(io.BytesIO(image_data)))

    # 2. Handle RGBA → RGB conversion
    if img_array.shape[2] == 4:
        img_array = img_array[:, :, :3]

    # 3. Extract faces with accurate bounding boxes
    face_objs = DeepFace.extract_faces(
        img_path=img_array,
        detector_backend='mtcnn',
        enforce_detection=False
    )

    # 4. Analyze emotions on cropped face regions
    for face_obj in face_objs:
        facial_area = face_obj['facial_area']
        x, y, w, h = facial_area['x'], facial_area['y'], facial_area['w'], facial_area['h']

        face_region = img_array[y:y+h, x:x+w]
        emotion_results = DeepFace.analyze(
            img_path=face_region,
            actions=['emotion'],
            detector_backend='opencv'
        )

        # 5. Format response with bbox and emotion data
        face_data = {
            'bbox': [int(x), int(y), int(w), int(h)],
            'emotion': {
                'dominant': dominant_emotion,
                'scores': emotion_scores_normalized,
                'confidence': confidence
            }
        }
```

### 4. Real-time Overlay Rendering
```typescript
// OverlayCanvas.tsx - Live face boxes
const drawFaces = () => {
  const { peopleMap } = useFaceStore.getState()

  peopleMap.forEach(person => {
    person.faces.forEach(face => {
      if (face.bbox) {
        const [x, y, w, h] = face.bbox

        // Scale coordinates to canvas size
        const scaleX = canvas.width / videoWidth
        const scaleY = canvas.height / videoHeight

        // Draw green rectangle
        ctx.strokeStyle = '#00ff00'
        ctx.strokeRect(x * scaleX, y * scaleY, w * scaleX, h * scaleY)

        // Draw emotion label
        ctx.fillText(face.emotion.dominant, x * scaleX, y * scaleY - 5)
      }
    })
  })
}
```

## Key Components

### State Management (Zustand)
```typescript
// /lib/faceStore.ts
interface FaceStore {
  peopleMap: Map<string, Person>     // Active detected people
  fps: number                        // Processing frame rate
  zoom: number                       // Camera zoom level
  cameraInterval: number             // Detection frequency (ms)
  updateFaceResults: (faces, latency) => void
  removeStalePeople: () => void      // Cleanup old detections
}
```

### Core Components
- **`/app/facelab/page.tsx`** - Main application layout
- **`/components/facelab/CameraPreview.tsx`** - Camera stream and controls
- **`/components/facelab/OverlayCanvas.tsx`** - Real-time face box rendering
- **`/components/facelab/PeoplePanel.tsx`** - Detected people list
- **`/components/facelab/ControlsBar.tsx`** - Settings and controls
- **`/components/facelab/StatusBar.tsx`** - System status display

### Configuration Files
- **`.env.local`** - Environment variables
- **`face-detect.py`** - Python DeepFace script
- **`package.json`** - Dependencies and scripts
- **`tailwind.config.js`** - Styling configuration

## Performance Considerations

### Optimization Strategies
1. **Image Downscaling**: Resize to 640px before API call
2. **JPEG Compression**: 0.8 quality for balance of speed/accuracy
3. **Interval Control**: Configurable detection frequency (default 1000ms)
4. **GPU Acceleration**: DeepFace supports CUDA (requires proper drivers)
5. **Detector Backend Selection**:
   - `opencv`: Fastest, lower accuracy
   - `mtcnn`: Balanced accuracy/speed
   - `retinaface`: Highest accuracy, slower

### Current Performance
- **Processing Time**: ~3-12 seconds (CPU-only on WSL2)
- **Frame Rate**: ~1 FPS detection (limited by processing time)
- **Memory Usage**: Optimized through image downscaling

## Testing Features

### Test Detection Button
- Captures single frame from camera
- Runs complete detection pipeline
- Shows side-by-side comparison:
  - Original captured image
  - Image with green detection boxes
- Displays detailed face information (bbox coordinates, emotions)

### Debug Logging
Comprehensive logging throughout the pipeline:
```typescript
console.log('📸 Processing frame...')
console.log('🔍 Calling face recognition API...', { frameSize: base64Image.length })
console.log('✅ Face recognition response:', { faces: results.faces.length, latency })
```

## Error Handling

### Common Issues and Solutions
1. **Camera Access**: Graceful fallback with error messages
2. **Python Script Errors**: Fallback to empty face array
3. **Image Format Issues**: RGBA→RGB conversion
4. **Shell Escaping**: Temporary file approach for base64 data
5. **Timeout Protection**: 15-second timeout on Python calls

### Monitoring
- Real-time FPS display
- Processing status indicators
- Toast notifications for errors
- Detailed console logging for debugging

## Version Information
- **Current Version**: v1.8.5
- **Last Updated**: December 2024
- **Status**: Production-ready with test features

This architecture provides a robust, scalable foundation for real-time face detection with clear separation of concerns and comprehensive error handling.