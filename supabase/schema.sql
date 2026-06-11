-- ===========================================================
-- DRAFTED APPAREL — Supabase schema
-- Run this in Supabase → SQL Editor (or via the CLI).
-- Postgres + Row Level Security. Designed for the automated
-- pay → generate → proof → approve/regenerate/manual-touch flow.
-- ===========================================================

-- ---------- EXTENSIONS ----------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ===========================================================
-- ORDERS
-- One row per purchase. Holds customization input, Stripe refs,
-- regeneration counter, lifecycle status, and the access token
-- used for instant + return proof access.
-- ===========================================================
create table if not exists orders (
  id                uuid primary key default gen_random_uuid(),

  -- Access (instant-on-site + magic-link return). High-entropy, unguessable.
  access_token      text not null unique default encode(gen_random_bytes(32), 'hex'),

  -- Customer
  customer_email    text not null,
  customer_name     text,

  -- Customization input (what the athlete entered)
  style_key         text not null,             -- references styles config (data, not FK — styles live in repo config)
  garment_type      text not null default 'tshirt',
  garment_color     text,
  garment_size      text,
  athlete_name      text,
  jersey_number     text,
  sport             text,
  school_team       text,
  source_photo_path text,                       -- Supabase Storage path to uploaded photo

  -- Commerce
  quantity          int not null default 1 check (quantity > 0),
  unit_price_cents  int not null,               -- locked at checkout (handles bulk tiers)
  total_cents       int not null,
  stripe_session_id text unique,
  stripe_payment_intent text,
  paid              boolean not null default false,
  paid_at           timestamptz,

  -- Generation / proof lifecycle
  status            text not null default 'pending_payment'
                    check (status in (
                      'pending_payment',  -- created, awaiting Stripe confirmation
                      'paid',             -- payment confirmed, generation not yet started
                      'generating',       -- a generation job is in flight
                      'proof_ready',      -- a proof is available for review
                      'regenerating',     -- customer asked for a re-roll
                      'manual_requested', -- customer requested manual touch
                      'manual_in_progress',-- owner working on it
                      'approved',         -- customer approved a proof
                      'in_production',    -- pushed to Printful
                      'shipped',
                      'cancelled'
                    )),

  regen_count       int not null default 0 check (regen_count >= 0),
  regen_limit       int not null default 3,     -- max automated re-rolls (free)
  manual_unlocked   boolean not null default false, -- becomes true after regen_limit reached

  approved_proof_id uuid,                        -- set when customer approves (FK added below)

  -- Printful
  printful_order_id text,
  tracking_number   text,
  tracking_url      text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_orders_access_token on orders(access_token);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_email on orders(customer_email);

-- ===========================================================
-- PROOFS
-- One row per generated (or manually uploaded) proof image.
-- An order can have many proofs (original + up to 3 regens + manual).
-- ===========================================================
create table if not exists proofs (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,

  attempt_no      int not null,                 -- 1 = first, 2..4 = regens, etc.
  kind            text not null default 'auto'  -- how it was produced
                  check (kind in ('auto','manual')),

  -- Image generation provenance (filled by the generation adapter)
  provider        text,                          -- 'openai' | 'replicate' | 'mock' | 'manual'
  model           text,
  prompt_used     text,

  -- Storage paths (Supabase Storage)
  raw_image_path     text,                       -- AI output before text overlay
  composited_path    text,                       -- after programmatic name/number overlay (what customer sees)
  print_file_path    text,                       -- full print-resolution file for Printful

  status          text not null default 'pending'
                  check (status in ('pending','rendering','ready','failed')),
  error_detail    text,

  created_at      timestamptz not null default now()
);

create index if not exists idx_proofs_order on proofs(order_id);

-- Link approved_proof_id now that proofs exists
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'orders_approved_proof_fk'
  ) then
    alter table orders
      add constraint orders_approved_proof_fk
      foreign key (approved_proof_id) references proofs(id) on delete set null;
  end if;
end $$;

-- ===========================================================
-- MANUAL TOUCH REQUESTS
-- Captures the customer's description of what to fix.
-- ===========================================================
create table if not exists manual_requests (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  description   text not null,                   -- customer's "what needs fixing"
  status        text not null default 'open'
                check (status in ('open','in_progress','resolved')),
  resolved_proof_id uuid references proofs(id) on delete set null,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create index if not exists idx_manual_order on manual_requests(order_id);

-- ===========================================================
-- GENERATION JOBS (audit + idempotency)
-- Every call to the generation adapter is logged. Lets us
-- enforce "paid before generate", debug, and track API spend.
-- ===========================================================
create table if not exists generation_jobs (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  proof_id      uuid references proofs(id) on delete set null,
  trigger       text not null,                   -- 'initial' | 'regen' | 'manual'
  provider      text,
  model         text,
  cost_cents    int,                             -- estimated API spend, for margin tracking
  status        text not null default 'started'
                check (status in ('started','succeeded','failed')),
  error_detail  text,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create index if not exists idx_genjobs_order on generation_jobs(order_id);

-- ===========================================================
-- updated_at trigger for orders
-- ===========================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_orders_updated on orders;
create trigger trg_orders_updated
  before update on orders
  for each row execute function set_updated_at();

-- ===========================================================
-- ROW LEVEL SECURITY
-- All customer-facing access goes through Netlify Functions using
-- the SERVICE ROLE key (which bypasses RLS). The anon key should
-- never read these tables directly from the browser. So we enable
-- RLS and add NO public policies — locking the tables to service-role only.
-- ===========================================================
alter table orders            enable row level security;
alter table proofs            enable row level security;
alter table manual_requests   enable row level security;
alter table generation_jobs   enable row level security;

-- (Intentionally no policies for anon/authenticated roles.
--  Service role bypasses RLS and is used only server-side in functions.)

-- ===========================================================
-- STORAGE BUCKETS
-- Create these in Supabase → Storage (or via the snippet below if using CLI).
--   source-photos   (private)  — customer uploads
--   proofs          (private)  — composited proofs shown to customer via signed URLs
--   print-files     (private)  — full-res files sent to Printful
-- Keep ALL private; serve via short-lived signed URLs from functions.
-- ===========================================================
