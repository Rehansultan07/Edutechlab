"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, BarChart3, Bell, Check, ClipboardCheck, GraduationCap, MessageCircle, ShieldCheck, Sparkles, Users, WalletCards, Zap } from "lucide-react";

const modules = [
  ["Admissions","Students, classes & sections",GraduationCap],
  ["Attendance","Daily tracking & reports",ClipboardCheck],
  ["Fees","Dues, collections & receipts",WalletCards],
  ["Exams","Marks, results & records",BarChart3],
  ["Staff","Roles & permissions",Users],
  ["Parents","Notices & communication",MessageCircle],
];

function ProductScene(){
  return <div className="relative mx-auto w-full max-w-[850px] [perspective:1800px]">
    <div className="absolute -inset-20 rounded-full bg-[#7567ff]/20 blur-[110px]"/>
    <div className="absolute -right-12 top-16 h-72 w-72 rounded-full bg-[#27d9c5]/10 blur-[90px]"/>
    <div className="absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-[#ff72b6]/10 blur-[80px]"/>

    <div className="absolute -right-2 top-2 z-30 hidden w-52 animate-[floatCard_5s_ease-in-out_infinite] rounded-[22px] border border-white/20 bg-white/[.10] p-4 shadow-[0_25px_80px_rgba(0,0,0,.4)] backdrop-blur-2xl sm:block">
      <div className="flex items-center justify-between"><span className="text-[9px] uppercase tracking-[.2em] text-white/45">Attendance</span><span className="flex items-center gap-1 text-[9px] text-[#66f0c4]"><i className="h-1.5 w-1.5 rounded-full bg-[#66f0c4]"/> Live</span></div>
      <div className="mt-2 flex items-end justify-between"><b className="text-3xl font-semibold">94.2%</b><span className="text-[10px] text-[#66f0c4]">+2.1%</span></div>
      <div className="mt-3 h-1.5 rounded-full bg-white/10"><div className="h-full w-[94%] rounded-full bg-gradient-to-r from-[#27d9c5] to-[#7567ff]"/></div>
    </div>

    <div className="absolute -bottom-7 left-0 z-30 hidden w-60 animate-[floatCard_6s_ease-in-out_infinite_reverse] rounded-[22px] border border-white/20 bg-[#101a31]/90 p-4 shadow-[0_25px_80px_rgba(0,0,0,.45)] backdrop-blur-2xl sm:block">
      <div className="flex items-center justify-between"><span className="text-[9px] uppercase tracking-[.2em] text-white/40">Fee collection</span><WalletCards size={15} className="text-[#27d9c5]"/></div>
      <div className="mt-1 flex items-end justify-between"><b className="text-2xl font-semibold">₹2.84L</b><span className="text-[9px] text-white/35">this month</span></div>
      <div className="mt-3 flex gap-1">{[40,55,47,72,60,82,75,92].map((h,i)=><i key={i} className="flex-1 rounded-t bg-gradient-to-t from-[#7567ff] to-[#27d9c5]" style={{height:h/2+"px"}}/>)}</div>
    </div>

    <div className="relative animate-[sceneFloat_9s_ease-in-out_infinite] rounded-[32px] border border-white/20 bg-white/[.08] p-2 shadow-[0_55px_130px_rgba(0,0,0,.58)] backdrop-blur-xl [transform:rotateX(7deg) rotateY(-8deg) rotateZ(1deg)]">
      <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-[#f7f8fc]">
        <div className="flex h-11 items-center gap-1.5 border-b border-slate-200 bg-white px-4">
          <i className="h-2.5 w-2.5 rounded-full bg-[#ffb5c9]"/><i className="h-2.5 w-2.5 rounded-full bg-[#ffd66b]"/><i className="h-2.5 w-2.5 rounded-full bg-[#76e4c0]"/>
          <div className="mx-auto h-2 w-36 rounded-full bg-slate-100"/><Bell size={13} className="text-slate-300"/>
        </div>
        <div className="grid min-h-[430px] grid-cols-[78px_1fr] sm:min-h-[550px] sm:grid-cols-[118px_1fr]">
          <aside className="border-r border-slate-200 bg-white p-3 sm:p-4">
            <div className="mb-8 flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-xl bg-[#17152f] text-white shadow-lg"><GraduationCap size={15}/></div><span className="hidden text-[10px] font-bold text-slate-800 sm:block">EduTechLab</span></div>
            <div className="space-y-3">{["Dashboard","Students","Attendance","Fees","Exams","Staff","Notices"].map((x,i)=><div key={x} className={`rounded-lg px-2 py-2 text-[8px] font-semibold ${i===0?"bg-[#eeeaff] text-[#6558e8]":"text-slate-400"}`}>{x}</div>)}</div>
          </aside>
          <div className="p-4 sm:p-7">
            <div className="flex items-end justify-between">
              <div><p className="text-[9px] font-bold uppercase tracking-[.2em] text-slate-400">Institution dashboard</p><h3 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Good morning, Admin</h3></div>
              <button className="rounded-xl bg-[#17152f] px-3 py-2 text-[9px] font-bold text-white shadow-lg">+ Add</button>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">{[["Students","428","#7567ff"],["Attendance","94.2%","#27bfae"],["Dues","₹64.5K","#ef6ca5"]].map(([a,b,c])=><div key={a} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><p className="text-[8px] text-slate-400">{a}</p><p className="mt-1 text-base font-bold text-slate-900 sm:text-lg">{b}</p><div className="mt-3 h-1 rounded-full bg-slate-100"><div className="h-full w-2/3 rounded-full" style={{background:c}}/></div></div>)}</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1.5fr_.5fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><div className="flex justify-between"><span className="text-[8px] font-semibold text-slate-400">Attendance overview</span><span className="text-[8px] font-bold text-[#1daf9f]">+2.1%</span></div><div className="mt-5 flex h-32 items-end gap-1">{[34,48,43,61,56,70,64,79,68,88,78,94].map((h,i)=><span key={i} className="flex-1 rounded-t bg-gradient-to-t from-[#7567ff] to-[#27d9c5]" style={{height:h+"%"}}/>)}</div></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><span className="text-[8px] font-semibold text-slate-400">Quick actions</span><div className="mt-3 space-y-2">{["Admission","Receipt","Notice"].map(x=><div key={x} className="rounded-xl bg-[#f5f3ff] px-2 py-2 text-[8px] font-semibold text-[#6256dc]">{x}</div>)}</div></div>
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"><div className="flex justify-between"><span className="text-[8px] font-semibold text-slate-400">Recent activity</span><span className="text-[8px] font-bold text-[#7567ff]">View all</span></div><div className="mt-3 grid grid-cols-3 gap-2"><span className="rounded-xl bg-[#f8f7ff] p-2 text-[7px] text-slate-400"><b className="block text-sm text-slate-800">12</b> admissions</span><span className="rounded-xl bg-[#f2fffc] p-2 text-[7px] text-slate-400"><b className="block text-sm text-slate-800">36</b> fees collected</span><span className="rounded-xl bg-[#fff5fa] p-2 text-[7px] text-slate-400"><b className="block text-sm text-slate-800">08</b> notices sent</span></div></div>
          </div>
        </div>
      </div>
    </div>
  </div>;
}

export default function Home(){
return <main className="min-h-screen overflow-hidden bg-[#f8f9fc] text-[#17152f]">
  <section className="relative overflow-hidden bg-[#090817] text-white">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_10%,rgba(117,103,255,.28),transparent_28%),radial-gradient(circle_at_92%_14%,rgba(39,217,197,.18),transparent_25%),radial-gradient(circle_at_55%_100%,rgba(239,108,165,.14),transparent_30%)]"/>
    <div className="absolute inset-0 opacity-[.045] [background-image:linear-gradient(rgba(255,255,255,.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.9)_1px,transparent_1px)] [background-size:72px_72px]"/>
    <header className="relative z-20 mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
      <Link href="/" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-[13px] border border-white/15 bg-white/10"><GraduationCap size={20}/></span><span className="text-[19px] font-bold tracking-[-.04em]">EduTech<span className="text-[#27d9c5]">Lab</span></span></Link>
      <nav className="hidden items-center gap-8 text-[13px] font-medium text-white/45 md:flex"><a href="#platform" className="hover:text-white">Platform</a><a href="#modules" className="hover:text-white">Modules</a><a href="#security" className="hover:text-white">Security</a></nav>
      <div className="flex items-center gap-2"><Link href="/login" className="hidden rounded-full px-4 py-2.5 text-sm text-white/65 hover:text-white sm:inline-flex">Sign in</Link><Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-[#17152f] shadow-[0_10px_40px_rgba(255,255,255,.1)]">Get started <ArrowUpRight size={15}/></Link></div>
    </header>

    <div id="platform" className="relative mx-auto max-w-[1500px] px-5 pb-28 pt-14 sm:px-8 sm:pt-20 lg:px-12 lg:pb-36 lg:pt-24">
      <div className="grid items-center gap-20 lg:grid-cols-[.76fr_1.24fr]">
        <div className="relative z-10">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#7567ff]/30 bg-[#7567ff]/10 px-3.5 py-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#c8c3ff]"><Sparkles size={13} className="text-[#27d9c5]"/> Education operating system</div>
          <h1 className="max-w-2xl text-[54px] font-semibold leading-[.91] tracking-[-.07em] sm:text-[72px] lg:text-[84px]">Your entire institution. <span className="bg-gradient-to-r from-[#27d9c5] via-white to-[#a79dff] bg-clip-text text-transparent">One beautiful system.</span></h1>
          <p className="mt-8 max-w-xl text-[16px] leading-7 text-white/50 sm:text-lg">Admissions, attendance, fees, exams, staff and parents — designed to work together, not as separate software.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row"><Link href="/register" className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#27d9c5] to-[#7567ff] px-6 py-3.5 text-sm font-bold text-white shadow-[0_15px_55px_rgba(117,103,255,.25)] transition hover:-translate-y-1">Create your institution <ArrowRight size={16} className="transition group-hover:translate-x-1"/></Link><a href="#modules" className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white/75 hover:bg-white/10">Explore modules</a></div>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-[10px] text-white/35"><span className="flex items-center gap-2"><Check size={13} className="text-[#27d9c5]"/> Multi-institution</span><span className="flex items-center gap-2"><Check size={13} className="text-[#27d9c5]"/> Role-based access</span><span className="flex items-center gap-2"><Check size={13} className="text-[#27d9c5]"/> Secure by architecture</span></div>
        </div>
        <ProductScene/>
      </div>
    </div>
  </section>

  <section id="modules" className="mx-auto max-w-[1500px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
    <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#6558e8]">The platform</p><h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-.06em] sm:text-6xl">Everything your team needs, <span className="text-slate-400">beautifully connected.</span></h2></div><p className="max-w-md text-sm leading-7 text-slate-500">One student record flows through admissions, attendance, finance, exams and communication.</p></div>
    <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{modules.map(([title,copy,Icon],i)=><div key={title as string} className="group relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-7 shadow-[0_15px_50px_rgba(20,15,60,.04)] transition duration-500 hover:-translate-y-2 hover:shadow-[0_25px_70px_rgba(80,65,180,.12)] sm:p-8"><div className={`absolute -right-10 -top-10 h-28 w-28 rounded-full blur-3xl ${i%3===0?"bg-[#7567ff]/10":i%3===1?"bg-[#27d9c5]/10":"bg-[#ef6ca5]/10"}`}/><div className="relative flex items-center justify-between"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#17152f] text-white"><Icon size={20}/></div><span className="text-[10px] font-bold text-slate-300">0{i+1}</span></div><h3 className="relative mt-10 text-xl font-semibold">{title as string}</h3><p className="relative mt-3 text-sm leading-6 text-slate-500">{copy as string}</p><div className="relative mt-7 flex items-center gap-2 text-xs font-bold text-[#6558e8]"><Zap size={13}/> Connected by default</div></div>)}</div>
  </section>

  <section id="security" className="relative overflow-hidden bg-[#0b0a19] py-24 text-white sm:py-32">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_45%,rgba(117,103,255,.22),transparent_35%),radial-gradient(circle_at_20%_80%,rgba(39,217,197,.12),transparent_30%)]"/>
    <div className="relative mx-auto grid max-w-[1500px] gap-16 px-5 sm:px-8 lg:grid-cols-[1fr_.7fr] lg:items-center lg:px-12">
      <div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#27d9c5]">Built for multiple institutions</p><h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-.06em] sm:text-6xl">Your data stays inside <span className="text-white/30">your workspace.</span></h2><p className="mt-6 max-w-xl text-base leading-7 text-white/45">Every school, coaching institute and madrasa gets its own isolated environment with authentication and granular access control.</p><div className="mt-9 grid gap-3 sm:grid-cols-2">{["Separate institution data","Admin, teacher & staff roles","Feature-level permissions","Ready for future integrations"].map(x=><div key={x} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.045] px-4 py-3 text-sm text-white/65"><Check size={16} className="text-[#27d9c5]"/>{x}</div>)}</div></div>
      <div className="relative mx-auto w-full max-w-md"><div className="absolute -inset-10 rounded-full bg-[#7567ff]/20 blur-[80px]"/><div className="relative rounded-[28px] border border-white/10 bg-white/[.06] p-6 backdrop-blur-xl"><div className="flex items-center justify-between"><div><p className="text-[9px] uppercase tracking-[.2em] text-white/35">Workspace boundary</p><p className="mt-2 text-xl font-semibold">Institution A</p></div><ShieldCheck className="text-[#27d9c5]"/></div><div className="mt-7 space-y-2">{["Students & admissions","Attendance & academics","Finance & receipts","Staff & permissions"].map(x=><div key={x} className="flex items-center justify-between rounded-xl border border-white/8 bg-black/10 px-4 py-3 text-xs text-white/55"><span>{x}</span><span className="text-[10px] text-[#66f0c4]">Protected</span></div>)}</div></div></div>
    </div>
  </section>

  <section className="px-5 py-20 sm:px-8 lg:px-12"><div className="mx-auto max-w-[1500px] overflow-hidden rounded-[32px] bg-gradient-to-r from-[#7567ff] via-[#6558e8] to-[#27d9c5] p-[1px] shadow-[0_30px_90px_rgba(101,88,232,.18)]"><div className="rounded-[31px] bg-[#111025] px-7 py-14 text-white sm:px-12 sm:py-16"><div className="flex flex-col justify-between gap-9 md:flex-row md:items-center"><div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#27d9c5]">Start building</p><h2 className="mt-3 text-4xl font-semibold tracking-[-.05em] sm:text-5xl">Make your institution feel effortless.</h2><p className="mt-4 max-w-xl text-sm leading-6 text-white/45">Create your workspace and bring your education operations into one modern system.</p></div><Link href="/register" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-[#17152f]">Register your institute <ArrowUpRight size={16}/></Link></div></div></div></section>
  <footer className="border-t border-slate-200 bg-white px-5 py-9 sm:px-8 lg:px-12"><div className="mx-auto flex max-w-[1500px] justify-between gap-4 text-xs text-slate-400"><span>© 2026 EduTechLab · Education, connected.</span><div className="flex gap-6"><Link href="/login">Sign in</Link><Link href="/register">Register</Link></div></div></footer>
  <style jsx global>{`
    @keyframes sceneFloat{0%,100%{transform:rotateX(7deg) rotateY(-8deg) rotateZ(1deg) translateY(0)}50%{transform:rotateX(8deg) rotateY(-5deg) rotateZ(.4deg) translateY(-12px)}}
    @keyframes floatCard{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-14px) rotate(1.5deg)}}
  `}</style>
</main>;
}
