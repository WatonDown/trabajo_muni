"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell, Building2, CalendarDays, ChevronDown, CircleHelp, Clock3, Droplets,
  FileCheck2, FileText, Gauge, History, Home, Leaf, Menu, Moon, PackageCheck,
  Plus, Recycle, Search, Settings, Sun, Truck, X, CheckCircle2, AlertTriangle,
  ArrowUpRight, MapPin, UserRound, LogOut, LogIn, SlidersHorizontal
} from "lucide-react";
import Link from "next/link";
import { createPickup, declareWaste, getWorkspace } from "@/lib/supabase/data";
import { CertificatesView, HelpView, HistoryView, PickupView, SettingsView, WasteView } from "@/components/module-views";
import { createClient } from "@/lib/supabase/client";

type Waste = { id: string; type: string; quantity: number; unit: string; date: string; status: "Disponible" | "Retiro solicitado" | "Retirado"; code: string };

const initialWaste: Waste[] = [
  { id: "1", type: "Aceite vegetal usado", quantity: 48, unit: "L", date: "28 ago 2026", status: "Disponible", code: "RES-2026-0842" },
  { id: "2", type: "Cartón y papel", quantity: 120, unit: "kg", date: "24 ago 2026", status: "Retiro solicitado", code: "RES-2026-0811" },
  { id: "3", type: "Vidrio", quantity: 76, unit: "kg", date: "18 ago 2026", status: "Retirado", code: "RES-2026-0789" },
  { id: "4", type: "Plásticos PET", quantity: 35, unit: "kg", date: "12 ago 2026", status: "Retirado", code: "RES-2026-0756" }
];

const nav = [
  ["Resumen", Home], ["Mis residuos", Recycle], ["Solicitudes", Truck],
  ["Certificados", FileCheck2], ["Historial", History]
] as const;

