-- Create time_entries table
CREATE TABLE IF NOT EXISTS time_entries (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS time_entries_user_id_idx ON time_entries(user_id);

-- Create index on created_at for ordering
CREATE INDEX IF NOT EXISTS time_entries_created_at_idx ON time_entries(created_at DESC);

-- Enable Row Level Security
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see their own time entries
CREATE POLICY "Users can view their own time entries"
  ON time_entries
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy: Users can insert their own time entries
CREATE POLICY "Users can insert their own time entries"
  ON time_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can delete their own time entries
CREATE POLICY "Users can delete their own time entries"
  ON time_entries
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create policy: Users can update their own time entries
CREATE POLICY "Users can update their own time entries"
  ON time_entries
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
