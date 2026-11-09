-- Row Level Security

alter table public.profiles enable row level security;
alter table public.collections enable row level security;
alter table public.products enable row level security;

-- Profiles: users read own; admins read/write all
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admins can manage all profiles"
  on public.profiles for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Collections: public read; admin write
create policy "Public can view collections"
  on public.collections for select
  using (true);

create policy "Admins can manage collections"
  on public.collections for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Products: public read; admin write
create policy "Public can view products"
  on public.products for select
  using (true);

create policy "Admins can manage products"
  on public.products for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Storage: public read; authenticated write for product/collection images
create policy "Public can view product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "Public can view collection images"
  on storage.objects for select
  using (bucket_id = 'collection-images');

create policy "Authenticated can upload product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and auth.role() = 'authenticated');

create policy "Authenticated can upload collection images"
  on storage.objects for insert
  with check (bucket_id = 'collection-images' and auth.role() = 'authenticated');
