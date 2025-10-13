# LLM Chat Performance Monitoring

This document explains the performance monitoring system implemented in this project to help identify bottlenecks in the LLM chat flow.

## Overview

The performance monitoring system tracks the time spent in each part of the LLM chat procedure, from user message submission to LLM response. This helps identify where the delays are occurring.

## What is Being Tracked

The system monitors the following operations:

### 1. **Message Flow Operations** (useMessages.ts)
- `total-message-flow` - Complete end-to-end time from message send to completion
- `insert-user-message` - Time to save user message to database
- `upload-attachments` - Time to upload files to storage (if any)
- `insert-attachment-records` - Time to save attachment metadata to database
- `prepare-signed-urls` - Time to generate signed URLs for images
- `llm-call-and-save` - Combined LLM call and saving response
- `insert-assistant-message` - Time to save LLM response to database

### 2. **LLM Configuration Operations** (llm.ts)
- `fetch-llm-config` - Time to fetch LLM configuration from database
- `format-messages` - Time to format conversation history for LLM

### 3. **OpenAI API Operations** (llm.ts)
- `openai-api-call` - Total time for OpenAI API interaction
- `openai-format-request` - Time to prepare request payload
- `openai-network-request` - Actual network request time
- `openai-parse-response` - Time to parse API response

### 4. **Gemini API Operations** (llm.ts)
- `gemini-api-call` - Total time for Gemini API interaction
- `gemini-format-request` - Time to prepare request payload
- `gemini-network-request` - Actual network request time
- `gemini-parse-response` - Time to parse API response

## How to Use

### 1. Run Your Application

Start your development server:
```bash
npm run dev
```

### 2. Send a Message in the Chat

Simply send any message through the chat interface in dev mode.

### 3. Check Browser Console

Open your browser's developer console (F12 or Cmd+Option+I on Mac). You will see:

#### Real-time Operation Logs
```
⏱️ [session-xxx] START: total-message-flow
⏱️ [session-xxx] START: insert-user-message
⏱️ [session-xxx] END: insert-user-message - 45.20ms
⏱️ [session-xxx] START: fetch-llm-config { configKey: 'llm' }
⏱️ [session-xxx] END: fetch-llm-config - 23.50ms { success: true }
...
```

#### Performance Summary Report
At the end of each message, you'll see a detailed report:

```
================================================================================
📊 Performance Report - Session: msg-1234567890
================================================================================

📍 total-message-flow
   Duration: 3245.67ms (100.0% of total)

📍 llm-call-and-save
   Duration: 2890.12ms (89.1% of total)

📍 openai-network-request
   Duration: 2750.34ms (84.7% of total)
   Metadata: {"status":200}

📍 insert-user-message
   Duration: 45.20ms (1.4% of total)

📍 fetch-llm-config
   Duration: 23.50ms (0.7% of total)
   Metadata: {"configKey":"llm","success":true}

...

================================================================================
⏱️  TOTAL TIME: 3245.67ms
================================================================================

🔴 BOTTLENECK: openai-network-request (2750.34ms)
```

## Understanding the Results

### Typical Performance Breakdown

In most cases, you'll see something like this:

1. **Network Request (80-95% of total time)**
   - This is the actual LLM API call
   - This is usually the bottleneck
   - Time varies based on:
     - Model size
     - Response length
     - Network latency
     - API server load

2. **Database Operations (2-10% of total time)**
   - Inserting/fetching messages
   - Usually fast but can be slow if:
     - Database is remote
     - Indexes are missing
     - Complex queries

3. **File Operations (1-5% of total time)**
   - Only if attachments are present
   - Upload and signed URL generation

4. **Formatting/Parsing (<1% of total time)**
   - Converting message formats
   - Usually negligible

### Common Bottlenecks and Solutions

#### 1. LLM Network Request is Slow (>2 seconds)

**Possible Causes:**
- Model is too large
- Requesting too many tokens
- Network latency
- API rate limiting

