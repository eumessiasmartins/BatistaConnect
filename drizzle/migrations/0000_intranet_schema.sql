create type public.app_role as enum ('superadmin','admin','user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  cpf text not null unique,
  job_title text,
  department text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create table public.role_permissions (
  role app_role not null,
  permission text not null,
  primary key (role, permission)
);
grant select, insert, delete on public.role_permissions to authenticated;
grant all on public.role_permissions to service_role;
alter table public.role_permissions enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.has_permission(_user_id uuid, _perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id, 'superadmin') or exists (
    select 1 from public.user_roles ur join public.role_permissions rp on rp.role = ur.role
    where ur.user_id = _user_id and rp.permission = _perm)
$$;

create policy "profiles read" on public.profiles for select to authenticated using (true);
create policy "profiles update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_permission(auth.uid(), 'collaborators.manage'));
create policy "roles read" on public.user_roles for select to authenticated using (true);
create policy "perms read" on public.role_permissions for select to authenticated using (true);
create policy "perms insert" on public.role_permissions for insert to authenticated with check (public.has_role(auth.uid(),'superadmin'));
create policy "perms delete" on public.role_permissions for delete to authenticated using (public.has_role(auth.uid(),'superadmin'));

insert into public.role_permissions (role, permission) values
 ('admin','post.create'),('admin','announcement.create'),('admin','event.create'),('admin','poll.create'),
 ('admin','collaborators.manage'),('admin','company.manage'),('admin','posts.moderate'),
 ('user','post.create');

create table public.company (
  id int primary key default 1 check (id = 1),
  name text not null default 'Minha Empresa',
  trade_name text, cnpj text, email text, phone text, address text, city text, state text, website text,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.company to authenticated;
grant all on public.company to service_role;
alter table public.company enable row level security;
create policy "company read" on public.company for select to authenticated using (true);
create policy "company insert" on public.company for insert to authenticated with check (public.has_permission(auth.uid(),'company.manage'));
create policy "company update" on public.company for update to authenticated using (public.has_permission(auth.uid(),'company.manage'));
insert into public.company (id, name) values (1, 'Minha Empresa');

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('post','announcement','event','poll')),
  title text,
  content text,
  require_read_confirmation boolean not null default false,
  event_date date, event_start time, event_end time,
  event_format text check (event_format in ('local','online')),
  event_location text, event_link text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
create policy "posts read" on public.posts for select to authenticated using (true);
create policy "posts insert" on public.posts for insert to authenticated with check (
  author_id = auth.uid() and public.has_permission(auth.uid(), case type when 'post' then 'post.create' when 'announcement' then 'announcement.create' when 'event' then 'event.create' else 'poll.create' end));
create policy "posts delete" on public.posts for delete to authenticated using (author_id = auth.uid() or public.has_permission(auth.uid(),'posts.moderate'));

create table public.post_attachments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  path text not null, name text not null, kind text not null check (kind in ('image','document')),
  mime text, size bigint, created_at timestamptz not null default now()
);
grant select, insert, delete on public.post_attachments to authenticated;
grant all on public.post_attachments to service_role;
alter table public.post_attachments enable row level security;
create policy "att read" on public.post_attachments for select to authenticated using (true);
create policy "att insert" on public.post_attachments for insert to authenticated with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  label text not null, position int not null default 0
);
grant select, insert on public.poll_options to authenticated;
grant all on public.poll_options to service_role;
alter table public.poll_options enable row level security;
create policy "opt read" on public.poll_options for select to authenticated using (true);
create policy "opt insert" on public.poll_options for insert to authenticated with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

create table public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);
grant select, insert, delete on public.poll_votes to authenticated;
grant all on public.poll_votes to service_role;
alter table public.poll_votes enable row level security;
create policy "vote read" on public.poll_votes for select to authenticated using (true);
create policy "vote insert" on public.poll_votes for insert to authenticated with check (user_id = auth.uid());
create policy "vote delete" on public.poll_votes for delete to authenticated using (user_id = auth.uid());

create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
grant select, insert, delete on public.post_likes to authenticated;
grant all on public.post_likes to service_role;
alter table public.post_likes enable row level security;
create policy "like read" on public.post_likes for select to authenticated using (true);
create policy "like insert" on public.post_likes for insert to authenticated with check (user_id = auth.uid());
create policy "like delete" on public.post_likes for delete to authenticated using (user_id = auth.uid());

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.post_comments to authenticated;
grant all on public.post_comments to service_role;
alter table public.post_comments enable row level security;
create policy "com read" on public.post_comments for select to authenticated using (true);
create policy "com insert" on public.post_comments for insert to authenticated with check (author_id = auth.uid());
create policy "com delete" on public.post_comments for delete to authenticated using (author_id = auth.uid() or public.has_permission(auth.uid(),'posts.moderate'));

create table public.read_confirmations (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  confirmed_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
grant select, insert on public.read_confirmations to authenticated;
grant all on public.read_confirmations to service_role;
alter table public.read_confirmations enable row level security;
create policy "rc read" on public.read_confirmations for select to authenticated using (true);
create policy "rc insert" on public.read_confirmations for insert to authenticated with check (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, cpf, job_title, department)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''),
          coalesce(new.raw_user_meta_data->>'cpf', split_part(new.email,'@',1)),
          new.raw_user_meta_data->>'job_title', new.raw_user_meta_data->>'department');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

do $$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    '95932844787@cpf.intranet', extensions.crypt('159753', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Messias Martins","cpf":"95932844787","job_title":"Superadministrador"}',
    now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text,
    jsonb_build_object('sub', uid::text, 'email', '95932844787@cpf.intranet', 'email_verified', true),
    'email', now(), now(), now());
  insert into public.user_roles (user_id, role) values (uid, 'superadmin');
end $$;

create policy "attachments read" on storage.objects for select to authenticated using (bucket_id = 'attachments');
create policy "attachments upload" on storage.objects for insert to authenticated with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
