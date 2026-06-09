-- Allow users to clear their notification feed.

DROP POLICY IF EXISTS "Users delete own notifications" ON public.user_notifications;
CREATE POLICY "Users delete own notifications"
  ON public.user_notifications FOR DELETE
  USING (auth.uid() = user_id);
