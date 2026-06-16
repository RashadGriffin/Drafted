-- Per-proof revision note: the customer feedback that produced THIS attempt.
-- Null for the initial generation. Used to label versions in the history strip.
alter table proofs
  add column if not exists feedback text;
