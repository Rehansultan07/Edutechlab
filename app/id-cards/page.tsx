"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, Search, Users, Download, Filter, CheckSquare, Square, Palette, GraduationCap, Phone, MapPin, Calendar, Droplet } from "lucide-react";
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
  phone: string | null;
  class_id?: string | null;
  section_id?: string | null;
  father_name: string | null;
  photo_url: string | null;
  address: string | null;
  date_of_birth: string | null;
  blood_group?: string | null;
  gender: string | null;
};

type ClassItem = { id: string; name: string };
type SectionItem = { id: string; class_id: string; name: string };
type OrgSettings = {
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};

export default function IdCardGenerator() {
  const supabase = createClient();
  const { loading: authLoading, orgId, hasAccess } = useUserAccess(["students.view"]);

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [orgName, setOrgName] = useState("Your Institution");
  const [orgSettings, setOrgSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [featureActive, setFeatureActive] = useState(true);

  // Filters
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Card Appearance Options
  const [themeColor, setThemeColor] = useState<string>("#4f46e5"); // Indigo
  const [validUntil, setValidUntil] = useState<string>("March 2027");
  const [showQr, setShowQr] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);

  useEffect(() => {
    if (!orgId || !hasAccess) return;
    (async () => {
      setLoading(true);
      const feat = await fetchInstitutionFeatures(supabase, orgId);
      if (feat && feat.id_cards === false) { setFeatureActive(false); setLoading(false); return; }
      const [stRes, clRes, secRes, orgRes, setRes] = await Promise.all([
        supabase
          .from("students")
          .select("id,admission_no,first_name,last_name,class_id,section_id,phone,father_name,photo_url,address,date_of_birth,gender")
          .eq("organization_id", orgId)
          .eq("status", "active")
          .order("admission_no"),
        supabase.from("classes").select("id,name").eq("organization_id", orgId).order("sort_order"),
        supabase.from("sections").select("id,class_id,name").eq("organization_id", orgId),
        supabase.from("organizations").select("name").eq("id", orgId).single(),
        supabase.from("organization_settings").select("phone,address,logo_url,primary_color,secondary_color").eq("organization_id", orgId).maybeSingle(),
      ]);

      if (stRes.data) {
        setStudents(stRes.data as Student[]);
        // Select all by default
        setSelectedIds(new Set(stRes.data.map((s) => s.id)));
      }
      if (clRes.data) setClasses(clRes.data);
      if (secRes.data) setSections(secRes.data);
      if (orgRes.data?.name) setOrgName(orgRes.data.name);
      if (setRes.data) setOrgSettings(setRes.data);
      setLoading(false);
    })();
  }, [orgId, hasAccess]);

  const classMap = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c.name])), [classes]);
  const sectionMap = useMemo(() => Object.fromEntries(sections.map((s) => [s.id, s.name])), [sections]);

  // Filtered Students
  const displayedStudents = useMemo(() => {
    return students.filter((s) => {
      const matchClass = selectedClass === "all" || s.class_id === selectedClass;
      const name = `${s.first_name} ${s.last_name || ""} ${s.admission_no}`.toLowerCase();
      const matchSearch = !searchQuery || name.includes(searchQuery.toLowerCase());
      return matchClass && matchSearch;
    });
  }, [students, selectedClass, searchQuery]);

  // Selected students for print
  const cardsToPrint = useMemo(() => {
    return displayedStudents.filter((s) => selectedIds.has(s.id));
  }, [displayedStudents, selectedIds]);

  const toggleSelectAll = () => {
    if (selectedIds.size === displayedStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedStudents.map((s) => s.id)));
    }
  };

  const toggleStudent = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  if (!featureActive) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <FeatureGate featureKey="id_cards" instituteName={orgName} />
      </div>
    );
  }

  if (authLoading) {
    return (
      <main className="mx-auto max-w-7xl p-8 text-center text-sm text-slate-500">
        Loading ID Card Generator...
      </main>
    );
  }

  if (!hasAccess) {
    return <AccessDenied moduleName="Student ID Card Generator" />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 print:bg-white print:p-0">
      {/* SCREEN-ONLY TOOLBAR & CONTROLS */}
      <div className="print:hidden border-b bg-white">
        <div className="mx-auto max-w-7xl px-5 py-4 sm:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <Link
                href="/students"
                className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
              >
                <ArrowLeft size={14} /> Back to Students
              </Link>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                Student ID Card Generator
              </h1>
              <p className="mt-1 text-xs text-slate-500 font-medium">
                High-resolution, printable student identity cards with barcodes, QR codes, and school branding.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                disabled={cardsToPrint.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-600/25 hover:bg-purple-700 transition active:scale-95 disabled:opacity-50"
              >
                <Printer size={15} />
                <span>Print {cardsToPrint.length} ID Cards</span>
              </button>
            </div>
          </div>

          {/* Filter & Appearance Controls Bar */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 pt-4 border-t border-slate-100">
            {/* Class Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Filter by Class
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm focus:border-purple-600 focus:outline-none"
              >
                <option value="all">All Classes ({students.length})</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Search Student
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Name or Roll No..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs font-semibold text-slate-800 shadow-sm focus:border-purple-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Theme Color Picker */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Card Theme Color
              </label>
              <div className="flex items-center gap-2">
                {[
                  { name: "Indigo", color: "#4f46e5" },
                  { name: "Purple", color: "#7c3aed" },
                  { name: "Emerald", color: "#059669" },
                  { name: "Navy", color: "#1e293b" },
                  { name: "Crimson", color: "#b91c1c" },
                ].map((c) => (
                  <button
                    key={c.color}
                    onClick={() => setThemeColor(c.color)}
                    style={{ backgroundColor: c.color }}
                    className={`h-7 w-7 rounded-lg transition-transform ${
                      themeColor === c.color ? "ring-2 ring-offset-2 ring-slate-800 scale-110" : "opacity-80 hover:opacity-100"
                    }`}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            {/* Validity Text */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Academic Validity
              </label>
              <input
                type="text"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                placeholder="e.g. 2026-27"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm focus:border-purple-600 focus:outline-none"
              />
            </div>

            {/* Selection Status & Toggles */}
            <div className="flex flex-col justify-end">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-1">
                <button
                  onClick={toggleSelectAll}
                  className="inline-flex items-center gap-1.5 text-purple-700 hover:text-purple-900"
                >
                  {selectedIds.size === displayedStudents.length ? (
                    <CheckSquare size={16} className="text-purple-600" />
                  ) : (
                    <Square size={16} className="text-slate-400" />
                  )}
                  <span>
                    {selectedIds.size === displayedStudents.length ? "Deselect All" : "Select All"} ({displayedStudents.length})
                  </span>
                </button>
                <span className="text-slate-400">
                  {cardsToPrint.length} selected
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PRINT-READY CARDS GRID */}
      <main className="mx-auto max-w-7xl p-5 sm:p-8 print:p-0 print:max-w-none">
        {loading ? (
          <div className="py-20 text-center text-sm text-slate-400">Loading student records...</div>
        ) : cardsToPrint.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <Users size={32} className="mx-auto text-slate-400" />
            <h3 className="mt-3 text-base font-bold text-slate-800">No students selected</h3>
            <p className="mt-1 text-xs text-slate-500">
              Please check at least one student or click "Select All" above to generate ID cards.
            </p>
          </div>
        ) : (
          <div className="id-card-sheet grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print:grid-cols-2 print:gap-4">
            {cardsToPrint.map((s) => {
              const className = s.class_id ? classMap[s.class_id] || "Standard" : "Standard";
              const sectionName = s.section_id ? sectionMap[s.section_id] || "" : "";
              const fullName = `${s.first_name} ${s.last_name || ""}`.trim();
              const initials = `${s.first_name[0] || ""}${(s.last_name || "")[0] || ""}`.toUpperCase();
              const origin = typeof window !== "undefined" ? window.location.origin : "https://edutechlab-9fz4.vercel.app";
              const qrData = `${origin}/parent-portal?id=${encodeURIComponent(s.admission_no)}`;
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}`;

              return (
                <div
                  key={s.id}
                  className="id-card relative mx-auto w-full max-w-[320px] rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden flex flex-col justify-between print:shadow-none print:border-slate-300 print:break-inside-avoid print:w-[320px] print:h-[480px]"
                  style={{ minHeight: "460px" }}
                >
                  {/* Card Header with School Branding */}
                  <div
                    className="p-3 text-center text-white relative"
                    style={{ backgroundColor: themeColor }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className="grid h-7 w-7 place-items-center rounded-lg bg-white/20 text-white font-bold text-xs backdrop-blur-sm">
                        <GraduationCap size={16} />
                      </div>
                      <div className="text-left">
                        <h4 className="font-extrabold text-xs uppercase tracking-wide leading-tight line-clamp-1">
                          {orgName}
                        </h4>
                        <p className="text-[9px] text-white/80 font-medium line-clamp-1">
                          {orgSettings?.address || "Education Institute"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-1 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-widest text-white">
                      STUDENT IDENTITY CARD
                    </div>
                  </div>

                  {/* Student Photo & Name Section */}
                  <div className="px-4 pt-3 text-center">
                    <div className="relative mx-auto h-20 w-20 rounded-xl border-2 border-white shadow-md overflow-hidden bg-slate-100 grid place-items-center">
                      {s.photo_url ? (
                        <img
                          src={s.photo_url}
                          alt={fullName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="h-full w-full grid place-items-center text-xl font-black text-white"
                          style={{ backgroundColor: themeColor }}
                        >
                          {initials || "ST"}
                        </div>
                      )}
                    </div>

                    <h3 className="mt-2 text-base font-extrabold text-slate-900 leading-tight">
                      {fullName}
                    </h3>
                    <div className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                      <span>Class: {className} {sectionName ? `(${sectionName})` : ""}</span>
                      <span>•</span>
                      <span>Roll/Adm: {s.admission_no}</span>
                    </div>
                  </div>

                  {/* Student Details Grid */}
                  <div className="px-4 py-2 text-[11px] text-slate-700 space-y-1">
                    {s.father_name && (
                      <div className="flex justify-between border-b border-slate-100 pb-0.5">
                        <span className="font-semibold text-slate-400">Father:</span>
                        <span className="font-bold text-slate-800 truncate max-w-[170px]">{s.father_name}</span>
                      </div>
                    )}
                    {s.date_of_birth && (
                      <div className="flex justify-between border-b border-slate-100 pb-0.5">
                        <span className="font-semibold text-slate-400">Date of Birth:</span>
                        <span className="font-bold text-slate-800">{s.date_of_birth}</span>
                      </div>
                    )}
                    {s.phone && (
                      <div className="flex justify-between border-b border-slate-100 pb-0.5">
                        <span className="font-semibold text-slate-400">Emergency Phone:</span>
                        <span className="font-bold text-slate-800 font-mono">{s.phone}</span>
                      </div>
                    )}
                    {s.gender && (
                      <div className="flex justify-between border-b border-slate-100 pb-0.5">
                        <span className="font-semibold text-slate-400">Gender:</span>
                        <span className="font-bold text-slate-800 capitalize">{s.gender}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-b border-slate-100 pb-0.5">
                      <span className="font-semibold text-slate-400">Academic Session:</span>
                      <span className="font-bold text-slate-800">{validUntil}</span>
                    </div>
                  </div>

                  {/* Verification QR, Barcode & Signature */}
                  <div className="px-4 pb-3 pt-1 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center justify-between">
                      {showQr && (
                        <div className="flex items-center gap-1.5">
                          <img
                            src={qrUrl}
                            alt="Verification QR"
                            className="h-10 w-10 rounded border border-slate-200 bg-white p-0.5"
                          />
                          <div className="text-[8px] text-slate-500 font-medium leading-tight">
                            <span>Scan to</span><br />
                            <strong className="text-slate-800">Verify</strong>
                          </div>
                        </div>
                      )}

                      <div className="text-right">
                        <div className="h-6 w-24 border-b border-dashed border-slate-400" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                          Principal Sign
                        </span>
                      </div>
                    </div>

                    {showBarcode && (
                      <div className="mt-2 text-center">
                        {/* CSS Simulated Barcode */}
                        <div className="h-4 flex justify-center items-center gap-0.5 overflow-hidden opacity-80">
                          {s.admission_no.split("").map((ch, i) => (
                            <div
                              key={i}
                              className="h-full bg-slate-900"
                              style={{ width: (ch.charCodeAt(0) % 3) + 1 + "px" }}
                            />
                          ))}
                          <div className="h-full w-1 bg-slate-900" />
                          <div className="h-full w-0.5 bg-slate-900" />
                          <div className="h-full w-2 bg-slate-900" />
                        </div>
                        <span className="text-[8px] font-mono tracking-widest text-slate-400">
                          *{s.admission_no}*
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Print Specific CSS Styles */}
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
          .id-card-sheet {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12mm !important;
          }
          .id-card {
            page-break-inside: avoid !important;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
