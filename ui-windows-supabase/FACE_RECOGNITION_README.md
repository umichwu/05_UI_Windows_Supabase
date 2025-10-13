# Face Recognition + Emotion Detection System

A comprehensive facial recognition and emotion analysis system built with Next.js, Supabase, and DeepFace for real-time monitoring and care automation.

## 🚀 Features

### Frontend (Next.js)
- **CameraPanel**: Real-time camera feed with face detection and emotion analysis
- **EnrollmentDialog**: Multi-image face profile registration
- **FaceStatusBadge**: Live display of recognition results and emotional states
- **CareCenter**: Dashboard for mood trends, care incidents, and rule management

### Backend Services
- **Face Recognition API**: FastAPI service using DeepFace for face detection and emotion analysis
- **Care Automation**: Automated emotional wellbeing monitoring with customizable rules
- **n8n Integration**: Workflow automation for care notifications and incident management

### Core Capabilities
- **Real-time Face Recognition** using DeepFace (Facenet512, VGG-Face, etc.)
- **Emotion Detection** with 7-emotion classification (happy, sad, angry, fear, surprise, disgust, neutral)
- **Anti-spoofing Detection** for liveness verification
- **Care Rule Engine** for automated emotional health monitoring
- **Multi-channel Notifications** (LINE, WeChat, mobile push)

## 📋 Prerequisites

- Node.js 18+ and npm/yarn
- Python 3.9+ with pip
- Supabase account and database
- Camera access for face detection

## 🔧 Installation

### 1. Clone and Setup Next.js App

```bash
# Install frontend dependencies
npm install

# Add new required packages
npm install @radix-ui/react-select recharts

# Setup environment variables
cp .env.example .env.local
```

### 2. Configure Environment Variables

**`.env.local`** (Next.js):
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Face Recognition
FACE_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_CAMERA_INTERVAL_MS=5000
```

### 3. Setup Database Schema

```sql
-- Run the face recognition database schema
psql -d your_database < supabase_face_pro.sql
```

### 4. Install and Run DeepFace API Service

```bash
# Navigate to face API directory
cd face-api

# Install Python dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your database URL and preferences

# Run the FastAPI service
python main.py
# Or with uvicorn:
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 5. Run Next.js Development Server

```bash
# In the main project directory
npm run dev
```

## 🐳 Docker Deployment

### Run DeepFace API with Docker

```bash
cd face-api

# Build the image
docker build -t deepface-api .

# Run the container
docker run -p 8000:8000 \
  -e DATABASE_URL="your_database_url" \
  -e DEEPFACE_MODEL="Facenet512" \
  -e DEEPFACE_DETECTOR="retinaface" \
  -e DEEPFACE_THRESHOLD="0.30" \
  deepface-api
```

## 🔬 DeepFace Configuration

### Model Options
- **Facenet512** (default): High accuracy, 512-dim embeddings
- **VGG-Face**: Classic CNN architecture
- **OpenFace**: Lightweight option
- **ArcFace**: State-of-the-art accuracy
- **Dlib**: Fast processing

### Detector Backends
- **retinaface** (default): Best accuracy
- **mtcnn**: Good balance of speed/accuracy
- **opencv**: Fastest, basic detection
- **ssd**: Good for mobile deployment

### Distance Metrics
- **cosine** (default): Most robust
- **euclidean**: Direct distance
- **euclidean_l2**: Normalized distance

### Example Configuration
```python
# face-api/.env
DEEPFACE_MODEL=Facenet512
DEEPFACE_DETECTOR=retinaface
DEEPFACE_METRIC=cosine
DEEPFACE_THRESHOLD=0.30
ENABLE_ANTI_SPOOFING=true
```

## 🧪 Testing and Usage

### 1. Test Face Recognition API

```bash
# Health check
curl http://localhost:8000/

# Test emotion analysis
curl -X POST http://localhost:8000/analyze \
  -F "image=@test_face.jpg"

# Test enrollment
curl -X POST http://localhost:8000/enroll \
  -F "label=John Doe" \
  -F "images=@face1.jpg" \
  -F "images=@face2.jpg" \
  -F "images=@face3.jpg"

# Test recognition
curl -X POST http://localhost:8000/recognize \
  -F "image=@test_face.jpg"
```

### 2. Frontend Usage

1. **Navigate to Face Recognition**: `http://localhost:3001/face-recognition`
2. **Enroll Your Face**: Click "Enroll Your Face" and upload 3-5 clear photos
3. **Start Camera**: Allow camera access and begin real-time detection
4. **Monitor Care Center**: View emotion trends and configure care rules
5. **Manage Incidents**: Handle care notifications and close incidents

### 3. Database Queries

```sql
-- View recent face events
SELECT * FROM app.face_events
ORDER BY frame_ts DESC LIMIT 10;

-- Check mood windows
SELECT * FROM app.mood_windows
WHERE user_id = 'your-user-id'
ORDER BY window_end DESC;

-- Monitor care incidents
SELECT ci.*, cr.name as rule_name
FROM app.care_incidents ci
JOIN app.care_rules cr ON ci.rule_id = cr.id
WHERE ci.status = 'open';
```

## 🔄 n8n Care Flow Setup

