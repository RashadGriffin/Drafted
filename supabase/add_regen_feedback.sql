-- Stores the customer's revision request for the NEXT regeneration.
-- Overwritten each regenerate; null on initial generation.
alter table orders
  add column if not exists regen_feedback text;
