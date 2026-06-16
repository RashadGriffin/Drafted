-- ============================================================
-- New flow: art approved -> optional text editor -> finalized.
-- Stores the customer's chosen text + colors and the final print
-- file, and adds a 'finalized' lifecycle status.
-- ============================================================

-- 1) Columns to hold the customer's final text choices (from the editor).
--    All optional — blank means a clean, text-free shirt.
alter table orders
  add column if not exists final_name        text,
  add column if not exists final_school      text,
  add column if not exists final_number      text,
  add column if not exists final_name_color  text,
  add column if not exists final_school_color text,
  add column if not exists final_number_color text,
  add column if not exists wants_text        boolean,      -- answered the fork question
  add column if not exists final_print_path  text,         -- composed at end of editor
  add column if not exists final_proof_path  text,         -- preview of the finalized design
  add column if not exists finalized_at      timestamptz;

-- 2) Allow the new 'finalized' status (art approved + design completed).
--    Rebuild the CHECK constraint to include it.
do $$
begin
  alter table orders drop constraint if exists orders_status_check;
  alter table orders add constraint orders_status_check check (status in (
    'pending_payment','paid','generating','proof_ready','regenerating',
    'manual_requested','manual_in_progress','approved',
    'finalized',          -- NEW: design completed via editor (or clean), ready for production
    'in_production','shipped','cancelled','refunded'
  ));
end $$;
