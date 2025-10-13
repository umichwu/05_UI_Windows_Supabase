# 🚀 Chat UI System - Complete Setup Guide

## 📋 Project Overview

A complete Next.js chat application with Supabase backend, featuring:
- **Authentication** (Email/Google)
- **Real-time messaging** with attachments
- **LLM integration** (Dev & Outbox modes)
- **Auto-summaries** and memory management
- **Admin tools** for outbox management

## 🛠 Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui
- **Backend**: Supabase (Auth, Database, Storage, Realtime)
- **State Management**: Zustand
- **File Upload**: Supabase Storage
- **LLM**: OpenAI/Claude/Ollama integration

## 📦 Installation Commands

### 1. Create Next.js Project

```bash
npx create-next-app@latest chat-ui-system --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd chat-ui-system
```

### 2. Install Dependencies

```bash
# Core dependencies
npm install @supabase/supabase-js zustand

# shadcn/ui setup
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input textarea badge dialog table tabs sheet select dropdown-menu alert-dialog switch label

# Additional utilities
npm install lucide-react clsx tailwind-merge
npm install -D @types/node

# Optional: TanStack Query (if you want to use it)
npm install @tanstack/react-query
```

### 3. Configure shadcn/ui

When running `npx shadcn-ui@latest init`, use these options:
```
✔ Which style would you like to use? › Default
✔ Which color would you like to use as base color? › Slate
✔ Would you like to use CSS variables for colors? › yes
```

## 📁 Project Structure

```
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   ├── login/
│   │   └── page.tsx
│   ├── chat/
│   │   └── page.tsx
│   └── demo-panels/
│       └── page.tsx
├── components/
│   ├── ui/                      # shadcn/ui components
│   ├── AuthGate.tsx
│   ├── ConversationList.tsx
│   ├── ChatHeader.tsx
│   ├── MessageStream.tsx
│   ├── Composer.tsx
│   ├── AttachmentGrid.tsx
│   ├── SummaryCard.tsx
│   ├── MemoryPanel.tsx
│   ├── RetrievalPanel.tsx
│   ├── OutboxTable.tsx
│   ├── ConfigEditor.tsx
│   ├── EventSandbox.tsx
│   └── AutoSummarySettings.tsx
├── lib/
│   ├── supabaseClient.ts
│   ├── auth-store.ts
│   ├── types.ts
│   ├── storage.ts
│   ├── llm.ts
│   └── toast.ts
└── hooks/
    ├── useConversations.ts
    ├── useMessages.ts
    └── useUserMemory.ts
```

## ⚙️ Environment Setup

### 1. Create `.env.local`

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Development Mode (dev or outbox)
NEXT_PUBLIC_DEV_MODE=dev

# Optional: Direct LLM API keys (for dev mode)
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
```

### 2. Supabase Database Setup

Run these SQL scripts in your Supabase SQL Editor:

1. **Main Schema**: `supabase_chat_pro.sql`
2. **Auto-Summary System**: `automatic-summary-system.sql`
3. **Indexes & Constraints**: `add-indexes-fixed.sql`
4. **RLS Policies**: `add-rls-policies.sql`

### 3. Configure Authentication

In Supabase Dashboard:
1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Optionally enable **Google** provider
4. Set **Site URL**: `http://localhost:3000`
5. Add **Redirect URLs**: `http://localhost:3000/auth/callback`

### 4. Storage Configuration

The system uses a public storage bucket for attachments:
- Bucket name: `chat-attachments`
- Path format: `{userId}/{conversationId}/{messageId}/filename`
- RLS policies ensure users can only access their own files

## 🏃‍♂️ Running the Application

```bash
# Development server
npm run dev

# Build for production
npm run build
npm start
```

## 📋 Feature Checklist

### ✅ **Core Features Implemented**

- [x] **Authentication**: Email/Google login via Supabase Auth
- [x] **Conversations**: List, create, select conversations
- [x] **Messaging**: Send/receive messages with real-time updates
- [x] **Attachments**: Upload files with preview and download
- [x] **LLM Modes**:
  - Dev mode: Direct LLM API calls
  - Outbox mode: Message queuing for n8n processing
