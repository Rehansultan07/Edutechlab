"use client";
import {useEffect,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {Printer,ArrowLeft} from "lucide-react";

export default async function FeeReceipt({params}:{params:Promise<{paymentId:string}>}){\n const {paymentId}=await params;
 const s=createClient(); const [data,setData]=useState<any>(null); const [error,setError]=useState("");
 useEffect(()=>{(async()=>{
  const {data:{user}}=await s.auth.getUser(); if(!user){setError("Please sign in.");return}
  const {data:p}=await s.from("profiles").select("organization_id").eq("id",user.id).single(); if(!p){setError("Organization not found.");return}
  const {data:pay,error:pe}=await s.from("fee_payments").select("id,student_id,amount,paid_on,method,reference,note,receipt_no,fee_month,created_at").eq("id",paymentId).eq("organization_id",p.organization_id).single();
  if(pe||!pay){setError("Receipt not found.");return}
  const [{data:st},{data:org},{data:settings}]=await Promise.all([
   s.from("students").select("id,admission_no,first_name,last_name,class_id,section_id").eq("id",pay.student_id).eq("organization_id",p.organization_id).single(),
   s.from("organizations").select("name").eq("id",p.organization_id).single(),
   s.from("organization_settings").select("phone,email,address,logo_url,authorized_signatory,receipt_footer,currency,primary_color,secondary_color").eq("organization_id",p.organization_id).single()
  ]);
  let logo=""; if(settings?.logo_url){const path=settings.logo_url.replace(/^institution-assets\//,"");const {data:u}=await s.storage.from("institution-assets").createSignedUrl(path,3600);logo=u?.signedUrl||""}
  let className="";let sectionName="";
  if(st?.class_id){const {data:c}=await s.from("classes").select("name").eq("id",st.class_id).single();className=c?.name||""}
  if(st?.section_id){const {data:sec}=await s.from("sections").select("name").eq("id",st.section_id).single();sectionName=sec?.name||""}
  setData({pay,st,org,settings,logo,className,sectionName});
 })()},[paymentId]);
 if(error)return <main className="p-8 text-center text-red-600">{error}</main>;
 if(!data)return <main className="p-8 text-center text-slate-500">Loading receipt...</main>;
 const {pay,st,org,settings,logo,className,sectionName}=data;
 const currency=settings?.currency==="INR"?"₹":settings?.currency||"₹";
 return <main className="min-h-screen bg-slate-100 p-4 sm:p-8">
  <div className="mx-auto mb-4 flex max-w-3xl justify-between print:hidden">
   <button onClick={()=>history.back()} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm"><ArrowLeft size={16}/>Back</button>
   <button onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"><Printer size={16}/>Print / Save PDF</button>
  </div>
  <article className="mx-auto max-w-3xl bg-white p-8 shadow-sm print:max-w-none print:shadow-none sm:p-10">
   <div className="border-b-2 pb-5" style={{borderColor:settings?.primary_color||"#171625"}}>
    <div className="flex items-start justify-between gap-5">
     <div className="flex items-center gap-4">{logo&&<img src={logo} alt="" className="h-16 w-16 object-contain"/>}<div><h1 className="text-2xl font-extrabold">{org?.name||"Institute"}</h1><p className="mt-1 whitespace-pre-line text-sm text-slate-500">{settings?.address||""}</p><p className="text-xs text-slate-500">{[settings?.phone,settings?.email].filter(Boolean).join(" · ")}</p></div></div>
     <div className="text-right"><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Fee Receipt</p><p className="mt-2 text-lg font-bold">{pay.receipt_no||"Receipt"}</p><p className="text-xs text-slate-500">{pay.paid_on}</p></div>
    </div>
   </div>
   <div className="mt-7 grid gap-4 rounded-xl border p-5 sm:grid-cols-2">
    <div><p className="text-xs uppercase tracking-wide text-slate-400">Student</p><p className="mt-1 font-bold">{st?.first_name} {st?.last_name||""}</p><p className="text-sm text-slate-500">Admission No. {st?.admission_no}</p></div>
    <div><p className="text-xs uppercase tracking-wide text-slate-400">Class / Section</p><p className="mt-1 font-semibold">{className||"—"}{sectionName?" / "+sectionName:""}</p></div>
   </div>
   <table className="mt-7 w-full border-collapse text-sm"><thead><tr style={{background:settings?.secondary_color||"#6657e8",color:"#fff"}}><th className="p-3 text-left">Description</th><th className="p-3 text-left">Month</th><th className="p-3 text-right">Amount</th></tr></thead><tbody><tr className="border-b"><td className="p-4 font-medium">Tuition / Fee Payment</td><td className="p-4">{pay.fee_month?new Date(pay.fee_month+"T00:00:00").toLocaleDateString("en-IN",{month:"long",year:"numeric"}):"—"}</td><td className="p-4 text-right font-bold">{currency}{Number(pay.amount).toLocaleString("en-IN")}</td></tr></tbody></table>
   <div className="mt-5 ml-auto max-w-sm space-y-2 border-t pt-4 text-sm"><div className="flex justify-between"><span>Payment method</span><b className="capitalize">{pay.method}</b></div>{pay.reference&&<div className="flex justify-between gap-4"><span>Reference</span><b>{pay.reference}</b></div>}<div className="flex justify-between text-lg"><span>Total received</span><b>{currency}{Number(pay.amount).toLocaleString("en-IN")}</b></div></div>
   <div className="mt-12 flex items-end justify-between gap-8"><div className="text-xs text-slate-500"><p>Received with thanks.</p><p className="mt-2">{settings?.receipt_footer||"This is a computer-generated receipt."}</p></div><div className="min-w-40 text-center text-xs text-slate-500"><div className="mb-2 border-t pt-2">{settings?.authorized_signatory||"Authorized Signatory"}</div></div></div>
  </article>
  <style>{'@media print{body{background:#fff!important}.print\\:hidden{display:none!important}@page{size:A4;margin:12mm}}'}</style>
 </main>
}
