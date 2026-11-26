create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id text primary key check (id = 'main'),
  announcement text not null default 'For current admission information, please contact the school.' check (char_length(announcement) between 1 and 240),
  address text not null default 'Powayan, Shahjahanpur, Uttar Pradesh, India' check (char_length(address) between 1 and 240),
  map_query text not null default 'Powayan, Shahjahanpur, Uttar Pradesh, India' check (char_length(map_query) between 1 and 240),
  phone text not null default '' check (char_length(phone) <= 40),
  email text not null default '' check (char_length(email) <= 254),
  whatsapp text not null default '' check (char_length(whatsapp) <= 15 and (whatsapp = '' or whatsapp ~ '^[0-9]{10,15}$')),
  admissions_information text not null default 'For current admission information, please contact the school.' check (char_length(admissions_information) between 1 and 1200),
  school_history text not null default 'School history will be shared here by the school.' check (char_length(school_history) between 1 and 1200),
  school_mission text not null default 'The school''s mission will be shared here by the school.' check (char_length(school_mission) between 1 and 1200),
  school_vision text not null default 'The school''s vision and educational philosophy will be shared here by the school.' check (char_length(school_vision) between 1 and 1200),
  school_values text not null default 'School values will be shared here by the school.' check (char_length(school_values) between 1 and 800),
  principal_name text not null default 'Principal, Marwah Modern School' check (char_length(principal_name) between 1 and 100),
  principal_message text not null default 'A message from the Principal will be shared here by the school.' check (char_length(principal_message) between 1 and 2000),
  principal_photo_url text not null default '' check (char_length(principal_photo_url) <= 2048),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 2000),
  category text not null check (category in ('Announcement', 'Admissions', 'Examination', 'Holiday', 'Important date')),
  published_at date not null default current_date,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  caption text not null check (char_length(caption) between 1 and 120),
  image_url text not null check (char_length(image_url) between 1 and 2048),
  storage_path text not null check (char_length(storage_path) between 1 and 512),
  created_at timestamptz not null default now()
);

