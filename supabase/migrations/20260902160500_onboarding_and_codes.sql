create sequence if not exists public.declaration_code_seq start 1000;
create sequence if not exists public.pickup_code_seq start 1000;

create or replace function public.assign_tracking_code() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.code is null or new.code = '' then
    if tg_table_name = 'waste_declarations' then
      new.code := 'RES-' || extract(year from current_date)::text || '-' || lpad(nextval('public.declaration_code_seq')::text, 5, '0');
    else
      new.code := 'SOL-' || extract(year from current_date)::text || '-' || lpad(nextval('public.pickup_code_seq')::text, 5, '0');
    end if;
  end if;
  return new;
end; $$;
create trigger declaration_tracking_code before insert on public.waste_declarations for each row execute function public.assign_tracking_code();
create trigger pickup_tracking_code before insert on public.pickup_requests for each row execute function public.assign_tracking_code();

create or replace function public.onboard_company(company_legal_name text, company_trade_name text, company_rut text, company_email text, company_phone text, site_address text, site_commune text, site_region text, contact_full_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_org uuid; municipality uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if length(trim(company_legal_name)) < 2 or length(trim(company_rut)) < 8 then raise exception 'Invalid company data'; end if;
  if exists(select 1 from public.memberships where user_id=(select auth.uid())) then raise exception 'User already onboarded'; end if;
  select id into municipality from public.municipalities where commune=site_commune limit 1;
  insert into public.organizations(municipality_id,kind,legal_name,trade_name,rut,email,phone,address_line,commune,region)
  values(municipality,'company',trim(company_legal_name),nullif(trim(company_trade_name),''),upper(trim(company_rut)),company_email,company_phone,site_address,site_commune,site_region) returning id into new_org;
  insert into public.profiles(id,full_name,phone,job_title) values((select auth.uid()),trim(contact_full_name),company_phone,'Administrador/a');
  insert into public.memberships(user_id,organization_id,role) values((select auth.uid()),new_org,'company_admin');
  insert into public.sites(organization_id,name,address_line,commune,region,contact_name,contact_phone)
  values(new_org,coalesce(nullif(trim(company_trade_name),''),'Casa matriz'),site_address,site_commune,site_region,contact_full_name,company_phone);
  return new_org;
end; $$;
revoke all on function public.onboard_company(text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.onboard_company(text,text,text,text,text,text,text,text,text) to authenticated;
grant usage, select on sequence public.declaration_code_seq, public.pickup_code_seq to authenticated;
