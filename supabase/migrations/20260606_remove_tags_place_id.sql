-- Drop columns that were previously removed from shops table
-- tags: array of shop tags (deprecated)
-- place_id: Google Places ID (deprecated)

ALTER TABLE shops DROP COLUMN IF EXISTS tags;
ALTER TABLE shops DROP COLUMN IF EXISTS place_id;
