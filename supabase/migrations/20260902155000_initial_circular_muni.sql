create extension if not exists pgcrypto;

create type public.member_role as enum ('municipal_admin','municipal_inspector','company_admin','company_operator','collector_admin','collector_driver');
create type public.organization_kind as enum ('municipality','company','collector','recycler');
create type public.declaration_status as enum ('draft','available','assigned','collected','received','recycled','cancelled');
create type public.pickup_status as enum ('requested','confirmed','on_route','collected','delivered','completed','rejected','cancelled');
create type public.priority_level as enum ('normal','high','urgent');

create table public.municipalities (
  id uuid primary key default gen_random_uuid(), name text not null, commune text not null,
  region text not null, rut text unique, contact_email text, phone text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(), municipality_id uuid references public.municipalities(id),
  kind public.organization_kind not null, legal_name text not null, trade_name text,
  rut text not null unique, business_activity text, email text, phone text, website text,
  address_line text, commune text, region text, latitude numeric(9,6), longitude numeric(9,6),
  is_verified boolean not null default false, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade, full_name text not null,
  phone text, job_title text, avatar_path text, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role public.member_role not null, is_active boolean not null default true,
  created_at timestamptz not null default now(), unique(user_id, organization_id)
);

create table public.sites (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, address_line text not null, commune text not null, region text not null,
  latitude numeric(9,6), longitude numeric(9,6), contact_name text, contact_phone text,
  opening_hours jsonb not null default '{}'::jsonb, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.waste_types (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
  category text not null, default_unit text not null check (default_unit in ('kg','L','unit')),
  is_hazardous boolean not null default false, handling_instructions text, color text,
  is_active boolean not null default true, created_at timestamptz not null default now()
);

create table public.waste_declarations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  site_id uuid not null references public.sites(id), waste_type_id uuid not null references public.waste_types(id),
  declared_by uuid not null references auth.users(id), code text not null unique,
  quantity numeric(12,3) not null check (quantity > 0), unit text not null check (unit in ('kg','L','unit')),
  generated_on date not null default current_date, container_type text, storage_location text,
  purchase_document_number text, source_description text, observations text,
  status public.declaration_status not null default 'available', available_for_pickup boolean not null default true,
  photo_paths text[] not null default '{}', metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.pickup_requests (
  id uuid primary key default gen_random_uuid(), requester_organization_id uuid not null references public.organizations(id),
  collector_organization_id uuid references public.organizations(id), site_id uuid not null references public.sites(id),
  requested_by uuid not null references auth.users(id), assigned_driver_id uuid references auth.users(id),
  code text not null unique, status public.pickup_status not null default 'requested', priority public.priority_level not null default 'normal',
  preferred_date date not null, time_window_start time not null, time_window_end time not null,
  confirmed_at timestamptz, collected_at timestamptz, completed_at timestamptz,
  access_instructions text, rejection_reason text, vehicle_plate text,
  contact_name text not null, contact_phone text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (time_window_end > time_window_start)
);

create table public.pickup_items (
  id uuid primary key default gen_random_uuid(), pickup_request_id uuid not null references public.pickup_requests(id) on delete cascade,
  declaration_id uuid not null references public.waste_declarations(id),
  estimated_quantity numeric(12,3) not null check (estimated_quantity > 0),
  actual_quantity numeric(12,3) check (actual_quantity > 0), unit text not null check (unit in ('kg','L','unit')),
  condition_notes text, unique(pickup_request_id, declaration_id)
);

create table public.pickup_status_history (
  id bigint generated always as identity primary key, pickup_request_id uuid not null references public.pickup_requests(id) on delete cascade,
  from_status public.pickup_status, to_status public.pickup_status not null,
  changed_by uuid not null references auth.users(id), notes text, location jsonb,
  created_at timestamptz not null default now()
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(), pickup_request_id uuid not null unique references public.pickup_requests(id),
  organization_id uuid not null references public.organizations(id), certificate_number text not null unique,
  issued_at timestamptz not null default now(), total_weight_kg numeric(12,3) not null check (total_weight_kg >= 0),
  recovered_weight_kg numeric(12,3) not null check (recovered_weight_kg >= 0),
  final_treatment text not null, file_path text, verification_hash text not null unique,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, body text not null, category text not null default 'system', action_url text,
  read_at timestamptz, created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key, actor_id uuid references auth.users(id),
  organization_id uuid references public.organizations(id), entity_type text not null, entity_id uuid,
  action text not null, old_data jsonb, new_data jsonb, ip_address inet,
  created_at timestamptz not null default now()
);

create index memberships_user_org_idx on public.memberships(user_id, organization_id) where is_active;
create index sites_org_idx on public.sites(organization_id) where is_active;
create index declarations_org_status_date_idx on public.waste_declarations(organization_id, status, generated_on desc);
create index declarations_site_idx on public.waste_declarations(site_id);
create index pickup_requester_status_date_idx on public.pickup_requests(requester_organization_id, status, preferred_date desc);
create index pickup_collector_status_idx on public.pickup_requests(collector_organization_id, status) where collector_organization_id is not null;
create index pickup_items_request_idx on public.pickup_items(pickup_request_id);
create index status_history_pickup_date_idx on public.pickup_status_history(pickup_request_id, created_at desc);
create index notifications_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;
create index audit_org_date_idx on public.audit_logs(organization_id, created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
create trigger municipalities_updated before update on public.municipalities for each row execute function public.set_updated_at();
create trigger organizations_updated before update on public.organizations for each row execute function public.set_updated_at();
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger sites_updated before update on public.sites for each row execute function public.set_updated_at();
create trigger declarations_updated before update on public.waste_declarations for each row execute function public.set_updated_at();
create trigger pickups_updated before update on public.pickup_requests for each row execute function public.set_updated_at();

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create or replace function private.is_org_member(check_org uuid, allowed_roles public.member_role[] default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.memberships m where m.user_id = (select auth.uid())
    and m.organization_id = check_org and m.is_active
    and (allowed_roles is null or m.role = any(allowed_roles))
  );
$$;
revoke all on function private.is_org_member(uuid, public.member_role[]) from public, anon;
grant execute on function private.is_org_member(uuid, public.member_role[]) to authenticated;

alter table public.municipalities enable row level security;
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.sites enable row level security;
alter table public.waste_types enable row level security;
alter table public.waste_declarations enable row level security;
alter table public.pickup_requests enable row level security;
alter table public.pickup_items enable row level security;
alter table public.pickup_status_history enable row level security;
alter table public.certificates enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_self_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_self_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy memberships_own_select on public.memberships for select to authenticated using (user_id = (select auth.uid()));
create policy waste_types_read on public.waste_types for select to authenticated using (is_active);
create policy organizations_member_read on public.organizations for select to authenticated using (private.is_org_member(id));
create policy sites_member_all on public.sites for all to authenticated using (private.is_org_member(organization_id)) with check (private.is_org_member(organization_id, array['company_admin','municipal_admin','collector_admin']::public.member_role[]));
create policy declarations_member_read on public.waste_declarations for select to authenticated using (private.is_org_member(organization_id));
create policy declarations_member_insert on public.waste_declarations for insert to authenticated with check (declared_by = (select auth.uid()) and private.is_org_member(organization_id, array['company_admin','company_operator']::public.member_role[]));
create policy declarations_member_update on public.waste_declarations for update to authenticated using (private.is_org_member(organization_id)) with check (private.is_org_member(organization_id, array['company_admin','company_operator','collector_admin','collector_driver']::public.member_role[]));
create policy pickups_participant_read on public.pickup_requests for select to authenticated using (private.is_org_member(requester_organization_id) or private.is_org_member(collector_organization_id));
create policy pickups_company_insert on public.pickup_requests for insert to authenticated with check (requested_by = (select auth.uid()) and private.is_org_member(requester_organization_id, array['company_admin','company_operator']::public.member_role[]));
create policy pickups_participant_update on public.pickup_requests for update to authenticated using (private.is_org_member(requester_organization_id) or private.is_org_member(collector_organization_id)) with check (private.is_org_member(requester_organization_id) or private.is_org_member(collector_organization_id));
create policy pickup_items_participant on public.pickup_items for all to authenticated using (exists(select 1 from public.pickup_requests p where p.id=pickup_request_id and (private.is_org_member(p.requester_organization_id) or private.is_org_member(p.collector_organization_id)))) with check (exists(select 1 from public.pickup_requests p where p.id=pickup_request_id and (private.is_org_member(p.requester_organization_id) or private.is_org_member(p.collector_organization_id))));
create policy pickup_history_participant_read on public.pickup_status_history for select to authenticated using (exists(select 1 from public.pickup_requests p where p.id=pickup_request_id and (private.is_org_member(p.requester_organization_id) or private.is_org_member(p.collector_organization_id))));
create policy pickup_history_actor_insert on public.pickup_status_history for insert to authenticated with check (changed_by = (select auth.uid()) and exists(select 1 from public.pickup_requests p where p.id=pickup_request_id and (private.is_org_member(p.requester_organization_id) or private.is_org_member(p.collector_organization_id))));
create policy certificates_org_read on public.certificates for select to authenticated using (private.is_org_member(organization_id));
create policy notifications_own on public.notifications for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy audit_org_read on public.audit_logs for select to authenticated using (private.is_org_member(organization_id, array['company_admin','municipal_admin','municipal_inspector','collector_admin']::public.member_role[]));

grant usage on schema public to authenticated;
grant select on public.waste_types to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.memberships, public.organizations to authenticated;
grant select, insert, update on public.sites, public.waste_declarations, public.pickup_requests, public.pickup_items to authenticated;
grant select, insert on public.pickup_status_history to authenticated;
grant select on public.certificates, public.audit_logs to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant usage, select on all sequences in schema public to authenticated;

insert into public.municipalities(name, commune, region, rut, contact_email, phone)
values ('Municipalidad de Ñuñoa','Ñuñoa','Región Metropolitana','69.070.500-1','medioambiente@nunoa.cl','232407000');
insert into public.waste_types(code,name,category,default_unit,is_hazardous,handling_instructions,color) values
('AVU','Aceite vegetal usado','Aceites','L',false,'Almacenar en recipiente hermético, rotulado y sin mezclar con agua.','#D79A35'),
('PAP-CAR','Cartón y papel','Papel y cartón','kg',false,'Mantener limpio, seco y plegado.','#9B7A48'),
('VID','Vidrio','Vidrio','kg',false,'Separar por color cuando sea posible; evitar vidrio contaminado.','#3C85A8'),
('PET','Plásticos PET','Plásticos','kg',false,'Vaciar, enjuagar y compactar los envases.','#7060AD'),
('RAEE','Residuos electrónicos','Electrónicos','unit',true,'Almacenar bajo techo y evitar roturas o desmontaje.','#4D6471'),
('MET','Metales','Metales','kg',false,'Mantener separado de residuos peligrosos.','#64747B');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('waste-evidence','waste-evidence',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']),
       ('certificates','certificates',false,20971520,array['application/pdf'])
on conflict (id) do nothing;

create policy evidence_member_read on storage.objects for select to authenticated using (bucket_id='waste-evidence' and private.is_org_member((storage.foldername(name))[1]::uuid));
create policy evidence_member_insert on storage.objects for insert to authenticated with check (bucket_id='waste-evidence' and private.is_org_member((storage.foldername(name))[1]::uuid));
create policy certificates_member_read on storage.objects for select to authenticated using (bucket_id='certificates' and private.is_org_member((storage.foldername(name))[1]::uuid));
