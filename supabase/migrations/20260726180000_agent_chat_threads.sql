-- Agent chat history: private threads + messages (no market data).
CREATE TABLE IF NOT EXISTS public.agent_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New chat',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS agent_threads_user_updated_idx
  ON public.agent_threads (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.agent_threads IS
  'Finsepa Agent chat threads. Private per user; soft-delete via deleted_at.';

CREATE TABLE IF NOT EXISTS public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.agent_threads (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  seq integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS agent_messages_thread_seq_idx
  ON public.agent_messages (thread_id, seq ASC, created_at ASC);

COMMENT ON TABLE public.agent_messages IS
  'Finsepa Agent chat messages belonging to a thread. Private per user.';

ALTER TABLE public.agent_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_messages TO authenticated;

DROP POLICY IF EXISTS "Users manage own agent threads" ON public.agent_threads;
CREATE POLICY "Users manage own agent threads"
  ON public.agent_threads
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own agent messages" ON public.agent_messages;
CREATE POLICY "Users manage own agent messages"
  ON public.agent_messages
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
