# Gemini API with Google Search Grounding - Setup Guide

## Overview

Your application now uses **Google Search Grounding** with Gemini API to provide real-time, up-to-date information for:
- Current events and news
- Stock prices and market data
- Recently occurred events (after the model's knowledge cutoff)
- Any information that requires web search

## Architecture Changes

### Before
- Gemini API was called **directly from the browser** (client-side)
- No real-time grounding capability
- API key potentially exposed in network requests

### After
- Gemini API is called through a **secure backend API route** (`/api/gemini`)
- **Google Search tool** is enabled for all Gemini requests
- API key is securely stored and never exposed to the client
- Responses include grounding metadata showing sources used

## Files Modified

1. **`src/app/api/gemini/route.ts`** (NEW)
   - Serverless function handling Gemini API calls
   - Implements Google Search grounding
   - Fetches API key securely from Supabase config

2. **`src/lib/llm.ts`**
   - Updated `callGemini()` to use backend API route
   - Added `userId` parameter for authentication
   - Enhanced logging for grounding metadata

3. **`src/hooks/useMessages.ts`**
   - Updated to pass `userId` to `callLLM()`

4. **`package.json`**
   - Added `@google/generative-ai` SDK

## Environment Variables

### Required Variables

The following environment variables must be configured:

#### Local Development (`.env.local`)
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

#### Vercel Deployment

Add these environment variables in **Vercel Dashboard** → **Settings** → **Environment Variables**:

1. `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
3. `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (**IMPORTANT: Must be service role, not anon key**)

### Gemini API Key Storage

The Gemini API key is stored in your **Supabase database** in the `app.config` table:

```sql
-- Check your current Gemini config
SELECT * FROM app.config WHERE key = 'gemini';
```

Expected format:
```json
{
  "key": "gemini",
  "value": {
    "url": "https://generativelanguage.googleapis.com/v1beta",
    "model": "gemini-1.5-flash",
    "temperature": 0.7,
    "max_tokens": 1000,
    "api_key": "YOUR_GEMINI_API_KEY_HERE",
    "provider": "gemini"
  }
}
```

## How Google Search Grounding Works

When you ask Gemini a question:

1. **Backend API receives request** at `/api/gemini`
2. **Fetches Gemini config** from Supabase (including API key)
3. **Initializes Gemini model** with Google Search tool:
   ```typescript
   tools: [{ googleSearch: {} }]
   ```
4. **Gemini automatically decides** when to use web search based on the query
5. **Returns response** with:
   - The generated text answer
   - `groundingMetadata` (sources, search queries used)
   - Grounding chunks (snippets from web pages)

## Testing

### 1. Test the API Route Directly

```bash
# Health check
curl http://localhost:3000/api/gemini

# Expected response:
{
  "status": "ok",
  "message": "Gemini API route with Google Search grounding is ready",
  "features": ["google-search-grounding", "real-time-information"]
}
```

### 2. Test with a Real-Time Query

Ask Gemini questions that require current information:
- "What is the current price of NVIDIA stock?"
- "What are the latest news about AI today?"
- "What happened in the world today?"
- "What is the weather in San Francisco right now?"

### 3. Check Console Logs

In the browser console, you should see:
```
Calling Gemini via backend API with Google Search grounding: {...}
Gemini response received: {
  responseLength: 1234,
  hasGroundingMetadata: true,
  groundingChunks: 5
}
```

## Security Features

1. **API Key Protection**
   - Gemini API key is stored in Supabase database
   - Only accessible via backend API route
   - Never exposed to client-side code

2. **User Authentication**
   - Requires `userId` parameter
   - Validates user session on backend
   - Prevents unauthorized API usage

3. **Service Role Key**
   - Uses Supabase service role key on backend
   - Bypasses Row Level Security (RLS) when needed
   - Kept secret in environment variables

## Deployment Checklist

- [ ] Install dependencies: `npm install @google/generative-ai`
- [ ] Verify Gemini API key is stored in Supabase `app.config` table
- [ ] Set environment variables in Vercel:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Deploy to Vercel: `vercel --prod`
- [ ] Test the `/api/gemini` endpoint
- [ ] Test with real-time queries in chat interface

## Troubleshooting

### Issue: "Gemini configuration not found"
**Solution:** Ensure your Supabase database has the `gemini` config in `app.config` table.

```sql
INSERT INTO app.config (key, value) VALUES (
  'gemini',
  '{
    "url": "https://generativelanguage.googleapis.com/v1beta",
    "model": "gemini-1.5-flash",
    "temperature": 0.7,
    "max_tokens": 1000,
    "api_key": "YOUR_API_KEY",
    "provider": "gemini"
  }'::jsonb
);
```

### Issue: "User ID is required"
**Solution:** Ensure the user is authenticated before sending messages with Gemini provider.

### Issue: Responses are still outdated
**Solution:**
1. Check console logs to verify `hasGroundingMetadata: true`
2. Ensure you're using a Gemini model that supports grounding (e.g., `gemini-1.5-flash`, `gemini-1.5-pro`)
3. Try more specific queries that clearly require web search

### Issue: SUPABASE_SERVICE_ROLE_KEY error
**Solution:** Ensure you've set the `SUPABASE_SERVICE_ROLE_KEY` environment variable in Vercel (not just locally).

## API Reference

### POST `/api/gemini`

Request body:
```typescript
{
  messages: Array<{
    role: 'system' | 'user' | 'assistant',
    content: string | Array<{type: 'text' | 'image_url', ...}>
  }>,
  userId: string,
  temperature?: number,
  maxTokens?: number
}
```

Response:
```typescript
{
  success: true,
  response: string,
  groundingMetadata: {
    groundingChunks: Array<{
      web: {
        uri: string,
        title: string
      }
    }>,
    searchEntryPoint: {
      renderedContent: string
    }
  } | null,
  model: string
}
```

## Additional Resources

- [Google AI Gemini API Documentation](https://ai.google.dev/docs)
- [Grounding with Google Search](https://ai.google.dev/gemini-api/docs/grounding)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Supabase Service Role Key](https://supabase.com/docs/guides/api#the-service-role-key)

---

**Last Updated:** 2025-10-19
