-- ===========================================================
-- DRAFTED APPAREL — Team Colors (additive migration)
-- Run in Supabase SQL editor. Safe on an existing orders table.
-- Stores the customer's chosen background/text colors.
-- ===========================================================
alter table orders add column if not exists primary_color_name   text;
alter table orders add column if not exists primary_color_hex     text;
alter table orders add column if not exists secondary_color_name  text;
alter table orders add column if not exists secondary_color_hex   text;
