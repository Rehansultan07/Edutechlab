"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, Award, FileCheck, Search, Users, Calendar, CheckCircle2, AlertCircle, Building2, GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUserAccess } from "@/lib/auth/permissions";
import AccessDenied from "@/components/auth/AccessDenied";
import FeatureGate from "@/components/FeatureGate";
import { fetchInstitutionFeatures } from "@/lib/features";

type Student = {
  id: string;
  admission_no: string;
  first_name: string;
  last_name: string | null;
  father_name: string | null;
  mother_name: string | null;
  date_of_birth: string | null;
  class_id?: string | null;
  section_id?: string | null;
  address: string | null;
  gender: string | null;
};

type ClassItem = { id: string; name: string };
type OrgSettings = {
  phone: string | null;
  address: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
};

export default function CertificatesPage() {
  const supabase = createClient();
  const { loading: authLoading, orgId, hasAccess, can, isAdmin } = useUserAccess([
    "certificates.manage",
    "students.manage",
    "students.view",
  ]);

  const [certType, setCertType] = useState<"tc" | "character" | "bonafide">("tc");
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [orgName, setOrgName] = useState("Your Institution");
  const [orgSettings, setOrgSettings] = useState<OrgSettings | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [featureActive, setFeatureActive] = useState(true);

  // Certificate Form Data
  const [certNo, setCertNo] = useState(`TC-${new Date().getFullYear()}-001`);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [leavingDate, setLeavingDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("Parents transfer / relocation");
  const [conduct, setConduct] = useState("Good");
  const [duesCleared, setDuesCleared] = useState("Yes, all school dues cleared");
  const [academicSession, setAcademicSession] = useState("2025-2026");
  const [remarks, setRemarks] = useState("Promoted to next standard. Best wishes for future.");

  useEffect(() => {
    if (!orgId || !hasAccess) return;
    (async () => {
      setLoading(true);
      const feat = await fetchInstitutionFeatures(supabase, orgId);
      if (feat && feat.certificates === false) { setFeatureActive(false); setLoading(false); return; }
      const [stRes, clRes, orgRes, setRes] = await Promise.all([
        supabase
          .from("students")
          .select("id,admission_no,first_name,last_name,father_name,mother_name,date_of_birth,class_id,section_id,address,gender")
          .eq("organization_id", orgId)
          .order("first_name"),
        supabase.from("classes").select("id,name").eq("organization_id", orgId).order("sort_order"),
        supabase.from("organizations").select("name").eq("id", orgId).single(),
        supabase.from("organization_settings").select("phone,address,email,website,logo_url").eq("organization_id", orgId).maybeSingle(),
      ]);

      if (stRes.data) {
        setStudents(stRes.data as Student[]);
        if (stRes.data.length > 0) {
          setSelectedStudentId(stRes.data[0].id);
        }
      }
      if (clRes.data) setClasses(clRes.data);
      if (orgRes.data?.name) setOrgName(orgRes.data.name);
      if (setRes.data) setOrgSettings(setRes.data);
      setLoading(false);
    })();
  }, [orgId, hasAccess]);

  const classMap = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c.name])), [classes]);

  const currentStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId) || null;
  }, [students, selectedStudentId]);

  const studentFullName = currentStudent
    ? `${currentStudent.first_name} ${currentStudent.last_name || ""}`.trim()
    : "Student Full Name";

  const studentClassName = currentStudent?.class_id
    ? classMap[currentStudent.class_id] || "Standard"
    : "Standard";

  const handleTypeChange = (type: "tc" | "character" | "bonafide") => {
    setCertType(type);
    const prefix = type === "tc" ? "TC" : type === "character" ? "CC" : "BNF";
    setCertNo(`${prefix}-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  };

  if (!featureActive) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <FeatureGate featureKey="certificates" instituteName={orgName} />
      </div>
    );
  }

  if (authLoading) {
    return (
      <main className="mx-auto max-w-7xl p-8 text-center text-sm text-slate-500">
        Loading Certificate Generator...
      </main>
    );
  }

  if (!hasAccess) {
    return <AccessDenied moduleName="Certificates & TC Generation" />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 print:bg-white print:p-0">
      {/* SCREEN CONTROLS & FORM */}
      <div className="print:hidden border-b bg-white">
        <div className="mx-auto max-w-7xl px-5 py-4 sm:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <Link
                href="/dashboard"
                className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
              >
                <ArrowLeft size={14} /> Back to Dashboard
              </Link>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                School Certificate & TC Generator
              </h1>
              <p className="mt-1 text-xs text-slate-500 font-medium">
                Issue official Transfer Certificates (TC), Character Certificates, and Bonafide Certificates with legal formatting.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                disabled={!currentStudent}
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-600/25 hover:bg-purple-700 transition active:scale-95 disabled:opacity-50"
              >
                <Printer size={15} />
                <span>Print Official Certificate</span>
              </button>
            </div>
          </div>

          {/* Certificate Type Switcher */}
          <div className="mt-5 flex flex-wrap gap-2 pt-4 border-t border-slate-100">
            {[
              { id: "tc", label: "Transfer Certificate (TC / SLC)" },
              { id: "character", label: "Character Certificate" },
              { id: "bonafide", label: "Bonafide / Study Certificate" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => handleTypeChange(t.id as any)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                  certType === t.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Form Settings Grid */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pb-2">
            {/* Student Picker */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Select Student *
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm focus:border-purple-600 focus:outline-none"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.admission_no} - {s.first_name} {s.last_name || ""} ({classMap[s.class_id || ""] || "Std"})
                  </option>
                ))}
              </select>
            </div>

            {/* Certificate Serial No */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Certificate No.
              </label>
              <input
                type="text"
                value={certNo}
                onChange={(e) => setCertNo(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm focus:border-purple-600 focus:outline-none font-mono"
              />
            </div>

            {/* Issue Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Date of Issue
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm focus:border-purple-600 focus:outline-none"
              />
            </div>

            {/* Academic Session */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Academic Session
              </label>
              <input
                type="text"
                value={academicSession}
                onChange={(e) => setAcademicSession(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm focus:border-purple-600 focus:outline-none"
              />
            </div>

            {certType === "tc" && (
              <>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Date of Leaving
                  </label>
                  <input
                    type="date"
                    value={leavingDate}
                    onChange={(e) => setLeavingDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm focus:border-purple-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Reason for Leaving
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm focus:border-purple-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Conduct / Behavior
                  </label>
                  <select
                    value={conduct}
                    onChange={(e) => setConduct(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm focus:border-purple-600 focus:outline-none"
                  >
                    <option value="Exemplary">Exemplary</option>
                    <option value="Very Good">Very Good</option>
                    <option value="Good">Good</option>
                    <option value="Satisfactory">Satisfactory</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Dues Status
                  </label>
                  <input
                    type="text"
                    value={duesCleared}
                    onChange={(e) => setDuesCleared(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm focus:border-purple-600 focus:outline-none"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* PRINTABLE OFFICIAL CERTIFICATE DOCUMENT */}
      <main className="mx-auto max-w-4xl p-5 sm:p-10 print:p-0 print:max-w-none">
        {loading ? (
          <div className="py-20 text-center text-sm text-slate-400">Loading certificate preview...</div>
        ) : !currentStudent ? (
          <div className="p-12 text-center text-slate-500">No students available to issue certificate.</div>
        ) : (
          <div className="certificate-sheet relative mx-auto max-w-[800px] border-[10px] border-double border-slate-800 bg-[#fffdfa] p-8 sm:p-12 shadow-2xl print:shadow-none print:border-8 print:p-10">
            {/* Corner Decorative Accents */}
            <div className="absolute top-2 left-2 h-4 w-4 border-t-2 border-l-2 border-slate-800" />
            <div className="absolute top-2 right-2 h-4 w-4 border-t-2 border-r-2 border-slate-800" />
            <div className="absolute bottom-2 left-2 h-4 w-4 border-b-2 border-l-2 border-slate-800" />
            <div className="absolute bottom-2 right-2 h-4 w-4 border-b-2 border-r-2 border-slate-800" />

            {/* Institute Emblem & Header */}
            <div className="text-center pb-6 border-b-2 border-slate-800">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-white font-bold mb-2">
                <GraduationCap size={28} />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-slate-900">
                {orgName}
              </h2>
              <p className="mt-1 text-xs text-slate-600 font-semibold tracking-wide">
                {orgSettings?.address || "Recognized & Affiliated Educational Institution"}
              </p>
              {orgSettings?.phone && (
                <p className="text-[11px] text-slate-500 font-medium">
                  Contact: {orgSettings.phone} {orgSettings?.email ? `• ${orgSettings.email}` : ""}
                </p>
              )}
            </div>

            {/* Certificate Title Badge */}
            <div className="my-6 text-center">
              <div className="inline-block rounded-lg border-2 border-slate-900 px-6 py-1.5 bg-white shadow-sm">
                <h3 className="text-base sm:text-lg font-black uppercase tracking-widest text-slate-900 font-serif">
                  {certType === "tc"
                    ? "TRANSFER CERTIFICATE"
                    : certType === "character"
                    ? "CHARACTER CERTIFICATE"
                    : "BONAFIDE / STUDY CERTIFICATE"}
                </h3>
              </div>
              <div className="mt-2 flex justify-between text-xs font-bold text-slate-700 px-2 font-mono">
                <span>Certificate No: {certNo}</span>
                <span>Date: {issueDate}</span>
              </div>
            </div>

            {/* Certificate Body Text */}
            <div className="my-8 text-sm leading-8 text-slate-800 font-serif">
              {certType === "tc" && (
                <div className="space-y-3">
                  <p>
                    This is to certify that <strong>{studentFullName}</strong>, Son/Daughter of{" "}
                    <strong>{currentStudent.father_name || "Father Name"}</strong> and{" "}
                    <strong>{currentStudent.mother_name || "Mother Name"}</strong>, bearing Admission / Roll
                    Number <strong>{currentStudent.admission_no}</strong>, was a bonafide student of this
                    institution.
                  </p>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 font-sans text-xs space-y-1.5 leading-6">
                    <div className="flex justify-between border-b border-slate-100 pb-1">
                      <span className="text-slate-500 font-semibold">1. Date of Birth:</span>
                      <span className="font-bold text-slate-900">{currentStudent.date_of_birth || "Recorded in Admission Register"}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1">
                      <span className="text-slate-500 font-semibold">2. Class in which student last studied:</span>
                      <span className="font-bold text-slate-900">{studentClassName} ({academicSession})</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1">
                      <span className="text-slate-500 font-semibold">3. School / Institute Dues Status:</span>
                      <span className="font-bold text-emerald-700">{duesCleared}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1">
                      <span className="text-slate-500 font-semibold">4. Date on which student left:</span>
                      <span className="font-bold text-slate-900">{leavingDate}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1">
                      <span className="text-slate-500 font-semibold">5. Reason for leaving school:</span>
                      <span className="font-bold text-slate-900">{reason}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold">6. General Conduct & Character:</span>
                      <span className="font-bold text-slate-900">{conduct}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs italic text-slate-600 font-sans">
                    {remarks}
                  </p>
                </div>
              )}

              {certType === "character" && (
                <div className="space-y-4 text-justify">
                  <p>
                    This is to certify that <strong>{studentFullName}</strong>, Son/Daughter of{" "}
                    <strong>{currentStudent.father_name || "Father Name"}</strong>, residing at{" "}
                    <strong>{currentStudent.address || "Local Address"}</strong>, is a student of this
                    institution studying in <strong>Class {studentClassName}</strong> under Admission Number{" "}
                    <strong>{currentStudent.admission_no}</strong> for the academic session{" "}
                    <strong>{academicSession}</strong>.
                  </p>
                  <p>
                    During his/her stay in the institution, he/she has shown commendable academic diligence,
                    punctuality, and moral integrity. To the best of our knowledge and official institutional
                    records, he/she bears an <strong>{conduct}</strong> moral character and has not taken part
                    in any undesirable activities.
                  </p>
                  <p className="mt-4">
                    We wish him/her all success in his/her future educational and personal pursuits.
                  </p>
                </div>
              )}

              {certType === "bonafide" && (
                <div className="space-y-4 text-justify">
                  <p>
                    This is to certify that <strong>{studentFullName}</strong>, Son/Daughter of{" "}
                    <strong>{currentStudent.father_name || "Father Name"}</strong>, is a bonafide student of{" "}
                    <strong>{orgName}</strong>, presently enrolled in <strong>Class {studentClassName}</strong>{" "}
                    (Admission No: <strong>{currentStudent.admission_no}</strong>) for the academic year{" "}
                    <strong>{academicSession}</strong>.
                  </p>
                  <p>
                    As per our school admission records, his/her date of birth is{" "}
                    <strong>{currentStudent.date_of_birth || "duly verified"}</strong>.
                  </p>
                  <p>
                    This certificate is issued upon the request of the parent/guardian for official / scholarship
                    / passport / verification purposes.
                  </p>
                </div>
              )}
            </div>

            {/* Official Seal Stamp & Signatures */}
            <div className="mt-14 pt-8 border-t border-slate-300 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="h-10 border-b border-dashed border-slate-400 mx-4" />
                <p className="mt-2 text-xs font-bold text-slate-800">Class Teacher</p>
                <p className="text-[10px] text-slate-400">Checked & Verified</p>
              </div>

              <div>
                <div className="mx-auto h-16 w-16 rounded-full border-2 border-dashed border-slate-400 grid place-items-center text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                  School Seal
                </div>
              </div>

              <div>
                <div className="h-10 border-b border-dashed border-slate-400 mx-4" />
                <p className="mt-2 text-xs font-bold text-slate-800">Principal / Head</p>
                <p className="text-[10px] text-slate-400">{orgName}</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Print Specific CSS */}
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
          }
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          .certificate-sheet {
            box-shadow: none !important;
            border-width: 6px !important;
            page-break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
