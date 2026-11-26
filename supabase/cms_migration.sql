alter table public.site_settings
  add column if not exists map_query text not null default 'Powayan, Shahjahanpur, Uttar Pradesh, India'
  check (char_length(map_query) between 1 and 240);

create table if not exists public.site_pages (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  page_type text not null check (page_type in ('about', 'fees', 'custom')),
  title text not null check (char_length(title) between 1 and 100),
  nav_label text not null check (char_length(nav_label) between 1 and 40),
  summary text not null default '' check (char_length(summary) <= 240),
  content text not null default '' check (char_length(content) <= 6000),
  is_published boolean not null default true,
  show_in_nav boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (page_type = 'about' and slug = 'about')
    or (page_type = 'fees' and slug = 'fees')
    or (page_type = 'custom' and slug not in ('about', 'fees'))
  )
);

create unique index if not exists site_pages_single_builtin_type_idx
  on public.site_pages (page_type)
  where page_type in ('about', 'fees');

create table if not exists public.fee_items (
  id uuid primary key default gen_random_uuid(),
  class_name text not null check (char_length(class_name) between 1 and 80),
  fee_name text not null check (char_length(fee_name) between 1 and 100),
  amount numeric(12, 2) not null check (amount >= 0),
  frequency text not null check (frequency in ('One-time', 'Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'Other')),
  notes text not null default '' check (char_length(notes) <= 240),
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.campus_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  address text not null check (char_length(address) between 1 and 240),
  map_query text not null check (char_length(map_query) between 1 and 240),
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.site_pages enable row level security;
alter table public.fee_items enable row level security;
alter table public.campus_locations enable row level security;

drop policy if exists "Public can read published pages" on public.site_pages;
create policy "Public can read published pages"
  on public.site_pages for select to anon, authenticated
  using (is_published = true);
drop policy if exists "Admins manage pages" on public.site_pages;
create policy "Admins manage pages"
  on public.site_pages for all to authenticated
  using ((select public.is_school_admin()))
  with check ((select public.is_school_admin()));

drop policy if exists "Public can read published fee items" on public.fee_items;
create policy "Public can read published fee items"
  on public.fee_items for select to anon, authenticated
  using (
    exists (
      select 1 from public.site_pages
      where slug = 'fees' and is_published = true
    )
  );
drop policy if exists "Admins manage fee items" on public.fee_items;
create policy "Admins manage fee items"
  on public.fee_items for all to authenticated
  using ((select public.is_school_admin()))
  with check ((select public.is_school_admin()));

drop policy if exists "Public can read published campus locations" on public.campus_locations;
create policy "Public can read published campus locations"
  on public.campus_locations for select to anon, authenticated
  using (is_published = true);
drop policy if exists "Admins manage campus locations" on public.campus_locations;
create policy "Admins manage campus locations"
  on public.campus_locations for all to authenticated
  using ((select public.is_school_admin()))
  with check ((select public.is_school_admin()));

grant select on public.site_pages, public.fee_items, public.campus_locations to anon, authenticated;
grant insert, update, delete on public.site_pages, public.fee_items, public.campus_locations to authenticated;

create index if not exists site_pages_public_order_idx
  on public.site_pages (is_published, sort_order);
create index if not exists fee_items_sort_idx
  on public.fee_items (sort_order, class_name);
create index if not exists campus_locations_public_idx
  on public.campus_locations (is_published, created_at);

insert into public.site_pages (slug, page_type, title, nav_label, summary, content, is_published, show_in_nav, sort_order)
values
  ('about', 'about', 'Grounded in community.', 'About', 'A school is more than its classrooms. It is the people, ideas and everyday moments that help young minds find their way.', 'Marwah Modern School welcomes families in Powayan, Shahjahanpur. We are shaping this space to share the school''s story, approach and the information families need. Details are kept honest and will be updated by the school.', true, true, 10),
  ('fees', 'fees', 'Fee structure', 'Fees', 'View school-approved fee information.', 'For current details and payment information, please contact the school office.', false, true, 20)
on conflict (slug) do nothing;
