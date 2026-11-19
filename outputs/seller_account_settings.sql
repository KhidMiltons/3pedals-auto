-- Seller account settings and promotion history state for 3 Pedals Auto KE
create table if not exists public.seller_settings (
  seller_id uuid primary key references auth.users(id) on delete cascade,
  preferred_stock_mode text not null default 'any' check (preferred_stock_mode in ('any', 'local', 'import')),
  bank_details text not null default '',
  print_logo_on_documents boolean not null default true,
  require_engine_number boolean not null default false,
  require_registration_number boolean not null default true,
  require_logbook boolean not null default true,
  require_supplier_documents boolean not null default false,
  repost_reminder_days integer not null default 14 check (repost_reminder_days between 1 and 365),
  promotion_history_cleared_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.seller_settings enable row level security;

drop policy if exists "Sellers manage their own settings" on public.seller_settings;
create policy "Sellers manage their own settings"
  on public.seller_settings
  for all
  to authenticated
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()));

revoke all on public.seller_settings from anon, public;
grant select, insert, update, delete on public.seller_settings to authenticated;
