"use client";
import{useEffect,useMemo,useState}from"react";
import{ArrowLeft,Check,Plus,ShieldCheck,UserCog,X,Power}from"lucide-react";
import{createClient}from"@/lib/supabase/client";

type Staff={id:string;full_name:string;role:string;login_id:string|null;is_active:boolean;phone:string|null};
type Permission={id:string;code:string;name:string;module:string};
type RolePermission={role:string;permission_id:string;enabled:boolean};

const starterRoles=["teacher","accountant","receptionist","exam_coordinator"];
const labelRole=(r:string)=>r.split("_").map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(" ");

export default function StaffPage(){
 const s=createClient();
 const[org,setOrg]=useState("");const[staff,setStaff]=useState<Staff[]>([]);const[permissions,setPermissions]=useState<Permission[]>([]);const[rolePerms,setRolePerms]=useState<RolePermission[]>([]);
 const[open,setOpen]=useState(false);const[roleOpen,setRoleOpen]=useState(false);const[selectedRole,setSelectedRole]=useState("teacher");const[customRole,setCustomRole]=useState("");
 const[form,setForm]=useState({fullName:"",email:"",password:"",role:"teacher"});const[busy,setBusy]=useState(false);const[error,setError]=useState("");const[saved,setSaved]=useState("");

 const load=async()=>{
  setError("");
  const{data:{user}}=await s.auth.getUser();if(!user)return;
  const{data:p,error:pe}=await s.from("profiles").select("organization_id,role").eq("id",user.id).single();
  if(pe||!p){setError("Could not load staff workspace.");return}
  if(!["owner","admin"].includes(p.role)){setError("You do not have permission to manage staff.");return}
  setOrg(p.organization_id);
  const[a,b,c]=await Promise.all([
   s.from("profiles").select("id,full_name,role,login_id,is_active,phone").eq("organization_id",p.organization_id).in("role",["owner","admin","teacher","accountant","receptionist","exam_coordinator"]).order("created_at",{ascending:false}),
   s.from("permissions").select("id,code,name,module").order("module").order("name"),
   s.from("role_permissions").select("role,permission_id,enabled").eq("organization_id",p.organization_id)
  ]);
  if(a.error||b.error||c.error)setError((a.error||b.error||c.error)?.message||"Could not load staff.");
  else{setStaff(a.data||[]);setPermissions(b.data||[]);setRolePerms(c.data||[])}
 };
 useEffect(()=>{load()},[]);

 const roles=useMemo(()=>Array.from(new Set([...starterRoles,...staff.map(x=>x.role).filter(r=>!["owner","admin"].includes(r)),...rolePerms.map(x=>x.role)])).sort(),[staff,rolePerms]);
 const grouped=useMemo(()=>permissions.reduce<Record<string,Permission[]>>((a,p)=>(a[p.module]??=[],a[p.module].push(p),a),{}),[permissions]);
 const enabled=(role:string,id:string)=>rolePerms.some(x=>x.role===role&&x.permission_id===id&&x.enabled);
 const toggle=(role:string,id:string)=>setRolePerms(prev=>{const i=prev.findIndex(x=>x.role===role&&x.permission_id===id);if(i>=0){const n=[...prev];n[i]={...n[i],enabled:!n[i].enabled};return n}return[...prev,{role,permission_id:id,enabled:true}]});
 const saveRole=async()=>{
  setBusy(true);setError("");setSaved("");
  try{
   await s.from("role_permissions").delete().eq("organization_id",org).eq("role",selectedRole);
   const rows=permissions.filter(p=>enabled(selectedRole,p.id)).map(p=>({organization_id:org,role:selectedRole,permission_id:p.id,enabled:true}));
   if(rows.length){const r=await s.from("role_permissions").insert(rows);if(r.error)throw r.error}
   setSaved("Role permissions saved.");await load();
  }catch(e:any){setError(e.message||"Could not save permissions")}finally{setBusy(false)}
 };
 const createStaff=async()=>{
  setBusy(true);setError("");setSaved("");
  try{
   const role=(customRole.trim()||form.role).toLowerCase().replace(/[^a-z0-9_ -]/g,"").replace(/\s+/g,"_");
   if(!role)throw new Error("Select or enter a role.");
   const codes=permissions.filter(p=>enabled(role,p.id)).map(p=>p.code);
   const{data,error:e}=await s.functions.invoke("create-staff",{body:{fullName:form.fullName,email:form.email,password:form.password,role,permissionCodes:codes}});
   if(e)throw new Error(e.message);
   if(!data?.loginId)throw new Error(data?.error||"Could not create staff.");
   setSaved(`Staff created. Login ID: ${data.loginId}`);
   setOpen(false);setForm({fullName:"",email:"",password:"",role:"teacher"});setCustomRole("");await load();
  }catch(e:any){setError(e.message||"Could not create staff")}finally{setBusy(false)}
 };
 const toggleActive=async(r:Staff)=>{
  if(r.role==="owner")return;
  setError("");const q=await s.from("profiles").update({is_active:!r.is_active}).eq("id",r.id);
  if(q.error)setError(q.error.message);else load();
 };

 return <main className="mx-auto max-w-7xl p-5 sm:p-8">
  <button onClick={()=>window.history.back()} className="mb-5 inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm text-slate-600"><ArrowLeft size={16}/>Back</button>
  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm text-slate-500">Administration</p><h1 className="mt-1 text-3xl font-bold">Staff & permissions</h1><p className="mt-2 text-sm text-slate-500">Create staff accounts, assign roles and control exactly which modules they can use.</p></div><div className="flex gap-2"><button onClick={()=>setRoleOpen(true)} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold"><ShieldCheck size={17}/>Role permissions</button><button onClick={()=>setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={17}/>Add staff</button></div></div>
  {error&&<div className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}{saved&&<div className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-700">{saved}</div>}
  <section className="mt-7 overflow-hidden rounded-2xl border bg-white"><div className="border-b p-5"><h2 className="font-semibold">Staff accounts</h2><p className="mt-1 text-xs text-slate-500">Owner and admin have full access. Other roles use the permission matrix below.</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3">Staff</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Login ID</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Access</th></tr></thead><tbody>{staff.map(r=><tr key={r.id} className="border-t"><td className="px-5 py-4"><div className="font-medium">{r.full_name}</div><div className="text-xs text-slate-400">{r.phone||"Staff account"}</div></td><td className="px-5 py-4 font-medium">{labelRole(r.role)}</td><td className="px-5 py-4 font-mono text-xs">{r.login_id||"—"}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.is_active?"bg-green-50 text-green-700":"bg-slate-100 text-slate-500"}`}>{r.is_active?"Active":"Disabled"}</span></td><td className="px-5 py-4 text-right"><button disabled={r.role==="owner"} onClick={()=>toggleActive(r)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold"><Power size={14}/>{r.is_active?"Disable":"Enable"}</button></td></tr>)}</tbody></table></div></section>

  {open&&<div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4"><div className="mx-auto my-8 w-full max-w-xl rounded-2xl bg-white p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Create staff account</h2><p className="mt-1 text-xs text-slate-500">The staff member can sign in using the generated Staff ID and password.</p></div><button onClick={()=>setOpen(false)}><X/></button></div><div className="mt-5 grid gap-4"><label className="text-sm">Full name<input value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})} className="mt-1 w-full rounded-xl border px-3 py-2.5"/></label><label className="text-sm">Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="mt-1 w-full rounded-xl border px-3 py-2.5"/></label><label className="text-sm">Temporary password<input type="password" minLength={8} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className="mt-1 w-full rounded-xl border px-3 py-2.5"/><span className="text-xs text-slate-400">Minimum 8 characters.</span></label><label className="text-sm">Role<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} className="mt-1 w-full rounded-xl border px-3 py-2.5">{starterRoles.map(r=><option key={r} value={r}>{labelRole(r)}</option>)}<option value="custom">Custom role…</option></select></label>{form.role==="custom"&&<label className="text-sm">Custom role name<input value={customRole} onChange={e=>setCustomRole(e.target.value)} placeholder="e.g. librarian" className="mt-1 w-full rounded-xl border px-3 py-2.5"/></label>}<div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600">After creating the account, use <b>Role permissions</b> to fine-tune this role.</div></div><button disabled={busy} onClick={createStaff} className="mt-5 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white">{busy?"Creating…":"Create staff account"}</button></div></div>}

  {roleOpen&&<div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4"><div className="mx-auto my-6 w-full max-w-4xl rounded-2xl bg-white p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Role permissions</h2><p className="mt-1 text-xs text-slate-500">Changes apply to every staff account with the selected role.</p></div><button onClick={()=>setRoleOpen(false)}><X/></button></div><div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr]"><div className="space-y-2">{roles.map(r=><button key={r} onClick={()=>setSelectedRole(r)} className={`w-full rounded-xl border px-3 py-3 text-left text-sm ${selectedRole===r?"border-slate-900 bg-slate-900 text-white":"bg-white"}`}>{labelRole(r)}</button>)}</div><div>{selectedRole==="owner"||selectedRole==="admin"?<div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">Owner and Admin have full access and do not need individual permission switches.</div>:<div className="space-y-5">{Object.entries(grouped).map(([module,items])=><div key={module} className="rounded-xl border p-4"><div className="font-semibold">{module}</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{items.map(p=><label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" checked={enabled(selectedRole,p.id)} onChange={()=>toggle(selectedRole,p.id)} className="h-4 w-4"/><span><span className="font-medium">{p.name}</span><span className="block text-[11px] text-slate-400">{p.code}</span></span></label>)}</div></div>)}<button disabled={busy} onClick={saveRole} className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white">{busy?"Saving…":"Save role permissions"}</button></div>}</div></div></div></div>}
 </main>
}