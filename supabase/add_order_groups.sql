-- ============================================================
-- MULTI-DESIGN: an "order group" ties several designs (orders)
-- together under ONE payment. A single-design purchase is just a
-- group with one order. The per-order generation/proof/editor
-- pipeline is UNCHANGED — this only adds a grouping + payment layer.
-- ============================================================

create table if not exists order_groups (
  id                  uuid primary key default gen_random_uuid(),
  customer_email      text not null,
  access_token        text not null unique default encode(gen_random_bytes(32), 'hex'),
  status              text not null default 'pending_payment'
                      check (status in ('pending_payment','paid','completed','cancelled','refunded')),
  total_cents         int  not null default 0,
  stripe_session_id   text,
  stripe_payment_intent text,
  paid                boolean not null default false,
  paid_at             timestamptz,
  refunded_at         timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists idx_order_groups_token on order_groups(access_token);

-- Each order (design) can belong to a group. Nullable so existing
-- single orders are unaffected; new multi-design flow always sets it.
alter table orders
  add column if not exists group_id        uuid references order_groups(id) on delete cascade,
  add column if not exists group_seq        int;     -- 1-based position within the group

create index if not exists idx_orders_group on orders(group_id);
