ALTER TABLE shops
  ADD COLUMN hidden_reason TEXT
    CHECK (hidden_reason IN ('manual', 'auto_absent_report'));
