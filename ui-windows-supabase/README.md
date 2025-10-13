# 💬 Chat UI System - Beta Version

A complete, production-ready chat application built with Next.js and Supabase, featuring real-time messaging, LLM integration, auto-summaries, and comprehensive admin tools.

## 🏗️ Architecture Overview

This system implements a **dual-processing architecture** with two operational modes:

### 🔄 **Dual Processing Modes**

**1. Dev Mode (Direct LLM)**
- User sends message → Stored in database → LLM called directly → Assistant response stored
- Immediate responses, perfect for development and testing

**2. Outbox Mode (n8n Pipeline)**
- User sends message → Stored in database → Outbox event created → n8n processes → Assistant response written back
- Production-ready, scalable architecture with queue management

### 🏛️ **System Architecture**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js UI   │ ←→ │   Supabase      │ ←→ │   n8n Pipeline  │
│                 │    │                 │    │                 │
│ • Chat Interface│    │ • Database      │    │ • LLM Processing│
│ • Real-time     │    │ • Auth          │    │ • Event Queue   │
│ • File Upload   │    │ • Storage       │    │ • Webhooks      │
│ • Admin Tools   │    │ • Realtime      │    │ • Integrations  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📊 **Database Schema**

### **🗂️ Core Tables**

#### **`app.conversations`** - Chat Sessions
Main container for chat conversations with metadata and counters.

```sql
CREATE TABLE app.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel app.channel NOT NULL DEFAULT 'web',  -- web, line, wechat, google
  channel_account_id UUID REFERENCES app.channel_accounts(id) ON DELETE SET NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active',        -- active, archived, deleted
  msg_count INTEGER NOT NULL DEFAULT 0,         -- Total message count
  last_message_at TIMESTAMPTZ DEFAULT now(),    -- Last activity timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Auto-summary tracking fields
  last_auto_summary_at TIMESTAMPTZ,            -- When last auto-summary was generated
  messages_since_last_summary INTEGER DEFAULT 0 -- Messages since last summary (for auto-trigger)
);
```

**Key Features:**
- Tracks message count and last activity for sorting
- Supports multiple channels (web, messaging platforms)
- Auto-summary tracking with message counters
- Soft delete support via status field

#### **`app.messages`** - All Messages
Stores all messages with role-based content and full-text search.

```sql
CREATE TABLE app.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES app.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app.message_role NOT NULL,               -- user, assistant, system, tool
  content TEXT,                                 -- Message content
  metadata JSONB,                               -- Additional data (model info, tokens, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fts TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', COALESCE(content,''))) STORED
);
```

**Key Features:**
- Multi-role support (user, assistant, system, tool)
- Full-text search with generated tsvector column
- JSONB metadata for flexible data storage
- Cascade deletion with conversations

#### **`app.conversation_summaries`** - AI-Generated Summaries
Stores conversation summaries with versioning and type classification.

```sql
CREATE TABLE app.conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES app.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind app.summary_kind NOT NULL DEFAULT 'rolling',  -- rolling, episodic, daily, manual
  is_latest BOOLEAN NOT NULL DEFAULT true,           -- Only one latest per conversation+kind
  model TEXT,                                         -- Model used for generation
  summary TEXT NOT NULL,                              -- Generated summary content
  token_count INTEGER,                                -- Tokens used in generation
  message_id_start UUID,                              -- First message in summary range
  message_id_end UUID,                                -- Last message in summary range
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Key Features:**
- Multiple summary types (rolling, episodic, daily, manual)
- Only one "latest" summary per conversation and type
- Token tracking for cost management
- Message range tracking

#### **`app.user_memory`** - Long-term User Context
Stores persistent user information and preferences across conversations.

```sql
CREATE TABLE app.user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type app.memory_type NOT NULL DEFAULT 'other',  -- fact, preference, profile, skill, constraint, other
  source TEXT NOT NULL DEFAULT 'llm',                    -- manual, llm, import, system
  content TEXT NOT NULL,                                  -- Memory content
  weight REAL NOT NULL DEFAULT 1.0,                      -- Importance weighting (0.0-10.0)
  confidence SMALLINT CHECK (confidence BETWEEN 0 AND 100), -- Confidence percentage
  expires_at TIMESTAMPTZ,                                 -- Optional expiration
  last_reinforced_at TIMESTAMPTZ,                         -- When memory was last reinforced
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Key Features:**
- Categorized memory types for organization
- Confidence scoring and weighting system
- Expiration dates for temporary memories
- Source tracking (manual vs AI-generated)

