"use client";

import Link from "next/link";
import {
  ArrowUpRight, BarChart3, Bell, Check, ChevronRight, ClipboardCheck,
  GraduationCap, MessageCircle, ShieldCheck, Sparkles, Users, WalletCards
} from "lucide-react";

const modules = [
  ["Admissions","Student records, classes and sections.",GraduationCap],
  ["Attendance","Daily attendance and reports.",ClipboardCheck],
  ["Fees & finance","Dues, collections and receipts.",WalletCards],
  ["Exams & results","Marks, results and academic records.",BarChart3],
  ["Staff & permissions","Roles with precise feature access.",Users],
  ["Parent communication","Notices and student updates.",MessageCircle],
];

function DashboardVisual(){
  const bars=[42,58,47,72,61,78,67,86,74,92,81,96];
  return (
    <div className="relative mx-auto w-full max-w-[820px] [perspective:1800px]">
      <div className="absolute -inset-16 rounded-full bg-indigo-500/20 blur-[100px]"/>
      <div className="absolute right-0 top-4 z-30 hidden w-48 animate-[float_6s_ease-in-out_infinite] rounded-2xl border border-white/15 bg-[#101b2d]/90 p-4 shadow-[0_25px_70px_rgba(0,0,0,.35)] backdrop-blur-xl sm:block">
        <div className="flex items-center justify-between"><span className="text-[9px] uppercase tracking-[.18em] text-white/40">Live today</span><span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,.9)]"/></div>
        <p className="mt-2 text-2xl font-semibold">94.2%</p><p className="mt-1 text-[10px] text-emerald-300">Attendance rate</p>
      </div>
      <div className="absolute -bottom-5 left-0 z-30 hidden w-56 animate-[float_7s_ease-in-out_infinite_reverse] rounded-2xl border border-white/15 bg-[#101b2d]/95 p-4 shadow-[0_25px_70px_rgba(0,0,0,.4)] backdrop-blur-xl sm:block">
        <div className="flex items-center justify-between"><span className="text-[9px] uppercase tracking-[.18em] text-white/40">Fee collection</span><WalletCards size={14} className="text-cyan-300"/></div>
        <p className="mt-1 text-2xl font-semibold">₹2.84L</p>
        <div className="mt-3 h-1.5 rounded-full bg-white/10"><div className="h-full w-[78%] rounded-full bg-gradient-to-r from-cyan-300 to-indigo-400"/></div>
      </div>

      <div className="relative animate-[dashboardFloat_9s_ease-in-out_infinite] rounded-[2.4rem] border border-white/20 bg-white/[.09] p-2 shadow-[0_50px_120px_rgba(0,0,0,.55)] backdrop-blur-xl [transform:rotateX(6deg) rotateY(-8deg) rotateZ(1deg)]">
        <div className="overflow-hidden rounded-[1.9rem] border border-slate-200/80 bg-[#f5f7fb] shadow-2xl">
          <div className="flex h-11 items-center gap-1.5 border-b border-slate-200 bg-white px-4">
            <i className="h-2.5 w-2.5 rounded-full bg-slate-200"/><i className="h-2.5 w-2.5 rounded-full bg-slate-200"/><i className="h-2.5 w-2.5 rounded-full bg-slate-200"/>
            <div className="mx-auto h-2 w-32 rounded-full bg-slate-100"/>
            <Bell size={13} className="text-slate-300"/>
          </div>
          <div className="grid min-h-[430px] grid-cols-[78px_1fr] sm:min-h-[540px] sm:grid-cols-[112px_1fr]">
            <aside className="border-r border-slate-200 bg-white p-3 sm:p-4">
              <div className="mb-8 flex items-center gap-2"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-950 text-white"><GraduationCap size={15}/></div><span className="hidden text-[10px] font-bold text-slate-800 sm:block">EduTech</span></div>
              <div className="space-y-4">
                {["Dashboard","Students","Attendance","Fees","Exams","Staff","Notices"].map((x,i)=><div key={x} className={`flex items-center gap-2 rounded-lg px-2 py-2 text-[8px] font-semibold ${i===0?"bg-indigo-50 text-indigo-600":"text-slate-400"}`}><span className={`h-1.5 w-1.5 rounded-full ${i===0?"bg-indigo-500":"bg-slate-200"}`}/><span className="hidden sm:block">{x}</span></div>)}
              </div>
            </aside>
            <div className="p-4 sm:p-7">
              <div className="flex items-end justify-between">
                <div><p className="text-[9px] font-bold uppercase tracking-[.2em] text-slate-400">Institution overview</p><h3 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Good morning, Admin</h3></div>
                <button className="rounded-lg bg-slate-950 px-3 py-2 text-[9px] font-bold text-white shadow-lg shadow-slate-900/15">+ Add</button>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
                {[["Students","428","12 new"],["Attendance","94.2%","+2.1%"],["Dues","₹64.5K","8 pending"]].map(([a,b,c])=><div key={a} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><p className="text-[8px] text-slate-400">{a}</p><p className="mt-1 text-base font-bold text-slate-900 sm:text-lg">{b}</p><p className="mt-1 text-[7px] font-semibold text-emerald-600">{c}</p></div>)}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1.45fr_.55fr]">
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                  <div className="flex items-center justify-between"><span className="text-[8px] font-semibold text-slate-400">Attendance overview</span><span className="text-[8px] font-semibold text-emerald-600">+2.1%</span></div>
                  <div className="mt-4 flex h-32 items-end gap-1">{bars.map((h,i)=><span key={i} className="flex-1 rounded-t bg-gradient-to-t from-indigo-600 to-cyan-300 opacity-90" style={{height:h+"%"}}/>)}</div>
                  <div className="mt-2 flex justify-between text-[7px] text-slate-300"><span>Mon</span><span>Wed</span><span>Fri</span><span>Sun</span></div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                  <span className="text-[8px] font-semibold text-slate-400">Quick actions</span>
                  <div className="mt-3 space-y-2">{["New admission","Collect fee","Post notice"].map((x,i)=><div key={x} className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-2 text-[8px] font-semibold text-slate-600"><span>{x}</span><ChevronRight size={10} className="text-slate-300"/></div>)}</div>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between"><span className="text-[8px] font-semibold text-slate-400">Recent activity</span><span className="text-[8px] font-semibold text-indigo-500">View all</span></div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[7px] text-slate-400"><span><b className="text-slate-700">12</b> admissions</span><span><b className="text-slate-700">36</b> fees collected</span><span><b className="text-slate-700">8</b> notices sent</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home(){
  return <main className="min-h-screen overflow-hidden bg-[#f6f8fc] text-slate-900 selection:bg-indigo-200">
    <section className="relative overflow-hidden bg-[#060d19] text-white">
      <div className="absolute inset-0 [background-image:radial-gradient(circle_at_15%_10%,rgba(99,102,241,.28),transparent_28%),radial-gradient(circle_at_90%_20%,rgba(34,211,238,.16),transparent_25%),radial-gradient(circle_at_55%_80%,rgba(139,92,246,.16),transparent_32%)]"/>
      <div className="absolute inset-0 opacity-[.055] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:64px_64px]"/>
      <header className="relative z-20 mx-auto flex max-w-[1480px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/10 backdrop-blur"><GraduationCap size={20}/></span><span className="text-[19px] font-bold tracking-[-.03em]">EduTech<span className="text-cyan-300">Lab</span></span></Link>
        <nav className="hidden items-center gap-9 text-[13px] font-medium text-white/45 md:flex"><a href="#platform" className="hover:text-white">Platform</a><a href="#features" className="hover:text-white">Solutions</a><a href="#security" className="hover:text-white">Security</a></nav>
        <div className="flex items-center gap-2"><Link href="/login" className="hidden rounded-full px-4 py-2.5 text-sm text-white/65 hover:text-white sm:inline-flex">Sign in</Link><Link href="/register" className="group inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-slate-950">Get started <ArrowUpRight size={15}/></Link></div>
      </header>

      <div id="platform" className="relative mx-auto max-w-[1480px] px-5 pb-24 pt-14 sm:px-8 sm:pt-20 lg:px-12 lg:pb-32 lg:pt-24">
        <div className="grid items-center gap-16 lg:grid-cols-[.78fr_1.22fr]">
          <div className="relative z-10">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[.06] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[.18em] text-cyan-100/80"><Sparkles size={13} className="text-cyan-300"/> The education operating system</div>
            <h1 className="max-w-2xl text-[54px] font-semibold leading-[.92] tracking-[-.065em] sm:text-[72px] lg:text-[82px]">Run your institution from <span className="bg-gradient-to-r from-cyan-200 via-white to-indigo-300 bg-clip-text text-transparent">one intelligent workspace.</span></h1>
            <p className="mt-8 max-w-xl text-[16px] leading-7 text-white/50 sm:text-lg">Admissions, students, attendance, fees, exams, staff and parent communication — connected in one serious platform.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row"><Link href="/register" className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-slate-950 shadow-[0_15px_50px_rgba(255,255,255,.12)] transition hover:-translate-y-1">Create your institution <ArrowUpRight size={17}/></Link><a href="#features" className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white/75 hover:bg-white/10">Explore platform</a></div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-[10px] font-medium text-white/35"><span className="flex items-center gap-2"><Check size={13} className="text-cyan-300"/> Separate workspaces</span><span className="flex items-center gap-2"><Check size={13} className="text-cyan-300"/> Granular permissions</span><span className="flex items-center gap-2"><Check size={13} className="text-cyan-300"/> Built to scale</span></div>
          </div>
          <DashboardVisual/>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#060d19] to-transparent"/>
    </section>

    <section id="features" className="mx-auto max-w-[1480px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
      <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-indigo-600">Everything connected</p><h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-.055em] sm:text-6xl">Your daily operations, <span className="text-slate-400">without the chaos.</span></h2></div><p className="max-w-md text-sm leading-7 text-slate-500">Purpose-built modules share the same student, staff and institution data — so your team spends less time moving information around.</p></div>
      <div className="mt-14 grid overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-200 gap-px sm:grid-cols-2 lg:grid-cols-3">{modules.map(([title,copy,Icon])=><div key={title as string} className="group bg-white p-7 sm:p-9"><div className="flex items-center justify-between"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg"><Icon size={20}/></div><ChevronRight size={16} className="text-slate-200 transition group-hover:translate-x-1 group-hover:text-indigo-500"/></div><h3 className="mt-10 text-xl font-semibold tracking-tight">{title as string}</h3><p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">{copy as string}</p></div>)}</div>
    </section>

    <section id="security" className="relative overflow-hidden bg-[#070f1d] py-24 text-white sm:py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_40%,rgba(99,102,241,.22),transparent_35%),radial-gradient(circle_at_15%_90%,rgba(34,211,238,.10),transparent_28%)]"/>
      <div className="relative mx-auto grid max-w-[1480px] gap-16 px-5 sm:px-8 lg:grid-cols-[1fr_.8fr] lg:items-center lg:px-12">
        <div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-cyan-300">Built as a platform</p><h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-.055em] sm:text-6xl">Every institution gets its <span className="text-white/35">own secure workspace.</span></h2><p className="mt-6 max-w-xl text-base leading-7 text-white/50">Organization-level data boundaries, authentication and feature permissions form the foundation. Your institution controls who can see and manage each part of the system.</p><div className="mt-9 grid gap-3 sm:grid-cols-2">{["Separate institution data","Admin, teacher & staff roles","Feature-level permissions","Ready for future integrations"].map(x=><div key={x} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.05] px-4 py-3 text-sm text-white/70"><Check size={16} className="text-cyan-300"/>{x}</div>)}</div></div>
        <div className="relative mx-auto w-full max-w-md"><div className="absolute -inset-10 rounded-full bg-indigo-500/20 blur-[80px]"/><div className="relative rounded-[2rem] border border-white/10 bg-white/[.06] p-6 backdrop-blur-xl"><div className="flex items-center justify-between"><div><p className="text-[9px] uppercase tracking-[.2em] text-white/35">Workspace</p><p className="mt-2 text-xl font-semibold">Institution A</p></div><ShieldCheck className="text-cyan-300"/></div><div className="mt-7 space-y-2">{["Students & admissions","Attendance & academics","Finance & receipts","Staff & permissions"].map(x=><div key={x} className="flex items-center justify-between rounded-xl border border-white/8 bg-black/10 px-4 py-3 text-xs text-white/60"><span>{x}</span><span className="text-[10px] text-emerald-300">Protected</span></div>)}</div></div></div>
      </div>
    </section>

    <section className="px-5 py-20 sm:px-8 lg:px-12"><div className="mx-auto max-w-[1480px] rounded-[2.5rem] bg-gradient-to-br from-indigo-600 via-indigo-600 to-cyan-500 p-[1px] shadow-[0_25px_80px_rgba(79,70,229,.2)]"><div className="rounded-[2.45rem] bg-[#101a31]/95 px-7 py-14 text-white sm:px-12 sm:py-16"><div className="flex flex-col justify-between gap-9 md:flex-row md:items-center"><div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-cyan-300">Start building</p><h2 className="mt-3 text-4xl font-semibold tracking-[-.05em] sm:text-5xl">Make your institution feel effortless.</h2><p className="mt-4 max-w-xl text-sm leading-6 text-white/50">Create your workspace and bring your education operations into one modern system.</p></div><Link href="/register" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-slate-950">Register your institute <ArrowUpRight size={16}/></Link></div></div></div></section>

    <footer className="border-t border-slate-200 bg-white px-5 py-9 sm:px-8 lg:px-12"><div className="mx-auto flex max-w-[1480px] flex-col justify-between gap-4 text-xs text-slate-400 sm:flex-row"><span>© 2026 EduTechLab · Education, connected.</span><div className="flex gap-6"><Link href="/login" className="hover:text-slate-900">Sign in</Link><Link href="/register" className="hover:text-slate-900">Register</Link></div></div></footer>
    <style jsx global>{`
      @keyframes dashboardFloat{0%,100%{transform:rotateX(6deg) rotateY(-8deg) rotateZ(1deg) translateY(0)}50%{transform:rotateX(7deg) rotateY(-6deg) rotateZ(.5deg) translateY(-10px)}}
      @keyframes float{0%,100%{translate:0 0}50%{translate:0 -12px}}
    `}</style>
  </main>;
}
