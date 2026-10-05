"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mark = { subject: string; marks: number | null; max_marks: number; pass_percentage: number; status?: "marked" | "absent" | "fail" | "pass" };
type GradeRow = { min: number; grade: string; remark: string };

const DEFAULT_SCALE: GradeRow[] = [
  { min: 90, grade: "A+", remark: "Outstanding" },
  { min: 80, grade: "A", remark: "Excellent" },
  { min: 70, grade: "B+", remark: "Very Good" },
  { min: 60, grade: "B", remark: "Good" },
  { min: 50, grade: "C", remark: "Satisfactory" },
  { min: 33, grade: "D", remark: "Needs Improvement" },
  { min: 0, grade: "F", remark: "Needs Improvement" },
];

function getGrade(percent: number, scale: GradeRow[]) {
  return [...scale].sort((a, b) => b.min - a.min).find((row) => percent >= row.min) ?? scale[scale.length - 1];
}

function parseScale(value: unknown): GradeRow[] {
  if (!value) return DEFAULT_SCALE;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return DEFAULT_SCALE;
    const rows = parsed.map((row: any) => ({
      min: Number(row.min ?? row.minimum ?? row.min_percentage),
      grade: String(row.grade ?? ""),
      remark: String(row.remark ?? row.remarks ?? ""),
    })).filter((row) => Number.isFinite(row.min) && row.grade);
    return rows.length ? rows : DEFAULT_SCALE;
  } catch { return DEFAULT_SCALE; }
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

