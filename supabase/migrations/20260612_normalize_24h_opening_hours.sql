-- Normalize opening_hours entries that represent 24-hour operation.
--
-- Targets two cases:
--   1. Plain-text values matching 24h patterns (e.g. "24시간 영업", "00:00~24:00")
--   2. JSON BusinessHoursData where close = "24:00" (fails TIME_RE, gets silently dropped)
--
-- All are converted to the canonical form: {"default":{"allDay":true,"open":"","close":""}}

-- Case 1: plain text 24h patterns
UPDATE shops
SET
  opening_hours = '{"default":{"allDay":true,"open":"","close":""}}',
  updated_at = now()
WHERE
  opening_hours IS NOT NULL
  AND opening_hours NOT LIKE '{%'
  AND (
    opening_hours ~* '24\s*시간'
    OR opening_hours ~* '24\s*hours'
    OR opening_hours ~* 'open\s*24\s*hours'
    OR opening_hours ~* '00:00\s*[-~–]\s*24:00'
    OR opening_hours ~* '0:00\s*[-~–]\s*24:00'
  );

-- Case 2: JSON with close = "24:00" in the default schedule
UPDATE shops
SET
  opening_hours = '{"default":{"allDay":true,"open":"","close":""}}',
  updated_at = now()
WHERE
  opening_hours IS NOT NULL
  AND opening_hours LIKE '{%'
  AND (opening_hours::jsonb -> 'default' ->> 'close') = '24:00';

-- Case 3: Google Maps format where a single open-only period starts at 0000 (true 24/7)
--   e.g. {"periods":[{"open":{"day":0,"time":"0000"}}],"weekday_text":["월요일: 24시간 영업",...]}
UPDATE shops
SET
  opening_hours = '{"default":{"allDay":true,"open":"","close":""}}',
  updated_at = now()
WHERE
  opening_hours IS NOT NULL
  AND opening_hours LIKE '{%'
  AND jsonb_array_length(opening_hours::jsonb -> 'periods') = 1
  AND (opening_hours::jsonb -> 'periods' -> 0 -> 'close') IS NULL
  AND (opening_hours::jsonb -> 'periods' -> 0 -> 'open' ->> 'time') = '0000';

-- Case 4: BusinessHoursData with invalid close time (fails TIME_RE) — reset to default schedule
--   e.g. {"default":{"open":"10:00","close":"39:00"}}
UPDATE shops
SET
  opening_hours = '{"default":{"open":"10:00","close":"21:00"}}',
  updated_at = now()
WHERE
  opening_hours IS NOT NULL
  AND opening_hours LIKE '{%'
  AND (opening_hours::jsonb -> 'default') IS NOT NULL
  AND (opening_hours::jsonb -> 'default' ->> 'allDay') IS NULL
  AND (opening_hours::jsonb -> 'default' ->> 'close') IS NOT NULL
  AND (opening_hours::jsonb -> 'default' ->> 'close') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';
