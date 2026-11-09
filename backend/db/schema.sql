-- Enable UUID extension
create extension if not exists pgcrypto;

-- Profiles table extends Supabase Auth users
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Collections (Shopify-like)
create table public.collections (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  handle text unique not null,
  description text,
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Products (Shopify-like)
create table public.products (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  handle text unique not null,
  description text,
  price numeric not null default 0,
  compare_at_price numeric,
  sku text,
  inventory_quantity integer not null default 0,
  collection_id uuid references public.collections(id) on delete set null,
  image_url text,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for common lookups
create index idx_products_collection_id on public.products(collection_id);
create index idx_products_status on public.products(status);
create index idx_products_handle on public.products(handle);
create index idx_collections_handle on public.collections(handle);

-- Storage buckets for product and collection images
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true),
       ('collection-images', 'collection-images', true)
on conflict (id) do nothing;
