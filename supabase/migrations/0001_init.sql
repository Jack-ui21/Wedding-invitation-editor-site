-- Wedding Invitation Studio — initial schema.
-- Run in Supabase SQL editor. Service-role key is used only by Next.js server code.

create extension if not exists pgcrypto;

create type public.user_role as enum ('owner', 'customer');
create type public.project_status as enum (
  'draft', 'in_progress', 'awaiting_customer', 'ready_for_review', 'published', 'archived'
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null unique,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text not null default '',
  created_at timestamptz not null default now()
);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  thumbnail_path text not null default '',
  source_project_id uuid,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  owner_id uuid not null references public.users(id),
  project_name text not null,
  template_id uuid references public.templates(id) on delete set null,
  status public.project_status not null default 'draft',
  slug text unique,
  published_url text,
  main_file_path text not null default 'index.html',
  field_mappings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.templates
  add constraint templates_source_project_fk
  foreign key (source_project_id) references public.projects(id) on delete set null;

create table public.wedding_details (
  project_id uuid primary key references public.projects(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null default '',
  event_date text not null default '',
  event_time text not null default '',
  location text not null default '',
  description text not null default '',
  image_url text not null default '',
  map_url text not null default '',
  sort_order integer not null default 0
);

create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  file_type text not null,
  mime_type text not null default '',
  file_size bigint not null default 0,
  is_asset boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, file_path)
);

create index projects_customer_idx on public.projects(customer_id);
create index projects_owner_idx on public.projects(owner_id);
create index projects_status_idx on public.projects(status);
create index projects_updated_idx on public.projects(updated_at desc);
create index events_project_idx on public.events(project_id);
create index project_files_project_idx on public.project_files(project_id);

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'owner');
$$;

create or replace function public.project_owner(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_owner() or exists (
    select 1 from public.projects p
    join public.customers c on c.id = p.customer_id
    where p.id = p_project and c.user_id = auth.uid()
  );
$$;

create or replace function public.project_visible(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p.status = 'published' or public.project_owner(p_project)
  from public.projects p where p.id = p_project;
$$;

alter table public.users enable row level security;
alter table public.customers enable row level security;
alter table public.templates enable row level security;
alter table public.projects enable row level security;
alter table public.wedding_details enable row level security;
alter table public.events enable row level security;
alter table public.project_files enable row level security;

create policy "users read self or owner" on public.users for select
  using (id = auth.uid() or public.is_owner());
create policy "users update self name" on public.users for update
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.users where id = auth.uid()));

create policy "customers read own or owner" on public.customers for select
  using (user_id = auth.uid() or public.is_owner());

create policy "templates readable" on public.templates for select using (true);

create policy "projects read visible" on public.projects for select using (public.project_visible(id));
create policy "projects update owned" on public.projects for update using (public.project_owner(id));
create policy "projects insert owner" on public.projects for insert with check (public.is_owner());
create policy "projects delete owner" on public.projects for delete using (public.is_owner());

create policy "wedding read visible" on public.wedding_details for select using (public.project_visible(project_id));
create policy "wedding write owned" on public.wedding_details for all using (public.project_owner(project_id)) with check (public.project_owner(project_id));
create policy "events read visible" on public.events for select using (public.project_visible(project_id));
create policy "events write owned" on public.events for all using (public.project_owner(project_id)) with check (public.project_owner(project_id));
create policy "files read visible" on public.project_files for select using (public.project_visible(project_id));
create policy "files write owned" on public.project_files for all using (public.project_owner(project_id)) with check (public.project_owner(project_id));

-- Storage: one bucket. Object path must start with the project id.
insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;

create policy "project files read" on storage.objects for select
  using (bucket_id = 'project-files' and public.project_visible(((storage.foldername(name))[1])::uuid));

create policy "project files write" on storage.objects for insert
  with check (bucket_id = 'project-files' and public.project_owner(((storage.foldername(name))[1])::uuid));

create policy "project files update" on storage.objects for update
  using (bucket_id = 'project-files' and public.project_owner(((storage.foldername(name))[1])::uuid));

create policy "project files delete" on storage.objects for delete
  using (bucket_id = 'project-files' and public.project_owner(((storage.foldername(name))[1])::uuid));
