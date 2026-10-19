"use client";

import Link from "next/link";
import { LayoutDashboard, Users, GraduationCap, ClipboardCheck, WalletCards, FileText, Bell, Settings, Menu, X, ChevronRight, Search, ShieldCheck, BookOpen, CreditCard, Sparkles, AlertCircle, Printer, Award, Receipt, Calendar, Cake } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import InstallButton from "@/components/pwa/InstallButton";

const nav = [
 ["Dashboard","/dashboard",LayoutDashboard,[]],
 ["Students","/students",Users,["students.view","students.manage","admissions.manage"]],
 ["ID Cards","/id-cards",Printer,["students.view"]],
 ["Certificates & TC","/certificates",Award,["students.manage"]],
 ["Academics","/academics",BookOpen,["settings.manage","students.manage"]],
 ["Class Timetable","/timetable",Calendar,["settings.manage"]],
 ["Daily Homework","/homework",BookOpen,["students.view"]],
 ["Teachers","/teachers",GraduationCap,["teachers.view","teachers.manage"]],
 ["Attendance","/attendance",ClipboardCheck,["attendance.view","attendance.manage"]],
 ["Fees & Receipts","/fees",WalletCards,["fees.view","fees.manage","fees.receipts"]],
 ["School Expenses","/expenses",Receipt,["settings.manage"]],
 ["Exams & Results","/exams",FileText,["exams.view","exams.manage","results.manage"]],
 ["Notices","/notices",Bell,["notices.manage"]],
 ["Staff & Permissions","/staff",ShieldCheck,["staff.manage"]],
 ["Subscription","/subscription",CreditCard,["settings.manage"]],
 ["Settings","/settings",Settings,["settings.manage"]]
] as const;
type PermissionCode=string;
type Stats={students:number;teachers:number;attendance:number|null;fees:number};
type Profile={full_name:string;login_id:string|null;organization_id:string;role:string;organizations:{name:string}|null};

