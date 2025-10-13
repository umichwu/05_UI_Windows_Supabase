Database Tables & Triggers Analysis for Partner Collaboration

  Your project uses Supabase PostgreSQL with a comprehensive schema designed for an AI-powered chat system with face        
  recognition and emotion-based care automation.

  Core Database Schema: app Schema

  ---
  📊 MAIN TABLE CATEGORIES

  1. Chat/Conversation System

  - app.conversations - Chat sessions management
  - app.messages - Individual chat messages
  - app.message_embeddings - Vector embeddings for semantic search
  - app.messages_attachments - File attachments metadata
  - app.conversation_summaries - AI-generated conversation summaries

  2. Face Recognition & Emotion Analysis

  - app.face_profiles - User face embeddings for recognition
  - app.face_events - Real-time face detection results
  - app.mood_windows - Aggregated emotion data over time windows

  3. Care System (Automated Emotional Monitoring)

  - app.care_rules - User-defined rules for emotional state monitoring
  - app.care_incidents - Records when care rules are triggered

  4. System Management

  - app.outbox_events - Event queue for reliable processing
  - app.user_memory - Long-term user context storage
  - app.config - System configuration (LLM settings, retry policies)

  ---
  🎯 TABLE PURPOSES & TARGETS

  Chat System Tables

  | Table                  | Purpose                                                 | Target Use
                  |
  |------------------------|---------------------------------------------------------|----------------------------------    
  ----------------|
  | conversations          | Manages chat sessions across channels (web/line/wechat) | Multi-platform chat orchestration    
                  |
  | messages               | Stores all chat messages with metadata                  | Core chat functionality with
  emotion integration |
  | message_embeddings     | Vector search for semantic message retrieval            | AI-powered message similarity        
  search             |
  | conversation_summaries | Rolling/episodic conversation summaries                 | Context compression for long
  conversations       |

  Face Recognition Tables

  | Table         | Purpose                                       | Target Use                              |
  |---------------|-----------------------------------------------|-----------------------------------------|
  | face_profiles | Stores user face embeddings (512-dim vectors) | Personal face recognition database      |
  | face_events   | Real-time emotion detection results           | Live emotion tracking stream            |
  | mood_windows  | Aggregated emotion statistics                 | Trend analysis and care rule evaluation |

  Care System Tables

  | Table          | Purpose                               | Target Use                         |
  |----------------|---------------------------------------|------------------------------------|
  | care_rules     | Configurable emotion monitoring rules | Automated wellness monitoring      |
  | care_incidents | Care event lifecycle tracking         | Intervention tracking and response |

  ---
  ⚡ DATABASE TRIGGERS & AUTOMATION

  1. Face Event Care Evaluation Trigger

  Function: app.eval_care_rules_on_face_event()
  Trigger: trg_eval_care_rules_on_face_event
  Target: Automatically monitor emotional states and trigger care alerts

  How it works:
  - Fires on every face_events insert
  - Evaluates active care rules for the detected user
  - Calculates emotion ratios within time windows
  - Creates outbox_events when thresholds are met
  - Generates care_incidents for tracking

  2. Conversation Update Trigger

  Function: app.update_conversation_on_message()
  Trigger: trg_update_conversation_on_message
  Target: Maintain conversation metadata automatically

  How it works:
  - Updates msg_count, last_message_at on new messages
  - Keeps conversation statistics current

  3. Auto-Summary System Trigger

  Function: app.check_and_request_auto_summary()
  Trigger: trg_check_auto_summary
  Target: Generate conversation summaries automatically

  How it works:
  - Triggers summary requests every 20 messages
  - Creates outbox_events for external processing
  - Prevents duplicate summary requests

  ---
  🔄 DATA FLOW ARCHITECTURE

  Camera Feed → Face Detection API → face_events table
       ↓
  Care Rules Trigger → outbox_events → n8n Automation
       ↓
  Care Actions (notifications, interventions)

  Chat Messages → conversations/messages tables
       ↓
  Auto-Summary Trigger → outbox_events → LLM Processing
       ↓
  Conversation Summaries

  ---
  🔐 SECURITY & ACCESS CONTROL

  Row Level Security (RLS) enabled on all tables:
  - Users can only access their own data
  - Face events accessible to camera user OR recognized user
  - Care rules support both personal and global configurations
  - Service role bypasses RLS for system operations

  ---
  📈 KEY INTEGRATION POINTS

  1. Face Recognition Integration: Real-time emotion data flows into chat context
  2. n8n Automation: outbox_events table serves as workflow trigger queue
  3. LLM Integration: Configurable via app.config table
  4. External APIs: Care incidents can trigger external notifications

  ---
  🛠 OPERATIONAL FEATURES

  - Automatic emotion aggregation via rollup_mood_windows() function
  - Retry logic with exponential backoff for failed events
  - Idempotency protection for duplicate operations
  - Configurable thresholds for care rules and summaries
  - Real-time subscriptions supported via Supabase

  This architecture provides a complete foundation for emotion-aware conversational AI with automated care features and reliable event processing.