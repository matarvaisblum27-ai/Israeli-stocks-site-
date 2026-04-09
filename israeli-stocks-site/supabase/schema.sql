-- Schema for Israeli Stocks historical database
-- Run this once in the Supabase SQL Editor.

create table if not exists categories (
  id bigserial primary key,
  name text not null,
  position int not null,
  intro jsonb
);

create table if not exists companies (
  id bigserial primary key,
  category_id bigint not null references categories(id) on delete cascade,
  name text not null,
  position int not null,
  ticker text,
  reviews jsonb not null default '{}'::jsonb
);

create index if not exists companies_category_idx on companies (category_id, position);
create index if not exists companies_name_idx on companies using gin (to_tsvector('simple', name));

create table if not exists interesting_preamble (
  year text primary key,
  preamble text
);

create table if not exists interesting_index (
  id bigserial primary key,
  year text not null,
  num int not null,
  name text not null,
  html text not null,
  ticker text
);

create index if not exists interesting_index_year_idx on interesting_index (year, num);

-- Enable RLS and grant public read
alter table categories enable row level security;
alter table companies enable row level security;
alter table interesting_preamble enable row level security;
alter table interesting_index enable row level security;

create policy "public read categories" on categories for select using (true);
create policy "public read companies" on companies for select using (true);
create policy "public read interesting_preamble" on interesting_preamble for select using (true);
create policy "public read interesting_index" on interesting_index for select using (true);
