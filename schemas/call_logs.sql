CREATE TABLE call_logs (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid REFERENCES auth.users(id) NOT NULL,
  to_number      text NOT NULL,
  from_number    text,
  province       text,
  started_at     timestamptz DEFAULT now(),
  duration_seconds int,
  status         text DEFAULT 'initiated'
);

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own logs" ON call_logs
  FOR ALL USING (auth.uid() = user_id);