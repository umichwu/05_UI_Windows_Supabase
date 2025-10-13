# Debug Console Errors

## Root Cause Analysis

The "there is no unique or exclusion constraint matching the ON CONFLICT specification" error is caused by:

1. **Database trigger function** (`app.enqueue_message_and_maybe_summary`) at lines 284 and 295
2. Uses `ON CONFLICT (idempotency_key) DO NOTHING` 
3. But the unique constraint `uq_outbox_idem` might not exist or be properly configured

## The Three Console Errors You're Seeing:

### Error 1: ON CONFLICT specification
```
there is no unique or exclusion constraint matching the ON CONFLICT specification
```
**Cause**: Database trigger trying to use ON CONFLICT on non-unique column
**Fix**: Run `CRITICAL_FIX.sql`

### Error 2: Likely "Error sending message: {}"
**Cause**: Empty error object being logged when the database operation fails
**Fix**: Our improved error handling in the updated `sendMessage` function

### Error 3: Could be any of:
- RLS policy violation 
- Missing user_id in message insert
- Database connection issue
- Schema permission issue

## Verification Steps:

1. **Run CRITICAL_FIX.sql** in Supabase SQL Editor
2. **Test sending a message** in your app
3. **Check browser console** for remaining errors
4. **If you still see errors**, run this query in Supabase to check constraints:

```sql
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'app' 
    AND tc.table_name = 'outbox_events'
    AND tc.constraint_type = 'UNIQUE';
```

## Expected Result After Fix:
- ✅ No ON CONFLICT errors
- ✅ Messages insert successfully  
- ✅ Conversation counters update
- ✅ Clean console logs with proper error details (if any errors occur)