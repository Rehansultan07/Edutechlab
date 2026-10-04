"use client";

import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BarChart3, Bell, Check, ChevronRight,
  ClipboardCheck, GraduationCap, Menu, MessageCircle, Play, ShieldCheck,
  Sparkles, Users, WalletCards
} from "lucide-react";

const modules = [
  { n:"01", title:"Admissions", copy:"Capture every enquiry, admission and student record in one clean flow.", icon:GraduationCap },
  { n:"02", title:"Attendance", copy:"Daily attendance, trends and follow-ups without spreadsheet chaos.", icon:ClipboardCheck },
  { n:"03", title:"Fees & finance", copy:"Know what is due, what is collected and what needs attention.", icon:WalletCards },
  { n:"04", title:"Exams & results", copy:"Plan exams, enter marks and turn results into polished records.", icon:BarChart3 },
  { n:"05", title:"People & access", copy:"Give every admin, teacher and staff member exactly the access they need.", icon:Users },
  { n:"06", title:"Parent communication", copy:"Keep families informed with notices and a connected parent experience.", icon:MessageCircle },
];

function MiniChart(){
  const bars=[38,52,46,68,58,77,64,84,72,91,79,96];
  return <div className="flex h-28 items-end gap-1.5">{bars.map((h,i)=><div key={i} className="relative flex-1 overflow-hidden rounded-t-[5px] bg-slate-100"><div className="absolute inset-x-0 bottom-0 rounded-t-[5px] bg-gradient-to-t from-[#6657ee] to-[#2bd7c5]" style={{height:h+"%"}}/></div>)}</div>;
}