export default function Dashboard() {
  const [dark, setDark] = useState(false);
  const [active, setActive] = useState("Resumen");
  const [mobile, setMobile] = useState(false);
  const [profile, setProfile] = useState(false);
  const [modal, setModal] = useState<"waste" | "pickup" | null>(null);
  const [toast, setToast] = useState("");
  const [waste, setWaste] = useState(initialWaste);
  const [query, setQuery] = useState("");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("circular-theme") === "dark";
    setDark(saved);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("circular-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => { getWorkspace().then(ws => {
    if (!ws?.membership) return;
    setConnected(true);
    if (ws.waste.length) setWaste(ws.waste.map((w, i) => ({ id:w.id, type:w.waste_types?.name ?? "Residuo", quantity:Number(w.quantity), unit:w.unit === "unit" ? "unidades" : w.unit, date:new Intl.DateTimeFormat("es-CL",{day:"numeric",month:"short",year:"numeric"}).format(new Date(`${w.generated_on}T12:00:00`)), status:w.status === "available" ? "Disponible" : w.status === "collected" || w.status === "recycled" ? "Retirado" : "Retiro solicitado", code:w.code })));
  }).catch(() => notify("No fue posible sincronizar con Supabase")); }, []);

  const filtered = useMemo(() => waste.filter(w => `${w.type} ${w.code}`.toLowerCase().includes(query.toLowerCase())), [waste, query]);
  const notify = (message: string) => { setToast(message); setTimeout(() => setToast(""), 3500); };

  async function addWaste(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const type = String(data.get("type"));
    const quantity = Number(data.get("quantity"));
    const unit = String(data.get("unit"));
    try {
      const saved = await declareWaste({typeName:type,quantity,unit:unit === "unidades" ? "unit" : unit,generatedOn:String(data.get("generatedOn")),containerType:String(data.get("containerType")||""),storageLocation:String(data.get("storageLocation")||""),purchaseDocument:String(data.get("purchaseDocument")||""),observations:String(data.get("observations")||"")});
      setWaste(prev => [{ id:saved?.id ?? crypto.randomUUID(), type, quantity, unit, date:"2 sep 2026", status:"Disponible", code:saved?.code ?? `RES-DEMO-${String(843+prev.length).padStart(4,"0")}` },...prev]);
      setModal(null); notify(connected ? "Residuo guardado y sincronizado con Supabase" : "Residuo declarado en modo demostración");
    } catch(error) { notify(error instanceof Error ? error.message : "No se pudo guardar la declaración"); }
  }

  async function requestPickup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const data=new FormData(e.currentTarget);
    try { await createPickup({preferredDate:String(data.get("preferredDate")),start:String(data.get("start")),end:String(data.get("end")),contactName:String(data.get("contactName")),contactPhone:String(data.get("contactPhone")),instructions:String(data.get("instructions")||"")}); setModal(null); notify(connected?"Solicitud registrada en Supabase":"Solicitud creada en modo demostración"); }
    catch(error){notify(error instanceof Error?error.message:"No se pudo solicitar el retiro");}
  }

  async function signOut(){ const client=createClient(); if(client) await client.auth.signOut(); setConnected(false); setProfile(false); notify("Sesión cerrada correctamente"); }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="brand"><span className="brand-mark"><Recycle size={24}/></span><span>Circular<span>Muni</span></span></div>
        <button className="close-mobile" onClick={() => setMobile(false)} aria-label="Cerrar menú"><X/></button>
        <div className="org-card"><div className="org-icon"><Building2 size={19}/></div><div><small>Empresa</small><strong>Mercado Central SpA</strong><span>RUT 76.432.198-5</span></div></div>
        <nav>
          <p>GESTIÓN</p>
          {nav.map(([label, Icon]) => <button key={label} className={active === label ? "active" : ""} onClick={() => {setActive(label); setMobile(false)}}><Icon size={19}/><span>{label}</span>{label === "Solicitudes" && <b>1</b>}</button>)}
          <p>SOPORTE</p>
          <button className={active === "Centro de ayuda" ? "active" : ""} onClick={() => {setActive("Centro de ayuda");setMobile(false)}}><CircleHelp size={19}/><span>Centro de ayuda</span></button>
          <button className={active === "Configuración" ? "active" : ""} onClick={() => {setActive("Configuración");setMobile(false)}}><Settings size={19}/><span>Configuración</span></button>
        </nav>
        <div className="sidebar-impact"><Leaf size={21}/><div><strong>Tu impacto importa</strong><span>284 kg recuperados este año</span></div></div>
        <div className="municipality"><span>En colaboración con</span><Link href="/municipal" title="Abrir panel municipal"><Building2 size={16}/> Municipalidad de Ñuñoa</Link></div>
      </aside>
      {mobile && <div className="overlay" onClick={() => setMobile(false)}/>} 

      <main>
        <header>
          <button className="menu-btn" onClick={() => setMobile(true)}><Menu/></button>
          <div className="mobile-brand"><Recycle size={23}/> CircularMuni</div>
          <div className="header-actions">
            <button className="icon-btn" onClick={() => setDark(!dark)} aria-label="Cambiar tema">{dark ? <Sun size={19}/> : <Moon size={19}/>}</button>
            <button className="icon-btn notification" onClick={() => {setActive("Historial");notify("Mostrando tu actividad reciente")}}><Bell size={19}/><i/></button>
            <div className="profile-wrap">
              <button className="profile" onClick={() => setProfile(!profile)}><span className="avatar">CM</span><span><strong>Carolina Muñoz</strong><small>Administradora</small></span><ChevronDown size={16}/></button>
              {profile && <div className="profile-menu"><button onClick={() => {setActive("Configuración");setProfile(false)}}><UserRound size={17}/> Mi perfil</button><button onClick={() => {setActive("Configuración");setProfile(false)}}><Settings size={17}/> Preferencias</button><hr/>{connected?<button onClick={signOut}><LogOut size={17}/> Cerrar sesión</button>:<Link href="/login" className="profile-link"><LogIn size={17}/> Ingresar con Supabase</Link>}</div>}
            </div>
          </div>
        </header>

        <div className="content">
          {active === "Resumen" && <><section className="welcome"><div><p className="eyebrow"><span/> Miércoles, 2 de septiembre</p><h1>Buenos días, Carolina</h1><p>Aquí tienes el resumen ambiental de tu empresa.</p></div><button className="primary" onClick={() => setModal("waste")}><Plus size={19}/> Declarar residuo</button></section>

          <section className="stats">
            <article><div className="stat-icon green"><Recycle/></div><div><span>Residuos declarados</span><strong>279,4 <small>kg</small></strong><p className="up">↑ 12% <span>vs. mes anterior</span></p></div></article>
            <article><div className="stat-icon amber"><Clock3/></div><div><span>Pendiente de retiro</span><strong>168 <small>kg</small></strong><p>2 tipos de residuos</p></div></article>
            <article><div className="stat-icon blue"><Truck/></div><div><span>Retiros completados</span><strong>8</strong><p>Último: 26 ago 2026</p></div></article>
            <article><div className="stat-icon purple"><Gauge/></div><div><span>Tasa de valorización</span><strong>94,8%</strong><p className="up">↑ 3,2% <span>este año</span></p></div></article>
          </section>

          <section className="pickup-banner">
            <div className="pickup-visual"><div className="road"/><span><Truck size={34}/></span></div>
            <div className="pickup-copy"><span className="tag">ACCIÓN RECOMENDADA</span><h2>¿Tienes residuos listos para retirar?</h2><p>Solicita un retiro y un gestor autorizado coordinará la recolección de forma segura.</p></div>
            <button onClick={() => setModal("pickup")}><Truck size={18}/> Solicitar retiro <ArrowUpRight size={17}/></button>
          </section>

          <div className="dashboard-grid">
            <section className="panel activity-panel">
              <div className="panel-head"><div><h2>Residuos recientes</h2><p>Últimas declaraciones registradas</p></div><button onClick={() => setActive("Mis residuos")}>Ver todos <ArrowUpRight size={15}/></button></div>
              <div className="search"><Search size={17}/><input placeholder="Buscar por residuo o código..." value={query} onChange={e => setQuery(e.target.value)}/><SlidersHorizontal size={17}/></div>
              <div className="table-wrap"><table><thead><tr><th>RESIDUO</th><th>CANTIDAD</th><th>FECHA</th><th>ESTADO</th></tr></thead><tbody>{filtered.map((w, i) => <tr key={w.id}><td><div className={`waste-icon w${i%4}`}>{i%4 === 0 ? <Droplets/> : i%4 === 1 ? <PackageCheck/> : <Recycle/>}</div><div><strong>{w.type}</strong><small>{w.code}</small></div></td><td><strong>{w.quantity} {w.unit}</strong></td><td>{w.date}</td><td><span className={`status ${w.status.replace(" ", "-").toLowerCase()}`}>{w.status === "Retirado" ? <CheckCircle2/> : w.status === "Retiro solicitado" ? <Clock3/> : <span className="dot"/>}{w.status}</span></td></tr>)}</tbody></table></div>
            </section>

            <aside className="right-col">
              <section className="panel next-pickup"><div className="panel-head"><div><h2>Próximo retiro</h2><p>Solicitud #SOL-0341</p></div><span className="confirmed">Confirmado</span></div><div className="date-card"><div><span>SEP</span><strong>04</strong></div><section><strong>Viernes, 4 de septiembre</strong><span><Clock3/> 09:00 – 12:00 hrs</span><span><MapPin/> Av. Irarrázaval 2450</span></section></div><div className="pickup-items"><span>Aceite vegetal usado <strong>48 L</strong></span><span>Cartón y papel <strong>120 kg</strong></span></div><button className="secondary" onClick={()=>setActive("Solicitudes")}>Ver detalle del retiro</button></section>
              <section className="panel compliance"><div className="compliance-top"><div className="ring"><span>92<small>%</small></span></div><div><span>CUMPLIMIENTO</span><h3>¡Excelente gestión!</h3><p>Tus declaraciones están al día.</p></div></div><div className="compliance-foot"><FileText size={18}/><span>Próxima declaración mensual<strong>10 de septiembre</strong></span></div></section>
            </aside>
          </div></>}
          {active === "Mis residuos" && <WasteView waste={waste} query={query} setQuery={setQuery} onDeclare={()=>setModal("waste")} onPickup={()=>setModal("pickup")} notify={notify}/>} 
          {active === "Solicitudes" && <PickupView waste={waste} query={query} setQuery={setQuery} onDeclare={()=>setModal("waste")} onPickup={()=>setModal("pickup")} notify={notify}/>} 
          {active === "Certificados" && <CertificatesView waste={waste} query={query} setQuery={setQuery} onDeclare={()=>setModal("waste")} onPickup={()=>setModal("pickup")} notify={notify}/>} 
          {active === "Historial" && <HistoryView waste={waste} query={query} setQuery={setQuery} onDeclare={()=>setModal("waste")} onPickup={()=>setModal("pickup")} notify={notify}/>} 
          {active === "Centro de ayuda" && <HelpView waste={waste} query={query} setQuery={setQuery} onDeclare={()=>setModal("waste")} onPickup={()=>setModal("pickup")} notify={notify}/>} 
          {active === "Configuración" && <SettingsView waste={waste} query={query} setQuery={setQuery} onDeclare={()=>setModal("waste")} onPickup={()=>setModal("pickup")} notify={notify}/>} 
          <footer><span>© 2026 CircularMuni · Plataforma de gestión ambiental</span><span><a onClick={()=>notify("Política de privacidad disponible para revisión")}>Privacidad</a><a onClick={()=>notify("Términos y condiciones disponibles para revisión")}>Términos</a><a onClick={()=>setActive("Centro de ayuda")}>Soporte</a></span></footer>
        </div>
      </main>

      {modal && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><div className="modal" onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={() => setModal(null)}><X/></button>{modal === "waste" ? <>
        <div className="modal-icon"><Recycle/></div><h2>Declarar nuevo residuo</h2><p>Registra el residuo generado para mantener su trazabilidad.</p>
        <form onSubmit={addWaste}><label>Tipo de residuo<select name="type" required defaultValue=""><option value="" disabled>Selecciona una categoría</option><option>Aceite vegetal usado</option><option>Cartón y papel</option><option>Vidrio</option><option>Plásticos PET</option><option>Residuos electrónicos</option><option>Metales</option></select></label><div className="form-row"><label>Cantidad<input name="quantity" type="number" min="0.1" step="0.1" placeholder="Ej. 10" required/></label><label>Unidad<select name="unit"><option>L</option><option>kg</option><option>unidades</option></select></label></div><div className="form-row"><label>Fecha de generación<input name="generatedOn" type="date" defaultValue="2026-09-02" required/></label><label>Tipo de contenedor<select name="containerType"><option>Bidón sellado</option><option>Tambor</option><option>Saco</option><option>Contenedor rígido</option><option>Caja</option></select></label></div><label>Ubicación de almacenamiento<input name="storageLocation" placeholder="Ej. Bodega posterior, zona señalizada" required/></label><label>N.º documento de compra/origen<input name="purchaseDocument" placeholder="Ej. Factura 18342 (opcional)"/></label><label>Observaciones<textarea name="observations" placeholder="Estado, condiciones o información adicional"/></label><div className="form-actions"><button type="button" className="secondary" onClick={() => setModal(null)}>Cancelar</button><button className="primary">Guardar declaración</button></div></form>
      </> : <>
        <div className="modal-icon truck"><Truck/></div><h2>Solicitar retiro</h2><p>Selecciona cuándo y qué material debe retirar el gestor.</p>
        <form onSubmit={requestPickup}><label>Dirección de retiro<input defaultValue="Av. Irarrázaval 2450, Ñuñoa" required readOnly/></label><label>Residuos disponibles<select required><option>Todos los residuos disponibles</option></select></label><div className="form-row"><label>Fecha preferida<input name="preferredDate" type="date" min="2026-09-03" defaultValue="2026-09-04" required/></label><label>Prioridad<select><option>Normal</option><option>Alta</option><option>Urgente</option></select></label></div><div className="form-row"><label>Desde<input name="start" type="time" defaultValue="09:00" required/></label><label>Hasta<input name="end" type="time" defaultValue="12:00" required/></label></div><div className="form-row"><label>Persona de contacto<input name="contactName" defaultValue="Carolina Muñoz" required/></label><label>Teléfono<input name="contactPhone" defaultValue="+56 9 1234 5678" required/></label></div><label>Indicaciones<textarea name="instructions" placeholder="Ej. Ingresar por acceso de carga"/></label><div className="notice"><AlertTriangle size={18}/> La fecha quedará sujeta a confirmación del gestor autorizado.</div><div className="form-actions"><button type="button" className="secondary" onClick={() => setModal(null)}>Cancelar</button><button className="primary">Enviar solicitud</button></div></form>
      </>}</div></div>}
      {toast && <div className="toast"><CheckCircle2/>{toast}</div>}
    </div>
  );
}
