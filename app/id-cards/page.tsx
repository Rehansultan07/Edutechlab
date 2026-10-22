"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  ArrowLeft,
  Printer,
  Search,
  Users,
  Download,
  Filter,
  CheckSquare,
  Square,
  Palette,
  GraduationCap,
  Phone,
  MapPin,
  Calendar,
  Droplet,
  QrCode,
  ShieldCheck,
  Wallet,
  Sparkles,
  Layers,
  FileText,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
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

type StudentFeeStatus = {
  hasDues: boolean;
  dueAmount: number;
  dueMonthsCount: number;
};

const THEME_COLORS = [
  { name: "Royal Indigo", hex: "#4338ca" },
  { name: "Deep Navy", hex: "#0f2746" },
  { name: "Emerald Green", hex: "#047857" },
  { name: "Crimson Maroon", hex: "#881337" },
  { name: "Dark Slate", hex: "#1e293b" },
  { name: "Deep Violet", hex: "#6b21a8" },
];

function QRCodeImage({ value, className }: { value: string; className?: string }) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: 220,
      margin: 1,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch((err) => {
        console.error("QR Code generation fallback:", err);
        if (active) {
          setDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(value)}`);
        }
      });

    return () => {
      active = false;
    };
  }, [value]);

  if (!dataUrl) {
    return <div className={`animate-pulse bg-slate-200 ${className}`} />;
  }

  return <img src={dataUrl} alt="Attendance & Verification QR" className={className} />;
}

export default function IdCardGenerator() {
  const supabase = createClient();
  const { loading: authLoading, orgId, hasAccess } = useUserAccess(["students.view"]);

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [orgName, setOrgName] = useState("Your Institution");
  const [orgSettings, setOrgSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [featureActive, setFeatureActive] = useState(true);

  // Fee status map: student_id -> { hasDues, dueAmount, dueMonthsCount }
  const [feeMap, setFeeMap] = useState<Record<string, StudentFeeStatus>>({});

  // Filters
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [feeFilter, setFeeFilter] = useState<"all" | "due" | "cleared">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Card Appearance Options
  const [themeColor, setThemeColor] = useState<string>("#0f2746");
  const [sessionYear, setSessionYear] = useState<string>("2026-2027");
  const [cardLayout, setCardLayout] = useState<"front" | "dual">("front");
  const [showQr, setShowQr] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [printFeeStamp, setPrintFeeStamp] = useState(false);

  useEffect(() => {
    if (!orgId || !hasAccess) return;
    (async () => {
      setLoading(true);
      setErrorMsg("");
      try {
        const feat = await fetchInstitutionFeatures(supabase, orgId);
        if (feat && feat.id_cards === false) {
          setFeatureActive(false);
          setLoading(false);
          return;
        }

        // Check URL search parameters (e.g. ?id=01)
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const qParam = params.get("id") || params.get("adm") || params.get("search");
          if (qParam) {
            setSearchQuery(qParam);
          }
        }

        // Query students with safety fallback
        let stData: Student[] = [];
        const stRes = await supabase
          .from("students")
          .select(
            "id,admission_no,first_name,last_name,class_id,section_id,phone,father_name,photo_url,address,date_of_birth,blood_group,gender"
          )
          .eq("organization_id", orgId)
          .eq("status", "active")
          .order("admission_no");

        if (stRes.error) {
          console.warn("Retrying students query without blood_group:", stRes.error.message);
          const fallbackRes = await supabase
            .from("students")
            .select(
              "id,admission_no,first_name,last_name,class_id,section_id,phone,father_name,photo_url,address,date_of_birth,gender"
            )
            .eq("organization_id", orgId)
            .eq("status", "active")
            .order("admission_no");

          if (fallbackRes.data) {
            stData = fallbackRes.data as Student[];
          } else if (fallbackRes.error) {
            setErrorMsg(fallbackRes.error.message);
          }
        } else if (stRes.data) {
          stData = stRes.data as Student[];
        }

        setStudents(stData);
        setSelectedIds(new Set(stData.map((s) => s.id)));

        // Metadata queries
        const [clRes, secRes, orgRes, setRes, feeRes] = await Promise.all([
          supabase.from("classes").select("id,name").eq("organization_id", orgId).order("sort_order"),
          supabase.from("sections").select("id,class_id,name").eq("organization_id", orgId),
          supabase.from("organizations").select("name").eq("id", orgId).single(),
          supabase
            .from("organization_settings")
            .select("phone,address,logo_url,primary_color,secondary_color")
            .eq("organization_id", orgId)
            .maybeSingle(),
          supabase
            .from("student_fee_months")
            .select("student_id,amount_due,amount_paid,status")
            .eq("organization_id", orgId),
        ]);

        if (clRes.data) setClasses(clRes.data);
        if (secRes.data) setSections(secRes.data);
        if (orgRes.data?.name) setOrgName(orgRes.data.name);
        if (setRes.data) setOrgSettings(setRes.data);

        // Compute student fee dues
        if (feeRes.data) {
          const computedMap: Record<string, StudentFeeStatus> = {};
          feeRes.data.forEach((row: any) => {
            if (row.status === "due" || row.status === "partial") {
              const dueBal = Math.max(0, Number(row.amount_due || 0) - Number(row.amount_paid || 0));
              if (!computedMap[row.student_id]) {
                computedMap[row.student_id] = { hasDues: true, dueAmount: 0, dueMonthsCount: 0 };
              }
              computedMap[row.student_id].dueAmount += dueBal;
              computedMap[row.student_id].dueMonthsCount += 1;
            }
          });
          setFeeMap(computedMap);
        }
      } catch (err: any) {
        console.error("ID Cards load exception:", err);
        setErrorMsg(err.message || "Failed to load ID card records.");
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId, hasAccess, supabase]);

  const classMap = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c.name])), [classes]);
  const sectionMap = useMemo(() => Object.fromEntries(sections.map((s) => [s.id, s.name])), [sections]);

  // Filtered Students
  const displayedStudents = useMemo(() => {
    return students.filter((s) => {
      const matchClass = selectedClass === "all" || s.class_id === selectedClass;
      const sFee = feeMap[s.id];
      const matchFee =
        feeFilter === "all" ||
        (feeFilter === "due" && sFee && sFee.hasDues) ||
        (feeFilter === "cleared" && (!sFee || !sFee.hasDues));

      const query = searchQuery.toLowerCase();
      const matchSearch =
        !query ||
        `${s.first_name} ${s.last_name || ""} ${s.admission_no} ${s.father_name || ""}`
          .toLowerCase()
          .includes(query);

      return matchClass && matchFee && matchSearch;
    });
  }, [students, selectedClass, feeFilter, searchQuery, feeMap]);

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
    return <AccessDenied moduleName="ID Cards" />;
  }

  const originUrl =
    typeof window !== "undefined" ? window.location.origin : "https://edutechlab-9fz4.vercel.app";

  return (
    <div className="min-h-screen bg-slate-100/70 pb-16">
      {/* ============================================================== */}
      {/* TOP CONTROL BAR (Hidden during printing)                       */}
      {/* ============================================================== */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 py-4 sm:px-8 print:hidden shadow-sm">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Student Identity Cards
                </h1>
                <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700">
                  QR Smart ID Generator
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Generate high-resolution printable ID cards equipped with live attendance QR codes &amp; fee verification.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => window.print()}
              disabled={cardsToPrint.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition disabled:opacity-50"
            >
              <Printer size={15} />
              <span>Print {cardsToPrint.length} Selected Cards</span>
            </button>
          </div>
        </div>

        {/* Customization Toolbar */}
        <div className="mx-auto max-w-7xl mt-4 pt-4 border-t border-slate-100 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-center text-xs">
          {/* Class Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Class
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-purple-600"
            >
              <option value="all">All Classes ({students.length})</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Fee Status Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Fee Status Filter
            </label>
            <select
              value={feeFilter}
              onChange={(e) => setFeeFilter(e.target.value as any)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-purple-600"
            >
              <option value="all">All Students</option>
              <option value="due">⚠️ Students With Due Fees</option>
              <option value="cleared">✅ Fee Cleared Students</option>
            </select>
          </div>

          {/* Theme Color Selector */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Card Color Theme
            </label>
            <div className="flex items-center gap-1.5">
              {THEME_COLORS.map((tc) => (
                <button
                  key={tc.hex}
                  type="button"
                  onClick={() => setThemeColor(tc.hex)}
                  className={`h-7 w-7 rounded-xl transition-transform ${
                    themeColor === tc.hex ? "scale-110 ring-2 ring-purple-600 ring-offset-2" : "opacity-80"
                  }`}
                  style={{ backgroundColor: tc.hex }}
                  title={tc.name}
                />
              ))}
            </div>
          </div>

          {/* Academic Session */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Academic Session
            </label>
            <input
              type="text"
              value={sessionYear}
              onChange={(e) => setSessionYear(e.target.value)}
              placeholder="e.g. 2026-2027"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-purple-600"
            />
          </div>

          {/* Dual Side Toggle */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Card Format
            </label>
            <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setCardLayout("front")}
                className={`flex-1 rounded-lg py-1.5 transition ${
                  cardLayout === "front" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                Front Only
              </button>
              <button
                type="button"
                onClick={() => setCardLayout("dual")}
                className={`flex-1 rounded-lg py-1.5 transition ${
                  cardLayout === "dual" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                Front &amp; Back
              </button>
            </div>
          </div>
        </div>

        {/* Search & Selection Sub-Bar */}
        <div className="mx-auto max-w-7xl mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search student by name, admission no, or father's name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs outline-none focus:border-purple-600 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-1.5 font-bold text-slate-700 hover:text-slate-900"
            >
              {selectedIds.size === displayedStudents.length ? (
                <CheckSquare size={16} className="text-purple-600" />
              ) : (
                <Square size={16} className="text-slate-400" />
              )}
              <span>
                Select All ({selectedIds.size}/{displayedStudents.length})
              </span>
            </button>

            {/* Optional Print Watermark Toggle */}
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-600">
              <input
                type="checkbox"
                checked={printFeeStamp}
                onChange={(e) => setPrintFeeStamp(e.target.checked)}
                className="rounded border-slate-300 text-purple-600"
              />
              <span>Print Fee Due Stamp on Defaulters</span>
            </label>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* PRINT SHEET: PVC CR80 SMART ID CARDS GRID                      */}
      {/* ============================================================== */}
      <main className="mx-auto max-w-7xl p-5 sm:p-8 print:p-0 print:max-w-none">
        {errorMsg && (
          <div className="mb-6 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1 font-bold text-amber-900 hover:underline"
            >
              <RotateCcw size={12} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center text-sm text-slate-400">Loading student records &amp; fee balances...</div>
        ) : students.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center my-8">
            <Users size={36} className="mx-auto text-purple-600" />
            <h3 className="mt-3 text-base font-bold text-slate-800">No students enrolled yet</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
              You need to admit students in your school database before generating printable Smart ID cards.
            </p>
            <Link
              href="/students"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-purple-700 transition"
            >
              Go to Student Admission →
            </Link>
          </div>
        ) : cardsToPrint.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center my-8">
            <Users size={36} className="mx-auto text-slate-400" />
            <h3 className="mt-3 text-base font-bold text-slate-800">No students match your filter</h3>
            <p className="mt-1 text-xs text-slate-500">
              Try resetting the fee filter or class search, or click &quot;Select All&quot; above.
            </p>
            <button
              onClick={() => {
                setSelectedClass("all");
                setFeeFilter("all");
                setSearchQuery("");
                setSelectedIds(new Set(students.map((s) => s.id)));
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="id-card-sheet grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print:grid-cols-2 print:gap-4">
            {cardsToPrint.map((s) => {
              const className = s.class_id ? classMap[s.class_id] || "Standard" : "Standard";
              const sectionName = s.section_id ? sectionMap[s.section_id] || "" : "";
              const fullName = `${s.first_name} ${s.last_name || ""}`.trim();
              const initials = `${s.first_name[0] || ""}${(s.last_name || "")[0] || ""}`.toUpperCase();

              // QR encodes direct verification portal URL
              const qrData = `${originUrl}/parent-portal?id=${encodeURIComponent(s.admission_no)}`;

              const sFee = feeMap[s.id];
              const hasFeeDues = sFee && sFee.hasDues;

              return (
                <div key={s.id} className="flex flex-col gap-3">
                  {/* Selection Checkbox for Admin (Hidden during print) */}
                  <div className="flex items-center justify-between text-xs print:hidden px-1">
                    <button
                      type="button"
                      onClick={() => toggleStudent(s.id)}
                      className="flex items-center gap-1.5 font-bold text-slate-700 hover:text-slate-900"
                    >
                      {selectedIds.has(s.id) ? (
                        <CheckSquare size={16} className="text-purple-600" />
                      ) : (
                        <Square size={16} className="text-slate-400" />
                      )}
                      <span>Select</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIds(new Set([s.id]));
                          setTimeout(() => window.print(), 100);
                        }}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-100 hover:bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 transition"
                        title="Print only this ID card"
                      >
                        <Printer size={11} />
                        <span>Print</span>
                      </button>

                      {hasFeeDues ? (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300">
                          Fee Due: ₹{sFee.dueAmount}
                        </span>
                      ) : (
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          Fee Paid ✓
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ========================================================== */}
                  {/* CARD FRONT: PROFESSIONAL PVC SMART IDENTITY CARD           */}
                  {/* ========================================================== */}
                  <div
                    className="id-card relative mx-auto w-full max-w-[325px] rounded-2xl border border-slate-300 bg-white shadow-lg overflow-hidden flex flex-col justify-between print:shadow-none print:border-slate-400 print:break-inside-avoid print:w-[320px] print:h-[490px]"
                    style={{ minHeight: "490px" }}
                  >
                    {/* Top Lanyard Slot Guide Mark */}
                    <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-20 w-8 h-1.5 rounded-full bg-white/40 border border-white/60 pointer-events-none" />

                    {/* Card Header with School Crest Branding */}
                    <div
                      className="pt-4 pb-2.5 px-3 text-center text-white relative shadow-sm"
                      style={{ backgroundColor: themeColor }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        {orgSettings?.logo_url ? (
                          <img
                            src={orgSettings.logo_url}
                            alt=""
                            className="h-8 w-8 rounded-lg object-contain bg-white/10 p-0.5"
                          />
                        ) : (
                          <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/20 text-white font-bold text-xs backdrop-blur-sm">
                            <GraduationCap size={18} />
                          </div>
                        )}
                        <div className="text-left">
                          <h4 className="font-black text-xs uppercase tracking-wide leading-tight line-clamp-1">
                            {orgName}
                          </h4>
                          <p className="text-[9px] text-white/80 font-medium line-clamp-1">
                            {orgSettings?.address || "Recognized Educational Institution"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between px-2 text-[8px] font-black uppercase tracking-widest text-white/90 border-t border-white/20 pt-1">
                        <span>STUDENT SMART ID</span>
                        <span>SESSION {sessionYear}</span>
                      </div>
                    </div>

                    {/* Student Photo & Identity Pill */}
                    <div className="px-4 pt-2.5 text-center relative">
                      {/* Photo Frame */}
                      <div className="relative mx-auto h-22 w-22 rounded-2xl border-2 border-white shadow-md overflow-hidden bg-slate-100 grid place-items-center">
                        {s.photo_url ? (
                          <img
                            src={s.photo_url}
                            alt={fullName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div
                            className="h-full w-full grid place-items-center text-2xl font-black text-white"
                            style={{ backgroundColor: themeColor }}
                          >
                            {initials || "ST"}
                          </div>
                        )}
                      </div>

                      <h3 className="mt-2 text-base font-black text-slate-900 leading-tight uppercase tracking-tight">
                        {fullName}
                      </h3>

                      <div className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold text-purple-800 border border-purple-200">
                        <span>Class: {className} {sectionName ? `(${sectionName})` : ""}</span>
                        <span>&bull;</span>
                        <span>Adm No: <strong className="font-mono text-purple-900">{s.admission_no}</strong></span>
                      </div>
                    </div>

                    {/* Student Details Grid */}
                    <div className="px-4 py-2 text-[11px] text-slate-700 space-y-1">
                      {s.father_name && (
                        <div className="flex justify-between border-b border-slate-100 pb-0.5">
                          <span className="font-semibold text-slate-400">Father / Guardian:</span>
                          <span className="font-bold text-slate-800 truncate max-w-[170px]">
                            {s.father_name}
                          </span>
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
                          <span className="font-semibold text-slate-400">Emergency Contact:</span>
                          <span className="font-bold text-slate-800 font-mono">{s.phone}</span>
                        </div>
                      )}
                      {s.blood_group && (
                        <div className="flex justify-between border-b border-slate-100 pb-0.5">
                          <span className="font-semibold text-slate-400">Blood Group:</span>
                          <span className="font-bold text-red-600">{s.blood_group}</span>
                        </div>
                      )}
                      {s.address && (
                        <div className="flex justify-between border-b border-slate-100 pb-0.5">
                          <span className="font-semibold text-slate-400">Address:</span>
                          <span className="font-medium text-slate-800 truncate max-w-[190px]">
                            {s.address}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Optional Fee Status Watermark Stamp */}
                    {printFeeStamp && hasFeeDues && (
                      <div className="mx-4 my-1 rounded-md bg-amber-50 border border-amber-300 p-1 text-center text-[9px] font-bold text-amber-800">
                        ⚠️ Pending Fee Dues: ₹{sFee.dueAmount}
                      </div>
                    )}

                    {/* Card Bottom: High-Res QR + Signature + Barcode */}
                    <div className="px-4 pb-3 pt-1.5 border-t border-slate-200 bg-slate-50/70">
                      <div className="flex items-center justify-between">
                        {/* High-Resolution QR Code */}
                        {showQr && (
                          <div className="flex items-center gap-2">
                            <QRCodeImage
                              value={qrData}
                              className="h-12 w-12 rounded-lg border border-slate-300 bg-white p-0.5 shadow-sm"
                            />
                            <div className="text-[8px] text-slate-500 font-semibold leading-tight">
                              <span className="font-bold text-slate-800 block">Scan for Gate</span>
                              <span>Attendance &amp; Dues</span>
                            </div>
                          </div>
                        )}

                        {/* Principal Signature & Seal */}
                        <div className="text-right">
                          <div className="h-6 w-24 border-b border-dashed border-slate-400 flex items-center justify-center">
                            <span className="text-[8px] text-purple-700 font-serif italic opacity-75">
                              Authorized
                            </span>
                          </div>
                          <span className="text-[8px] font-extrabold text-slate-500 uppercase tracking-tighter block mt-0.5">
                            Principal Sign
                          </span>
                        </div>
                      </div>

                      {/* Barcode Representation */}
                      {showBarcode && (
                        <div className="mt-2 text-center">
                          <div className="h-3.5 flex justify-center items-center gap-0.5 overflow-hidden opacity-80">
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
                          <span className="text-[8px] font-mono tracking-widest text-slate-500 block">
                            *{s.admission_no}*
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ========================================================== */}
                  {/* CARD BACK SIDE (If Dual Side Format is selected)           */}
                  {/* ========================================================== */}
                  {cardLayout === "dual" && (
                    <div
                      className="id-card-back relative mx-auto w-full max-w-[325px] rounded-2xl border border-slate-300 bg-white shadow-lg overflow-hidden flex flex-col justify-between print:shadow-none print:border-slate-400 print:break-inside-avoid print:w-[320px] print:h-[490px] p-4 text-xs"
                      style={{ minHeight: "490px" }}
                    >
                      <div>
                        {/* Header */}
                        <div className="text-center border-b border-slate-200 pb-2">
                          <h4 className="font-extrabold text-xs uppercase text-slate-900">
                            {orgName}
                          </h4>
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                            Card Holder Guidelines &bull; Terms
                          </span>
                        </div>

                        {/* Rules List */}
                        <div className="mt-3 space-y-2 text-[10px] text-slate-600 leading-relaxed">
                          <p>
                            1. <strong>Mandatory Attendance:</strong> Student must carry this card daily and scan at the gate QR kiosk upon arrival.
                          </p>
                          <p>
                            2. <strong>Non-Transferable:</strong> This card is issued exclusively for {fullName} and cannot be transferred or lent.
                          </p>
                          <p>
                            3. <strong>Loss or Damage:</strong> In case of loss or damage, immediately inform the school administration office for a replacement card.
                          </p>
                          <p>
                            4. <strong>Live Verification:</strong> Parents can scan the front QR code from any smartphone to view live attendance records and fee dues status.
                          </p>
                        </div>
                      </div>

                      {/* Contact & Return Notice */}
                      <div className="border-t border-slate-200 pt-3">
                        <div className="rounded-xl bg-slate-50 p-2.5 text-[10px] text-slate-700 space-y-1">
                          <p className="font-bold text-slate-900">If found, please return to:</p>
                          <p>{orgSettings?.address || orgName}</p>
                          {orgSettings?.phone && (
                            <p className="font-mono">Helpline: {orgSettings.phone}</p>
                          )}
                        </div>

                        <div className="mt-3 text-center text-[9px] text-slate-400 font-mono">
                          VALID FOR ACADEMIC SESSION {sessionYear}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Print Specific CSS Styles for exact A4 layout */}
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          @page {
            size: A4;
            margin: 8mm;
          }
          .id-card-sheet {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
          }
          .id-card,
          .id-card-back {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            margin-bottom: 8px !important;
          }
        }
      `}</style>
    </div>
  );
}