function DashboardMockup(){
  return <div className="relative mx-auto w-full max-w-[820px]">
    <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-[#6d5df2]/25 blur-[100px]"/>
    <div className="absolute -right-12 bottom-10 h-64 w-64 rounded-full bg-[#22d8c5]/20 blur-[100px]"/>
    <div className="absolute -right-4 -top-7 z-20 hidden w-52 rounded-2xl border border-white/20 bg-white/[.11] p-4 shadow-2xl backdrop-blur-2xl sm:block animate-[float_6s_ease-in-out_infinite]">
      <div className="flex items-center justify-between text-[9px] uppercase tracking-[.16em] text-white/45"><span>Attendance</span><span className="text-[#65efc7]">Live</span></div>
      <div className="mt-2 text-3xl font-semibold">94.2%</div>
      <div className="mt-3 h-1.5 rounded-full bg-white/10"><div className="h-full w-[94%] rounded-full bg-gradient-to-r from-[#27d9c5] to-[#7567ff]"/></div>
    </div>
    <div className="absolute -bottom-6 -left-8 z-20 hidden w-56 rounded-2xl border border-white/15 bg-[#11152b]/95 p-4 shadow-2xl backdrop-blur-xl sm:block animate-[float_7s_ease-in-out_infinite_reverse]">
      <div className="text-[9px] uppercase tracking-[.16em] text-white/35">Collected this month</div>
      <div className="mt-1 flex items-end justify-between"><b className="text-2xl">₹2.84L</b><span className="text-[10px] text-[#65efc7]">+18.4%</span></div>
      <div className="mt-3 flex items-end gap-1">{[28,42,34,55,46,68,58,78].map((h,i)=><i key={i} className="flex-1 rounded-t bg-gradient-to-t from-[#7567ff] to-[#27d9c5]" style={{height:h/1.7+"px"}}/>)}</div>
    </div>

    <div className="relative rounded-[28px] border border-white/30 bg-white/10 p-1.5 shadow-[0_50px_120px_rgba(0,0,0,.55)] backdrop-blur-xl [transform:rotateX(4deg) rotateY(-6deg)]">
      <div className="overflow-hidden rounded-[23px] bg-[#f6f7fb] shadow-inner">
        <div className="flex h-10 items-center border-b border-slate-200 bg-white px-4"><div className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#ffb8ca]"/><i className="h-2.5 w-2.5 rounded-full bg-[#ffd36c]"/><i className="h-2.5 w-2.5 rounded-full bg-[#7ce5c1]"/></div><div className="mx-auto h-1.5 w-32 rounded-full bg-slate-100"/><Bell size={13} className="text-slate-300"/></div>
        <div className="grid grid-cols-[78px_1fr] sm:grid-cols-[132px_1fr]">
          <aside className="border-r border-slate-200 bg-[#fbfbfd] p-3 sm:p-4">
            <div className="mb-7 flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-xl bg-[#17152f] text-white"><GraduationCap size={15}/></div><span className="hidden text-[10px] font-bold sm:block">EduTechLab</span></div>
            <div className="space-y-1.5">{["Overview","Students","Attendance","Fees","Exams","Staff","Notices"].map((x,i)=><div key={x} className={`rounded-lg px-2 py-2 text-[8px] font-semibold ${i===0?"bg-[#eceaff] text-[#6355e4]":"text-slate-400"}`}>{x}</div>)}</div>
          </aside>
          <div className="p-4 sm:p-7">
            <div className="flex items-end justify-between"><div><p className="text-[8px] font-bold uppercase tracking-[.2em] text-slate-400">Monday · 06 October 2026</p><h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900 sm:text-2xl">Good morning, Admin</h3></div><button className="rounded-xl bg-[#17152f] px-3 py-2 text-[8px] font-bold text-white">+ Add</button></div>
            <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">{[["Students","428","+12"],["Attendance","94.2%","+2.1%"],["Outstanding","₹64.5K","-8.2%"]].map(([a,b,c],i)=><div key={a} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><div className="flex justify-between"><p className="text-[8px] text-slate-400">{a}</p><span className={`text-[7px] font-bold ${i===2?"text-[#6355e4]":"text-[#16aa92]"}`}>{c}</span></div><p className="mt-1 text-base font-bold sm:text-lg">{b}</p><div className="mt-3 h-1 rounded-full bg-slate-100"><div className={`h-full rounded-full ${i===0?"w-3/4 bg-[#7567ff]":i===1?"w-[94%] bg-[#27c7b2]":"w-2/5 bg-[#ef6ca5]"}`}/></div></div>)}</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1.45fr_.55fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><div className="flex items-center justify-between"><span className="text-[8px] font-bold text-slate-400">Attendance overview</span><span className="rounded-full bg-[#eafff9] px-2 py-1 text-[7px] font-bold text-[#12a88f]">Healthy</span></div><div className="mt-3"><MiniChart/></div></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><span className="text-[8px] font-bold text-slate-400">Today</span><div className="mt-3 space-y-2">{[["Admissions","12"],["Fees received","36"],["Notices","08"]].map(x=><div key={x[0]} className="rounded-xl bg-slate-50 p-2"><b className="block text-xs">{x[1]}</b><span className="text-[7px] text-slate-400">{x[0]}</span></div>)}</div></div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div><p className="text-[8px] font-bold text-slate-400">Recent activity</p><p className="mt-1 text-[9px] font-semibold text-slate-700">New admission · Class 8A</p></div><span className="text-[8px] font-bold text-[#6558e8]">2 min ago</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>;
}

export default function Home(){
  return <main className="min-h-screen overflow-hidden bg-[#f8f8fa] text-[#17152f]">
    <section className="relative overflow-hidden bg-[#080817] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(113,92,245,.28),transparent_30%),radial-gradient(circle_at_80%_5%,rgba(31,213,193,.16),transparent_28%),radial-gradient(circle_at_55%_100%,rgba(219,74,147,.10),transparent_32%)]"/>
      <div className="absolute inset-0 opacity-[.035] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:64px_64px]"/>
      <header className="relative z-30 mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-[12px] bg-gradient-to-br from-[#7969ff] to-[#27d9c5] text-white shadow-[0_8px_30px_rgba(113,92,245,.3)]"><GraduationCap size={20}/></span><span className="text-[19px] font-bold tracking-[-.045em]">EduTech<span className="text-[#2bd7c5]">Lab</span></span></Link>
        <nav className="hidden items-center gap-9 text-[12px] font-medium text-white/45 md:flex"><a href="#platform" className="transition hover:text-white">Platform</a><a href="#capabilities" className="transition hover:text-white">Capabilities</a><a href="#security" className="transition hover:text-white">Security</a></nav>
        <div className="flex items-center gap-1"><Link href="/login" className="hidden px-4 py-2.5 text-sm text-white/55 transition hover:text-white sm:block">Sign in</Link><Link href="/register" className="group inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-[#17152f] transition hover:-translate-y-0.5 hover:shadow-xl">Get started <ArrowUpRight size={14}/></Link></div>
      </header>

      <div id="platform" className="relative mx-auto max-w-[1440px] px-5 pb-28 pt-16 sm:px-8 sm:pt-24 lg:px-12 lg:pb-40 lg:pt-28">
        <div className="grid items-center gap-20 lg:grid-cols-[.82fr_1.18fr]">
          <div className="relative z-10">
            <div className="mb-7 flex items-center gap-3"><span className="h-px w-9 bg-[#2bd7c5]"/><span className="text-[10px] font-bold uppercase tracking-[.25em] text-[#b8b4e9]">The modern institution OS</span></div>
            <h1 className="max-w-[650px] text-[54px] font-semibold leading-[.92] tracking-[-.075em] sm:text-[70px] lg:text-[82px]">Run the whole institution <span className="bg-gradient-to-r from-white via-[#d9d5ff] to-[#6eeedc] bg-clip-text text-transparent">from one place.</span></h1>
            <p className="mt-8 max-w-[540px] text-[15px] leading-7 text-white/45 sm:text-[17px]">Admissions, academics, attendance, fees, exams, staff and parent communication — connected into one calm, intelligent workflow.</p>
            <div className="mt-9 flex flex-wrap gap-3"><Link href="/register" className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#7160f5] to-[#28cdbb] px-6 py-3.5 text-sm font-bold shadow-[0_16px_55px_rgba(94,82,220,.28)] transition hover:-translate-y-1">Create your workspace <ArrowRight size={16} className="transition group-hover:translate-x-1"/></Link><a href="#capabilities" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.045] px-6 py-3.5 text-sm font-semibold text-white/70 transition hover:bg-white/10"><Play size={13} fill="currentColor"/> See what it replaces</a></div>
            <div className="mt-9 grid max-w-lg grid-cols-3 border-y border-white/10 py-5"><div><b className="text-lg font-semibold">01</b><p className="mt-1 text-[9px] uppercase tracking-[.14em] text-white/35">Workspace</p></div><div className="border-l border-white/10 pl-5"><b className="text-lg font-semibold">06+</b><p className="mt-1 text-[9px] uppercase tracking-[.14em] text-white/35">Core modules</p></div><div className="border-l border-white/10 pl-5"><b className="text-lg font-semibold">∞</b><p className="mt-1 text-[9px] uppercase tracking-[.14em] text-white/35">Institutions</p></div></div>
          </div>
          <DashboardMockup/>
        </div>
      </div>
    </section>

    <section className="border-b border-slate-200 bg-white px-5 py-6 sm:px-8 lg:px-12"><div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-5"><span className="text-[9px] font-bold uppercase tracking-[.22em] text-slate-400">Designed for</span><div className="flex flex-wrap gap-x-8 gap-y-2 text-xs font-semibold text-slate-400"><span>Schools</span><span>Coaching institutes</span><span>Madrasas</span><span>Education groups</span><span>Multi-campus teams</span></div></div></section>

    <section id="capabilities" className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
      <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr]"><div className="lg:sticky lg:top-10 lg:h-fit"><p className="text-[10px] font-bold uppercase tracking-[.25em] text-[#6658e8]">One connected system</p><h2 className="mt-5 max-w-lg text-4xl font-semibold leading-[.98] tracking-[-.06em] sm:text-6xl">Less software.<br/><span className="text-slate-300">More control.</span></h2><p className="mt-6 max-w-md text-sm leading-7 text-slate-500">Every module works from the same student, staff and institution data — so your team stops moving information between disconnected tools.</p><Link href="/register" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#5f52d8]">Build your workspace <ArrowRight size={15}/></Link></div>
        <div className="grid gap-3 sm:grid-cols-2">{modules.map(({n,title,copy,icon:Icon},i)=><div key={title} className="group relative overflow-hidden rounded-[25px] border border-slate-200 bg-[#fbfbfc] p-7 transition duration-500 hover:-translate-y-1 hover:border-[#d9d4ff] hover:bg-white hover:shadow-[0_25px_70px_rgba(63,52,160,.10)] sm:p-8"><div className="absolute -right-14 -top-14 h-40 w-40 rounded-full bg-[#7364f3]/[.07] blur-3xl transition duration-500 group-hover:scale-150"/><div className="relative flex items-start justify-between"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#17152f] text-white shadow-lg"><Icon size={19}/></div><span className="text-[10px] font-bold tracking-[.15em] text-slate-300">{n}</span></div><h3 className="relative mt-14 text-xl font-semibold tracking-tight">{title}</h3><p className="relative mt-3 max-w-sm text-sm leading-6 text-slate-500">{copy}</p><div className="relative mt-8 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#6658e8]">Connected by default <ChevronRight size={13}/></div></div>)}</div>
      </div>
    </section>

    <section id="security" className="relative overflow-hidden bg-[#0a0918] py-24 text-white sm:py-32"><div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_45%,rgba(111,93,245,.20),transparent_35%),radial-gradient(circle_at_20%_90%,rgba(36,212,191,.10),transparent_28%)]"/><div className="relative mx-auto grid max-w-[1440px] gap-16 px-5 sm:px-8 lg:grid-cols-[1.05fr_.75fr] lg:items-center lg:px-12"><div><div className="flex items-center gap-3"><ShieldCheck size={17} className="text-[#2bd7c5]"/><span className="text-[10px] font-bold uppercase tracking-[.23em] text-[#7fe9dc]">Architecture first</span></div><h2 className="mt-5 max-w-3xl text-4xl font-semibold leading-[.98] tracking-[-.06em] sm:text-6xl">Every institution gets its <span className="text-white/30">own boundary.</span></h2><p className="mt-6 max-w-xl text-sm leading-7 text-white/45">Separate organization workspaces, authentication and feature-level permissions create a foundation that can scale from one campus to many.</p><div className="mt-9 grid max-w-2xl gap-2 sm:grid-cols-2">{["Isolated institution data","Admin, teacher & staff roles","Granular feature permissions","Built for future integrations"].map(x=><div key={x} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3.5 text-xs text-white/65"><Check size={15} className="text-[#2bd7c5]"/>{x}</div>)}</div></div><div className="relative mx-auto w-full max-w-sm"><div className="absolute -inset-10 rounded-full bg-[#6d5df2]/20 blur-[90px]"/><div className="relative rounded-[28px] border border-white/10 bg-white/[.055] p-5 shadow-2xl backdrop-blur-xl"><div className="flex items-center justify-between border-b border-white/10 pb-5"><div><p className="text-[9px] uppercase tracking-[.2em] text-white/30">Organization</p><p className="mt-1 font-semibold">Your institution</p></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#27d9c5]/10 text-[#27d9c5]"><ShieldCheck size={18}/></span></div><div className="space-y-2 pt-4">{["Students & admissions","Academics & attendance","Finance & receipts","People & permissions"].map(x=><div key={x} className="flex items-center justify-between rounded-xl bg-black/20 px-4 py-3 text-xs text-white/55"><span>{x}</span><span className="text-[9px] font-bold text-[#63e7c6]">Protected</span></div>)}</div></div></div></div></section>

    <section className="px-5 py-20 sm:px-8 lg:px-12 lg:py-28"><div className="mx-auto max-w-[1440px] overflow-hidden rounded-[34px] bg-gradient-to-br from-[#7363f5] via-[#5c51d9] to-[#1fcab9] p-px shadow-[0_35px_100px_rgba(83,72,205,.18)]"><div className="relative overflow-hidden rounded-[33px] bg-[#111025] px-7 py-14 sm:px-12 sm:py-16"><div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#27d9c5]/10 blur-[80px]"/><div className="relative flex flex-col justify-between gap-10 md:flex-row md:items-center"><div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#63e7d6]">Ready when you are</p><h2 className="mt-3 max-w-2xl text-4xl font-semibold tracking-[-.06em] sm:text-5xl">Give your institution a better operating system.</h2><p className="mt-4 max-w-xl text-sm leading-6 text-white/45">Create your workspace today. Your data, people and workflows start with one clean foundation.</p></div><Link href="/register" className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-[#17152f] transition hover:-translate-y-1">Register institute <ArrowUpRight size={16} className="transition group-hover:translate-x-0.5"/></Link></div></div></div></section>
    <footer className="border-t border-slate-200 bg-white px-5 py-9 sm:px-8 lg:px-12"><div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 text-xs text-slate-400"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#17152f] text-white"><GraduationCap size={13}/></span><span>© 2026 EduTechLab</span></div><div className="flex gap-6"><Link href="/login" className="hover:text-slate-700">Sign in</Link><Link href="/register" className="hover:text-slate-700">Register</Link></div></div></footer>
    <style jsx global>{`
      @keyframes float{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-12px) rotate(1deg)}}
    `}</style>
  </main>;
}
