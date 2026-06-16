-- Owner-side refund tracking. status='refunded' marks a refunded order.
alter table orders
  add column if not exists refunded_at  timestamptz,
  add column if not exists stripe_refund_id text;
