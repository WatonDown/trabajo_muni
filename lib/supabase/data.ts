import { createClient } from "./client";
export type WasteRow = { id:string; code:string; quantity:number; unit:string; generated_on:string; status:string; waste_types:{name:string}|null };
export type MunicipalOperation = {
  id:string; code:string; status:string; priority:string; preferred_date:string;
  time_window_start:string; time_window_end:string; contact_name:string; contact_phone:string;
  requester_organization_id:string;
  organizations:{legal_name:string;trade_name:string|null;rut:string;commune:string|null}|null;
  sites:{address_line:string;commune:string}|null;
  pickup_items:{estimated_quantity:number;unit:string; waste_declarations:{waste_types:{name:string}|null}|null}[];
};

export type MunicipalWorkspace = {
  user:{id:string;email?:string|null};
  membership:{organization_id:string;role:string;organizations:{legal_name:string;municipality_id:string|null;kind:string}|null};
  operations:MunicipalOperation[];
};

export async function getWorkspace() {
  const supabase=createClient(); if(!supabase)return null;
  const {data:{user}}=await supabase.auth.getUser(); if(!user)return null;
  const {data:membership}=await supabase.from("memberships").select("organization_id, organizations(id, legal_name, trade_name, rut)").eq("user_id",user.id).eq("is_active",true).maybeSingle();
  if(!membership)return {user,membership:null,waste:[]};
  const {data:waste,error}=await supabase.from("waste_declarations").select("id, code, quantity, unit, generated_on, status, waste_types(name)").eq("organization_id",membership.organization_id).order("created_at",{ascending:false}).limit(50);
  if(error)throw error; return {user,membership,waste:(waste??[]) as unknown as WasteRow[]};
}

export async function declareWaste(input:{typeName:string;quantity:number;unit:string;generatedOn:string;containerType:string;storageLocation:string;purchaseDocument:string;observations:string}) {
  const supabase=createClient(); if(!supabase)return null; const {data:{user}}=await supabase.auth.getUser(); if(!user)return null;
  const [{data:member},{data:type}]=await Promise.all([supabase.from("memberships").select("organization_id").eq("user_id",user.id).eq("is_active",true).single(),supabase.from("waste_types").select("id").eq("name",input.typeName).single()]);
  if(!member||!type)throw new Error("No se encontró la empresa o el tipo de residuo.");
  const {data:site}=await supabase.from("sites").select("id").eq("organization_id",member.organization_id).eq("is_active",true).limit(1).single(); if(!site)throw new Error("La empresa no tiene un establecimiento activo.");
  const {data,error}=await supabase.from("waste_declarations").insert({organization_id:member.organization_id,site_id:site.id,waste_type_id:type.id,declared_by:user.id,code:"",quantity:input.quantity,unit:input.unit,generated_on:input.generatedOn,container_type:input.containerType||null,storage_location:input.storageLocation||null,purchase_document_number:input.purchaseDocument||null,observations:input.observations||null}).select("id, code, quantity, unit, generated_on, status, waste_types(name)").single();
  if(error)throw error; return data as unknown as WasteRow;
}

export async function createPickup(input:{preferredDate:string;start:string;end:string;contactName:string;contactPhone:string;instructions:string}) {
  const supabase=createClient(); if(!supabase)return null; const {data:{user}}=await supabase.auth.getUser(); if(!user)return null;
  const {data:member}=await supabase.from("memberships").select("organization_id").eq("user_id",user.id).eq("is_active",true).single(); if(!member)throw new Error("No se encontró la empresa.");
  const [{data:site},{data:declarations}]=await Promise.all([supabase.from("sites").select("id").eq("organization_id",member.organization_id).eq("is_active",true).limit(1).single(),supabase.from("waste_declarations").select("id, quantity, unit").eq("organization_id",member.organization_id).eq("status","available").eq("available_for_pickup",true)]);
  if(!site||!declarations?.length)throw new Error("No hay residuos disponibles para retirar.");
  const {data:pickup,error}=await supabase.from("pickup_requests").insert({requester_organization_id:member.organization_id,site_id:site.id,requested_by:user.id,code:"",preferred_date:input.preferredDate,time_window_start:input.start,time_window_end:input.end,access_instructions:input.instructions||null,contact_name:input.contactName,contact_phone:input.contactPhone}).select("id").single(); if(error)throw error;
  const {error:itemsError}=await supabase.from("pickup_items").insert(declarations.map(d=>({pickup_request_id:pickup.id,declaration_id:d.id,estimated_quantity:d.quantity,unit:d.unit}))); if(itemsError)throw itemsError;
  await supabase.from("waste_declarations").update({status:"assigned"}).in("id",declarations.map(d=>d.id)); return pickup;
}

/** Datos operativos para personal municipal. La autorización se aplica nuevamente con RLS. */
export async function getMunicipalWorkspace():Promise<MunicipalWorkspace|null> {
  const supabase=createClient(); if(!supabase)return null;
  const {data:{user}}=await supabase.auth.getUser(); if(!user)return null;
  const {data:membership,error:memberError}=await supabase.from("memberships")
    .select("organization_id, role, organizations(legal_name, municipality_id, kind)")
    .eq("user_id",user.id).eq("is_active",true)
    .in("role",["municipal_admin","municipal_inspector"]).maybeSingle();
  if(memberError)throw memberError;
  if(!membership)return {user,membership:null,operations:[]} as unknown as MunicipalWorkspace;
  const {data:operations,error}=await supabase.from("pickup_requests").select(
    "id, code, status, priority, preferred_date, time_window_start, time_window_end, contact_name, contact_phone, requester_organization_id, organizations!pickup_requests_requester_organization_id_fkey(legal_name,trade_name,rut,commune), sites(address_line,commune), pickup_items(estimated_quantity,unit,waste_declarations(waste_types(name)))"
  ).order("preferred_date",{ascending:true}).limit(100);
  if(error)throw error;
  return {user,membership:membership as unknown as MunicipalWorkspace["membership"],operations:(operations??[]) as unknown as MunicipalOperation[]};
}

export async function updateMunicipalPickup(input:{pickupId:string;status:string;notes?:string}) {
  const supabase=createClient(); if(!supabase)throw new Error("Configura la conexión con Supabase.");
  const {data:{user}}=await supabase.auth.getUser(); if(!user)throw new Error("Tu sesión expiró.");
  const {data,error}=await supabase.rpc("municipal_update_pickup_status",{p_pickup_id:input.pickupId,p_status:input.status,p_notes:input.notes??null});
  if(error)throw error;
  return data;
}
