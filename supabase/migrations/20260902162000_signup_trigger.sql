create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare new_org uuid; municipality uuid; meta jsonb := new.raw_user_meta_data;
begin
  if coalesce(meta->>'account_type','') <> 'company' then
    insert into public.profiles(id,full_name) values(new.id,coalesce(meta->>'full_name','Usuario')) on conflict do nothing;
    return new;
  end if;
  if length(trim(coalesce(meta->>'legal_name',''))) < 2 or length(trim(coalesce(meta->>'rut',''))) < 8 then
    raise exception 'Incomplete company registration data';
  end if;
  select id into municipality from public.municipalities where commune=coalesce(meta->>'commune','Ñuñoa') limit 1;
  insert into public.organizations(municipality_id,kind,legal_name,trade_name,rut,email,phone,address_line,commune,region)
  values(municipality,'company',trim(meta->>'legal_name'),nullif(trim(meta->>'trade_name'),''),upper(trim(meta->>'rut')),new.email,meta->>'phone',meta->>'address',coalesce(meta->>'commune','Ñuñoa'),coalesce(meta->>'region','Región Metropolitana')) returning id into new_org;
  insert into public.profiles(id,full_name,phone,job_title) values(new.id,coalesce(nullif(trim(meta->>'full_name'),''),'Administrador'),meta->>'phone','Administrador/a');
  insert into public.memberships(user_id,organization_id,role) values(new.id,new_org,'company_admin');
  insert into public.sites(organization_id,name,address_line,commune,region,contact_name,contact_phone)
  values(new_org,coalesce(nullif(trim(meta->>'trade_name'),''),'Casa matriz'),meta->>'address',coalesce(meta->>'commune','Ñuñoa'),coalesce(meta->>'region','Región Metropolitana'),meta->>'full_name',meta->>'phone');
  return new;
end; $$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();
