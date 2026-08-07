-- Distributed single-flight leases for cold asset snapshot rebuilds (P5).
-- One builder per (asset key, market segment) across serverless instances.

CREATE TABLE IF NOT EXISTS public.market_rebuild_lease (
  key text NOT NULL,
  segment text NOT NULL,
  owner_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('building', 'failed')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, segment)
);

CREATE INDEX IF NOT EXISTS market_rebuild_lease_expires_at_idx
  ON public.market_rebuild_lease (expires_at);

ALTER TABLE public.market_rebuild_lease ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.market_rebuild_lease IS
  'Cross-instance single-flight locks for loadStockPageInitialDataUncached. Lease expires if builder crashes; never mutates market_snapshot payloads.';

CREATE OR REPLACE FUNCTION public.try_acquire_asset_rebuild_lease(
  p_key text,
  p_segment text,
  p_owner uuid,
  p_ttl_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ttl integer := GREATEST(COALESCE(p_ttl_seconds, 60), 5);
  acquired boolean := false;
BEGIN
  IF p_key IS NULL OR length(trim(p_key)) = 0
     OR p_segment IS NULL OR length(trim(p_segment)) = 0
     OR p_owner IS NULL THEN
    RETURN false;
  END IF;

  WITH upserted AS (
    INSERT INTO public.market_rebuild_lease AS l (
      key, segment, owner_id, expires_at, status, updated_at
    )
    VALUES (
      trim(p_key),
      trim(p_segment),
      p_owner,
      now() + make_interval(secs => ttl),
      'building',
      now()
    )
    ON CONFLICT (key, segment) DO UPDATE
    SET
      owner_id = EXCLUDED.owner_id,
      expires_at = EXCLUDED.expires_at,
      status = 'building',
      updated_at = now()
    WHERE l.expires_at < now()
       OR l.status = 'failed'
    RETURNING l.owner_id
  )
  SELECT EXISTS (SELECT 1 FROM upserted u WHERE u.owner_id = p_owner)
  INTO acquired;

  RETURN COALESCE(acquired, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_asset_rebuild_lease(
  p_key text,
  p_segment text,
  p_owner uuid
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.market_rebuild_lease
  WHERE key = trim(p_key)
    AND segment = trim(p_segment)
    AND owner_id = p_owner;
$$;

CREATE OR REPLACE FUNCTION public.fail_asset_rebuild_lease(
  p_key text,
  p_segment text,
  p_owner uuid
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.market_rebuild_lease
  SET
    status = 'failed',
    expires_at = now(),
    updated_at = now()
  WHERE key = trim(p_key)
    AND segment = trim(p_segment)
    AND owner_id = p_owner;
$$;

REVOKE ALL ON FUNCTION public.try_acquire_asset_rebuild_lease(text, text, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_asset_rebuild_lease(text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_asset_rebuild_lease(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_acquire_asset_rebuild_lease(text, text, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_asset_rebuild_lease(text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_asset_rebuild_lease(text, text, uuid) TO service_role;
