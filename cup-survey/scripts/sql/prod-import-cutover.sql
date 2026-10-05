-- Idempotent post-import normalization for BracketGeneration.
-- Prod may already be on ACTIVE singleton (post cutover v7); legacy dumps may still have DRAFT/PUBLISHED rows.

DO $$
DECLARE
  live_id uuid;
  live_count integer;
BEGIN
  SELECT COUNT(*) INTO live_count
  FROM "BracketGeneration"
  WHERE status = 'ACTIVE' AND "singletonKey" = 'live';

  IF live_count = 1 THEN
    -- Already normalized on prod; nothing to do.
    RETURN;
  END IF;

  IF live_count > 1 THEN
    SELECT id INTO live_id
    FROM "BracketGeneration"
    WHERE status = 'ACTIVE' AND "singletonKey" = 'live'
    ORDER BY version DESC, id DESC
    LIMIT 1;

    DELETE FROM "BracketGeneration"
    WHERE "singletonKey" = 'live'
      AND id <> live_id;

    RETURN;
  END IF;

  -- Legacy import: pick best generation and promote to ACTIVE live singleton.
  SELECT id INTO live_id
  FROM "BracketGeneration"
  WHERE status::text IN ('PUBLISHED', 'ACTIVE')
  ORDER BY
    CASE WHEN status::text = 'PUBLISHED' THEN 0 ELSE 1 END,
    "publishedAt" DESC NULLS LAST,
    id DESC
  LIMIT 1;

  IF live_id IS NULL THEN
    SELECT id INTO live_id
    FROM "BracketGeneration"
    WHERE status::text = 'DRAFT'
    ORDER BY "generatedAt" DESC, id DESC
    LIMIT 1;
  END IF;

  IF live_id IS NULL THEN
    RAISE EXCEPTION 'No BracketGeneration row found for prod import cutover';
  END IF;

  UPDATE "BracketGeneration"
  SET status = 'ACTIVE',
      "singletonKey" = 'live'
  WHERE id = live_id;

  DELETE FROM "BracketGeneration"
  WHERE id <> live_id;
END $$;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "BracketGeneration" WHERE "singletonKey" = 'live') <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one live generation after prod import cutover';
  END IF;
END $$;
