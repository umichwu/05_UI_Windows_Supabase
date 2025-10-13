-- Harden RLS on app.messages
drop policy if exists "own messages" on app.messages;

create policy "own messages"
on app.messages
for all
to authenticated
using (
  exists (
    select 1
    from app.conversations c
    where c.id = conversation_id
      and c.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from app.conversations c
    where c.id = conversation_id
      and c.user_id = auth.uid()
  )
);