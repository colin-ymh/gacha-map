ALTER TABLE gacha_product_discovery_requests
  DROP CONSTRAINT IF EXISTS gacha_product_discovery_requests_status_check;

ALTER TABLE gacha_product_discovery_requests
  ADD CONSTRAINT gacha_product_discovery_requests_status_check
  CHECK (status IN (
    'pending',
    'searching',
    'imported',
    'needs_review',
    'no_match',
    'failed'
  ));