create table if not exists public.admission_enquiries (
  id uuid primary key default gen_random_uuid(),
  student_name text not null check (char_length(student_name) between 2 and 100),
  parent_name text not null check (char_length(parent_name) between 2 and 100),
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  class_interest text not null check (char_length(class_interest) between 1 and 80),
  message text check (message is null or char_length(message) <= 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  email text check (email is null or (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$')),
  phone text check (phone is null or phone ~ '^[6-9][0-9]{9}$'),
  message text not null check (char_length(message) between 5 and 2000),
  created_at timestamptz not null default now(),
  constraint contact_messages_has_reply_channel check (email is not null or phone is not null)
);

create or replace function public.is_school_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_school_admin() from public;
grant execute on function public.is_school_admin() to authenticated;

alter table public.admin_users enable row level security;
alter table public.site_settings enable row level security;
alter table public.site_pages enable row level security;
alter table public.fee_items enable row level security;
alter table public.campus_locations enable row level security;
alter table public.notices enable row level security;
alter table public.gallery enable row level security;
alter table public.admission_enquiries enable row level security;
alter table public.contact_messages enable row level security;

drop policy if exists "Admins may read their own role" on public.admin_users;
create policy "Admins may read their own role"
  on public.admin_users for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Public can read school information" on public.site_settings;
create policy "Public can read school information"
  on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "Admins manage school information" on public.site_settings;
create policy "Admins manage school information"
  on public.site_settings for all to authenticated
  using ((select public.is_school_admin()))
  with check ((select public.is_school_admin()));

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

drop policy if exists "Public can read published notices" on public.notices;
create policy "Public can read published notices"
  on public.notices for select to anon, authenticated
  using (is_published = true);
drop policy if exists "Admins manage notices" on public.notices;
create policy "Admins manage notices"
  on public.notices for all to authenticated
  using ((select public.is_school_admin()))
  with check ((select public.is_school_admin()));

drop policy if exists "Public can read gallery" on public.gallery;
create policy "Public can read gallery"
  on public.gallery for select to anon, authenticated using (true);
drop policy if exists "Admins manage gallery" on public.gallery;
create policy "Admins manage gallery"
  on public.gallery for all to authenticated
  using ((select public.is_school_admin()))
  with check ((select public.is_school_admin()));

drop policy if exists "Public can submit admission enquiries" on public.admission_enquiries;
create policy "Public can submit admission enquiries"
  on public.admission_enquiries for insert to anon, authenticated
  with check (
    char_length(student_name) between 2 and 100
    and char_length(parent_name) between 2 and 100
    and phone ~ '^[6-9][0-9]{9}$'
    and char_length(class_interest) between 1 and 80
  );
drop policy if exists "Admins can read admission enquiries" on public.admission_enquiries;
create policy "Admins can read admission enquiries"
  on public.admission_enquiries for select to authenticated
  using ((select public.is_school_admin()));

drop policy if exists "Public can submit contact messages" on public.contact_messages;
create policy "Public can submit contact messages"
  on public.contact_messages for insert to anon, authenticated
  with check (
    (email is not null or phone is not null)
    and char_length(name) between 2 and 100
    and char_length(message) between 5 and 2000
  );
drop policy if exists "Admins can read contact messages" on public.contact_messages;
create policy "Admins can read contact messages"
  on public.contact_messages for select to authenticated
  using ((select public.is_school_admin()));

grant select on public.site_settings, public.notices, public.gallery to anon, authenticated;
grant insert, update, delete on public.site_settings, public.notices, public.gallery to authenticated;
grant select on public.site_pages, public.fee_items, public.campus_locations to anon, authenticated;
grant insert, update, delete on public.site_pages, public.fee_items, public.campus_locations to authenticated;
grant select on public.admin_users, public.admission_enquiries, public.contact_messages to authenticated;
revoke insert on public.admission_enquiries, public.contact_messages from anon, authenticated;
grant insert (student_name, parent_name, phone, class_interest, message)
  on public.admission_enquiries to anon, authenticated;
grant insert (name, email, phone, message)
  on public.contact_messages to anon, authenticated;

create index if not exists notices_public_date_idx
  on public.notices (is_published, published_at desc);
create index if not exists gallery_created_at_idx
  on public.gallery (created_at desc);
create index if not exists admissions_created_at_idx
  on public.admission_enquiries (created_at desc);
create index if not exists contacts_created_at_idx
  on public.contact_messages (created_at desc);
create index if not exists site_pages_public_order_idx
  on public.site_pages (is_published, sort_order);
create index if not exists fee_items_sort_idx
  on public.fee_items (sort_order, class_name);
create index if not exists campus_locations_public_idx
  on public.campus_locations (is_published, created_at);

insert into public.site_settings (id)
values ('main')
on conflict (id) do nothing;

insert into public.site_pages (slug, page_type, title, nav_label, summary, content, is_published, show_in_nav, sort_order)
values
  ('about', 'about', 'Grounded in community.', 'About', 'A school is more than its classrooms. It is the people, ideas and everyday moments that help young minds find their way.', 'Marwah Modern School welcomes families in Powayan, Shahjahanpur. We are shaping this space to share the school''s story, approach and the information families need. Details are kept honest and will be updated by the school.', true, true, 10),
  ('fees', 'fees', 'Fee structure', 'Fees', 'View school-approved fee information.', 'For current details and payment information, please contact the school office.', false, true, 20)
on conflict (slug) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('school-gallery', 'school-gallery', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view school photos" on storage.objects;
create policy "Public can view school photos"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'school-gallery');
drop policy if exists "Admins can upload school photos" on storage.objects;
create policy "Admins can upload school photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'school-gallery'
    and (storage.foldername(name))[1] in ('gallery', 'principal')
    and (select public.is_school_admin())
  );
drop policy if exists "Admins can update school photos" on storage.objects;
create policy "Admins can update school photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'school-gallery' and (select public.is_school_admin()))
  with check (bucket_id = 'school-gallery' and (select public.is_school_admin()));
drop policy if exists "Admins can delete school photos" on storage.objects;
create policy "Admins can delete school photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'school-gallery' and (select public.is_school_admin()));
