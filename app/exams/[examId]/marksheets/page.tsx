"use client";
import {useEffect,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import MarksheetTemplate,{MarksheetData,MarksheetMark} from "@/components/marksheet/MarksheetTemplate";
export default function AllMarksheets({params}:{params:Promise<{examId:string}>}){
 const supabase=createClient();const[data,setData]=useState<MarksheetData[]>([]);const[loading,setLoading]=useState(true);
 useEffect(()=>{(async()=>{const{examId}=await params;const{data:{user}}=await supabase.auth.getUser();if(!user)return;const{data:p}=await supabase.from("profiles").select("organization_id").eq("id",user.id).single();if(!p)return;
 const[a,b,c,d,e]=await Promise.all([
  supabase.from("exams").select("name,exam_date").eq("id",examId).eq("organization_id",p.organization_id).single(),
  supabase.from("organizations").select("name").eq("id",p.organization_id).single(),
  supabase.from("organization_settings").select("address,phone,email,authorized_signatory,logo_url,primary_color,secondary_color,marksheet_title,grading_scale").eq("organization_id",p.organization_id).single(),
  supabase.from("exam_subjects").select("subject,max_marks,pass_percentage,sort_order").eq("exam_id",examId).eq("organization_id",p.organization_id).order("sort_order"),
  supabase.from("exam_marks").select("student_id,subject,marks,max_marks,pass_percentage,status").eq("exam_id",examId).eq("organization_id",p.organization_id)
 ]);
 const{data:students}=await supabase.from("students").select("id,admission_no,first_name,last_name,father_name,mother_name,guardian_name,gender,date_of_birth,photo_url").eq("organization_id",p.organization_id).eq("status","active").order("first_name");
 let logo="";if(c.data?.logo_url){const{data:z}=await supabase.storage.from("institution-assets").createSignedUrl(c.data.logo_url,3600);logo=z?.signedUrl||""}
 const out:MarksheetData[]=[];for(const st of students||[]){let photo="";if(st.photo_url){const{data:z}=await supabase.storage.from("institution-assets").createSignedUrl(st.photo_url,3600);photo=z?.signedUrl||""}const sm=new Map((e.data||[]).filter((m:any)=>m.student_id===st.id).map((m:any)=>[m.subject,m]));const marks=((d.data||[]) as any[]).map(s=>({...s,marks:sm.get(s.subject)?.marks??null,status:sm.get(s.subject)?.status} as MarksheetMark));out.push({student:{...st,photo_signed:photo},exam:a.data,marks,org:b.data,settings:{...c.data,logo_signed:logo}})}setData(out);setLoading(false)})()},[params]);
 if(loading)return <main className="grid min-h-screen place-items-center bg-slate-100 text-slate-500">Preparing marksheets…</main>;
 return <main>{data.map((x,i)=><MarksheetTemplate key={x.student.id} data={x} showToolbar={i===0}/>)}</main>;
}