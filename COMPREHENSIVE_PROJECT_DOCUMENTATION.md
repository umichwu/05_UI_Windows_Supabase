# 🚀 Chat UI with Face Recognition - Beta Version Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Database Schema](#database-schema)
5. [Function Catalog](#function-catalog)
6. [Face Recognition System](#face-recognition-system)
7. [Deployment Guide](#deployment-guide)
8. [API Documentation](#api-documentation)
9. [Development Guidelines](#development-guidelines)
10. [Troubleshooting](#troubleshooting)

---

## Project Overview

This is a **production-ready beta version** of an advanced chat application that combines real-time messaging with AI-powered face recognition and emotion detection capabilities. The system supports both individual conversations and automated care monitoring through facial emotion analysis.

### Key Features
- 💬 **Real-time Chat System** with file attachments and LLM integration
- 🎭 **Advanced Face Recognition** with emotion detection and anti-spoofing
- 🧠 **Automatic Conversation Summaries** triggered by message thresholds
- 🔒 **Enterprise Security** with Row Level Security (RLS) and authentication
- 📊 **Care Monitoring System** with customizable emotional state triggers
- 🔄 **Dual Processing Modes** (Dev/Production) with event-driven architecture
- 📱 **Responsive UI** built with modern React patterns

### Current Status: **Production Ready ✅**
- All core features implemented and tested
- Comprehensive admin tools and monitoring
- Ready for customer beta testing
- Scalable architecture with event-driven processing

---

## System Architecture

### Overall Architecture Diagram
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js UI   │ ←→ │   Supabase      │ ←→ │   n8n Pipeline  │
│                 │    │                 │    │                 │
│ • Chat Interface│    │ • Database      │    │ • LLM Processing│
│ • Face Detection│    │ • Auth          │    │ • Event Queue   │
│ • Admin Tools   │    │ • Storage       │    │ • Care Triggers │
│ • Real-time UI  │    │ • Realtime      │    │ • Notifications │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Face API       │    │  Python Scripts │    │  External APIs  │
│  DeepFace AI    │    │  Image Process  │    │  OpenAI/Claude  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Processing Modes

**1. Development Mode (dev)**
- Direct LLM API calls from frontend
- Immediate responses (2-10 seconds)
- Perfect for testing and prototyping

**2. Production Mode (outbox)**
- Event-driven processing through n8n
- Scalable queue management
- Production-ready with retry logic

### Data Flow Architecture

**Chat Message Flow:**
```
User Input → Store Message → Mode Check
├─ Dev Mode: Direct LLM Call → Store Response → UI Update
└─ Outbox Mode: Create Event → n8n Processing → Store Response → UI Update
```

**Face Recognition Flow:**
```
Camera Feed → Capture Frame → API Processing → Python DeepFace →
Store Face Event → Trigger Care Rules → Create Notifications → UI Update
```

**Auto-Summary Flow:**
```
New Message → Update Counters → Check Threshold (20 msgs) →
Create Summary Request → n8n Processing → Store Summary → UI Update
```

---

## Technology Stack

### Frontend
- **Next.js 15.5.2** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Modern utility-first styling
- **shadcn/ui** - High-quality component library
- **Zustand** - Lightweight state management
- **Lucide React** - Beautiful icon system

### Backend & Database
- **Supabase** - PostgreSQL with real-time capabilities
- **pgvector** - Vector embeddings for semantic search
- **Row Level Security (RLS)** - Multi-tenant data protection
- **Database Triggers** - Automated workflow processing

### AI & Processing
- **Python 3 + DeepFace** - Face recognition and emotion analysis
- **OpenCV** - Image processing and manipulation
- **OpenAI GPT-4** - Language model integration
- **n8n** - Workflow automation and event processing

### Development Tools
- **ESLint** - Code linting and formatting
- **TypeScript** - Static type checking
- **Git** - Version control
- **Vercel** - Deployment and hosting

---

## Database Schema

### Core Tables Overview

#### 1. **Conversation System**
```sql
-- Main conversation container
app.conversations (id, user_id, title, status, msg_count, last_message_at)

-- All chat messages with roles
app.messages (id, conversation_id, role, content, metadata, created_at)

-- File attachments with secure storage
app.messages_attachments (id, message_id, storage_object_path, mime_type)

-- AI-generated conversation summaries
app.conversation_summaries (id, conversation_id, summary, is_latest, token_count)
```

#### 2. **Face Recognition System**
```sql
-- User face embeddings for recognition
app.face_profiles (id, user_id, label, model, embedding[512])

-- Real-time face detection events
app.face_events (id, recognized_user_id, dominant_emotion, confidence, frame_ts)

-- Aggregated emotion windows for analysis
app.mood_windows (id, user_id, window_sec, dominant_emotion, ratio)
```

#### 3. **Care Monitoring System**
```sql
-- Customizable care rules and triggers
app.care_rules (id, user_id, target_emotions[], window_sec, min_ratio)

-- Care incidents and notifications
app.care_incidents (id, user_id, rule_id, status, context)
```

#### 4. **Event Processing System**
```sql
-- Reliable event queue with retry logic
app.outbox_events (id, event_type, status, payload, attempt_count)

-- System configuration storage
app.config (key, value, updated_at)

-- Long-term user memory and context
app.user_memory (id, user_id, memory_type, content, importance)
```

### Key Database Features

**Automatic Triggers:**
- `trg_update_conversation_on_message` - Updates conversation metadata
- `trg_check_auto_summary` - Triggers summaries after 20 messages
- `trg_eval_care_rules_on_face_event` - Evaluates emotional care rules

**Row Level Security (RLS):**
- All tables protected with user-based access control
- File storage secured with path-based permissions
- Service role bypass for system operations

**Performance Optimizations:**
- Strategic indexes on user_id, conversation_id, timestamps
- Full-text search with PostgreSQL FTS
- Vector similarity search with pgvector

---

## Function Catalog

### API Routes (`src/app/api/`)

#### Face Recognition APIs
| Route | Method | Purpose | Parameters |
|-------|--------|---------|------------|
| `/api/face/analyze` | POST | Emotion analysis for uploaded images | FormData with image |
| `/api/face/enroll` | POST | Register new face profiles | FormData with label + images |
| `/api/face/recognize` | POST | Real-time face recognition | JSON with base64 image |

### Custom Hooks (`src/hooks/`)

#### Core Data Management
| Hook | Purpose | Key Functions |
|------|---------|---------------|
| `useConversations` | Conversation CRUD | `fetchConversations()`, `createConversation()`, `renameConversation()` |
| `useMessages` | Message operations | `fetchMessages()`, `sendMessage()`, `deleteMessage()` |
| `useConversationSummary` | Summary management | `fetchConversationSummaries()`, `checkSummaryStatus()` |

### Utility Libraries (`src/lib/`)

#### Authentication & State
- **`auth-store.ts`** - Global authentication state with Zustand
- **`faceStore.ts`** - Real-time face detection state management
- **`supabaseClient.ts`** - Configured Supabase client instance

#### Core Services
- **`faceApi.ts`** - Face recognition API integration and image processing
- **`llm.ts`** - Language model integration with multimodal support
- **`storage.ts`** - Secure file upload/download management

#### Utilities
- **`types.ts`** - Comprehensive TypeScript definitions
- **`utils.ts`** - UI utilities and helper functions
- **`toast.ts`** - Global notification system

### React Components (`src/components/`)

#### Chat System Components
| Component | Purpose | Key Features |
|-----------|---------|--------------|
| `MessageStream` | Message display | Real-time updates, attachment preview |
| `Composer` | Message input | File upload, drag & drop, paste detection |
| `ConversationList` | Sidebar navigation | Conversation management, search |
| `ChatHeader` | App navigation | User info, connection status |

#### Face Recognition Components
| Component | Purpose | Key Features |
|-----------|---------|--------------|
| `CameraPanel` | Live camera feed | Real-time recognition, privacy controls |
| `OverlayCanvas` | Face detection overlay | Bounding boxes, emotion labels |
| `EnrollmentDialog` | Face registration | Multi-image capture, profile creation |
| `CareCenter` | Emotion monitoring | Care rules, incident management |

#### Admin & DevTools
| Component | Purpose | Key Features |
|-----------|---------|--------------|
| `OutboxTable` | Event monitoring | Queue status, retry management |
| `ConfigEditor` | System settings | LLM config, retry policies |
| `DatabaseTest` | Connection testing | Comprehensive health checks |
| `EventSandbox` | Development tools | Test event creation |

---

## Face Recognition System

### Technical Implementation

#### Core Processing Pipeline
1. **Camera Capture** - Real-time video frame extraction
2. **Image Optimization** - Downscaling to 640px for efficiency
3. **Python Processing** - DeepFace AI analysis with multiple backends
4. **Database Storage** - Face events with emotion and recognition data
5. **Care Rule Evaluation** - Automatic emotional state monitoring

#### AI Models & Backends
- **Face Detection**: MTCNN (balanced accuracy/speed)
- **Face Recognition**: Facenet512 (512-dimensional embeddings)
- **Emotion Analysis**: DeepFace emotion model
- **Anti-spoofing**: Optional liveness detection

#### Performance Characteristics
- **Processing Time**: ~3-12 seconds (CPU-only)
- **Detection Rate**: ~1 FPS (configurable interval)
- **Accuracy**: Production-grade with confidence scoring
- **Memory Usage**: Optimized through image downscaling

### Face Recognition Features

#### Real-time Recognition
```typescript
// Live camera processing
const recognizeFaces = async (base64Image: string) => {
  const response = await fetch('/api/face/recognize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image })
  });
  return response.json();
};
```

#### Emotion Detection
- **7 Basic Emotions**: Happy, Sad, Angry, Fear, Surprise, Disgust, Neutral
- **Confidence Scoring**: 0-1 probability scores for each emotion
- **Dominant Emotion**: Highest probability emotion classification
- **Temporal Analysis**: Emotion tracking over time windows

#### Care Rule System
```sql
-- Example care rule for depression detection
INSERT INTO app.care_rules (
  user_id, name, target_emotions, window_sec, min_ratio
) VALUES (
  auth.uid(), 'Sadness Monitor', ARRAY['sad'], 300, 0.6
);
```

---

## Deployment Guide

### Production Deployment (Vercel)

#### Quick Setup Steps
1. **Prepare Supabase Production Database**
   ```bash
   # Run SQL scripts in order:
   # 1. supabase_chat_pro.sql
   # 2. supabase_face_pro.sql
   # 3. automatic-summary-system.sql
   ```

2. **Deploy to Vercel**
   ```bash
   # GitHub integration (recommended)
   git push origin main
   # Vercel auto-deploys from GitHub

   # Or CLI deployment
   npm install -g vercel
   vercel
   ```

3. **Configure Environment Variables**
   ```env
   # Production Supabase
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key

   # Production mode
   NEXT_PUBLIC_DEV_MODE=outbox

   # LLM API keys
   OPENAI_API_KEY=sk-your-production-key
   ```

#### Production Checklist
- [ ] ✅ Database schema deployed
- [ ] ✅ Environment variables configured
- [ ] ✅ Storage bucket created and secured
- [ ] ✅ Authentication providers enabled
- [ ] ✅ Domain configured (optional)
- [ ] ✅ Performance testing completed

### Alternative Deployment Options

#### Docker Deployment
```dockerfile
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

#### Environment Configuration
```bash
# Development
NEXT_PUBLIC_DEV_MODE=dev

# Production
NEXT_PUBLIC_DEV_MODE=outbox
```

---

## API Documentation

### Face Recognition Endpoints

#### POST `/api/face/recognize`
Real-time face recognition and emotion detection.

**Request:**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...",
  "frameId": "frame_1234567890"
}
```

**Response:**
```json
{
  "frameId": "frame_1234567890",
  "faces": [
    {
      "bbox": [120, 80, 180, 240],
      "emotion": {
        "dominant": "happy",
        "scores": {
          "happy": 0.85,
          "neutral": 0.12,
          "sad": 0.03
        },
        "confidence": 0.85
      },
      "recognition": {
        "recognized_user": "uuid-here",
        "distance": 0.23,
        "confidence": 0.92
      }
    }
  ],
  "latency_ms": 3241
}
```

#### POST `/api/face/enroll`
Register new face profiles for recognition.

**Request:**
```javascript
const formData = new FormData();
formData.append('label', 'John Doe');
formData.append('images', imageFile1);
formData.append('images', imageFile2);
```

**Response:**
```json
{
  "success": true,
  "profiles_created": 3,
  "user_id": "uuid-here",
  "label": "John Doe"
}
```

### Chat System Endpoints

The chat system primarily uses Supabase's real-time capabilities rather than custom REST endpoints. Key operations include:

- **Message Creation**: Direct database insert with trigger processing
- **File Upload**: Supabase Storage with secure path-based access
- **Real-time Updates**: WebSocket subscriptions to database changes

---

## Development Guidelines

### Code Organization Principles

#### Component Structure
```typescript
// Example component pattern
interface ComponentProps {
  // Explicit prop types
}

export default function Component({ prop }: ComponentProps) {
  // 1. Hooks and state
  const [state, setState] = useState();

  // 2. Event handlers
  const handleAction = useCallback(() => {
    // Implementation
  }, [dependencies]);

  // 3. Effects
  useEffect(() => {
    // Side effects
  }, [dependencies]);

  // 4. Render
  return (
    <div className="component-container">
      {/* JSX content */}
    </div>
  );
}
```

#### State Management Patterns
```typescript
// Zustand store pattern
interface StoreState {
  data: DataType[];
  isLoading: boolean;
  actions: {
    fetchData: () => Promise<void>;
    updateData: (id: string, updates: Partial<DataType>) => void;
  };
}

export const useStore = create<StoreState>((set, get) => ({
  data: [],
  isLoading: false,
  actions: {
    fetchData: async () => {
      set({ isLoading: true });
      // Fetch logic
      set({ data: results, isLoading: false });
    },
    updateData: (id, updates) => {
      // Update logic
    }
  }
}));
```

### Security Best Practices

#### Row Level Security
```sql
-- Example RLS policy
CREATE POLICY "Users can read own data"
ON app.table_name FOR SELECT
TO authenticated
USING (user_id = auth.uid());
```

#### File Security
- Path-based access control: `{user_id}/{conversation_id}/{message_id}/filename`
- Content type validation and size limits
- SHA256 integrity verification

#### API Security
- JWT token validation on all protected routes
- Input sanitization and validation
- Rate limiting (handled by Vercel)

### Testing Guidelines

#### Database Testing
```typescript
// Example test pattern
describe('Database Operations', () => {
  test('should create conversation', async () => {
    const result = await createConversation({
      title: 'Test Conversation',
      user_id: testUserId
    });
    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
  });
});
```

#### Component Testing
```typescript
// Example component test
import { render, screen } from '@testing-library/react';
import Component from './Component';

test('renders component correctly', () => {
  render(<Component prop="value" />);
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

---

## Troubleshooting

### Common Issues & Solutions

#### Database Connection Issues
```sql
-- Test database connectivity
SELECT 'Database connection successful' as status;

-- Check RLS policies
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'app';
```

#### Face Recognition Issues
```python
# Test Python DeepFace installation
python3 -c "from deepface import DeepFace; print('DeepFace installed successfully')"

# Check model downloads
ls ~/.deepface/weights/
```

#### Build & Deployment Issues
```bash
# Test local build
npm run build

# Check environment variables
echo $NEXT_PUBLIC_SUPABASE_URL

# Verify TypeScript
npx tsc --noEmit
```

#### Performance Issues
```sql
-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Monitor database connections
SELECT count(*) FROM pg_stat_activity;
```

### Monitoring & Debugging

#### Application Monitoring
- **Vercel Analytics**: Page performance and Core Web Vitals
- **Supabase Dashboard**: Database performance and API usage
- **Browser DevTools**: Real-time debugging and network analysis

#### Log Analysis
```typescript
// Structured logging pattern
console.log('📸 Processing frame...', {
  frameSize: base64Image.length,
  timestamp: new Date().toISOString(),
  userId: user?.id
});
```

#### Error Handling
```typescript
// Global error boundary pattern
export class ErrorBoundary extends Component {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application error:', error, errorInfo);
    // Send to monitoring service
  }
}
```

---

## Version Information

- **Current Version**: 3.2.0 (Beta)
- **Last Updated**: December 2024
- **Status**: Production Ready
- **License**: Proprietary

### Recent Updates
- ✅ Enhanced face recognition with emotion detection
- ✅ Automated care monitoring system
- ✅ Comprehensive admin tools and monitoring
- ✅ Production deployment optimization
- ✅ Real-time event processing with retry logic

### Upcoming Features
- 🔄 Vector search for semantic message retrieval
- 🔄 Mobile app companion (React Native)
- 🔄 Advanced analytics dashboard
- 🔄 Plugin system for custom integrations

---

## Contact & Support

For technical questions, deployment assistance, or feature requests:

- **Documentation**: All README files in project directory
- **Database Schema**: `SUPABASE_DATABASE_SCHEMA.md`
- **Setup Guide**: `SETUP_GUIDE.md`
- **Deployment**: `DEPLOYMENT_GUIDE.md`

**Status**: Ready for production deployment and customer beta testing! 🚀

---

*This documentation represents a comprehensive overview of the Chat UI with Face Recognition system. The application is production-ready and designed for scalability, security, and extensibility.*