CREATE TABLE call_logs (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid REFERENCES auth.users(id),
  to_number        text NOT NULL,
  from_number      text,
  province         text,
  call_sid         text UNIQUE,
  started_at       timestamptz DEFAULT now(),
  duration_seconds int,
  status           text DEFAULT 'initiated'
);

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own logs" ON call_logs
  FOR ALL USING (auth.uid() = user_id);

-- Migration (run if table already exists):
-- ALTER TABLE call_logs ALTER COLUMN user_id DROP NOT NULL;
-- ALTER TABLE call_logs ADD COLUMN call_sid text UNIQUE;