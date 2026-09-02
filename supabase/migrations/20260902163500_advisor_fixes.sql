create policy municipalities_authenticated_read on public.municipalities for select to authenticated using (true);
grant select on public.municipalities to authenticated;

drop function if exists public.onboard_company(text,text,text,text,text,text,text,text,text);

create index audit_logs_actor_idx on public.audit_logs(actor_id);
create index certificates_org_idx on public.certificates(organization_id);
create index memberships_org_idx on public.memberships(organization_id);
create index organizations_municipality_idx on public.organizations(municipality_id);
create index pickup_items_declaration_idx on public.pickup_items(declaration_id);
create index pickup_requests_driver_idx on public.pickup_requests(assigned_driver_id) where assigned_driver_id is not null;
create index pickup_requests_requested_by_idx on public.pickup_requests(requested_by);
create index pickup_requests_site_idx on public.pickup_requests(site_id);
create index pickup_status_changed_by_idx on public.pickup_status_history(changed_by);
create index declarations_declared_by_idx on public.waste_declarations(declared_by);
create index declarations_waste_type_idx on public.waste_declarations(waste_type_id);