**Solutions:**
- Use a smaller/faster model (e.g., GPT-3.5 instead of GPT-4)
- Reduce `max_tokens` in configuration
- Use streaming responses (not yet implemented)
- Consider caching common responses
- Switch to local LLM (Ollama)

#### 2. Database Operations are Slow (>100ms)

**Possible Causes:**
- Database is remote
- Missing indexes
- Too much data being fetched

**Solutions:**
- Add database indexes on frequently queried columns
- Use connection pooling
- Optimize Supabase queries
- Consider using local database for development

#### 3. File Upload is Slow (>500ms per file)

**Possible Causes:**
- Large file sizes
- Slow network
- Storage server latency

**Solutions:**
- Implement client-side image compression
- Use CDN for storage
- Upload files in parallel
- Show progress indicators

## Performance Optimization Tips

### 1. Use Local LLM for Development
Switch to Ollama with a local model for faster iteration during development:
```sql
UPDATE app.config
SET value = jsonb_build_object(
  'url', 'http://localhost:11434/v1/chat/completions',
  'model', 'llama2',
  'temperature', 0.7,
  'max_tokens', 500
)
WHERE key = 'llm';
```

### 2. Reduce Context Window
Limit the number of messages sent to the LLM (currently set to last 20 messages):
```typescript
// In src/lib/llm.ts
.slice(-10) // Reduce from 20 to 10
```

### 3. Implement Request Caching
Cache common requests to avoid redundant LLM calls:
```typescript
// Example: Cache based on message content hash
const cacheKey = await sha256(content)
const cached = await getCachedResponse(cacheKey)
if (cached) return cached
```

### 4. Use Streaming Responses
Implement streaming to show responses as they arrive (reduces perceived latency):
```typescript
// Set stream: true in API call
const response = await fetch(config.url, {
  body: JSON.stringify({
    ...requestPayload,
    stream: true
  })
})
```

## Advanced Usage

### Programmatic Access

You can access performance data programmatically:

```typescript
import { getCurrentMonitor } from '@/lib/performance-monitor'

// Get current monitor
const monitor = getCurrentMonitor()

// Get metrics
const metrics = monitor?.getMetrics()

// Get bottleneck
const bottleneck = monitor?.getBottleneck()

// Get JSON data
const json = monitor?.toJSON()
```

### Custom Monitoring

Add your own performance tracking:

```typescript
import { getCurrentMonitor } from '@/lib/performance-monitor'

const monitor = getCurrentMonitor()
monitor?.start('my-custom-operation')

// Your code here
await doSomething()

monitor?.end('my-custom-operation', {
  customMetadata: 'value'
})
```

## Example Output Interpretation

Let's say you see this:

```
📍 openai-network-request
   Duration: 3500.00ms (85% of total)

📍 insert-user-message
   Duration: 250.00ms (6% of total)

📍 insert-assistant-message
   Duration: 200.00ms (5% of total)
```

**Interpretation:**
- 85% of time is spent waiting for the LLM API → **This is your bottleneck**
- 6% + 5% = 11% is spent on database operations → Acceptable but could be optimized
- Network request taking 3.5 seconds → Consider using a faster model or local LLM

## Troubleshooting

### No Performance Logs Appearing

1. Check that you're in dev mode (not outbox mode)
2. Open browser console (F12)
3. Verify the performance-monitor.ts file is being imported
4. Check for any JavaScript errors

### Metrics Look Wrong

1. Ensure browser tab is active (inactive tabs may throttle timers)
2. Check for browser extensions that might interfere
3. Verify system time is correct

## Next Steps

After identifying your bottleneck, you can:

1. **If LLM is slow:** Switch model, reduce tokens, or use local LLM
2. **If database is slow:** Add indexes, optimize queries, use caching
3. **If uploads are slow:** Compress files, use CDN, parallelize

## Support

If you need help interpreting the performance data or optimizing your application, please refer to the main project documentation or open an issue.
