alter table public.profiles add column if not exists login_id text;
create unique index if not exists profiles_login_id_key on public.profiles(login_id) where login_id is not null;
