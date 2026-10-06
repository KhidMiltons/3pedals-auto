-- 3 Pedals Auto KE — Admin-managed Our Projects portfolio
-- Run this once in the Supabase SQL Editor for the same project used by index.html.
-- This creates the portfolio table, RLS policies, and public media bucket.

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  type text not null check (type in ('video','photo','article')),
  category text,
  description text,
  body text,
  media_url text,
  media_path text,
  media_mime text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_published_created_idx
  on public.projects (published, created_at desc);

-- Keep updated_at current when an admin edits a project.
create or replace function public.set_projects_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
before update on public.projects
for each row execute function public.set_projects_updated_at();

alter table public.projects enable row level security;

drop policy if exists "Public can read published projects" on public.projects;
create policy "Public can read published projects"
on public.projects
for select
using (
  published = true
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

drop policy if exists "Admins can create projects" on public.projects;
create policy "Admins can create projects"
on public.projects
for insert
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

drop policy if exists "Admins can update projects" on public.projects;
create policy "Admins can update projects"
on public.projects
for update
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

drop policy if exists "Admins can delete projects" on public.projects;
create policy "Admins can delete projects"
on public.projects
for delete
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

-- Public bucket: the database controls which projects are published.
-- Do not put private customer documents in this bucket.
insert into storage.buckets (id, name, public)
values ('projects', 'projects', true)
on conflict (id) do update set public = true;

drop policy if exists "Anyone can view project media" on storage.objects;
create policy "Anyone can view project media"
on storage.objects
for select
using (bucket_id = 'projects');

drop policy if exists "Admins can upload project media" on storage.objects;
create policy "Admins can upload project media"
on storage.objects
for insert
with check (
  bucket_id = 'projects'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

drop policy if exists "Admins can update project media" on storage.objects;
create policy "Admins can update project media"
on storage.objects
for update
using (
  bucket_id = 'projects'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
)
with check (
  bucket_id = 'projects'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

drop policy if exists "Admins can delete project media" on storage.objects;
create policy "Admins can delete project media"
on storage.objects
for delete
using (
  bucket_id = 'projects'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
);

-- Optional: verify the table exists after running the script.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'projects'
order by ordinal_position;
