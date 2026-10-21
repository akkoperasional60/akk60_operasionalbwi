-- ====================================================================
-- SUPABASE POSTGRESQL ENTERPRISE LOGISTICS & B2B SUPPLY CHAIN SCHEMA
-- Includes Row Level Security (RLS), Indexes, and Foreign Key Cascades
-- ====================================================================

-- 1. Enable Required Extensions
create extension if not exists "uuid-ossp";

-- 2. User Roles Enum for RBAC
create type user_role as enum ('super_admin', 'spv_logistik', 'driver');

-- 3. PROFILES (Extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text not null,
  role user_role default 'spv_logistik'::user_role,
  department text default 'Logistics Operations',
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by authenticated users."
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile."
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "Super admins can manage all profiles."
  on public.profiles for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'super_admin'
    )
  );

-- 4. FLEETS (Armada Kendaraan)
create table public.fleets (
  id uuid default uuid_generate_v4() primary key,
  plate_number text unique not null,
  vehicle_type text not null, -- 'Pick Up Box', 'Engkel STD', 'Engkel Long', 'Double STD'
  tonnage_capacity numeric(5,2) not null, -- in metric tons
  current_tonnage numeric(5,2) default 0,
  status text default 'available' check (status in ('available', 'on-duty', 'maintenance')),
  gps_imei text,
  fuel_level_percent integer default 100 check (fuel_level_percent between 0 and 100),
  odometer_km integer default 0,
  year integer default 2024,
  last_maintenance date default current_date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.fleets enable row level security;

create policy "Fleets readable by all authenticated users"
  on public.fleets for select
  to authenticated
  using (true);

create policy "Fleets modifiable by admins and spv_logistiks"
  on public.fleets for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('super_admin', 'spv_logistik')
    )
  );

-- 5. CREWS (Supir dan Kernet)
create table public.crews (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  phone text not null,
  role text not null check (role in ('Driver Utama', 'Driver Cadangan', 'Kernet / Helper')),
  license_number text not null,
  license_type text not null check (license_type in ('SIM B2 Umum', 'SIM B1 Umum', 'SIM A')),
  status text default 'available' check (status in ('available', 'on-duty', 'off')),
  trips_completed integer default 0,
  rating numeric(3,2) default 5.00,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.crews enable row level security;

create policy "Crews viewable by authenticated users"
  on public.crews for select
  to authenticated
  using (true);

create policy "Crews modifiable by admins and spv_logistiks"
  on public.crews for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('super_admin', 'spv_logistik')
    )
  );

-- 6. STORES (Toko Retail & Koordinat Pelanggan)
create table public.stores (
  id uuid default uuid_generate_v4() primary key,
  store_code text unique not null,
  store_name text not null,
  island text not null, -- 'Jawa', 'Sumatera', 'Bali & Nusa Tenggara', 'Kalimantan', 'Sulawesi', 'Papua & Maluku'
  province text not null,
  city text not null,
  address text not null,
  latitude numeric(10, 8) not null,
  longitude numeric(11, 8) not null,
  contact_person text not null,
  phone text not null,
  delivery_window text default '08:00 - 17:00',
  store_category text default 'Supermarket' check (store_category in ('Hypermarket', 'Supermarket', 'Distribution Hub', 'Minimarket Cluster')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.stores enable row level security;

create policy "Stores viewable by all authenticated users"
  on public.stores for select
  to authenticated
  using (true);

create policy "Stores modifiable by spv_logistiks and admins"
  on public.stores for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('super_admin', 'spv_logistik')
    )
  );

-- 7. SCHEDULES (Jadwal Pengiriman & Penugasan Logistik)
create table public.schedules (
  id uuid default uuid_generate_v4() primary key,
  tracking_number text unique not null,
  origin_name text default 'Gudang Pusat Banyuwangi DC',
  origin_latitude numeric(10, 8) default -8.1906,
  origin_longitude numeric(11, 8) default 114.3708,
  store_id uuid references public.stores(id) on delete cascade not null,
  fleet_id uuid references public.fleets(id) on delete set null,
  crew_id uuid references public.crews(id) on delete set null,
  status text default 'scheduled' check (status in ('scheduled', 'in_transit', 'delivered', 'delayed')),
  departure_date timestamp with time zone not null,
  estimated_arrival timestamp with time zone not null,
  actual_arrival timestamp with time zone,
  cargo_description text not null,
  cargo_weight_ton numeric(5,2) not null,
  is_inter_island boolean default false,
  ferry_booking_code text,
  transit_port text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.schedules enable row level security;

create policy "Schedules viewable by all authenticated users"
  on public.schedules for select
  to authenticated
  using (true);

create policy "Schedules modifiable by spv_logistiks and admins"
  on public.schedules for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role in ('super_admin', 'spv_logistik')
    )
  );

-- 8. TRACKING_LOGS (Data Historis Import Excel GPS & Tracksolid)
create table public.tracking_logs (
  id uuid default uuid_generate_v4() primary key,
  schedule_id uuid references public.schedules(id) on delete cascade not null,
  timestamp timestamp with time zone not null,
  latitude numeric(10, 8) not null,
  longitude numeric(11, 8) not null,
  speed numeric(5, 2) default 0, -- in km/h
  engine_status text default 'IDLE' check (engine_status in ('RUNNING', 'STOP', 'IDLE')),
  location_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_tracking_logs_schedule on public.tracking_logs(schedule_id);
create index idx_tracking_logs_timestamp on public.tracking_logs(timestamp);

alter table public.tracking_logs enable row level security;

create policy "Tracking logs accessible by authenticated users"
  on public.tracking_logs for all
  to authenticated
  using (true);

-- 9. DATABRIDGE POLICIES & SYNC AUDIT LOGS (Google Sheets to Supabase DataBridge)
-- Memungkinkan integrasi otomatis dua arah & upsert terjadwal dari Google Sheets API
create policy "DataBridge sync stores" on public.stores for all to anon, authenticated using (true) with check (true);
create policy "DataBridge sync fleets" on public.fleets for all to anon, authenticated using (true) with check (true);
create policy "DataBridge sync crews" on public.crews for all to anon, authenticated using (true) with check (true);
create policy "DataBridge sync schedules" on public.schedules for all to anon, authenticated using (true) with check (true);
create policy "DataBridge sync tracking logs" on public.tracking_logs for all to anon, authenticated using (true) with check (true);

create table if not exists public.databridge_sync_logs (
  id uuid default uuid_generate_v4() primary key,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  status text not null check (status in ('success', 'warning', 'error', 'in_progress')),
  source_type text default 'google_sheets_api',
  sheet_name text,
  stores_count integer default 0,
  schedules_count integer default 0,
  fleets_count integer default 0,
  crews_count integer default 0,
  details jsonb,
  message text,
  duration_ms integer default 0
);

alter table public.databridge_sync_logs enable row level security;
create policy "DataBridge logs viewable and insertable" on public.databridge_sync_logs for all to anon, authenticated using (true) with check (true);
