-- Optional: Add client-side de-duplication for message retries
alter table app.messages add column if not exists client_id uuid;
create unique index if not exists uq_messages_conv_client on app.messages (conversation_id, client_id);