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
  ExternalLink,
  CheckCircle2,
  X,
  CreditCard,
  Maximize2,
  Scissors,
  Settings2,
  SlidersHorizontal,
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

export type SheetPresetId = "8_standard" | "10_horizontal" | "9_vertical" | "dragon_fold";

interface SheetPresetDef {
  id: SheetPresetId;
  title: string;
  badge: string;
  capacity: number;
  description: string;
  screenGrid: string;
  printClass: string;
  orientation: "vertical" | "horizontal";
  isDragon?: boolean;
}

const SHEET_PRESETS: SheetPresetDef[] = [
  {
    id: "8_standard",
    title: "Standard 8 Cards / A4 (Recommended)",
    badge: "⭐ Recommended • 2×4 Grid",
    capacity: 8,
    description: "2 columns × 4 rows. Safe 4mm cutting gaps. 100% compatible with all desktop printers without edge clipping.",
    screenGrid: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    printClass: "sheet-preset-8_standard",
    orientation: "vertical",
  },
  {
    id: "10_horizontal",
    title: "Economy 10 Cards / A4 (Horizontal)",
    badge: "📄 Max Paper Saving • 2×5 Grid",
    capacity: 10,
    description: "2 columns × 5 rows in Landscape format. Fits 10 students per page for lowest cost per student.",
    screenGrid: "grid-cols-1 md:grid-cols-2",
    printClass: "sheet-preset-10_horizontal",
    orientation: "horizontal",
  },
  {
    id: "9_vertical",
    title: "Compact 9 Cards / A4 (Vertical 3×3)",
    badge: "📐 High Density • 3×3 Grid",
    capacity: 9,
    description: "3 columns × 3 rows vertical layout. Maximizes portrait card count per sheet.",
    screenGrid: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    printClass: "sheet-preset-9_vertical",
    orientation: "vertical",
  },
  {
    id: "dragon_fold",
    title: "PVC Dragon Sheet (Front + Back Paired)",
    badge: "🛡️ Heavy Thermal PVC Foldable",
    capacity: 4,
    description: "Front & Back paired side-by-side with a center fold line. 4 students (8 sides) per sheet for heavy thermal pouch lamination.",
    screenGrid: "grid-cols-1 lg:grid-cols-2",
    printClass: "sheet-preset-dragon_fold",
    orientation: "vertical",
    isDragon: true,
  },
];

const THEME_COLORS = [
  { name: "Royal Indigo", hex: "#312e81", accent: "#6366f1" },
  { name: "Deep Navy", hex: "#0a192f", accent: "#38bdf8" },
  { name: "Emerald Green", hex: "#064e3b", accent: "#10b981" },
  { name: "Crimson Maroon", hex: "#831843", accent: "#f43f5e" },
  { name: "Dark Slate", hex: "#0f172a", accent: "#94a3b8" },
  { name: "Royal Purple", hex: "#581c87", accent: "#a855f7" },
];

function QRCodeImage({
  value,
  className,
  size = 360,
}: {
  value: string;
  className?: string;
  size?: number;
}) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: {
        dark: "#000000",
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
          setDataUrl(
            `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(value)}`
          );
        }
      });

    return () => {
      active = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return <div className={`animate-pulse bg-slate-200 ${className}`} />;
  }

  return <img src={dataUrl} alt="Attendance & Verification QR" className={className} />;
}

