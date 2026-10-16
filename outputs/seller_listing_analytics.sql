-- Seller-specific listing analytics for 3 Pedals Auto KE
-- Run this script in Supabase SQL Editor before enabling the dashboard metrics.
create table if not exists public.seller_listing_analytics (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings(id) on delete cascade,
  event_type text not null check (event_type in ('view', 'whatsapp_click')),
  created_at timestamptz not null default now()
);

create index if not exists seller_listing_analytics_listing_created_idx
  on public.seller_listing_analytics (listing_id, created_at desc);
create index if not exists seller_listing_analytics_type_created_idx
  on public.seller_listing_analytics (event_type, created_at desc);

alter table public.seller_listing_analytics enable row level security;

drop policy if exists "Public can record events for approved listings" on public.seller_listing_analytics;
create policy "Public can record events for approved listings"
  on public.seller_listing_analytics
  for insert
  to anon, authenticated
  with check (
    event_type in ('view', 'whatsapp_click')
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.status = 'approved'
    )
  );

drop policy if exists "Sellers can read analytics for own listings" on public.seller_listing_analytics;
create policy "Sellers can read analytics for own listings"
  on public.seller_listing_analytics
  for select
  to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.owner = (select auth.uid())
    )
  );

revoke update, delete on public.seller_listing_analytics from anon, authenticated;
grant insert on public.seller_listing_analytics to anon, authenticated;
grant select on public.seller_listing_analytics to authenticated;