1. **Import Workflow**: Import `n8n-care-flow.json` into n8n
2. **Configure Credentials**: Set up Supabase API credentials
3. **Environment Variables**:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_service_role_key
   ```
4. **Activate Workflow**: Enable the care monitoring flow

### Care Flow Features
- **Automatic Polling**: Checks for care triggers every minute
- **Smart Messaging**: Generates contextual care messages based on emotions
- **Multi-channel Notifications**: Supports LINE, WeChat, and mobile push
- **Incident Tracking**: Full lifecycle management of care incidents

## 🚀 Vercel Deployment

### 1. Deploy Next.js App

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel

# Set environment variables in Vercel dashboard
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
# FACE_API_BASE_URL (point to your deployed FastAPI service)
```

### 2. Deploy FastAPI Service

#### Option A: Railway/Render
```bash
# Deploy to Railway/Render with Dockerfile
# Set environment variables in platform dashboard
```

#### Option B: Google Cloud Run
```bash
# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT_ID/deepface-api
gcloud run deploy --image gcr.io/PROJECT_ID/deepface-api --platform managed
```

## 📊 API Reference

### Face Recognition Endpoints

#### POST `/enroll`
Enroll face profiles for a user.

**Request:**
```bash
curl -X POST /enroll \
  -F "label=John Doe" \
  -F "images=@face1.jpg" \
  -F "images=@face2.jpg"
```

**Response:**
```json
{
  "success": true,
  "profiles_created": 2,
  "embeddings": [
    {
      "label": "John Doe",
      "model": "Facenet512",
      "embedding": [0.123, -0.456, ...]
    }
  ]
}
```

#### POST `/recognize`
Recognize face and analyze emotions.

**Request:**
```bash
curl -X POST /recognize \
  -F "image=@face.jpg"
```

**Response:**
```json
{
  "success": true,
  "recognized_user": "user-uuid",
  "distance": 0.23,
  "dominant_emotion": "happy",
  "emotion_scores": {
    "happy": 0.85,
    "neutral": 0.10,
    "sad": 0.05
  },
  "confidence": 0.85,
  "is_spoof": false
}
```

#### POST `/analyze`
Analyze emotions only (no recognition).

**Response:**
```json
{
  "success": true,
  "face_detected": true,
  "dominant_emotion": "happy",
  "emotion_scores": {
    "angry": 0.02,
    "disgust": 0.01,
    "fear": 0.03,
    "happy": 0.85,
    "sad": 0.04,
    "surprise": 0.02,
    "neutral": 0.03
  },
  "confidence": 0.85
}
```

## 🔒 Security Considerations

### Privacy Protection
- **No Video Storage**: Only analysis results are stored, not video frames
- **Encrypted Embeddings**: Face embeddings are stored securely in database
- **User Consent**: Explicit camera permission and consent dialogs
- **RLS Policies**: Row-level security ensures data isolation

### Anti-Spoofing
- **Liveness Detection**: Basic blur and texture analysis
- **Multi-sample Enrollment**: Requires multiple photos for enrollment
- **Confidence Thresholds**: Configurable recognition thresholds

## 📚 Learning Resources

### DeepFace Documentation
- **Official Repository**: https://github.com/serengil/deepface
- **Research Paper**: "DeepFace: Closing the Gap to Human-Level Performance in Face Verification"
- **Face Recognition Tutorial**: https://sefiks.com/2018/08/06/deep-face-recognition-with-keras/
- **Emotion Detection Guide**: https://sefiks.com/2018/01/01/facial-expression-recognition-with-keras/

### Technical Background
- **Face Recognition Theory**: Understanding embedding spaces and similarity metrics
- **Emotion Classification**: 7-emotion model (Ekman's basic emotions)
- **Anti-Spoofing Techniques**: Liveness detection and presentation attack detection
- **Performance Optimization**: Model quantization and edge deployment

### Implementation Examples
```python
# Basic DeepFace usage
from deepface import DeepFace

# Face verification
result = DeepFace.verify(
    img1_path="img1.jpg",
    img2_path="img2.jpg",
    model_name="Facenet512",
    detector_backend="retinaface"
)

# Emotion analysis
analysis = DeepFace.analyze(
    img_path="face.jpg",
    actions=['emotion'],
    detector_backend="retinaface"
)

# Face representation
embedding = DeepFace.represent(
    img_path="face.jpg",
    model_name="Facenet512"
)
```

## 🐛 Troubleshooting

### Common Issues

#### Camera Access Denied
- Check browser permissions
- Ensure HTTPS in production
- Clear browser cache and cookies

#### Face Detection Fails
- Ensure good lighting
- Face should be clearly visible
- Try different detector backend

#### API Connection Errors
- Verify FACE_API_BASE_URL is correct
- Check if DeepFace service is running
- Review CORS configuration

#### Database Connection Issues
- Verify DATABASE_URL format
- Check network connectivity
- Ensure proper RLS policies

### Performance Tuning

#### Optimize Recognition Speed
```python
# Use faster detector
DEEPFACE_DETECTOR=opencv

# Reduce threshold for faster matching
DEEPFACE_THRESHOLD=0.40

# Use lighter model
DEEPFACE_MODEL=OpenFace
```

#### Memory Optimization
```python
# Limit concurrent processing
# Add connection pooling
# Use async/await patterns
```

## 📞 Support

For issues and questions:
- Check the troubleshooting guide above
- Review DeepFace documentation
- Examine browser console for errors
- Check API service logs

## 🔄 Updates and Maintenance

### Regular Tasks
- Update DeepFace models periodically
- Monitor care rule effectiveness
- Review and tune recognition thresholds
- Clean up old face events data
- Update security policies

### Model Updates
```bash
# Update DeepFace
pip install --upgrade deepface

# Clear model cache if needed
rm -rf ~/.deepface/weights
```

---

**Built with ❤️ using DeepFace, Next.js, Supabase, and n8n**