export default function IdCardGenerator() {
  const supabase = createClient();
  const { loading: authLoading, orgId, hasAccess } = useUserAccess([
    "idcards.manage",
    "students.view",
    "students.manage",
  ]);

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
  const [themeColor, setThemeColor] = useState<string>("#0a192f");
  const [sessionYear, setSessionYear] = useState<string>("2026-2027");
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [cardLayout, setCardLayout] = useState<"front" | "dual">("front");
  const [printFeeStamp, setPrintFeeStamp] = useState(false);

  // A4 Sheet Layout & Print Settings
  const [sheetPreset, setSheetPreset] = useState<SheetPresetId>("8_standard");
  const [showCutGuides, setShowCutGuides] = useState(true);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // QR Inspection Modal
  const [inspectStudent, setInspectStudent] = useState<Student | null>(null);
  const [simulatingScan, setSimulatingScan] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);

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

  // Current active preset definition
  const activePreset = useMemo(
    () => SHEET_PRESETS.find((p) => p.id === sheetPreset) || SHEET_PRESETS[0],
    [sheetPreset]
  );

  // Sync orientation with preset selection
  const handleSelectPreset = (presetId: SheetPresetId) => {
    setSheetPreset(presetId);
    const p = SHEET_PRESETS.find((x) => x.id === presetId);
    if (p) {
      setOrientation(p.orientation);
      if (p.isDragon) {
        setCardLayout("dual");
      }
    }
  };

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

  // Live domain URL for QR codes (guarantees phones scan to public URL even when tested locally)
  const originUrl =
    typeof window !== "undefined" &&
    !window.location.hostname.includes("localhost") &&
    !window.location.hostname.includes("127.0.0.1")
      ? window.location.origin
      : "https://edutechlab-9fz4.vercel.app";

  const handleSimulateGateScan = async (admissionNo: string) => {
    setSimulatingScan(true);
    setScanResult(null);
    try {
      const { data: res, error } = await supabase.rpc("mark_qr_attendance", {
        p_admission_no: admissionNo,
        p_organization_id: orgId,
      });
      if (error) throw error;
      setScanResult(res);
    } catch (err: any) {
      setScanResult({ success: false, error: err.message || "Failed to mark attendance" });
    } finally {
      setSimulatingScan(false);
    }
  };

  const handleProceedPrint = () => {
    setShowPrintModal(false);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Estimated sheets needed
  const estimatedSheets = Math.ceil(cardsToPrint.length / activePreset.capacity) || 1;

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

  return (
    <div className="min-h-screen bg-slate-100/70 pb-16 font-sans">
      {/* ============================================================== */}
      {/* TOP CONTROL BAR (Hidden during printing)                       */}
      {/* ============================================================== */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 py-4 sm:px-8 print:hidden shadow-sm">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shadow-xs"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Student Identity Cards
                </h1>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                  {activePreset.badge}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Generate high-resolution printable ID cards equipped with live attendance QR codes &amp; fee verification.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/attendance"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              <QrCode size={15} className="text-purple-600" />
              <span>Gate QR Scanner Kiosk</span>
            </Link>

            {/* Print Settings Button */}
            <button
              onClick={() => setShowPrintModal(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-xs font-bold text-purple-700 shadow-xs hover:bg-purple-100 transition"
              title="Configure A4 Sheet Layout & Cut Guides"
            >
              <Settings2 size={15} />
              <span>A4 Print Setup</span>
            </button>

            {/* Main Print Button */}
            <button
              onClick={() => setShowPrintModal(true)}
              disabled={cardsToPrint.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition disabled:opacity-50"
            >
              <Printer size={15} />
              <span>Print {cardsToPrint.length} Cards ({estimatedSheets} Sheet{estimatedSheets > 1 ? "s" : ""})</span>
            </button>
          </div>
        </div>

        {/* Customization Toolbar */}
        <div className="mx-auto max-w-7xl mt-4 pt-4 border-t border-slate-100 grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-center text-xs">
          {/* A4 Sheet Layout Selector (The Requested Feature) */}
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-purple-700 mb-1 flex items-center gap-1">
              <Printer size={12} />
              <span>A4 Sheet Print Layout</span>
            </label>
            <select
              value={sheetPreset}
              onChange={(e) => handleSelectPreset(e.target.value as SheetPresetId)}
              className="w-full rounded-xl border-2 border-purple-300 bg-purple-50/50 px-3 py-2 text-xs font-bold text-purple-950 outline-none focus:border-purple-600"
            >
              {SHEET_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

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
                    themeColor === tc.hex ? "scale-115 ring-2 ring-purple-600 ring-offset-2" : "opacity-80"
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
        </div>

        {/* Search, Layout Presets, & Cutting Guides Sub-Bar */}
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

          <div className="flex items-center gap-4 flex-wrap">
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

            {/* Scissor Cutting Guidelines Toggle */}
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 font-semibold select-none">
              <input
                type="checkbox"
                checked={showCutGuides}
                onChange={(e) => setShowCutGuides(e.target.checked)}
                className="rounded border-slate-300 text-purple-600"
              />
              <span className="flex items-center gap-1">
                <Scissors size={13} className="text-slate-500" />
                <span>Show Cut Guides (✂️ Lines)</span>
              </span>
            </label>

            {/* Optional Print Watermark Toggle */}
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-600 select-none">
              <input
                type="checkbox"
                checked={printFeeStamp}
                onChange={(e) => setPrintFeeStamp(e.target.checked)}
                className="rounded border-slate-300 text-purple-600"
              />
              <span>Fee Due Stamp</span>
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
          <div className={`id-card-sheet ${activePreset.printClass} grid gap-6 ${activePreset.screenGrid}`}>
            {cardsToPrint.map((s) => {
              const className = s.class_id ? classMap[s.class_id] || "Standard" : "Standard";
              const sectionName = s.section_id ? sectionMap[s.section_id] || "" : "";
              const fullName = `${s.first_name} ${s.last_name || ""}`.trim();
              const initials = `${s.first_name[0] || ""}${(s.last_name || "")[0] || ""}`.toUpperCase();

              // QR encodes direct parent portal / attendance scan verification URL
              const qrData = `${originUrl}/parent-portal?id=${encodeURIComponent(s.admission_no)}`;

              const sFee = feeMap[s.id];
              const hasFeeDues = sFee && sFee.hasDues;

              // Card Front Element
              const CardFront = (
                <div
                  className="id-card relative mx-auto w-full max-w-[340px] rounded-3xl border border-slate-300/80 bg-white shadow-xl overflow-hidden flex flex-col justify-between print:shadow-none print:border-slate-400 print:break-inside-avoid print:w-[325px] print:h-[500px]"
                  style={{ minHeight: "500px" }}
                >
                  {/* Top Lanyard Slot Guide Mark */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 w-9 h-1.5 rounded-full bg-slate-800/60 border border-white/50 pointer-events-none" />

                  {/* Header with Deep Modern Gradient */}
                  <div
                    className="pt-5 pb-3 px-3.5 text-center text-white relative shadow-sm"
                    style={{
                      backgroundColor: themeColor,
                      backgroundImage: `linear-gradient(135deg, ${themeColor} 0%, #030712 100%)`,
                      WebkitPrintColorAdjust: "exact",
                      printColorAdjust: "exact",
                    }}
                  >
                    <div className="flex items-center justify-center gap-2.5">
                      {orgSettings?.logo_url ? (
                        <img
                          src={orgSettings.logo_url}
                          alt=""
                          className="h-9 w-9 rounded-xl object-contain bg-white/10 p-0.5 border border-white/20 shadow-xs"
                        />
                      ) : (
                        <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 text-white font-bold text-xs backdrop-blur-sm border border-white/20 shadow-xs">
                          <GraduationCap size={20} />
                        </div>
                      )}
                      <div className="text-left">
                        <h4 className="font-black text-xs sm:text-sm uppercase tracking-wide leading-tight line-clamp-1">
                          {orgName}
                        </h4>
                        <p className="text-[9px] text-white/80 font-medium line-clamp-1">
                          {orgSettings?.address || "Recognized Educational Institution"}
                        </p>
                      </div>
                    </div>

                    {/* Metallic / Ribbon Sub-Bar */}
                    <div className="mt-2 flex items-center justify-between px-2 text-[8px] font-black uppercase tracking-widest text-white/90 border-t border-white/15 pt-1">
                      <span className="flex items-center gap-1">
                        <ShieldCheck size={10} className="text-amber-300" />
                        <span>STUDENT SMART PASS</span>
                      </span>
                      <span className="rounded bg-white/15 px-1.5 py-0.2">SESSION {sessionYear}</span>
                    </div>
                  </div>

                  {/* Student Photo & Identity Section */}
                  <div className="px-4 pt-3 text-center relative">
                    {/* Photo Frame with Dual Ring */}
                    <div className="relative mx-auto h-22 w-22 rounded-2xl border-3 border-white shadow-md overflow-hidden bg-slate-100 grid place-items-center ring-2 ring-slate-200">
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
                      {/* Active Dot */}
                      <div
                        className="absolute bottom-1 right-1 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white shadow-xs"
                        title="Active Student"
                      />
                    </div>

                    <h3 className="mt-2 text-base font-black text-slate-900 leading-tight uppercase tracking-tight">
                      {fullName}
                    </h3>

                    <div className="mt-1 flex items-center justify-center gap-1.5 flex-wrap">
                      <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-900 border border-purple-200">
                        Class: {className} {sectionName ? `(${sectionName})` : ""}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-800 font-mono border border-slate-200">
                        ID: {s.admission_no}
                      </span>
                    </div>
                  </div>

                  {/* Bio Details Grid */}
                  <div className="px-4 py-2 text-[10.5px] text-slate-700 space-y-1">
                    {s.father_name && (
                      <div className="flex justify-between border-b border-slate-100 pb-0.5">
                        <span className="font-semibold text-slate-400">Father&apos;s Name:</span>
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
                        <span className="font-bold text-red-600 bg-red-50 px-1.5 rounded">
                          {s.blood_group}
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

                  {/* ==================================================== */}
                  {/* PROMINENT HIGH-VISIBILITY QR SCAN HUB (THE KEY FIX)  */}
                  {/* ==================================================== */}
                  <div className="px-3.5 pb-3 pt-2 border-t border-slate-200 bg-slate-50/90">
                    <div className="flex items-center justify-between gap-3">
                      {/* Dedicated Large High-Contrast QR Code */}
                      <div
                        onClick={() => setInspectStudent(s)}
                        className="group relative cursor-pointer flex flex-col items-center bg-white p-1.5 rounded-2xl border-2 border-slate-200 shadow-sm hover:border-purple-500 hover:shadow-md transition"
                        title="Click to test QR Code & Attendance scan"
                      >
                        {/* Scanning reticle visual brackets */}
                        <div className="absolute top-0.5 left-0.5 w-2 h-2 border-t-2 border-l-2 border-slate-800 pointer-events-none rounded-tl-sm" />
                        <div className="absolute top-0.5 right-0.5 w-2 h-2 border-t-2 border-r-2 border-slate-800 pointer-events-none rounded-tr-sm" />
                        <div className="absolute bottom-0.5 left-0.5 w-2 h-2 border-b-2 border-l-2 border-slate-800 pointer-events-none rounded-bl-sm" />
                        <div className="absolute bottom-0.5 right-0.5 w-2 h-2 border-b-2 border-r-2 border-slate-800 pointer-events-none rounded-br-sm" />

                        <QRCodeImage
                          value={qrData}
                          className="h-24 w-24 object-contain rounded-lg"
                          size={360}
                        />
                        <span className="mt-1 text-[7.5px] font-black uppercase tracking-tight text-slate-800 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                          📷 GATE ATTENDANCE
                        </span>
                      </div>

                      {/* Right Side: Authority Seal & Sign */}
                      <div className="flex-1 flex flex-col justify-between h-24 text-right py-0.5">
                        <div className="flex items-center justify-end gap-1 text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                          <ShieldCheck size={12} className="text-purple-600" />
                          <span>Verified Card</span>
                        </div>

                        {/* Principal Signature Container */}
                        <div>
                          <div className="h-9 border-b border-dashed border-slate-400 flex items-end justify-center pb-0.5">
                            <span className="text-[12px] text-purple-800 font-serif italic font-bold">
                              Authorized Sign
                            </span>
                          </div>
                          <span className="text-[8px] font-extrabold text-slate-600 uppercase tracking-tight block mt-0.5">
                            Principal Signature
                          </span>
                        </div>

                        <div className="text-[7.5px] font-mono text-slate-400 tracking-widest">
                          *{s.admission_no}*
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );

              // Card Horizontal Element
              const CardHorizontal = (
                <div
                  className="id-card-horizontal relative mx-auto w-full max-w-[460px] rounded-3xl border border-slate-300 bg-white shadow-xl overflow-hidden flex flex-col justify-between print:shadow-none print:border-slate-400 print:break-inside-avoid print:w-[440px] print:h-[265px]"
                  style={{ minHeight: "265px" }}
                >
                  {/* Top Lanyard Slot Guide Mark */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 w-10 h-1.5 rounded-full bg-slate-800/50 border border-white/60 pointer-events-none" />

                  {/* Header with Institution Banner */}
                  <div
                    className="pt-4 pb-2 px-4 text-white relative shadow-sm"
                    style={{
                      backgroundColor: themeColor,
                      backgroundImage: `linear-gradient(135deg, ${themeColor} 0%, #030712 100%)`,
                      WebkitPrintColorAdjust: "exact",
                      printColorAdjust: "exact",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {orgSettings?.logo_url ? (
                          <img
                            src={orgSettings.logo_url}
                            alt=""
                            className="h-8 w-8 rounded-lg object-contain bg-white/10 p-0.5 border border-white/20"
                          />
                        ) : (
                          <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/20 text-white font-bold text-xs backdrop-blur-sm">
                            <GraduationCap size={18} />
                          </div>
                        )}
                        <div>
                          <h4 className="font-black text-xs uppercase tracking-wide leading-tight">
                            {orgName}
                          </h4>
                          <p className="text-[8.5px] text-white/80 font-medium line-clamp-1">
                            {orgSettings?.address || "Recognized Educational Institution"}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="rounded bg-white/20 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-300">
                          SMART PASS {sessionYear}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Body: 3-Column Layout (Photo | Bio Info | Large QR Scan) */}
                  <div className="p-3.5 flex items-center justify-between gap-3">
                    {/* Left: Photo Frame */}
                    <div className="shrink-0 flex flex-col items-center">
                      <div className="relative h-24 w-24 rounded-2xl border-2 border-white shadow-md overflow-hidden bg-slate-100 ring-2 ring-slate-200">
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
                      <span className="mt-1.5 rounded-md bg-purple-50 px-2 py-0.5 text-[9px] font-bold text-purple-900 font-mono border border-purple-200">
                        ADM: {s.admission_no}
                      </span>
                    </div>

                    {/* Middle: Student Details */}
                    <div className="flex-1 min-w-0 text-[10px] space-y-1">
                      <h3 className="text-sm font-black text-slate-900 leading-tight uppercase tracking-tight truncate">
                        {fullName}
                      </h3>
                      <div className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-800">
                        Class: {className} {sectionName ? `(${sectionName})` : ""}
                      </div>

                      <div className="pt-1 space-y-0.5 text-slate-600">
                        {s.father_name && (
                          <div className="truncate">
                            <span className="font-semibold text-slate-400">Father: </span>
                            <span className="font-bold text-slate-800">{s.father_name}</span>
                          </div>
                        )}
                        {s.date_of_birth && (
                          <div>
                            <span className="font-semibold text-slate-400">DOB: </span>
                            <span className="font-bold text-slate-800">{s.date_of_birth}</span>
                          </div>
                        )}
                        {s.phone && (
                          <div>
                            <span className="font-semibold text-slate-400">Contact: </span>
                            <span className="font-bold text-slate-800 font-mono">{s.phone}</span>
                          </div>
                        )}
                        {s.blood_group && (
                          <div>
                            <span className="font-semibold text-slate-400">Blood: </span>
                            <span className="font-bold text-red-600">{s.blood_group}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Dedicated Large QR Code & Sign */}
                    <div className="shrink-0 flex flex-col items-center">
                      <div
                        onClick={() => setInspectStudent(s)}
                        className="group relative cursor-pointer bg-white p-1 rounded-2xl border-2 border-slate-200 shadow-sm hover:border-purple-500 hover:shadow-md transition"
                        title="Click to test QR Code"
                      >
                        <QRCodeImage
                          value={qrData}
                          className="h-24 w-24 object-contain rounded-lg"
                          size={360}
                        />
                        <span className="mt-0.5 block text-center text-[7.5px] font-black uppercase text-slate-700">
                          GATE SCAN
                        </span>
                      </div>

                      <div className="mt-1 text-center">
                        <span className="text-[9px] text-purple-800 font-serif italic font-bold block">
                          Authorized
                        </span>
                        <span className="text-[7px] font-extrabold text-slate-400 uppercase tracking-tighter">
                          Principal Sign
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Micro Footer */}
                  <div className="px-4 py-1 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[8px] text-slate-400">
                    <span>OFFICIAL STUDENT SMART IDENTITY CARD</span>
                    <span className="font-mono">{orgSettings?.phone ? `Helpline: ${orgSettings.phone}` : ""}</span>
                  </div>
                </div>
              );

              // Card Back Element
              const CardBack = (
                <div
                  className="id-card-back relative mx-auto w-full max-w-[340px] rounded-3xl border border-slate-300 bg-white shadow-xl overflow-hidden flex flex-col justify-between print:shadow-none print:border-slate-400 print:break-inside-avoid print:w-[325px] print:h-[500px] p-5 text-xs"
                  style={{ minHeight: "500px" }}
                >
                  <div>
                    {/* Header */}
                    <div className="text-center border-b border-slate-200 pb-2.5">
                      <h4 className="font-extrabold text-xs uppercase text-slate-900 tracking-wider">
                        {orgName}
                      </h4>
                      <span className="text-[9px] text-purple-700 font-bold uppercase tracking-wider block mt-0.5">
                        Card Holder Guidelines &bull; Terms
                      </span>
                    </div>

                    {/* Rules List */}
                    <div className="mt-3.5 space-y-2 text-[10px] text-slate-600 leading-relaxed">
                      <p>
                        1. <strong>Mandatory Attendance:</strong> Student must carry this card daily and scan at the gate QR kiosk upon arrival for automated attendance.
                      </p>
                      <p>
                        2. <strong>Non-Transferable:</strong> This card is issued exclusively for <strong>{fullName}</strong> and cannot be transferred or lent to anyone.
                      </p>
                      <p>
                        3. <strong>Loss or Damage:</strong> In case of loss or damage, immediately inform the school administration office for a replacement card.
                      </p>
                      <p>
                        4. <strong>Live Verification:</strong> Parents can scan the front QR code from any smartphone to view live attendance records and fee dues status.
                      </p>
                    </div>

                    {/* Giant Gate Attendance Fast-Pass QR */}
                    <div className="mt-4 flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-700 mb-1">
                        GATE SCANNER PASS
                      </span>
                      <QRCodeImage
                        value={qrData}
                        className="h-28 w-28 object-contain rounded-xl bg-white p-1 border border-slate-200 shadow-xs"
                        size={400}
                      />
                      <span className="text-[8px] text-slate-400 font-mono mt-1">
                        Adm No: {s.admission_no}
                      </span>
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

                    <div className="mt-2 text-center text-[9px] text-slate-400 font-mono">
                      VALID FOR ACADEMIC SESSION {sessionYear}
                    </div>
                  </div>
                </div>
              );

              return (
                <div key={s.id} className="relative flex flex-col gap-3">
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
                        onClick={() => setInspectStudent(s)}
                        className="inline-flex items-center gap-1 rounded-md bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-0.5 text-[10px] font-bold text-purple-700 transition"
                        title="Test & Inspect QR Code"
                      >
                        <QrCode size={11} />
                        <span>Test QR</span>
                      </button>

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
                        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                          Fee Paid ✓
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Scissor Cut Guide Marks (✂️ Dotted Outline for Trimming) */}
                  <div className="relative">
                    {showCutGuides && (
                      <div className="cut-guide-border absolute -inset-1 border border-dashed border-slate-300 pointer-events-none rounded-2xl print:border-slate-400 print:opacity-75 z-10">
                        <span className="absolute -top-2 left-4 bg-white px-1 text-[8px] font-mono text-slate-400 print:text-black">
                          ✂ CUT
                        </span>
                      </div>
                    )}

                    {/* Rendering Mode */}
                    {activePreset.id === "dragon_fold" ? (
                      /* PVC Dragon Sheet: Front & Back Paired Side-by-Side */
                      <div className="dragon-pair-card flex flex-col md:flex-row items-center justify-center gap-2 p-1 bg-slate-50/50 rounded-2xl border border-slate-200 print:border-none print:p-0">
                        <div className="w-full flex-1">{CardFront}</div>
                        {/* Fold center guide */}
                        <div className="hidden md:flex flex-col items-center justify-center py-2 px-1 text-[8px] font-bold text-purple-700 print:flex">
                          <span className="rotate-90 my-2 whitespace-nowrap bg-purple-50 px-1 rounded border border-purple-200 font-mono">
                            ✂ FOLD LINE
                          </span>
                        </div>
                        <div className="w-full flex-1">{CardBack}</div>
                      </div>
                    ) : orientation === "horizontal" ? (
                      <div>{CardHorizontal}</div>
                    ) : (
                      <div className="space-y-4">
                        {CardFront}
                        {cardLayout === "dual" && CardBack}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* A4 PRINT SETUP MODAL (The Main Feature Request)               */}
      {/* ============================================================== */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-7 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Printer size={20} className="text-purple-600" />
                  <span>A4 Print Sheet Layout Setup</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select the optimal layout preset for your printer, paper type, and cutting method.
                </p>
              </div>
              <button
                onClick={() => setShowPrintModal(false)}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* Presets Selection Cards */}
            <div className="my-5 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Choose A4 Printing Format:
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                {SHEET_PRESETS.map((p) => {
                  const isSelected = sheetPreset === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectPreset(p.id)}
                      className={`cursor-pointer rounded-2xl border-2 p-3.5 transition flex flex-col justify-between ${
                        isSelected
                          ? "border-purple-600 bg-purple-50/60 shadow-sm ring-2 ring-purple-600/20"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-black uppercase text-purple-800">
                            {p.badge}
                          </span>
                          {isSelected && <CheckCircle2 size={16} className="text-purple-600" />}
                        </div>
                        <h4 className="mt-2 text-sm font-black text-slate-900">{p.title}</h4>
                        <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                          {p.description}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[10px] font-bold text-slate-600">
                        <span>Capacity: {p.capacity} Cards/Sheet</span>
                        <span className="font-mono text-purple-700">
                          {Math.ceil(cardsToPrint.length / p.capacity) || 1} Sheet(s) Needed
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Print Options & Guidelines */}
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-slate-800 select-none">
                  <input
                    type="checkbox"
                    checked={showCutGuides}
                    onChange={(e) => setShowCutGuides(e.target.checked)}
                    className="rounded border-slate-300 text-purple-600"
                  />
                  <span className="flex items-center gap-1.5">
                    <Scissors size={14} className="text-purple-600" />
                    <span>Print Dotted Scissor Guidelines (✂️ Trimming Lines)</span>
                  </span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={printFeeStamp}
                    onChange={(e) => setPrintFeeStamp(e.target.checked)}
                    className="rounded border-slate-300 text-purple-600"
                  />
                  <span>Stamp Pending Fee Watermark on Defaulters</span>
                </label>
              </div>

              {/* Summary Stats */}
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600">
                <span>
                  Selected Students: <strong className="text-slate-900">{cardsToPrint.length}</strong>
                </span>
                <span>
                  Estimated A4 Paper:{" "}
                  <strong className="text-purple-700 font-bold">
                    {estimatedSheets} Page{estimatedSheets > 1 ? "s" : ""}
                  </strong>
                </span>
                <span>
                  Paper Size: <strong className="text-slate-900">Standard A4 (8mm Margin)</strong>
                </span>
              </div>
            </div>

            {/* Crucial Color Printing Notice */}
            <div className="mt-3.5 rounded-2xl bg-amber-50 border border-amber-300 p-3 text-xs text-amber-950 flex items-start gap-2.5 shadow-xs">
              <span className="text-base shrink-0">🎨</span>
              <div className="space-y-1">
                <p className="font-bold text-amber-900">
                  Color Printout Guideline (Chrome / Edge / Windows):
                </p>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Jab printer window khule, toh <strong>&ldquo;Color&rdquo;</strong> select karein aur <strong>&ldquo;More settings&rdquo; (अधिक सेटिंग्स)</strong> ke andar <strong>&ldquo;Background graphics&rdquo; (पृष्ठभूमि ग्राफिक्स)</strong> check/tick hona zaroori hai, tabhi poora colorful gradient aur card design print hoga!
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceedPrint}
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-purple-700 transition"
              >
                <Printer size={15} />
                <span>Open System Print Dialog (A4 Ready)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* QR TEST & INSPECTION MODAL (Lets user test with 1-click)       */}
      {/* ============================================================== */}
      {inspectStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  QR Code Inspection &amp; Live Test
                </h3>
                <p className="text-xs text-slate-500">
                  {inspectStudent.first_name} {inspectStudent.last_name || ""} &bull; Adm: {inspectStudent.admission_no}
                </p>
              </div>
              <button
                onClick={() => {
                  setInspectStudent(null);
                  setScanResult(null);
                }}
                className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* Huge QR Code View */}
            <div className="my-5 flex flex-col items-center">
              <div className="rounded-2xl border-2 border-purple-200 bg-white p-4 shadow-lg">
                <QRCodeImage
                  value={`${originUrl}/parent-portal?id=${encodeURIComponent(inspectStudent.admission_no)}`}
                  className="h-44 w-44 object-contain"
                  size={500}
                />
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-600">
                Point your phone camera here to scan instantly!
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] font-mono text-purple-700 bg-purple-50 px-3 py-1 rounded-lg border border-purple-200">
                <span>{`${originUrl}/parent-portal?id=${inspectStudent.admission_no}`}</span>
              </div>
            </div>

            {/* Live Scan Results */}
            {scanResult && (
              <div
                className={`mb-4 rounded-2xl p-3.5 text-xs ${
                  scanResult.success
                    ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                    : "bg-red-50 text-red-900 border border-red-200"
                }`}
              >
                {scanResult.success ? (
                  <div>
                    <div className="flex items-center gap-1.5 font-bold">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      <span>{scanResult.message || "Attendance Marked Present!"}</span>
                    </div>
                    <div className="mt-1 text-[11px]">
                      Student: <strong>{scanResult.student?.name}</strong> ({scanResult.student?.class_name})
                    </div>
                    {scanResult.fees?.has_dues && (
                      <div className="mt-1 font-bold text-amber-700">
                        {scanResult.fees?.status_message}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <span className="font-bold">Error:</span> {scanResult.error}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              <a
                href={`${originUrl}/parent-portal?id=${encodeURIComponent(inspectStudent.admission_no)}`}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-700 transition shadow-sm"
              >
                <ExternalLink size={14} />
                <span>Open Parent Verification Portal (New Tab)</span>
              </a>

              <button
                type="button"
                onClick={() => handleSimulateGateScan(inspectStudent.admission_no)}
                disabled={simulatingScan}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                <QrCode size={14} />
                <span>{simulatingScan ? "Marking Attendance..." : "Simulate Gate Kiosk Scan"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Specific CSS Styles for exact A4 layout & vibrant color preservation */}
      <style jsx global>{`
        @media print {
          *,
          *::before,
          *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          html,
          body {
            background-color: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          @page {
            size: A4 portrait;
            margin: 8mm;
          }

          /* Preset: 8 Standard (Recommended: 2x4) */
          .sheet-preset-8_standard {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 10px 14px !important;
          }

          /* Preset: 10 Horizontal (2x5) */
          .sheet-preset-10_horizontal {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 6px 10px !important;
          }

          /* Preset: 9 Vertical (3x3) */
          .sheet-preset-9_vertical {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 6px 6px !important;
          }

          /* Preset: Dragon Fold */
          .sheet-preset-dragon_fold {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }

          .id-card,
          .id-card-horizontal,
          .id-card-back,
          .dragon-pair-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          /* Force all colored headers and badges to print in full color */
          .id-card [style*="background"],
          .id-card-horizontal [style*="background"],
          .id-card-back [style*="background"],
          .bg-purple-50,
          .bg-emerald-100,
          .bg-amber-100,
          .bg-red-50,
          .bg-slate-100 {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          .cut-guide-border {
            border: 1px dashed #64748b !important;
          }
        }
      `}</style>
    </div>
  );
}