#### **`app.outbox_events`** - Event Processing Queue
Manages events for n8n processing with retry logic and status tracking.

```sql
CREATE TABLE app.outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type app.event_type NOT NULL,           -- message.created, summary.request, etc.
  status app.event_status NOT NULL DEFAULT 'pending', -- pending, processing, ok, failed, dead
  idempotency_key TEXT,                          -- Prevents duplicate processing
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES app.conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES app.messages(id) ON DELETE CASCADE,
  attempt_count INTEGER NOT NULL DEFAULT 0,      -- Retry counter
  last_error TEXT,                               -- Error message from last attempt
  payload JSONB NOT NULL,                        -- Event data for processing
  priority INTEGER DEFAULT 5,                    -- Processing priority (1=highest, 10=lowest)
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- When to process
  processed_at TIMESTAMPTZ,                      -- When processing completed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Key Features:**
- Event-driven architecture for scalable processing
- Retry logic with backoff and attempt counting
- Priority-based processing queues
- Idempotency keys prevent duplicate processing

#### **`app.config`** - System Configuration
Stores system-wide configuration in flexible JSON format.

```sql
CREATE TABLE app.config (
  key TEXT PRIMARY KEY,                          -- Configuration key
  value JSONB NOT NULL,                          -- Configuration value
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Common Configuration Keys:**
- `llm` - LLM provider settings (URL, model, API keys)
- `outbox_retry` - Retry policies and backoff schedules
- `auto_summary` - Automatic summary generation settings

### **🔗 Supporting Tables**

#### **`app.messages_attachments`** - File Upload Metadata
Links messages to uploaded files with metadata and storage paths.

```sql
CREATE TABLE app.messages_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES app.messages(id) ON DELETE CASCADE,
  storage_object_path TEXT NOT NULL,            -- Supabase Storage path
  mime_type TEXT,                               -- File type
  bytes BIGINT,                                 -- File size
  sha256 TEXT,                                  -- File hash for integrity
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Storage Path Format:** `{user_id}/{conversation_id}/{message_id}/filename`

#### **`app.message_embeddings`** - Vector Search Support
Stores vector embeddings for semantic search capabilities.

```sql
CREATE TABLE app.message_embeddings (
  message_id UUID PRIMARY KEY REFERENCES app.messages(id) ON DELETE CASCADE,
  model TEXT NOT NULL,                          -- Embedding model used
  embedding VECTOR(1536) NOT NULL,              -- Vector embedding
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Key Features:**
- pgvector extension for vector similarity search
- Model tracking for different embedding providers
- Ready for semantic search implementation

#### **`app.channel_accounts`** - Multi-Platform Integration
Links external platform accounts to internal users.

```sql
CREATE TABLE app.channel_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel app.channel NOT NULL,                 -- Platform type
  external_user_id TEXT NOT NULL,               -- Platform-specific user ID
  display_name TEXT,                            -- Display name on platform
  picture_url TEXT,                             -- Profile picture URL
  raw JSONB,                                    -- Raw platform data
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel, external_user_id)
);
```

**Supported Channels:**
- `web` - Web interface users
- `line` - LINE messaging platform
- `wechat` - WeChat integration
- `google` - Google OAuth users

### **🔧 Database Triggers**

#### **Message Processing Triggers**

**`trg_update_conversation_on_message`**
```sql
-- Updates conversation counters when new messages are added
-- Increments msg_count and messages_since_last_summary
-- Updates last_message_at timestamp
```

**`trg_check_auto_summary`**
```sql
-- Checks if auto-summary should be triggered
-- Creates summary.request in outbox_events when threshold reached
-- Configurable via app.config('auto_summary')
```

#### **Summary Management Triggers**

**`trg_handle_summary_completion`**
```sql
-- Resets message counters when auto-summary completes
-- Updates last_auto_summary_at timestamp
-- Monitors outbox_events status changes
```

**`trigger_ensure_single_latest_summary`**
```sql
-- Ensures only one summary per conversation has is_latest=true
-- Automatically updates when new summaries are created
```

#### **Maintenance Triggers**

**`trigger_*_updated_at`**
```sql
-- Updates updated_at timestamp on record changes
-- Applied to: conversation_summaries, user_memory, outbox_events
```

### **📈 Indexes and Performance**

**Primary Indexes:**
- `idx_conversations_user_time` - Fast conversation listing
- `idx_messages_conv_time` - Message retrieval by conversation
- `idx_messages_fts` - Full-text search on message content
- `idx_msg_emb_ivf` - Vector similarity search
- `idx_outbox_status_due` - Event processing queue

**Unique Constraints:**
- `uq_conv_summary_latest` - One latest summary per conversation+kind
- `uq_outbox_idem` - Idempotency key uniqueness
- `unique(channel, external_user_id)` - One account per platform

### **🔐 Row Level Security (RLS)**

All tables have RLS policies ensuring users can only access their own data:

**Pattern:** `user_id = auth.uid()` or through conversation ownership
**File Access:** Path-based security matching `{user_id}/...`
**Cross-table Security:** Policies check related table ownership

### **🗄️ Database Functions**

**Auto-Summary Management:**
- `app.set_auto_summary_enabled(boolean)` - Toggle auto-summaries
- `app.set_auto_summary_threshold(integer)` - Set message threshold
- `app.get_auto_summary_settings()` - Get current settings

**Outbox Management:**
- `app.fail_and_reschedule(uuid, text)` - Handle event failures with backoff

**Views:**
- `app.auto_summary_status` - Monitor conversation summary progress

## 🎯 **Key Features**

### 💬 **Core Chat Functionality**
- **Real-time messaging** with Supabase Realtime
- **Multi-role support** (user, assistant, system, tool)
- **File attachments** with preview and download
- **Conversation management** (create, rename, archive)
- **Message search** with full-text search

### 🤖 **LLM Integration**
- **Configurable LLM providers** (OpenAI, Claude, Ollama)
- **Model switching** and parameter control
- **Context management** with conversation history
- **Image analysis** support for uploaded images

### 📝 **Auto-Summary System**
- **Automatic triggers** after configurable message count (default: 20)
- **Manual summary refresh** via UI button
- **Rolling summaries** that update conversation context
- **Real-time summary updates** when processing completes

### 🧠 **Memory Management**
- **Long-term user memory** with CRUD operations
- **Memory types**: facts, preferences, profile, skills, constraints
- **Confidence scoring** and expiration dates
- **Context distillation** from recent conversations

### 🔧 **Admin & DevTools**
- **Outbox Event Management** - Monitor, retry, skip failed events
- **Configuration Editor** - Manage LLM and retry settings
- **Event Sandbox** - Create test events for development
- **Database Testing** - Comprehensive test suites

## 🚀 **Tech Stack**

**Frontend:**
- **Next.js 14+** (App Router) - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI component library
- **Lucide React** - Icons

**Backend:**
- **Supabase** - Database, Auth, Storage, Realtime
- **Row Level Security** - Data protection
- **Database Triggers** - Auto-summary automation
- **Storage Policies** - File access control

**State Management:**
- **Zustand** - Global state (auth, settings)
- **Custom Hooks** - Data fetching and caching
- **Real-time Subscriptions** - Live data updates

## 📁 **Project Structure**

```
src/
├── app/                     # Next.js App Router
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Landing page
│   ├── login/              # Authentication pages
│   ├── chat/               # Main chat interface
│   └── demo-panels/        # Admin and testing tools
│
├── components/             # React components
│   ├── ui/                 # shadcn/ui components
│   │
│   ├── Core Chat/
│   │   ├── AuthGate.tsx           # Authentication wrapper
│   │   ├── ConversationList.tsx   # Sidebar conversation list
│   │   ├── ChatHeader.tsx         # Chat header with actions
│   │   ├── MessageStream.tsx      # Message display area
│   │   ├── Composer.tsx           # Message input with attachments
│   │   └── AttachmentGrid.tsx     # File preview grid
│   │
│   ├── Context Panel/
│   │   ├── SummaryCard.tsx        # Conversation summaries
│   │   ├── MemoryPanel.tsx        # User memory management
│   │   └── RetrievalPanel.tsx     # Search functionality
│   │
│   └── DevTools/
│       ├── OutboxTable.tsx        # Event queue management
│       ├── ConfigEditor.tsx       # System configuration
│       ├── EventSandbox.tsx       # Test event creation
│       ├── DatabaseTest.tsx       # Database connectivity tests
│       └── AutoSummarySettings.tsx # Summary automation config
│
├── lib/                    # Utilities and configuration
│   ├── supabaseClient.ts   # Supabase client setup
│   ├── auth-store.ts       # Authentication state management
│   ├── types.ts            # TypeScript type definitions
│   ├── storage.ts          # File upload utilities
│   ├── llm.ts              # LLM API integration
│   └── toast.ts            # Error notification system
│
├── hooks/                  # Custom React hooks
│   ├── useConversations.ts # Conversation data management
│   ├── useMessages.ts      # Message CRUD operations
│   └── useUserMemory.ts    # Memory management hooks
│
└── SQL Scripts/           # Database setup
    ├── supabase_chat_pro.sql        # Main schema
    ├── automatic-summary-system.sql # Auto-summary triggers
    ├── add-indexes-fixed.sql        # Performance indexes
    └── add-rls-policies.sql         # Security policies
```

## 🔄 **Data Flow**

### **Message Sending Flow**

```
User Types Message → Mode Check
├─ Dev Mode: Store Message → Call LLM → Store Response → UI Update
└─ Outbox Mode: Store Message → Create Event → n8n Processes → UI Update
```

### **Auto-Summary Flow**

```
New Message → Update Counters → Check Threshold
└─ If ≥20 messages: Create summary.request → n8n Processes → Store Summary → UI Update
```

## 🎮 **Usage Modes**

### 👨‍💻 **Development Mode**
- **Purpose**: Testing, development, immediate feedback
- **LLM Calls**: Direct API calls from frontend
- **Response Time**: Immediate (2-10 seconds)
- **Use Cases**: Prototyping, debugging, demo

### 🏭 **Production Mode (Outbox)**
- **Purpose**: Scalable, production deployment
- **LLM Calls**: Queued through n8n pipeline
- **Response Time**: Depends on queue processing (typically 10-30 seconds)
- **Use Cases**: Production, high-volume, complex workflows

## 🔐 **Security Features**

### **Row Level Security (RLS)**
- **User Isolation**: Users can only access their own data
- **Conversation Security**: Messages tied to conversation ownership
- **File Security**: Attachments accessible only to owners

### **Authentication**
- **Supabase Auth**: Email and OAuth providers
- **JWT Tokens**: Secure API authentication
- **Session Management**: Automatic token refresh

### **File Security**
- **Path-based Access**: `{userId}/{conversationId}/{messageId}/filename`
- **Content Type Validation**: Restricted file types
- **Size Limits**: Configurable upload limits (default 50MB)

## 📈 **Performance Optimizations**

### **Database**
- **Indexes**: Optimized queries on conversation_id, user_id, created_at
- **Full-Text Search**: PostgreSQL FTS for message search
- **Vector Embeddings**: Ready for semantic search (future)

### **Frontend**
- **Real-time Subscriptions**: Efficient WebSocket updates
- **Optimistic Updates**: Immediate UI feedback
- **File Caching**: Browser caching for attachments
- **Component Optimization**: React optimization patterns

### **Auto-Summary System**
- **Configurable Thresholds**: Avoid over-processing
- **Duplicate Prevention**: Smart event deduplication
- **Priority Queuing**: Auto-summaries get higher priority
- **Batch Processing**: n8n can batch multiple requests

## 🧪 **Testing & Development**

### **Built-in Testing Tools**
- **Database Test Suite**: Connection and query validation
- **Event Sandbox**: Create test events for all types
- **Summary Test**: End-to-end summary workflow testing
- **Outbox Inspector**: Real-time event monitoring

### **Development Workflow**
1. **Local Development**: Use Dev mode for immediate feedback
2. **Integration Testing**: Switch to Outbox mode with test n8n workflow
3. **Production Deploy**: Full Outbox mode with production n8n

## 🔧 **Configuration Management**

### **LLM Configuration**
```json
{
  "url": "https://api.openai.com/v1/chat/completions",
  "model": "gpt-4o-mini",
  "temperature": 0.7,
  "max_tokens": 1000,
  "api_key": "sk-..."
}
```

### **Auto-Summary Configuration**
```json
{
  "enabled": true,
  "message_threshold": 20,
  "priority": 2,
  "description": "Automatic summary generation settings"
}
```

### **Retry Policy Configuration**
```json
{
  "backoff": [5, 15, 60, 300, 900, 1800, 3600],
  "max_attempts": 10
}
```

## 🚀 **Getting Started**

### **Quick Setup**
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run database migrations
# Execute SQL files in Supabase SQL Editor:
# 1. supabase_chat_pro.sql
# 2. automatic-summary-system.sql
# 3. add-indexes-fixed.sql

# Start development server
npm run dev
```

### **Environment Variables**
```env
# Required
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional
NEXT_PUBLIC_DEV_MODE=dev  # or 'outbox'
OPENAI_API_KEY=sk-your-key-here
```

## 🔮 **Future Enhancements**

### **Planned Features**
- **Vector Search**: Semantic message search using embeddings
- **Multi-tenant Support**: Organization and team management
- **Plugin System**: Custom LLM providers and tools
- **Analytics Dashboard**: Usage statistics and insights
- **Mobile App**: React Native companion app
- **Voice Integration**: Speech-to-text and text-to-speech

### **Scalability Improvements**
- **Message Pagination**: Handle large conversation histories
- **Attachment CDN**: External file storage and CDN
- **Caching Layer**: Redis for frequently accessed data
- **Load Balancing**: Multi-instance deployment
- **Background Jobs**: Separate worker processes

## 📋 **Partner Collaboration Notes**

### **Development Handoff**
- **Code Quality**: TypeScript, ESLint, consistent formatting
- **Documentation**: Inline comments and component documentation
- **Testing**: Comprehensive test suites for all major features
- **Error Handling**: Graceful error handling with user feedback

### **Architecture Decisions**
- **Why Dual Modes**: Flexibility for development vs production
- **Why Supabase**: Real-time capabilities and integrated auth/storage
- **Why Outbox Pattern**: Reliable event processing and queue management
- **Why Auto-Summaries**: Reduce token costs and improve UX

### **Known Limitations**
- **File Size**: 50MB limit (configurable in Supabase)
- **Concurrent Users**: Depends on Supabase plan and n8n capacity
- **Message History**: No pagination yet (loads all messages)
- **Search**: Text-only, vector search not implemented

### **Immediate Next Steps**
1. **Set up n8n Workflow**: Create production event processing
2. **Configure LLM Provider**: Set up API keys and test integration
3. **Deploy to Production**: Vercel + Supabase production setup
4. **User Testing**: Get feedback on UI/UX and performance
5. **Monitor & Optimize**: Watch database performance and user patterns

## 🆘 **Support & Resources**

- **Setup Guide**: `SETUP_GUIDE.md` - Complete installation instructions
- **Database Schema**: SQL files in project root
- **Component Documentation**: JSDoc comments in each component
- **Type Definitions**: `src/lib/types.ts` - Complete TypeScript types

## 🎉 **Current Status: Production Ready**

This beta version is **feature-complete** and ready for production deployment. All core requirements have been implemented with comprehensive testing tools and admin interfaces.

**Ready for:**
- ✅ User acceptance testing
- ✅ Production deployment
- ✅ n8n integration
- ✅ Team collaboration
- ✅ Feature expansion

---

*Built with ❤️ using Next.js, Supabase, and modern web technologies.*
