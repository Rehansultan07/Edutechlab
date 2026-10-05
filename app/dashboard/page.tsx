"use client";

import Link from "next/link";
import { LayoutDashboard, Users, GraduationCap, ClipboardCheck, WalletCards, FileText, Bell, Settings, Menu, X, ChevronRight, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const nav = [["Dashboard","/dashboard",LayoutDashboard],["Students","/students",Users],["Teachers","/teachers",GraduationCap],["Attendance","/attendance",ClipboardCheck],["Fees","/fees",WalletCards],["Exams & Results","/exams",FileText],["Notices","/notices",Bell]] as const;
type Stats={students:number;teachers:number;attendance:number|null;fees:number};
type Profile={full_name:string;login_id:string|null;organization_id:string;organizations:{name:string}|null};

export default function Dashboard(){
 const supabase=createClient();
 const [open,setOpen]=useState(false),[profile,setProfile]=useState<Profile|null>(null),[stats,setStats]=useState<Stats>({students:0,teachers:0,attendance:null,fees:0}),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{(async()=>{
  const {data:{user}}=await supabase.auth.getUser(); if(!user){window.location.href="/login";return;}
  const {data:p,error:pError}=await supabase.from("profiles").select("full_name,login_id,organization_id,organizations(name)").eq("id",user.id).single();
  if(pError||!p){setError("We couldn't load your institute workspace.");setLoading(false);return;}
  setProfile(p as unknown as Profile); const orgId=p.organization_id;
  const today=new Date().toISOString().slice(0,10), monthStart=new Date(); monthStart.setDate(1);
  const monthDate=monthStart.toISOString().slice(0,10);
  const [students,teachers,attendance,fees]=await Promise.all([
   supabase.from("students").select("id",{count:"exact",head:true}).eq("organization_id",orgId).eq("status","active"),
   supabase.from("teachers").select("id",{count:"exact",head:true}).eq("organization_id",orgId),
   supabase.from("attendance").select("status").eq("organization_id",orgId).eq("attendance_date",today),
   supabase.from("fee_payments").select("amount").eq("organization_id",orgId).gte("paid_on",monthDate)
  ]);
  const present=attendance.data?.filter((x:{status:string})=>x.status==="present").length??0,marked=attendance.data?.filter((x:{status:string})=>x.status==="present"||x.status==="absent").length??0;
  setStats({students:students.count??0,teachers:teachers.count??0,attendance:marked?Math.round(present/marked*1000)/10:null,fees:(fees.data??[]).reduce((s,r)=>s+Number(r.amount??0),0)});
  setLoading(false);
 })()},[]);
 const instituteName=profile?.organizations?.name||"Your Institute",firstName=profile?.full_name?.trim()?.split(/\\s+/)[0]||"Admin",initials=(profile?.full_name||"A").split(/\\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();
 return <div className="min-h-screen bg-slate-50">
  <aside className={`fixed inset-y-0 left-0 z-30 w-64 border-r bg-white p-5 transition-transform lg:translate-x-0 ${open?"translate-x-0":"-translate-x-full"}`}><div className="flex items-center justify-between"><div><div className="text-xl font-bold">EduTechLab</div><div className="mt-1 max-w-[190px] truncate text-xs text-slate-500">{instituteName}</div></div><button className="lg:hidden" onClick={()=>setOpen(false)}><X size={20}/></button></div><nav className="mt-8 space-y-1">{nav.map(([label,href,Icon])=><Link key={label} href={href} onClick={()=>setOpen(false)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${href==="/dashboard"?"bg-slate-900 text-white":"text-slate-600 hover:bg-slate-100"}`}><Icon size={18}/>{label}</Link>)}</nav><div className="absolute bottom-5 left-5 right-5"><Link href="/settings" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100"><Settings size={18}/>Settings</Link></div></aside>
  <div className="lg:pl-64"><header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/95 px-5 backdrop-blur"><button className="lg:hidden" onClick={()=>setOpen(true)}><Menu/></button><div className="hidden items-center gap-2 text-sm text-slate-500 sm:flex"><span>{instituteName}</span><ChevronRight size={15}/><span className="font-medium text-slate-900">Dashboard</span></div><div className="flex items-center gap-3"><div className="hidden items-center gap-2 rounded-lg border bg-white px-3 py-2 sm:flex"><Search size={16} className="text-slate-400"/><span className="text-sm text-slate-400">Search...</span></div><div title={profile?.full_name||"Admin"} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">{initials}</div></div></header>
   <main className="mx-auto max-w-7xl p-5 sm:p-8">{error?<div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">{error}</div>:<>
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-slate-500">{instituteName}</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Good to see you, {firstName}.</h1><p className="mt-2 text-sm text-slate-500">Here’s the live overview of your institute.</p></div><Link href="/students" className="rounded-xl bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white">+ Add Student</Link></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Total Students",loading?"—":String(stats.students),"Active students"],["Teachers",loading?"—":String(stats.teachers),"Staff records"],["Attendance Today",loading?"—":stats.attendance===null?"Not marked":stats.attendance+"%","Based on today’s marked attendance"],["Fees This Month",loading?"—":stats.fees.toLocaleString("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}),"Recorded payments"]].map(([a,b,c])=><div key={a} className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{a}</p><p className="mt-2 text-2xl font-bold">{b}</p><p className="mt-1 text-xs text-slate-500">{c}</p></div>)}</div>
    <div className="mt-6 grid gap-6 lg:grid-cols-3"><section className="rounded-2xl border bg-white p-5 lg:col-span-2"><div className="flex items-center justify-between"><h2 className="font-semibold">Your workspace</h2><span className="text-xs text-slate-400">{profile?.login_id||"Institute admin"}</span></div><div className="mt-5 rounded-xl bg-slate-50 p-5"><p className="text-sm font-medium text-slate-800">Your institute workspace is ready.</p><p className="mt-1 text-sm leading-6 text-slate-500">Start by adding students, teachers and attendance records. Dashboard numbers will update from your institute’s own data.</p></div></section><section className="rounded-2xl border bg-white p-5"><h2 className="font-semibold">Quick actions</h2><div className="mt-4 space-y-2">{[["Add student","/students"],["Mark attendance","/attendance"],["Record fee payment","/fees"],["Create notice","/notices"]].map(([x,h])=><Link href={h} key={x} className="flex w-full items-center justify-between rounded-xl border px-3 py-3 text-sm hover:bg-slate-50">{x}<ChevronRight size={16}/></Link>)}</div></section></div>
   </>}</main></div></div>
}