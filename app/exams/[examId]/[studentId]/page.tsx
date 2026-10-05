"use client";
import {useEffect,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import MarksheetTemplate,{MarksheetData,MarksheetMark} from "@/components/marksheet/MarksheetTemplate";
export default function Marksheet({params}:{params:Promise<{examId:string;studentId:string}>}){
 const supabase=createClient();const[data,setData]=useState<MarksheetData|null>(null);
 useEffect(()=>{(async()=>{const{examId,studentId}=await params;const{data:{user}}=await supabase.auth.getUser();if(!user)return;const{data:p}=await supabase.from("profiles").select("organization_id").eq("id",user.id).single();if(!p)return;
 const[a,b,c,d,e,f]=await Promise.all([
  supabase.from("students").select("admission_no,first_name,last_name,father_name,mother_name,guardian_name,gender,date_of_birth,photo_url").eq("id",studentId).eq("organization_id",p.organization_id).single(),
  supabase.from("exams").select("name,exam_date").eq("id",examId).eq("organization_id",p.organization_id).single(),
  supabase.from("exam_subjects").select("subject,max_marks,pass_percentage,sort_order").eq("exam_id",examId).eq("organization_id",p.organization_id).order("sort_order"),
  supabase.from("exam_marks").select("subject,marks,max_marks,pass_percentage,status").eq("exam_id",examId).eq("student_id",studentId).eq("organization_id",p.organization_id),
  supabase.from("organizations").select("name").eq("id",p.organization_id).single(),
  supabase.from("organization_settings").select("address,phone,email,authorized_signatory,logo_url,primary_color,secondary_color,marksheet_title,grading_scale").eq("organization_id",p.organization_id).single()
 ]);
 let photo="",logo="";if(a.data?.photo_url){const{data:z}=await supabase.storage.from("institution-assets").createSignedUrl(a.data.photo_url,3600);photo=z?.signedUrl||""}if(f.data?.logo_url){const{data:z}=await supabase.storage.from("institution-assets").createSignedUrl(f.data.logo_url,3600);logo=z?.signedUrl||""}
 const saved=new Map((d.data||[]).map((x:any)=>[x.subject,x]));const marks=((c.data||[]) as any[]).map(x=>({...x,marks:saved.get(x.subject)?.marks??null,status:saved.get(x.subject)?.status} as MarksheetMark));
 setData({student:{...a.data,photo_signed:photo},exam:b.data,marks,org:e.data,settings:{...f.data,logo_signed:logo}});
 })()},[params]);
 return data?<MarksheetTemplate data={data}/>:<main className="grid min-h-screen place-items-center bg-slate-100 text-slate-500">Preparing marksheet…</main>;
}