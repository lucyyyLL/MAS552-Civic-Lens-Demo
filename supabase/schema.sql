-- Civic Lens shared objects: table, row-level security, realtime and model storage.
-- Run once in the Supabase dashboard (SQL Editor → New query → paste → Run), and enable
-- Authentication → Sign In / Providers → "Allow anonymous sign-ins".

-- One row per placed object. Positions are in meters in the shared site frame (see
-- src/site-anchor.js), never in a phone's own world coordinates.
create table public.objects (
  id          uuid primary key default gen_random_uuid(),
  site_id     text not null,
  owner_id    uuid not null default auth.uid(),
  -- private: only the owner sees it; common: everyone at the site sees it
  layer       text not null default 'private' check (layer in ('private', 'common')),
  prompt      text,
  model_url   text not null,
  attribution text,
  upright     float8[] not null default '{0,0,0}',  -- degrees that stand the model upright
  height_m    float8 not null,                       -- real-world height
  pos_x       float8 not null default 0,
  pos_y       float8 not null default 0,
  pos_z       float8 not null default 0,
  rotation_y  float8 not null default 0,             -- degrees around the vertical axis
  created_at  timestamptz not null default now()
);
create index on public.objects (site_id);

-- Everyone sees common objects and their own private ones; only owners change or delete.
-- Anonymous users have the authenticated role.
alter table public.objects enable row level security;
create policy "read common or own" on public.objects for select to authenticated
  using (layer = 'common' or owner_id = auth.uid());
create policy "insert own" on public.objects for insert to authenticated
  with check (owner_id = auth.uid());
create policy "update own" on public.objects for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete own" on public.objects for delete to authenticated
  using (owner_id = auth.uid());

-- Live updates to every phone
alter publication supabase_realtime add table public.objects;

-- Generated models (uploaded by the backend with the secret key), readable by anyone
insert into storage.buckets (id, name, public) values ('models', 'models', true)
  on conflict (id) do nothing;
