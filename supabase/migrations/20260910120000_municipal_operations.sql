-- Operación municipal: cada municipio tiene una organización operativa propia.
-- No se insertan usuarios, solicitudes ni residuos de ejemplo: se cargan desde la operación real.
insert into public.organizations (municipality_id, kind, legal_name, trade_name, rut, email, phone, commune, region, is_verified)
select m.id, 'municipality'::public.organization_kind, m.name, m.name, m.rut,
       m.contact_email, m.phone, m.commune, m.region, true
from public.municipalities m
where not exists (
  select 1 from public.organizations o
  where o.kind = 'municipality' and o.municipality_id = m.id
);

create or replace function private.can_manage_municipality(target_municipality uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.memberships member
    join public.organizations municipal_org on municipal_org.id = member.organization_id
    where member.user_id = (select auth.uid())
      and member.is_active
      and member.role in ('municipal_admin','municipal_inspector')
      and municipal_org.kind = 'municipality'
      and municipal_org.municipality_id = target_municipality
  );
$$;
revoke all on function private.can_manage_municipality(uuid) from public, anon;
grant execute on function private.can_manage_municipality(uuid) to authenticated;

-- Visibilidad comunal para funcionarios, conservando el aislamiento para empresas y gestores.
create policy organizations_municipality_staff_read on public.organizations for select to authenticated
using (private.can_manage_municipality(municipality_id));
create policy sites_municipality_staff_read on public.sites for select to authenticated
using (exists (select 1 from public.organizations o where o.id = sites.organization_id and private.can_manage_municipality(o.municipality_id)));
create policy declarations_municipality_staff_read on public.waste_declarations for select to authenticated
using (exists (select 1 from public.organizations o where o.id = waste_declarations.organization_id and private.can_manage_municipality(o.municipality_id)));
create policy pickups_municipality_staff_read on public.pickup_requests for select to authenticated
using (exists (select 1 from public.organizations o where o.id = pickup_requests.requester_organization_id and private.can_manage_municipality(o.municipality_id)));
create policy pickup_items_municipality_staff_read on public.pickup_items for select to authenticated
using (exists (select 1 from public.pickup_requests p join public.organizations o on o.id=p.requester_organization_id where p.id=pickup_items.pickup_request_id and private.can_manage_municipality(o.municipality_id)));

-- Centraliza transiciones, bitácora y autorización de acciones municipales.
create or replace function public.municipal_update_pickup_status(p_pickup_id uuid, p_status public.pickup_status, p_notes text default null)
returns public.pickup_requests language plpgsql security definer set search_path = '' as $$
declare current_pickup public.pickup_requests; updated_pickup public.pickup_requests;
begin
  select p.* into current_pickup from public.pickup_requests p
  join public.organizations o on o.id=p.requester_organization_id
  where p.id=p_pickup_id and private.can_manage_municipality(o.municipality_id)
  for update;
  if current_pickup.id is null then raise exception 'Operación no encontrada o sin autorización'; end if;
  if p_status not in ('confirmed','rejected','cancelled') then raise exception 'Estado no permitido para operación municipal'; end if;
  update public.pickup_requests set status=p_status,
    confirmed_at=case when p_status='confirmed' then now() else confirmed_at end,
    rejection_reason=case when p_status='rejected' then nullif(trim(p_notes),'') else rejection_reason end
  where id=p_pickup_id returning * into updated_pickup;
  insert into public.pickup_status_history(pickup_request_id,from_status,to_status,changed_by,notes)
  values(p_pickup_id,current_pickup.status,p_status,(select auth.uid()),nullif(trim(p_notes),''));
  insert into public.audit_logs(actor_id,organization_id,entity_type,entity_id,action,old_data,new_data)
  values((select auth.uid()),current_pickup.requester_organization_id,'pickup_request',p_pickup_id,'municipal_status_update',to_jsonb(current_pickup),to_jsonb(updated_pickup));
  return updated_pickup;
end;
$$;
revoke all on function public.municipal_update_pickup_status(uuid, public.pickup_status, text) from public, anon;
grant execute on function public.municipal_update_pickup_status(uuid, public.pickup_status, text) to authenticated;

grant select on public.organizations, public.sites, public.waste_declarations, public.pickup_requests, public.pickup_items to authenticated;
