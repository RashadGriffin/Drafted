-- Per-design size breakdown: one design (order) printed across multiple
-- sizes, e.g. {"YM":1,"L":2}. quantity remains the total across sizes.
alter table orders
  add column if not exists sizes jsonb;