export default function Dashboard(){
 const supabase=createClient();
 const [open,setOpen]=useState(false),[profile,setProfile]=useState<Profile|null>(null),[permissions,setPermissions]=useState<Set<string>>(new Set()),[stats,setStats]=useState<Stats>({students:0,teachers:0,attendance:null,fees:0}),[subInfo,setSubInfo]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[birthdays,setBirthdays]=useState<any[]>([]),[monthlyExpense,setMonthlyExpense]=useState<number>(0);
 useEffect(()=>{(async()=>{
  const {data:{user}}=await supabase.auth.getUser(); if(!user){window.location.href="/login";return;}
  const {data:p,error:pError}=await supabase.from("profiles").select("full_name,login_id,organization_id,role,organizations(name)").eq("id",user.id).single();
  if(pError||!p){setError("We couldn't load your institute workspace.");setLoading(false);return;}
  setProfile(p as unknown as Profile); const orgId=p.organization_id;
  const role=String(p.role||"").trim().toLowerCase(); const isAdmin=role==="owner"||role==="admin";
  if(!isAdmin){window.location.replace("/staff-dashboard");return;}
  let granted=new Set<string>();
  if(isAdmin){granted=new Set(nav.flatMap(x=>x[3]))}else{
   const {data:grants}=await supabase.from("staff_permissions").select("permissions(code)").eq("staff_id",user.id).eq("organization_id",orgId).eq("enabled",true);
   granted=new Set((grants??[]).map((g:any)=>g.permissions?.code).filter(Boolean));
  }
  setPermissions(granted);
  const today=new Date().toISOString().slice(0,10), monthStart=new Date(); monthStart.setDate(1);
  const monthDate=monthStart.toISOString().slice(0,10);
  const can=(code:string)=>isAdmin||granted.has(code);
  const canAny=(codes:readonly string[])=>isAdmin||codes.some(code=>granted.has(code));
  const [students,teachers,attendance,fees,subRes,bdayRes,expRes]=await Promise.all([
   canAny(["students.view","students.manage","admissions.manage"])?supabase.from("students").select("id",{count:"exact",head:true}).eq("organization_id",orgId).eq("status","active"):Promise.resolve({count:0}),
   canAny(["teachers.view","teachers.manage"])?supabase.from("teachers").select("id",{count:"exact",head:true}).eq("organization_id",orgId):Promise.resolve({count:0}),
   canAny(["attendance.view","attendance.manage"])?supabase.from("attendance").select("status").eq("organization_id",orgId).eq("attendance_date",today):Promise.resolve({data:[]}),
   canAny(["fees.view","fees.manage","fees.receipts"])?supabase.from("fee_payments").select("amount").eq("organization_id",orgId).gte("paid_on",monthDate):Promise.resolve({data:[]}),
   supabase.rpc("get_institution_subscription",{p_org_id:orgId}),
   supabase.from("students").select("id,first_name,last_name,date_of_birth,class_id").eq("organization_id",orgId).not("date_of_birth","is",null),
   supabase.from("school_expenses").select("amount").eq("organization_id",orgId).gte("expense_date",monthDate)
  ]);
  
  // Calculate birthdays
  const todayMMDD = today.slice(5); // MM-DD
  const todaysBdays = (bdayRes.data || []).filter((s:any) => s.date_of_birth && s.date_of_birth.slice(5) === todayMMDD);
  setBirthdays(todaysBdays);

  // Calculate monthly expenses
  let totalExp = (expRes.data || []).reduce((sum:number, r:any) => sum + Number(r.amount||0), 0);
  if (totalExp === 0 && typeof window !== "undefined") {
    try {
      const localExp = JSON.parse(localStorage.getItem(`edutechlab_expenses_${orgId}`) || "[]");
      totalExp = localExp.filter((e:any) => e.expense_date >= monthDate).reduce((s:number, r:any) => s + Number(r.amount||0), 0);
    } catch {}
  }
  setMonthlyExpense(totalExp);
  const present=attendance.data?.filter((x:{status:string})=>x.status==="present").length??0,marked=attendance.data?.filter((x:{status:string})=>x.status==="present"||x.status==="absent").length??0;
  setStats({students:students.count??0,teachers:teachers.count??0,attendance:marked?Math.round(present/marked*1000)/10:null,fees:(fees.data??[]).reduce((s,r)=>s+Number(r.amount??0),0)});
  if(subRes.data) setSubInfo(subRes.data);
  setLoading(false);
 })()},[]);
 const can=(code:string)=>{const role=String(profile?.role||"").trim().toLowerCase(); return (role==="owner"||role==="admin")||permissions.has(code)};
 const canAny=(codes:readonly string[])=>{const role=String(profile?.role||"").trim().toLowerCase(); return (role==="owner"||role==="admin")||codes.some(code=>permissions.has(code))};
 const visibleNav=nav.filter(([,href,,required])=>href==="/dashboard"||canAny(required));
 const instituteName=profile?.organizations?.name||"Your Institute",firstName=profile?.full_name?.trim()?.split(/\s+/)[0]||"Admin",initials=(profile?.full_name||"A").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();
 const statCards:any[]=[
  canAny(["students.view","students.manage","admissions.manage"])?{title:"Total Students",value:loading?"—":String(stats.students),sub:"Active enrolled students",icon:Users,border:"border-blue-100",iconBg:"bg-blue-50 text-blue-600"}:null,
  canAny(["teachers.view","teachers.manage"])?{title:"Total Teachers",value:loading?"—":String(stats.teachers),sub:"Assigned faculty records",icon:GraduationCap,border:"border-purple-100",iconBg:"bg-purple-50 text-purple-600"}:null,
  canAny(["attendance.view","attendance.manage"])?{title:"Today's Attendance",value:loading?"—":stats.attendance===null?"Not marked":stats.attendance+"%",sub:"Realtime attendance ratio",icon:ClipboardCheck,border:"border-emerald-100",iconBg:"bg-emerald-50 text-emerald-600"}:null,
  canAny(["fees.view","fees.manage","fees.receipts"])?{title:"Fees This Month",value:loading?"—":stats.fees.toLocaleString("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}),sub:"Recorded collections",icon:WalletCards,border:"border-amber-100",iconBg:"bg-amber-50 text-amber-600"}:null
 ].filter(Boolean);
 const quickActions:any[]=[
  can("students.manage")?["Add student","/students"]:null,
  ["Print ID Cards","/id-cards"],
  ["Issue Certificate / TC","/certificates"],
  can("attendance.manage")?["Mark attendance","/attendance"]:null,
  can("fees.manage")?["Record fee payment","/fees"]:null,
  ["School Expenses & Kharcha","/expenses"],
  ["Class Timetable Routine","/timetable"],
  ["Daily Homework Diary","/homework"],
  can("notices.manage")?["Create notice","/notices"]:null
].filter(Boolean);
 return <div className="min-h-screen bg-[#f8fafc]">
  <aside className={`fixed inset-y-0 left-0 z-30 w-64 border-r bg-white p-5 transition-transform lg:translate-x-0 ${open?"translate-x-0":"-translate-x-full"}`}>
   <div className="flex items-center justify-between"><div><div className="text-xl font-bold bg-gradient-to-r from-purple-700 to-indigo-600 bg-clip-text text-transparent">EduTechLab</div><div className="mt-1 max-w-[190px] truncate text-xs text-slate-500 font-medium">{instituteName}</div></div><button className="lg:hidden" onClick={()=>setOpen(false)}><X size={20}/></button></div>
   <nav className="mt-8 space-y-1">{visibleNav.map(([label,href,Icon])=><Link key={label} href={href} onClick={()=>setOpen(false)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${href==="/dashboard"?"bg-slate-900 text-white shadow-sm":"text-slate-600 hover:bg-slate-100"}`}><Icon size={18}/>{label}</Link>)}</nav>
   <div className="mt-6 space-y-2 border-t pt-4">
     
     <InstallButton className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-100 transition" />
   </div>
  </aside>
  <div className="lg:pl-64">
   <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/95 px-5 backdrop-blur"><button className="lg:hidden" onClick={()=>setOpen(true)}><Menu/></button><div className="hidden items-center gap-2 text-sm text-slate-500 sm:flex"><span>{instituteName}</span><ChevronRight size={15}/><span className="font-semibold text-slate-900">Dashboard</span></div><div className="flex items-center gap-3"><InstallButton /><div className="hidden items-center gap-2 rounded-lg border bg-white px-3 py-2 sm:flex"><Search size={16} className="text-slate-400"/><span className="text-sm text-slate-400">Search...</span></div><div title={profile?.full_name||"Admin"} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white shadow-sm">{initials}</div></div></header>
   <main className="mx-auto max-w-7xl p-5 sm:p-8">
    {error?<div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">{error}</div>:<>
     <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-0.5 text-xs font-bold text-purple-700 mb-1">
          <Sparkles size={12} /> {instituteName} Workspace
        </div>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">Good to see you, {firstName}.</h1>
        <p className="mt-1 text-sm text-slate-500 font-medium">Here’s the live operational overview of your institute.</p>
      </div>
      {can("students.manage")||can("admissions.manage")?<Link href="/students" className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-center text-sm font-bold text-white shadow-md hover:bg-slate-800 transition hover:-translate-y-0.5">+ Add New Student</Link>:null}
     </div>

     {subInfo && (
       <div className={`mt-6 rounded-2xl border p-5 shadow-sm transition sm:flex sm:items-center sm:justify-between ${
         subInfo.is_expired
           ? "border-red-200 bg-red-50/70 text-red-900"
           : subInfo.status === "pending_approval"
           ? "border-blue-200 bg-blue-50/70 text-blue-900"
           : subInfo.is_trial
           ? "border-purple-200 bg-purple-50/70 text-purple-900"
           : "border-slate-200 bg-white text-slate-800"
       }`}>
         <div className="flex items-start gap-4">
           <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl shadow-sm ${
             subInfo.is_expired ? "bg-red-200 text-red-800" : "bg-purple-200 text-purple-800"
           }`}>
             {subInfo.is_expired ? <AlertCircle size={22} /> : <Sparkles size={22} />}
           </span>
           <div>
             <div className="flex flex-wrap items-center gap-2">
               <span className="font-extrabold text-sm sm:text-base">
                 {subInfo.is_expired
                   ? "Subscription Plan Expired"
                   : subInfo.status === "pending_approval"
                   ? "Payment Proof Under Review"
                   : subInfo.is_trial
                   ? `Free Trial Active (${subInfo.days_remaining} Days Left)`
                   : subInfo.status === "active"
                   ? "Standard Subscription Active"
                   : "No Active Subscription"}
               </span>
               <span className="rounded-full bg-white/90 border border-current/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                 {subInfo.current_student_count} / {subInfo.student_limit} Students Quota
               </span>
             </div>
             <p className="text-xs opacity-80 mt-1">
               {subInfo.is_expired
                 ? "Aapka subscription cycle khatam ho gaya hai. Students add karne ke liye plan renew karein."
                 : subInfo.days_remaining > 0
                 ? `Current billing period me ${subInfo.days_remaining} din bache hain.`
                 : "Renewal due today."}
             </p>
             <div className="mt-2.5 h-1.5 w-64 max-w-full rounded-full bg-slate-200/80 overflow-hidden">
               <div
                 className="h-full bg-gradient-to-r from-purple-600 to-teal-500 rounded-full"
                 style={{ width: `${Math.min(100, Math.round((subInfo.current_student_count / Math.max(1, subInfo.student_limit)) * 100))}%` }}
               />
             </div>
           </div>
         </div>
         <div className="mt-4 sm:mt-0 flex shrink-0">
           <Link
             href="/subscription"
             className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition hover:-translate-y-0.5"
           >
             <span>{subInfo.is_expired ? "Renew Subscription" : "Manage Plan & Billing"}</span>
             <ChevronRight size={14} />
           </Link>
         </div>
       </div>
     )}

           {/* TODAY'S BIRTHDAY CELEBRATION BANNER */}
      {birthdays.length > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 p-4 sm:p-5 shadow-sm sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-700 text-2xl shadow-sm">
              🎂
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-900">
                  Today's Birthday Celebrations ({birthdays.length})
                </span>
                <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[9px] font-extrabold text-amber-900 uppercase">
                  Celebration
                </span>
              </div>
              <p className="mt-0.5 text-sm font-extrabold text-slate-900">
                {birthdays.map((b: any) => `${b.first_name} ${b.last_name || ""}`).join(", ")}
              </p>
              <p className="text-[11px] text-amber-800 font-medium">
                Wishing them a joyful year of academic success and health!
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const names = birthdays.map((b: any) => `${b.first_name}`).join(", ");
              navigator.clipboard.writeText(`🎉 *Happy Birthday from ${instituteName}!*
Dear ${names}, we wish you a wonderful birthday filled with joy, knowledge, and bright blessings!`);
              alert("Birthday wish message copied to clipboard!");
            }}
            className="mt-3 sm:mt-0 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-600 transition active:scale-95 whitespace-nowrap"
          >
            <span>Copy Birthday Wish</span>
          </button>
        </div>
      )}

      {/* Monthly Financial Pulse: Fees vs Expenses */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <span className="text-[10px] font-bold uppercase text-emerald-800 tracking-wider">Fees Collected This Month</span>
          <div className="text-xl sm:text-2xl font-black text-emerald-950 mt-1">₹{stats.fees.toLocaleString("en-IN")}</div>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
          <span className="text-[10px] font-bold uppercase text-rose-800 tracking-wider">Expenses / Outflow</span>
          <div className="text-xl sm:text-2xl font-black text-rose-950 mt-1">₹{monthlyExpense.toLocaleString("en-IN")}</div>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
          <span className="text-[10px] font-bold uppercase text-indigo-800 tracking-wider">Net Cash Operating Surplus</span>
          <div className="text-xl sm:text-2xl font-black text-indigo-950 mt-1">₹{(stats.fees - monthlyExpense).toLocaleString("en-IN")}</div>
        </div>
      </div>

     <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
       {statCards.map((card:any)=>{
         const Icon = card.icon;
         return (
           <div key={card.title} className={`group relative overflow-hidden rounded-2xl border ${card.border} bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md`}>
             <div className="flex items-center justify-between">
               <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{card.title}</span>
               <div className={`grid h-9 w-9 place-items-center rounded-xl ${card.iconBg}`}><Icon size={18}/></div>
             </div>
             <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">{card.value}</p>
             <p className="mt-1 text-xs text-slate-400 font-medium">{card.sub}</p>
           </div>
         );
       })}
     </div>

     <div className="mt-6 grid gap-6 lg:grid-cols-3">
      <section className="rounded-2xl border bg-white p-5 lg:col-span-2 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-900">Your Institute Workspace</h2>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">Online & Active</span>
          </div>
          <span className="text-xs font-mono text-slate-400">{profile?.login_id||"Admin"}</span>
        </div>
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-5">
          <p className="text-sm font-semibold text-slate-800">Your institute workspace is fully configured.</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Start by adding students, assigning teachers, and recording daily attendance. Numbers will automatically refresh in real-time from your institute’s live records.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link href="/attendance" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-100 transition">
              <ClipboardCheck size={14} className="text-emerald-600"/> Mark Today's Attendance
            </Link>
            <Link href="/fees" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-100 transition">
              <WalletCards size={14} className="text-amber-600"/> Record Fee Payment
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-bold text-slate-900">Quick Actions</h2>
        <div className="mt-4 space-y-2">
          {quickActions.map((item:any)=>(
            <Link href={item[1]} key={item[0]} className="flex w-full items-center justify-between rounded-xl border border-slate-200/80 px-3.5 py-3 text-xs font-bold text-slate-700 hover:border-purple-300 hover:bg-purple-50/50 hover:text-purple-700 transition">
              <span>{item[0]}</span>
              <ChevronRight size={15}/>
            </Link>
          ))}
        </div>
      </section>
     </div>
    </>}
   </main>
  </div>
 </div>
}
