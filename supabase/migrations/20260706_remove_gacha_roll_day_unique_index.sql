-- Remove per-product-per-day unique index on gacha_roll_results
-- to allow unlimited rolls of the same product per day.
DROP INDEX IF EXISTS gacha_roll_results_user_product_day_free_idx;