export default function Marksheet({ params }: { params: Promise<{ examId: string; studentId: string }> }) {
  const supabase = createClient();
  const [student, setStudent] = useState<any>(null);
  const [exam, setExam] = useState<any>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [org, setOrg] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const ids = await params;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single();
      if (!profile?.organization_id) return;
      const [studentRes, examRes, subjectRes, marksRes, orgRes, settingsRes] = await Promise.all([
        supabase.from("students").select("admission_no,first_name,last_name,father_name,mother_name,guardian_name,gender,date_of_birth,photo_url").eq("id", ids.studentId).eq("organization_id", profile.organization_id).single(),
        supabase.from("exams").select("name,exam_date").eq("id", ids.examId).eq("organization_id", profile.organization_id).single(),
        supabase.from("exam_subjects").select("subject,max_marks,pass_percentage,sort_order").eq("exam_id", ids.examId).eq("organization_id", profile.organization_id).order("sort_order"),
        supabase.from("exam_marks").select("subject,marks,max_marks,pass_percentage,status").eq("exam_id", ids.examId).eq("student_id", ids.studentId).eq("organization_id", profile.organization_id).order("subject"),
        supabase.from("organizations").select("name").eq("id", profile.organization_id).single(),
        supabase.from("organization_settings").select("address,phone,email,authorized_signatory,logo_url,primary_color,secondary_color,marksheet_title,grading_scale").eq("organization_id", profile.organization_id).single(),
      ]);
      let studentPhoto = "";
      let instituteLogo = "";
      if (studentRes.data?.photo_url) {
        const { data } = await supabase.storage.from("institution-assets").createSignedUrl(studentRes.data.photo_url, 3600);
        studentPhoto = data?.signedUrl ?? "";
      }
      if (settingsRes.data?.logo_url) {
        const { data } = await supabase.storage.from("institution-assets").createSignedUrl(settingsRes.data.logo_url, 3600);
        instituteLogo = data?.signedUrl ?? "";
      }
      setStudent({ ...studentRes.data, photo_signed: studentPhoto });
      setExam(examRes.data);
      const saved = new Map(((marksRes.data as any[]) ?? []).map((row) => [row.subject, row]));
      const configured = ((subjectRes.data as any[]) ?? []).map((row) => ({ subject: row.subject, max_marks: Number(row.max_marks || 100), pass_percentage: Number(row.pass_percentage ?? 30), ...(saved.get(row.subject) ?? { marks: null, status: undefined }) }));
      setMarks(configured as Mark[]);
      setOrg(orgRes.data);
      setSettings({ ...settingsRes.data, logo_signed: instituteLogo });
    })();
  }, [params]);

  const scale = useMemo(() => parseScale(settings?.grading_scale), [settings?.grading_scale]);
  const totals = useMemo(() => {
    const total = marks.reduce((sum, row) => sum + Number(row.marks ?? 0), 0);
    const max = marks.reduce((sum, row) => sum + Number(row.max_marks || 0), 0);
    const percentage = max ? (total / max) * 100 : 0;
    const overall = getGrade(percentage, scale);
    const passed = marks.length > 0 && marks.every((row) => {
      if (row.status === "absent" || row.status === "fail") return false;
      if (row.status === "pass" && row.marks == null) return true;
      const rowMax = Number(row.max_marks || 0);
      const passPct = Number(row.pass_percentage ?? 30);
      return rowMax ? (Number(row.marks ?? 0) / rowMax) * 100 >= passPct : false;
    });
    return { total, max, percentage, overall, passed };
  }, [marks, scale]);

  const primary = settings?.primary_color || "#0e4b43";
  const accent = settings?.secondary_color || "#c5a15a";
  const instituteName = org?.name || "Institution Name";
  const studentName = [student?.first_name, student?.last_name].filter(Boolean).join(" ") || "Student Name";

  return (
    <main className="min-h-screen bg-[#e9ece8] px-2 py-4 sm:px-5 sm:py-6" style={{ "--primary": primary, "--accent": accent } as React.CSSProperties}>
      <div className="no-print mx-auto mb-4 flex max-w-[820px] items-center justify-between gap-2">
        <button onClick={() => window.history.back()} className="rounded-lg border bg-white px-3 py-2 text-sm font-medium shadow-sm"><ArrowLeft size={16} className="mr-1 inline" />Back</button>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm" style={{ backgroundColor: primary }}><Printer size={16} className="mr-1 inline" />Print</button>
          <button onClick={() => window.print()} className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold shadow-sm"><Download size={16} className="mr-1 inline" />Save PDF</button>
        </div>
      </div>

      <article className="marksheet relative mx-auto min-h-[1123px] w-full max-w-[794px] overflow-hidden bg-[#fbfaf6] text-[#202522] shadow-[0_18px_60px_rgba(0,0,0,.16)]">
        <div className="absolute inset-y-0 left-0 w-[6px]" style={{ backgroundColor: accent }} />
        <div className="absolute inset-y-0 right-0 w-[6px]" style={{ backgroundColor: accent }} />
        <div className="relative px-7 py-7 sm:px-10 sm:py-8">
          <header className="relative overflow-hidden border-b-[3px] pb-5" style={{ borderColor: accent }}>
            <div className="absolute -right-14 -top-16 h-44 w-44 rounded-full border-[18px] opacity-10" style={{ borderColor: primary }} />
            <div className="flex items-center gap-4">
              <div className="grid h-[82px] w-[82px] shrink-0 place-items-center overflow-hidden rounded-full border-[3px] bg-white" style={{ borderColor: accent }}>
                {settings?.logo_signed ? <img src={settings.logo_signed} alt="Institute logo" className="h-full w-full object-contain p-2" /> : <span className="text-xl font-black" style={{ color: primary }}>{initials(instituteName)}</span>}
              </div>
              <div className="min-w-0 flex-1 text-center">
                <p className="text-[8px] font-semibold uppercase tracking-[0.38em]" style={{ color: accent }}>Academic Excellence • Character • Discipline</p>
                <h1 className="mt-1 text-[26px] font-black uppercase leading-none tracking-[0.035em] sm:text-[31px]" style={{ color: primary }}>{instituteName}</h1>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Official Academic Record</p>
                <p className="mt-2 text-[10px] text-slate-500">{[settings?.address, settings?.phone, settings?.email].filter(Boolean).join("  •  ")}</p>
              </div>
              <div className="hidden w-[82px] shrink-0 text-center sm:block">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border bg-white/70" style={{ borderColor: accent }}><span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: primary }}>Official<br />Record</span></div>
              </div>
            </div>
            <div className="mt-6 text-center">
              <p className="text-[9px] font-bold uppercase tracking-[0.4em]" style={{ color: accent }}>Academic Examination</p>
              <h2 className="mt-1 text-[24px] font-black uppercase tracking-[0.09em]" style={{ color: primary }}>{settings?.marksheet_title || "Statement of Marks"}</h2>
              <p className="mt-1 text-[12px] font-semibold text-slate-500">{exam?.name || "Examination"}{exam?.exam_date ? ` • ${formatDate(exam.exam_date)}` : ""}</p>
            </div>
          </header>

          <section className="mt-5 rounded-xl border bg-white/70 p-4" style={{ borderColor: `${accent}66` }}>
            <div className="grid grid-cols-[1fr_86px] gap-4">
              <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
                <Info label="Student Name" value={studentName} strong />
                <Info label="Admission No." value={student?.admission_no} />
                <Info label="Father / Guardian" value={student?.father_name || student?.guardian_name} />
                <Info label="Mother" value={student?.mother_name} />
                <Info label="Gender" value={student?.gender} />
                <Info label="Date of Birth" value={formatDate(student?.date_of_birth)} />
                <Info label="Examination" value={exam?.name} />
                <Info label="Result" value={totals.passed ? "PASS" : "FAIL"} strong />
              </div>
              <div className="h-[104px] w-[86px] overflow-hidden rounded-lg border-2 bg-slate-100" style={{ borderColor: accent }}>
                {student?.photo_signed ? <img src={student.photo_signed} alt={studentName} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[9px] font-bold uppercase tracking-widest text-slate-400">Photo</div>}
              </div>
            </div>
          </section>

          <section className="mt-6">
            <div className="mb-3 flex items-end justify-between">
              <div><p className="text-[9px] font-bold uppercase tracking-[0.32em]" style={{ color: accent }}>Academic Performance</p><h3 className="mt-1 text-[17px] font-black uppercase tracking-wide" style={{ color: primary }}>Subject-wise Assessment</h3></div>
              <p className="text-[10px] font-semibold text-slate-400">{marks.length} {marks.length === 1 ? "Subject" : "Subjects"}</p>
            </div>
            <div className="overflow-hidden rounded-lg border" style={{ borderColor: `${primary}55` }}>
              <table className="w-full border-collapse text-[11px] sm:text-[12px]">
                <thead><tr style={{ backgroundColor: primary, color: "#fff" }}><th className="w-10 border-r border-white/20 p-2.5 text-center">S.No.</th><th className="p-2.5 text-left">Subject</th><th className="w-20 border-l border-white/20 p-2.5 text-center">Maximum</th><th className="w-20 border-l border-white/20 p-2.5 text-center">Obtained</th><th className="w-16 border-l border-white/20 p-2.5 text-center">Grade</th><th className="hidden w-28 border-l border-white/20 p-2.5 text-center sm:table-cell">Remarks</th></tr></thead>
                <tbody>
                  {marks.map((row, index) => { const rowMax = Number(row.max_marks || 0); const rowPercent = rowMax ? (Number(row.marks ?? 0) / rowMax) * 100 : 0; const rowGrade = getGrade(rowPercent, scale); const displayValue = row.marks == null ? (row.status || "—").toUpperCase() : row.marks; const displayGrade = row.marks == null ? (row.status === "pass" ? "P" : row.status === "absent" ? "AB" : row.status === "fail" ? "F" : "—") : rowGrade.grade; return <tr key={`${row.subject}-${index}`} className={index % 2 ? "bg-white" : "bg-[#f4f4ee]"}><td className="border-b p-2.5 text-center text-slate-500">{index + 1}</td><td className="border-b p-2.5 font-semibold">{row.subject}</td><td className="border-b border-l p-2.5 text-center">{row.max_marks}</td><td className="border-b border-l p-2.5 text-center font-black" style={{ color: row.status === "fail" || row.status === "absent" ? "#b91c1c" : primary }}>{displayValue}</td><td className="border-b border-l p-2.5 text-center font-black" style={{ color: row.status === "fail" || row.status === "absent" ? "#b91c1c" : primary }}>{displayGrade}</td><td className="hidden border-b border-l p-2.5 text-center text-[10px] text-slate-500 sm:table-cell">{rowGrade.remark}</td></tr>; })}
                  <tr style={{ backgroundColor: `${accent}28` }}><td colSpan={2} className="p-3 text-right font-black uppercase tracking-wide" style={{ color: primary }}>Grand Total</td><td className="border-l p-3 text-center font-black">{totals.max}</td><td className="border-l p-3 text-center text-[14px] font-black" style={{ color: primary }}>{totals.total}</td><td colSpan={2} className="border-l p-3 text-center font-black" style={{ color: primary }}>{totals.overall.grade}</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-5 grid grid-cols-3 overflow-hidden rounded-xl border bg-white/70" style={{ borderColor: `${accent}66` }}>
            <ResultStat label="Percentage" value={`${totals.percentage.toFixed(2)}%`} primary={primary} />
            <ResultStat label="Overall Grade" value={totals.overall.grade} primary={primary} border />
            <ResultStat label="Final Result" value={totals.passed ? "PASS" : "FAIL"} primary={primary} border result />
          </section>

          <section className="mt-5 grid gap-4 sm:grid-cols-[1fr_1.2fr]">
            <div className="rounded-xl border bg-white/70 p-4" style={{ borderColor: `${accent}66` }}><p className="text-[9px] font-black uppercase tracking-[0.25em]" style={{ color: accent }}>Grading Scale</p><div className="mt-3 overflow-hidden rounded border"><table className="w-full text-[9px]"><tbody>{scale.map((row) => <tr key={`${row.grade}-${row.min}`} className="border-b last:border-0"><td className="px-2 py-1.5 font-semibold">{row.min}% & above</td><td className="px-2 py-1.5 text-center font-black" style={{ color: primary }}>{row.grade}</td><td className="px-2 py-1.5 text-right text-slate-500">{row.remark}</td></tr>)}</tbody></table></div></div>
            <div className="rounded-xl border bg-white/70 p-4" style={{ borderColor: `${accent}66` }}><p className="text-[9px] font-black uppercase tracking-[0.25em]" style={{ color: accent }}>Result Remarks</p><p className="mt-3 text-[12px] leading-5 text-slate-600">{totals.passed ? `The student has successfully completed the examination with an overall grade of ${totals.overall.grade}.` : "The student has not met the minimum passing requirement in this examination."}</p><div className="mt-4 h-px w-20" style={{ backgroundColor: accent }} /></div>
          </section>

          <section className="mt-12 grid grid-cols-3 gap-5">
            <Signature title="Class Teacher" />
            <div className="text-center"><div className="mx-auto mb-1 grid h-14 w-14 place-items-center rounded-full border-2 border-dashed" style={{ borderColor: accent }}><span className="text-[7px] font-black uppercase tracking-wider" style={{ color: primary }}>Official<br />Seal</span></div><p className="mt-2 border-t pt-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">Institution Seal</p></div>
            <Signature title={settings?.authorized_signatory || "Authorized Signatory"} />
          </section>

          <footer className="mt-8 border-t pt-3 text-center text-[8px] text-slate-400"><p>This is an official academic record issued by {instituteName}.</p><p className="mt-1 font-semibold" style={{ color: accent }}>Generated through EduTechLab • Authentic institutional record</p></footer>
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 h-10 w-full" style={{ background: `linear-gradient(90deg, ${primary}, ${accent}, ${primary})` }} />
      </article>

      <style jsx global>{`
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .marksheet { width: 210mm !important; max-width: none !important; min-height: 297mm !important; margin: 0 !important; box-shadow: none !important; }
          @page { size: A4; margin: 0; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </main>
  );
}

function Info({ label, value, strong = false }: { label: string; value?: string | null; strong?: boolean }) {
  return <div className="min-w-0"><p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-0.5 truncate text-[10px] ${strong ? "font-black" : "font-semibold"} text-slate-800`}>{value || "—"}</p></div>;
}

function ResultStat({ label, value, primary, border = false, result = false }: { label: string; value: string; primary: string; border?: boolean; result?: boolean }) {
  return <div className={`p-3 text-center ${border ? "border-l" : ""}`} style={{ borderColor: `${primary}33` }}><p className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p><p className="mt-1 text-[18px] font-black sm:text-[21px]" style={{ color: primary }}>{result ? (value === "PASS" ? "✓ PASS" : "✕ FAIL") : value}</p></div>;
}

function Signature({ title }: { title: string }) {
  return <div className="pt-8 text-center"><div className="border-t border-slate-400" /><p className="mt-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">{title}</p><p className="mt-0.5 text-[8px] text-slate-400">Signature & Date</p></div>;
}