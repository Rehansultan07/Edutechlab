"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { ArrowRight, Eye, EyeOff, GraduationCap, ShieldCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage(){
 const supabase=createClient()
 const [loginId,setLoginId]=useState("")
 const [password,setPassword]=useState("")
 const [loading,setLoading]=useState(false)
 const [error,setError]=useState("")
 const [showPassword,setShowPassword]=useState(false)

 async function submit(e:FormEvent){
  e.preventDefault(); setLoading(true); setError("")
  const normalized=loginId.trim().toUpperCase()
  const {data:resolved,error:resolveError}=await supabase.functions.invoke("resolve-login-id",{body:{loginId:normalized}})
  if(resolveError||!resolved?.email){setError(resolveError?.message||resolved?.error||"Institute ID or password is incorrect.");setLoading(false);return}
  const {error}=await supabase.auth.signInWithPassword({email:resolved.email,password})
  if(error){setError("Institute ID or password is incorrect.");setLoading(false);return}
  window.location.href="/dashboard"
 }

 return <main className="min-h-screen bg-[#f7f7f4] px-5 py-8 sm:px-8"><div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center"><div className="grid w-full overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_100px_rgba(30,24,75,.12)] md:grid-cols-[1.05fr_.95fr]"><div className="hidden bg-[#171625] p-12 text-white md:block"><Link href="/" className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-[#171625]"><GraduationCap size={18}/></span><span className="font-bold">EduTechLab</span></Link><div className="mt-28"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#58dfcc]">Admin workspace</p><h1 className="mt-4 text-5xl font-semibold leading-[.95] tracking-[-.07em]">Your institution,<br/>under control.</h1><p className="mt-6 max-w-sm text-sm leading-7 text-white/50">Manage students, attendance, fees, exams, staff and notices from one connected workspace.</p><div className="mt-9 space-y-3 text-xs text-white/65"><div className="flex items-center gap-3"><ShieldCheck size={16} className="text-[#58dfcc]"/> Separate institute workspace</div><div className="flex items-center gap-3"><ShieldCheck size={16} className="text-[#58dfcc]"/> Role-based staff access</div></div></div></div><div className="p-7 sm:p-10 md:p-12"><div className="md:hidden"><Link href="/" className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#171625] text-white"><GraduationCap size={18}/></span><span className="font-bold text-slate-900">EduTechLab</span></Link></div><div className="mx-auto mt-8 max-w-sm md:mt-16"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#6657e8]">Welcome back</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.05em] text-slate-900">Sign in to your admin panel</h2><p className="mt-3 text-sm leading-6 text-slate-500">Use the Institute ID you received when you registered and your password.</p><form onSubmit={submit} className="mt-8 space-y-5"><label className="block text-sm font-semibold text-slate-700">Institute ID<input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3.5 font-mono uppercase tracking-[.08em] outline-none focus:border-[#6657e8] focus:ring-4 focus:ring-[#6657e8]/10" value={loginId} onChange={e=>setLoginId(e.target.value)} placeholder="EDU-7K4P2" required/></label><label className="block text-sm font-semibold text-slate-700">Password<div className="relative mt-2"><input className="w-full rounded-xl border border-slate-300 px-4 py-3.5 pr-12 outline-none focus:border-[#6657e8] focus:ring-4 focus:ring-[#6657e8]/10" type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password" required/><button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>{error&&<p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}<button disabled={loading} className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#171625] px-5 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-50">{loading?"Signing in...":"Sign in to admin panel"}{!loading&&<ArrowRight size={16} className="transition group-hover:translate-x-1" />}</button></form><div className="mt-7 border-t border-slate-100 pt-6 text-center text-sm text-slate-500">New institute? <Link href="/register" className="font-bold text-[#6657e8]">Register your institute</Link></div><p className="mt-5 text-center text-[11px] text-slate-400">Keep your Institute ID and password private.</p></div></div></div></div></main>
}