- [x] **Summaries**: Auto-generation and manual refresh
- [x] **Memory Management**: CRUD operations for user memory
- [x] **Search**: Full-text search across messages
- [x] **Admin Tools**: Outbox management, config editor, event testing

### ✅ **Advanced Features**

- [x] **Auto-Summaries**: Configurable triggers (every N messages)
- [x] **Real-time Updates**: Live message and summary updates
- [x] **File Management**: Image lightbox, file type detection
- [x] **Error Handling**: Toast notifications for failures
- [x] **Database Testing**: Comprehensive test suites
- [x] **Event Monitoring**: Real-time outbox event tracking

## 🔧 Configuration

### LLM Configuration

Edit in the UI via ConfigEditor or directly in database:

```sql
-- OpenAI
INSERT INTO app.config(key, value) VALUES
('llm', '{
  "url": "https://api.openai.com/v1/chat/completions",
  "model": "gpt-4o-mini",
  "temperature": 0.7,
  "max_tokens": 1000,
  "api_key": "your-key-here"
}');

-- Claude
INSERT INTO app.config(key, value) VALUES
('llm', '{
  "url": "https://api.anthropic.com/v1/messages",
  "model": "claude-3-haiku-20240307",
  "temperature": 0.7,
  "max_tokens": 1000,
  "api_key": "your-key-here"
}');
```

### Auto-Summary Configuration

```sql
-- Configure auto-summary (via UI or SQL)
SELECT app.set_auto_summary_enabled(true);
SELECT app.set_auto_summary_threshold(20); -- Every 20 messages
```

## 🧪 Testing

### Manual Testing Checklist

1. **Authentication**
   - [ ] Sign up with email works
   - [ ] Sign in with email works
   - [ ] Sign out works
   - [ ] Google OAuth works (if configured)

2. **Conversations**
   - [ ] Create new conversation
   - [ ] List shows conversations sorted by recent
   - [ ] Select conversation loads messages
   - [ ] Conversation title updates

3. **Messaging**
   - [ ] Send message in Dev mode (gets LLM response)
   - [ ] Send message in Outbox mode (waits for n8n)
   - [ ] Real-time updates when n8n responds
   - [ ] Message history loads correctly

4. **Attachments**
   - [ ] Drag & drop file upload works
   - [ ] Image preview and lightbox work
   - [ ] File download works
   - [ ] Different file types handled correctly

5. **Summaries**
   - [ ] Manual summary refresh creates outbox event
   - [ ] Auto-summary triggers at message threshold
   - [ ] Summary displays when completed
   - [ ] Real-time summary updates

6. **Admin Tools**
   - [ ] OutboxTable shows events with correct statuses
   - [ ] Retry/skip actions work
   - [ ] ConfigEditor saves LLM settings
   - [ ] EventSandbox creates test events

## 🚨 Troubleshooting

### Common Issues

1. **"Invalid JWT" errors**
   - Check Supabase URL and anon key in `.env.local`
   - Ensure RLS policies are correctly applied

2. **File upload failures**
   - Verify storage bucket is public
   - Check RLS policies on storage.objects
   - Ensure file size within limits (50MB default)

3. **LLM not responding in Dev mode**
   - Check API key in app.config table
   - Verify LLM URL and model name
   - Check network connectivity

4. **Outbox events not processing**
   - Verify n8n workflow is running
   - Check outbox_events table for error messages
   - Ensure database triggers are active

5. **Real-time updates not working**
   - Check Supabase Realtime is enabled
   - Verify RLS policies don't block subscriptions
   - Check browser console for WebSocket errors

### Database Health Check

```sql
-- Check table structures
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'app';

-- Check recent messages
SELECT * FROM app.messages ORDER BY created_at DESC LIMIT 5;

-- Check outbox events
SELECT * FROM app.outbox_events ORDER BY created_at DESC LIMIT 5;

-- Check configuration
SELECT * FROM app.config;
```

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## 🎉 You're Ready!

Your complete chat UI system is now set up with:
- ✅ Full authentication system
- ✅ Real-time messaging with attachments
- ✅ LLM integration (Dev & Outbox modes)
- ✅ Auto-summaries and memory management
- ✅ Comprehensive admin tools
- ✅ Production-ready error handling

Start the development server with `npm run dev` and visit `http://localhost:3000`!