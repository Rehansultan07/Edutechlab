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
import { resolveStorageUrl, resolveStorageUrlMap } from "@/lib/storage";

type Student = {
  id: string;
  admission_no: string;
  roll_no?: string | null;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  class_id?: string | null;
  section_id?: string | null;
  father_name: string | null;
  mother_name?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  photo_url: string | null;
  address: string | null;
  date_of_birth: string | null;
  admission_date?: string | null;
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
  authorized_signatory?: string | null;
};

type StudentFeeStatus = {
  hasDues: boolean;
  dueAmount: number;
  dueMonthsCount: number;
};

type CardTemplateId =
  | "sunrise_maroon"
  | "oakfield_gold"
  | "modern_wave"
  | "royal_cbse"
  | "cyber_metro";

interface CardTemplateDef {
  id: CardTemplateId;
  name: string;
  tagline: string;
  badge: string;
  description: string;
  orientation: "horizontal" | "vertical";
  defaultColor?: string;
}

const CARD_TEMPLATES: CardTemplateDef[] = [
  {
    id: "sunrise_maroon",
    name: "Sunrise Maroon & Gold",
    tagline: "Classic Maroon Header, Gold Trim & Clean Form Lines (Landscape)",
    badge: "🏫 Recommended",
    description: "Deep maroon header with white logo box, gold border trims, clean ruled student details & scan QR.",
    orientation: "horizontal",
    defaultColor: "#640d14",
  },
  {
    id: "oakfield_gold",
    name: "Oakfield Gold & White",
    tagline: "Geometric White Card, Barcode, Gold Band & Access QR (Landscape)",
    badge: "⭐ Academy Pro",
    description: "Crisp white faceted design with top barcode, yellow session ribbon, framed photo & principal seal.",
    orientation: "horizontal",
    defaultColor: "#0f172a",
  },
  {
    id: "modern_wave",
    name: "Modern Wave (Vertical)",
    tagline: "Dynamic Curved Gradient & Glass Photo Frame",
    badge: "🌟 Vertical Modern",
    description: "Fluid wave header, glowing photo border, 2-column bio & quick attendance scan.",
    orientation: "vertical",
    defaultColor: "#0a192f",
  },
  {
    id: "royal_cbse",
    name: "Royal CBSE (Vertical)",
    tagline: "Gold Ribbon, School Crest & Formal CBSE Table",
    badge: "👑 Vertical Classic",
    description: "Classic formal header, watermark crest, gold borders & traditional school bio table.",
    orientation: "vertical",
    defaultColor: "#312e81",
  },
  {
    id: "cyber_metro",
    name: "Cyber Metro (Vertical)",
    tagline: "Holographic Stripe, Micro Grid & Barcode",
    badge: "⚡ Vertical Tech",
    description: "Sleek executive look with smart chip badge, micro barcode & high-contrast gate scan.",
    orientation: "vertical",
    defaultColor: "#0f172a",
  },
];

export type SheetPresetId = "8_horizontal" | "10_horizontal" | "8_standard" | "9_vertical";

interface SheetPresetDef {
  id: SheetPresetId;
  title: string;
  badge: string;
  capacity: number;
  description: string;
  screenGrid: string;
  printClass: string;
  orientation: "vertical" | "horizontal";
}

const SHEET_PRESETS: SheetPresetDef[] = [
  {
    id: "8_horizontal",
    title: "Standard 8 Cards / A4 (Landscape 2×4 • Recommended)",
    badge: "⭐ Recommended • 2×4 Landscape",
    capacity: 8,
    description: "2 columns × 4 rows landscape CR80 cards with generous cutting gaps. Ideal for Sunrise Maroon & Oakfield Gold templates.",
    screenGrid: "grid-cols-1 xl:grid-cols-2",
    printClass: "sheet-preset-8_horizontal",
    orientation: "horizontal",
  },
  {
    id: "10_horizontal",
    title: "Economy 10 Cards / A4 (Landscape 2×5)",
    badge: "📄 Max Paper Saving • 2×5 Grid",
    capacity: 10,
    description: "2 columns × 5 rows in Landscape format. Fits 10 horizontal cards per A4 sheet for lowest paper cost.",
    screenGrid: "grid-cols-1 xl:grid-cols-2",
    printClass: "sheet-preset-10_horizontal",
    orientation: "horizontal",
  },
  {
    id: "8_standard",
    title: "Standard 8 Cards / A4 (Vertical 2×4)",
    badge: "📐 Vertical • 2×4 Grid",
    capacity: 8,
    description: "2 columns × 4 rows portrait cards. Safe 4mm cutting gaps for vertical ID templates.",
    screenGrid: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    printClass: "sheet-preset-8_standard",
    orientation: "vertical",
  },
  {
    id: "9_vertical",
    title: "Compact 9 Cards / A4 (Vertical 3×3)",
    badge: "📐 High Density • 3×3 Vertical",
    capacity: 9,
    description: "3 columns × 3 rows vertical layout. Maximizes portrait card count per sheet.",
    screenGrid: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    printClass: "sheet-preset-9_vertical",
    orientation: "vertical",
  },
];

const THEME_COLORS = [
  { name: "Sunrise Maroon", hex: "#640d14", accent: "#c59b38" },
  { name: "Royal Indigo", hex: "#312e81", accent: "#6366f1" },
  { name: "Deep Navy", hex: "#0a192f", accent: "#38bdf8" },
  { name: "Emerald Green", hex: "#064e3b", accent: "#10b981" },
  { name: "Crimson Rose", hex: "#831843", accent: "#f43f5e" },
  { name: "Dark Slate", hex: "#0f172a", accent: "#facc15" },
  { name: "Royal Purple", hex: "#581c87", accent: "#a855f7" },
];

function BarcodeSvg({ value, className = "h-7 w-28" }: { value: string; className?: string }) {
  // Deterministic crisp vector barcode bars derived from admission number
  const bars = useMemo(() => {
    const str = (value || "ADM001").toUpperCase();
    const widths: number[] = [2, 1, 2, 1]; // start guard
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      widths.push((code % 3) + 1);
      widths.push(((code >> 2) % 2) + 1);
      widths.push(((code >> 4) % 3) + 1);
      widths.push(1);
    }
    while (widths.length < 38) {
      const idx = widths.length;
      widths.push(((idx * 7 + str.length) % 3) + 1);
    }
    widths.push(2, 1, 2); // end guard

    const rects: Array<{ x: number; w: number }> = [];
    let x = 0;
    widths.forEach((w, i) => {
      if (i % 2 === 0) {
        rects.push({ x, w });
      }
      x += w;
    });
    return { rects, totalWidth: x };
  }, [value]);

  return (
    <svg
      viewBox={`0 0 ${bars.totalWidth} 28`}
      preserveAspectRatio="none"
      className={className}
      aria-label={`Barcode ${value}`}
    >
      {bars.rects.map((r, i) => (
        <rect key={i} x={r.x} y={0} width={r.w} height={28} fill="#0f172a" />
      ))}
    </svg>
  );
}

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
  const [cardTemplate, setCardTemplate] = useState<CardTemplateId>("sunrise_maroon");
  const [themeColor, setThemeColor] = useState<string>("#640d14");
  const [sessionYear, setSessionYear] = useState<string>("2026-27");
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">("horizontal");
  // Strictly OFF by default: Back side will NEVER print unless user explicitly enables it
  const [includeBackPrint, setIncludeBackPrint] = useState<boolean>(false);
  const [printFeeStamp, setPrintFeeStamp] = useState(false);

  // A4 Sheet Layout & Print Settings
  const [sheetPreset, setSheetPreset] = useState<SheetPresetId>("8_horizontal");
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
            "id,admission_no,roll_no,first_name,last_name,class_id,section_id,phone,father_name,mother_name,guardian_name,guardian_phone,photo_url,address,date_of_birth,admission_date,blood_group,gender"
          )
          .eq("organization_id", orgId)
          .eq("status", "active")
          .order("admission_no");

        if (stRes.error) {
          console.warn("Retrying students query without newer columns:", stRes.error.message);
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

        // Metadata queries
        const [clRes, secRes, orgRes, setRes, feeRes] = await Promise.all([
          supabase.from("classes").select("id,name").eq("organization_id", orgId).order("sort_order"),
          supabase.from("sections").select("id,class_id,name").eq("organization_id", orgId),
          supabase.from("organizations").select("name").eq("id", orgId).single(),
          supabase
            .from("organization_settings")
            .select("phone,address,logo_url,primary_color,secondary_color,authorized_signatory")
            .eq("organization_id", orgId)
            .maybeSingle(),
          supabase
            .from("student_fee_months")
            .select("student_id,amount_due,amount_paid,status")
            .eq("organization_id", orgId),
        ]);

        // Batch-resolve private Supabase Storage signed URLs for school logo + all student photos
        const rawLogoPath = setRes.data?.logo_url || null;
        const photoPaths = stData.map((st) => st.photo_url).filter(Boolean) as string[];
        const urlMap = await resolveStorageUrlMap(supabase, [rawLogoPath, ...photoPaths]);

        const resolvedStudents = stData.map((st) => {
          if (!st.photo_url) return st;
          const clean = st.photo_url.trim().replace(/^\/+/, "");
          const signed = urlMap[st.photo_url] || urlMap[clean] || st.photo_url;
          return { ...st, photo_url: signed };
        });

        setStudents(resolvedStudents);
        setSelectedIds(new Set(resolvedStudents.map((s) => s.id)));

        if (clRes.data) setClasses(clRes.data);
        if (secRes.data) setSections(secRes.data);
        if (orgRes.data?.name) setOrgName(orgRes.data.name);

        if (setRes.data) {
          let resolvedLogoUrl: string | null = null;
          if (rawLogoPath) {
            const cleanLogo = rawLogoPath.trim().replace(/^\/+/, "");
            resolvedLogoUrl =
              urlMap[rawLogoPath] ||
              urlMap[cleanLogo] ||
              (await resolveStorageUrl(supabase, rawLogoPath));
          }
          setOrgSettings({
            ...setRes.data,
            logo_url: resolvedLogoUrl,
          });
        }

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

  // Sync orientation & matching A4 preset when user switches card template
  const handleSelectTemplate = (templateId: CardTemplateId) => {
    setCardTemplate(templateId);
    const tpl = CARD_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;

    if (tpl.defaultColor) {
      setThemeColor(tpl.defaultColor);
    }
    setOrientation(tpl.orientation);

    // Switch to matching orientation A4 preset if current preset doesn't match
    const curPreset = SHEET_PRESETS.find((p) => p.id === sheetPreset);
    if (!curPreset || curPreset.orientation !== tpl.orientation) {
      setSheetPreset(tpl.orientation === "horizontal" ? "8_horizontal" : "8_standard");
    }
  };

  // Sync orientation with preset selection (NEVER silently enables back print)
  const handleSelectPreset = (presetId: SheetPresetId) => {
    setSheetPreset(presetId);
    const p = SHEET_PRESETS.find((x) => x.id === presetId);
    if (p) {
      setOrientation(p.orientation);
      // If user picks a vertical preset while on a horizontal template, switch to a vertical template (and vice versa)
      const curTpl = CARD_TEMPLATES.find((t) => t.id === cardTemplate);
      if (curTpl && curTpl.orientation !== p.orientation) {
        setCardTemplate(p.orientation === "horizontal" ? "sunrise_maroon" : "modern_wave");
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

  // Estimated sheets needed (front-only by default; 2x only when user explicitly turns Back Print ON)
  const totalCardSides = cardsToPrint.length * (includeBackPrint ? 2 : 1);
  const estimatedSheets = Math.ceil(totalCardSides / activePreset.capacity) || 1;

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
              <span>
                Print {cardsToPrint.length} {includeBackPrint ? "Front + Back" : "Front"} Cards ({estimatedSheets} Sheet{estimatedSheets > 1 ? "s" : ""})
              </span>
            </button>
          </div>
        </div>

        {/* Customization Toolbar */}
        <div className="mx-auto max-w-7xl mt-4 pt-4 border-t border-slate-100 grid gap-3 sm:grid-cols-2 lg:grid-cols-8 items-center text-xs">
          {/* Card Design Template Selector */}
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-purple-700 mb-1 flex items-center gap-1">
              <Sparkles size={12} className="text-purple-600" />
              <span>Card Design Template</span>
            </label>
            <select
              value={cardTemplate}
              onChange={(e) => handleSelectTemplate(e.target.value as CardTemplateId)}
              className="w-full rounded-xl border-2 border-purple-400 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-950 outline-none focus:border-purple-600 shadow-xs"
            >
              {CARD_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.badge} • {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* A4 Sheet Layout Selector */}
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1">
              <Printer size={12} />
              <span>A4 Sheet Print Layout</span>
            </label>
            <select
              value={sheetPreset}
              onChange={(e) => handleSelectPreset(e.target.value as SheetPresetId)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-purple-600"
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

          {/* Academic Session */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Session
            </label>
            <input
              type="text"
              value={sessionYear}
              onChange={(e) => setSessionYear(e.target.value)}
              placeholder="2026-27"
              className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold outline-none focus:border-purple-600"
            />
          </div>

          {/* Theme Color Selector */}
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Header / Accent Color
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {THEME_COLORS.map((tc) => (
                <button
                  key={tc.hex}
                  type="button"
                  onClick={() => setThemeColor(tc.hex)}
                  className={`h-7 w-7 rounded-xl transition-transform ${
                    themeColor === tc.hex ? "scale-110 ring-2 ring-purple-600 ring-offset-2" : "opacity-80 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: tc.hex }}
                  title={tc.name}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Template Quick Pills & Search Sub-Bar */}
        <div className="mx-auto max-w-7xl mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Templates:
            </span>
            {CARD_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelectTemplate(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  cardTemplate === t.id
                    ? "bg-slate-900 text-white shadow-sm ring-2 ring-purple-600 ring-offset-1"
                    : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
                }`}
              >
                <span>{t.badge.split(" ")[0]}</span>
                <span>{t.name}</span>
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, adm no, father..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs outline-none focus:border-purple-600 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Explicit Back Side Print Toggle (STRICTLY OFF BY DEFAULT) */}
            <button
              type="button"
              onClick={() => setIncludeBackPrint((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border transition ${
                includeBackPrint
                  ? "bg-purple-600 text-white border-purple-700 shadow-xs"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
              title="Back side will ONLY print when you click and turn this ON"
            >
              <Layers size={14} />
              <span>{includeBackPrint ? "Back Print: ON (Front + Back)" : "Back Print: OFF (Front Only)"}</span>
            </button>

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
                <span>Cut Guides</span>
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
              <span>Fee Stamp</span>
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
              const rollNo = s.roll_no || s.admission_no.replace(/\D/g, "").slice(-3) || "01";

              // ================================================================
              // TEMPLATE 1: MODERN WAVE & GRADIENT (Dynamic Curves & Glass Look)
              // ================================================================
              const CardModernWave = (
                <div
                  className="id-card id-card-modern-wave relative mx-auto w-full max-w-[340px] rounded-3xl border border-slate-300/80 bg-white shadow-xl overflow-hidden flex flex-col justify-between print:shadow-none print:border-slate-400 print:break-inside-avoid print:w-[325px] print:h-[500px]"
                  style={{ minHeight: "500px" }}
                >
                  {/* Top Lanyard Slot Guide Mark */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 w-9 h-1.5 rounded-full bg-slate-800/60 border border-white/50 pointer-events-none" />

                  {/* Header with Deep Modern Gradient */}
                  <div
                    className="pt-5 pb-5 px-3.5 text-center text-white relative shadow-sm"
                    style={{
                      backgroundColor: themeColor,
                      backgroundImage: `linear-gradient(135deg, ${themeColor} 0%, #030712 100%)`,
                      WebkitPrintColorAdjust: "exact",
                      printColorAdjust: "exact",
                    }}
                  >
                    <div className="flex items-center justify-center gap-2">
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
                      <div className="text-left flex-1 min-w-0">
                        <h4 className="font-black text-xs sm:text-sm uppercase tracking-wide leading-tight truncate">
                          {orgName}
                        </h4>
                        <p className="text-[8.5px] text-white/80 font-medium truncate">
                          {orgSettings?.address || "Recognized Educational Institution"}
                        </p>
                      </div>
                    </div>

                    {/* Ribbon Sub-Bar */}
                    <div className="mt-2 flex items-center justify-between px-1 text-[8px] font-black uppercase tracking-widest text-white/90 border-t border-white/15 pt-1">
                      <span className="flex items-center gap-1">
                        <Sparkles size={10} className="text-amber-300" />
                        <span>STUDENT SMART PASS</span>
                      </span>
                      <span className="rounded bg-white/20 px-1.5 py-0.2">SESSION {sessionYear}</span>
                    </div>
                  </div>

                  {/* Wave SVG Divider */}
                  <div className="-mt-3 relative z-10">
                    <svg viewBox="0 0 500 50" preserveAspectRatio="none" className="w-full h-4 text-white fill-current block">
                      <path d="M0,0 C150,45 350,-10 500,25 L500,50 L0,50 Z" />
                    </svg>
                  </div>

                  {/* Student Photo & Identity Section */}
                  <div className="px-4 pt-1 text-center relative -mt-3">
                    {/* Photo Frame with Dual Ring */}
                    <div className="relative mx-auto h-22 w-22 rounded-2xl border-3 border-white shadow-md overflow-hidden bg-slate-100 grid place-items-center ring-3 ring-purple-600/30">
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

                    <h3 className="mt-1.5 text-base font-black text-slate-900 leading-tight uppercase tracking-tight truncate">
                      {fullName}
                    </h3>

                    {/* Badges: Class, Roll No, Adm No */}
                    <div className="mt-1 flex items-center justify-center gap-1.5 flex-wrap">
                      <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[9.5px] font-extrabold text-purple-900 border border-purple-200">
                        Class: {className} {sectionName ? `(${sectionName})` : ""}
                      </span>
                      <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[9.5px] font-extrabold text-amber-900 font-mono border border-amber-300">
                        Roll: {rollNo}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[9.5px] font-bold text-slate-800 font-mono border border-slate-200">
                        ID: {s.admission_no}
                      </span>
                    </div>
                  </div>

                  {/* Bio Details 2-Column Grid */}
                  <div className="px-4 py-1.5 text-[10px] text-slate-700">
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 border-y border-slate-100 py-1.5">
                      <div>
                        <span className="text-[8.5px] text-slate-400 font-semibold block uppercase">Father / Guardian</span>
                        <span className="font-bold text-slate-900 truncate block">
                          {s.father_name || s.guardian_name || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[8.5px] text-slate-400 font-semibold block uppercase">Emergency Phone</span>
                        <span className="font-bold text-slate-900 font-mono block">
                          {s.phone || s.guardian_phone || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[8.5px] text-slate-400 font-semibold block uppercase">Date of Birth</span>
                        <span className="font-bold text-slate-900 block">{s.date_of_birth || "—"}</span>
                      </div>
                      <div>
                        <span className="text-[8.5px] text-slate-400 font-semibold block uppercase">Adm Date &bull; Blood</span>
                        <span className="font-bold text-slate-900 block">
                          {s.admission_date ? s.admission_date.slice(0, 10) : "—"}{" "}
                          <span className="ml-1 text-red-600 bg-red-50 px-1 rounded font-black">{s.blood_group || "O+"}</span>
                        </span>
                      </div>
                    </div>
                    {/* Address with MapPin */}
                    <div className="pt-1 flex items-start gap-1 text-[9px] text-slate-600">
                      <MapPin size={11} className="shrink-0 text-slate-400 mt-0.5" />
                      <span className="truncate line-clamp-1 font-medium">
                        {s.address || "Address recorded in school register"}
                      </span>
                    </div>
                  </div>

                  {/* Optional Fee Status Watermark Stamp */}
                  {printFeeStamp && hasFeeDues && (
                    <div className="mx-4 my-0.5 rounded-md bg-amber-50 border border-amber-300 p-0.5 text-center text-[8.5px] font-bold text-amber-800">
                      ⚠️ Pending Fee Dues: ₹{sFee.dueAmount}
                    </div>
                  )}

                  {/* Bottom QR Scan & Authority Sign Hub */}
                  <div className="px-3.5 pb-2.5 pt-1.5 border-t border-slate-200 bg-slate-50/90">
                    <div className="flex items-center justify-between gap-3">
                      {/* Dedicated Large High-Contrast QR Code */}
                      <div
                        onClick={() => setInspectStudent(s)}
                        className="group relative cursor-pointer flex flex-col items-center bg-white p-1 rounded-2xl border-2 border-slate-200 shadow-sm hover:border-purple-500 hover:shadow-md transition"
                        title="Click to test QR Code & Attendance scan"
                      >
                        <div className="absolute top-0.5 left-0.5 w-2 h-2 border-t-2 border-l-2 border-slate-800 pointer-events-none rounded-tl-sm" />
                        <div className="absolute top-0.5 right-0.5 w-2 h-2 border-t-2 border-r-2 border-slate-800 pointer-events-none rounded-tr-sm" />
                        <div className="absolute bottom-0.5 left-0.5 w-2 h-2 border-b-2 border-l-2 border-slate-800 pointer-events-none rounded-bl-sm" />
                        <div className="absolute bottom-0.5 right-0.5 w-2 h-2 border-b-2 border-r-2 border-slate-800 pointer-events-none rounded-br-sm" />

                        <QRCodeImage
                          value={qrData}
                          className="h-20 w-20 object-contain rounded-lg"
                          size={320}
                        />
                        <span className="mt-0.5 text-[7px] font-black uppercase text-slate-800 bg-purple-50 px-1 py-0.2 rounded border border-purple-200">
                          📷 GATE SCAN
                        </span>
                      </div>

                      {/* Right Side: Authority Seal & Sign */}
                      <div className="flex-1 flex flex-col justify-between h-20 text-right py-0.5">
                        <div className="flex items-center justify-end gap-1 text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                          <ShieldCheck size={11} className="text-purple-600" />
                          <span>Verified Card</span>
                        </div>

                        <div>
                          <div className="h-8 border-b border-dashed border-slate-400 flex items-end justify-center pb-0.5">
                            <span className="text-[12px] text-purple-900 font-serif italic font-bold">
                              Authorized Sign
                            </span>
                          </div>
                          <span className="text-[7.5px] font-extrabold text-slate-600 uppercase tracking-tight block mt-0.5">
                            Principal Signature
                          </span>
                        </div>

                        <div className="text-[7px] font-mono text-slate-400 tracking-widest">
                          *{s.admission_no}*
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );

              // ================================================================
              // TEMPLATE 2: ROYAL HERITAGE / CBSE CLASSIC (Formal Table & Crest)
              // ================================================================
              const CardRoyalCBSE = (
                <div
                  className="id-card id-card-royal-cbse relative mx-auto w-full max-w-[340px] rounded-2xl border-2 border-amber-600/70 bg-white shadow-xl overflow-hidden flex flex-col justify-between print:shadow-none print:border-amber-700 print:break-inside-avoid print:w-[325px] print:h-[500px]"
                  style={{ minHeight: "500px" }}
                >
                  {/* Top Lanyard Slot Guide Mark */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 w-9 h-1.5 rounded-full bg-amber-950/60 border border-white/50 pointer-events-none" />

                  {/* Header: Formal Classic Header with Gold Ribbon */}
                  <div
                    className="pt-4 pb-2 px-3 text-center text-white relative shadow-sm border-b-2 border-amber-400"
                    style={{
                      backgroundColor: themeColor,
                      backgroundImage: `linear-gradient(135deg, ${themeColor} 0%, #1e1b4b 100%)`,
                      WebkitPrintColorAdjust: "exact",
                      printColorAdjust: "exact",
                    }}
                  >
                    {/* Micro Top Crest Line */}
                    <div className="text-[7.5px] font-bold text-amber-300 uppercase tracking-widest pb-1 border-b border-white/15 flex items-center justify-between">
                      <span>★ AFFILIATED &amp; RECOGNIZED ★</span>
                      <span>CBSE / STATE BOARD</span>
                    </div>

                    <div className="mt-1 flex items-center justify-center gap-2">
                      {orgSettings?.logo_url ? (
                        <img
                          src={orgSettings.logo_url}
                          alt=""
                          className="h-10 w-10 rounded-full object-contain bg-white p-0.5 border-2 border-amber-400 shadow-xs"
                        />
                      ) : (
                        <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-slate-900 font-bold text-xs border-2 border-amber-400 shadow-xs">
                          <GraduationCap size={22} className="text-amber-600" />
                        </div>
                      )}
                      <div className="text-left flex-1 min-w-0">
                        <h4 className="font-serif font-black text-xs sm:text-sm uppercase tracking-wide leading-tight text-white truncate">
                          {orgName}
                        </h4>
                        <p className="text-[8px] text-amber-100 font-medium truncate">
                          {orgSettings?.address || "Official Educational Campus"}
                        </p>
                      </div>
                    </div>

                    {/* Gold Title Ribbon */}
                    <div className="mt-1 bg-amber-500/30 border border-amber-300/50 rounded py-0.5 px-2 text-[8px] font-black uppercase tracking-widest text-amber-200 flex items-center justify-between">
                      <span>STUDENT IDENTITY CARD</span>
                      <span>SESSION: {sessionYear}</span>
                    </div>
                  </div>

                  {/* Card Middle: Photo + Name + Formal CBSE Table */}
                  <div className="p-3 relative flex-1 flex flex-col justify-between">
                    {/* Subtle Background Watermark */}
                    <div className="absolute inset-0 grid place-items-center opacity-[0.04] pointer-events-none">
                      <GraduationCap size={150} />
                    </div>

                    {/* Top Row: Photo & Main Credentials */}
                    <div className="flex items-center gap-3">
                      {/* Photo with Gold Frame */}
                      <div className="shrink-0 relative h-23 w-20 rounded-lg border-2 border-amber-600/90 shadow-sm overflow-hidden bg-slate-100 grid place-items-center ring-1 ring-amber-400">
                        {s.photo_url ? (
                          <img src={s.photo_url} alt={fullName} className="h-full w-full object-cover" />
                        ) : (
                          <div
                            className="h-full w-full grid place-items-center text-xl font-bold text-white"
                            style={{ backgroundColor: themeColor }}
                          >
                            {initials || "ST"}
                          </div>
                        )}
                      </div>

                      {/* Name and Quick Badges */}
                      <div className="flex-1 min-w-0">
                        <span className="text-[7.5px] font-bold text-amber-800 uppercase tracking-widest block">
                          CANDIDATE NAME
                        </span>
                        <h3 className="font-serif text-sm font-black text-slate-900 leading-tight uppercase truncate">
                          {fullName}
                        </h3>

                        <div className="mt-1 space-y-1 text-[9.5px]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-500">Class:</span>
                            <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                              {className} {sectionName ? `(${sectionName})` : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div>
                              <span className="font-semibold text-slate-500">Roll: </span>
                              <span className="font-mono font-bold text-amber-900 bg-amber-50 px-1 rounded border border-amber-200">
                                {rollNo}
                              </span>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-500">Adm: </span>
                              <span className="font-mono font-bold text-slate-800">{s.admission_no}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Formal CBSE Data Table (Complete 11 Fields) */}
                    <div className="mt-2 rounded-lg border border-slate-200 overflow-hidden text-[9px]">
                      <table className="w-full text-left">
                        <tbody>
                          <tr className="border-b border-slate-200 bg-slate-50/70">
                            <td className="px-2 py-0.8 font-semibold text-slate-500 w-[36%]">Father/Guardian:</td>
                            <td className="px-2 py-0.8 font-bold text-slate-900 truncate">
                              {s.father_name || s.guardian_name || "—"}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-2 py-0.8 font-semibold text-slate-500">Date of Birth:</td>
                            <td className="px-2 py-0.8 font-bold text-slate-900">
                              {s.date_of_birth || "—"}
                              <span className="ml-2 font-semibold text-slate-400">Blood:</span>
                              <span className="ml-1 text-red-700 font-extrabold bg-red-50 px-1 rounded border border-red-200">
                                {s.blood_group || "O+"}
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200 bg-slate-50/70">
                            <td className="px-2 py-0.8 font-semibold text-slate-500">Admission Date:</td>
                            <td className="px-2 py-0.8 font-bold text-slate-900">
                              {s.admission_date || "—"}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-2 py-0.8 font-semibold text-slate-500">Emergency Phone:</td>
                            <td className="px-2 py-0.8 font-mono font-bold text-slate-900">
                              {s.phone || s.guardian_phone || "—"}
                            </td>
                          </tr>
                          <tr>
                            <td className="px-2 py-0.8 font-semibold text-slate-500 align-top">Address:</td>
                            <td className="px-2 py-0.8 text-slate-700 line-clamp-1 truncate font-medium">
                              {s.address || "Recorded in school register"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Fee Stamp */}
                    {printFeeStamp && hasFeeDues && (
                      <div className="mt-1 rounded bg-amber-50 border border-amber-300 p-0.5 text-center text-[8px] font-bold text-amber-800">
                        ⚠️ Fee Dues: ₹{sFee.dueAmount}
                      </div>
                    )}

                    {/* Bottom Footer: Formal Seal & Principal Signature + QR */}
                    <div className="mt-1.5 pt-1.5 border-t border-amber-200 flex items-center justify-between">
                      {/* Left QR */}
                      <div
                        onClick={() => setInspectStudent(s)}
                        className="cursor-pointer flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200"
                        title="Click to test QR Code"
                      >
                        <QRCodeImage value={qrData} className="h-16 w-16 object-contain rounded" size={260} />
                        <div className="text-[6.5px] text-slate-500 leading-tight">
                          <span className="font-bold text-amber-900 block">OFFICIAL QR</span>
                          <span>Gate Attendance</span>
                        </div>
                      </div>

                      {/* Center Seal */}
                      <div className="h-10 w-10 rounded-full border border-dashed border-amber-600/70 grid place-items-center text-[6px] font-black text-amber-800 uppercase tracking-tighter text-center leading-none p-0.5">
                        SCHOOL SEAL
                      </div>

                      {/* Right Authorized Sign */}
                      <div className="text-center w-22">
                        <div className="h-6 border-b border-slate-400 flex items-end justify-center pb-0.5">
                          <span className="text-[11px] text-purple-900 font-serif italic font-bold">
                            Signatory
                          </span>
                        </div>
                        <span className="text-[7px] font-bold text-slate-700 uppercase tracking-tight block mt-0.5">
                          Principal
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );

              // ================================================================
              // TEMPLATE 3: CYBER METRO / TECH MINIMAL (Sleek Modern Executive)
              // ================================================================
              const CardCyberMetro = (
                <div
                  className="id-card id-card-cyber-metro relative mx-auto w-full max-w-[340px] rounded-3xl border-2 border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden flex flex-col justify-between print:shadow-none print:border-slate-800 print:break-inside-avoid print:w-[325px] print:h-[500px]"
                  style={{ minHeight: "500px" }}
                >
                  {/* Top Lanyard Slot Guide Mark */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 w-9 h-1.5 rounded-full bg-slate-700 border border-white/40 pointer-events-none" />

                  {/* Header with Holographic Stripe */}
                  <div className="pt-4 pb-2 px-3.5 relative bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-indigo-500/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {orgSettings?.logo_url ? (
                          <img
                            src={orgSettings.logo_url}
                            alt=""
                            className="h-8 w-8 rounded-lg object-contain bg-white/10 p-0.5 border border-white/20"
                          />
                        ) : (
                          <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-xs">
                            <GraduationCap size={18} />
                          </div>
                        )}
                        <div className="truncate">
                          <h4 className="font-black text-xs uppercase tracking-wider text-white truncate">
                            {orgName}
                          </h4>
                          <p className="text-[8px] text-cyan-300 font-mono tracking-widest uppercase">
                            SMART METRO PASS • {sessionYear}
                          </p>
                        </div>
                      </div>
                      {/* Microchip Graphic Icon */}
                      <div className="h-6 w-8 rounded border border-amber-400/80 bg-gradient-to-br from-amber-300 to-amber-600 p-0.5 flex flex-col justify-between shadow-xs">
                        <div className="h-1 border-b border-amber-800/40" />
                        <div className="h-1 border-b border-amber-800/40" />
                      </div>
                    </div>
                  </div>

                  {/* White Interior Body Container */}
                  <div className="flex-1 bg-white text-slate-800 p-3.5 flex flex-col justify-between relative">
                    {/* Student Profile Row */}
                    <div className="flex items-center gap-3">
                      {/* High-Tech Photo Frame with Crosshairs */}
                      <div className="relative shrink-0 h-22 w-20 rounded-xl border-2 border-indigo-600 overflow-hidden bg-slate-100 shadow-sm">
                        {s.photo_url ? (
                          <img src={s.photo_url} alt={fullName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full grid place-items-center text-xl font-bold bg-slate-900 text-white">
                            {initials || "ST"}
                          </div>
                        )}
                        <span className="absolute bottom-0 inset-x-0 bg-slate-900/90 text-cyan-300 font-mono text-[7px] text-center font-bold uppercase py-0.2">
                          VERIFIED
                        </span>
                      </div>

                      {/* Name and Badges */}
                      <div className="flex-1 min-w-0">
                        <span className="text-[8px] font-mono text-indigo-600 font-black tracking-widest uppercase block">
                          STUDENT PASS
                        </span>
                        <h3 className="text-base font-black text-slate-900 uppercase tracking-tight truncate leading-tight">
                          {fullName}
                        </h3>

                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 text-[9px] font-extrabold text-indigo-900">
                            {className} {sectionName ? `(${sectionName})` : ""}
                          </span>
                          <span className="rounded bg-cyan-50 border border-cyan-300 px-1.5 py-0.2 text-[9px] font-mono font-bold text-cyan-900">
                            ROLL: {rollNo}
                          </span>
                        </div>

                        <div className="mt-1 text-[8px] font-mono text-slate-400">
                          ID: {s.admission_no}
                        </div>
                      </div>
                    </div>

                    {/* Modern Grid Tiles (All Details Required) */}
                    <div className="mt-2 grid grid-cols-2 gap-1.5 text-[9px]">
                      <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/80">
                        <span className="text-[7.5px] text-slate-400 font-semibold block uppercase">Father / Guardian</span>
                        <span className="font-bold text-slate-900 truncate block">
                          {s.father_name || s.guardian_name || "—"}
                        </span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/80">
                        <span className="text-[7.5px] text-slate-400 font-semibold block uppercase">Emergency Phone</span>
                        <span className="font-bold font-mono text-slate-900 truncate block">
                          {s.phone || s.guardian_phone || "—"}
                        </span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/80">
                        <span className="text-[7.5px] text-slate-400 font-semibold block uppercase">DOB &bull; Adm Date</span>
                        <span className="font-bold text-slate-900 truncate block">
                          {s.date_of_birth || "—"} &bull; {s.admission_date ? s.admission_date.slice(0, 10) : "—"}
                        </span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/80">
                        <span className="text-[7.5px] text-slate-400 font-semibold block uppercase">Blood Group</span>
                        <span className="font-extrabold text-red-600 bg-red-50 px-1 rounded inline-block">
                          {s.blood_group || "O+"}
                        </span>
                      </div>
                    </div>

                    {/* Address tile */}
                    <div className="mt-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-[8.5px] text-slate-600 flex items-start gap-1">
                      <MapPin size={10} className="shrink-0 text-slate-400 mt-0.5" />
                      <span className="truncate line-clamp-1 font-medium">
                        {s.address || "Registered Address with Institution"}
                      </span>
                    </div>

                    {/* Fee Warning Stamp */}
                    {printFeeStamp && hasFeeDues && (
                      <div className="mt-1 rounded bg-amber-50 border border-amber-300 p-0.5 text-center text-[8px] font-bold text-amber-800">
                        ⚠️ Fee Dues: ₹{sFee.dueAmount}
                      </div>
                    )}

                    {/* Faux Barcode Strip */}
                    <div className="mt-1.5 pt-1 border-t border-dashed border-slate-200 flex items-center justify-between text-[7px] font-mono text-slate-400">
                      <span className="tracking-widest">||| | |||| | ||| |||| | |||||</span>
                      <span>AUTH #{s.admission_no}</span>
                      <span className="tracking-widest">||||| | ||| | ||</span>
                    </div>

                    {/* Bottom Gate QR + Authority Sign Hub */}
                    <div className="mt-1.5 pt-1.5 border-t border-slate-200 flex items-center justify-between gap-2">
                      <div
                        onClick={() => setInspectStudent(s)}
                        className="cursor-pointer bg-slate-900 text-white p-1 rounded-xl flex items-center gap-1.5 shadow-sm"
                        title="Click to test QR Code"
                      >
                        <QRCodeImage value={qrData} className="h-15 w-15 object-contain rounded-lg bg-white p-0.5" size={260} />
                        <div className="pr-1 text-left">
                          <span className="text-[7.5px] font-black uppercase text-cyan-300 block">GATE SCAN</span>
                          <span className="text-[6.5px] text-slate-300 block">Fast-Pass QR</span>
                        </div>
                      </div>

                      <div className="flex-1 text-right">
                        <div className="h-6 border-b border-slate-400 flex items-end justify-center pb-0.5">
                          <span className="text-[11px] text-indigo-900 font-serif italic font-bold">
                            Authorized
                          </span>
                        </div>
                        <span className="text-[7px] font-black text-slate-700 uppercase tracking-wider block mt-0.5">
                          Principal Signature
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );

              // ================================================================
              // TEMPLATE 4 (USER DESIGN 2): SUNRISE MAROON & GOLD (LANDSCAPE)
              // ================================================================
              const sunriseColor = themeColor || "#640d14";
              const CardSunriseMaroon = (
                <div
                  className="id-card-horizontal id-card-sunrise-maroon relative mx-auto w-full max-w-[465px] rounded-2xl border border-stone-300 bg-white shadow-xl overflow-hidden flex flex-col justify-between print:shadow-none print:border-stone-400 print:break-inside-avoid print:w-[440px] print:h-[275px]"
                  style={{ minHeight: "275px" }}
                >
                  {/* Top Maroon Header Banner */}
                  <div
                    className="px-3.5 py-2.5 text-white flex items-center justify-between gap-2.5"
                    style={{
                      backgroundColor: sunriseColor,
                      WebkitPrintColorAdjust: "exact",
                      printColorAdjust: "exact",
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Crisp White Rounded Logo Container */}
                      <div className="h-12 w-12 shrink-0 rounded-xl bg-white p-1 shadow-xs flex items-center justify-center overflow-hidden border border-white/80">
                        {orgSettings?.logo_url ? (
                          <img
                            src={orgSettings.logo_url}
                            alt={orgName}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <GraduationCap size={26} style={{ color: sunriseColor }} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-black text-[13.5px] sm:text-[15px] uppercase tracking-wide leading-tight text-white truncate">
                          {orgName}
                        </h4>
                        <p className="text-[9px] text-rose-100/95 font-medium truncate mt-0.5">
                          {orgSettings?.address || "Recognized Educational Institution"}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right pl-1">
                      <span className="text-[11px] font-black uppercase tracking-wider text-white">
                        STUDENT ID
                      </span>
                    </div>
                  </div>

                  {/* Top Gold Accent Bar */}
                  <div
                    className="h-[4px] w-full shrink-0"
                    style={{
                      backgroundColor: "#c59b38",
                      WebkitPrintColorAdjust: "exact",
                      printColorAdjust: "exact",
                    }}
                  />

                  {/* Main White Body (3 Columns: Photo | Form Rows | Gold QR Box) */}
                  <div className="flex-1 px-3.5 py-2.5 bg-white flex items-stretch justify-between gap-3">
                    {/* Left Column: Gold-Trimmed Portrait Photo */}
                    <div className="shrink-0 flex flex-col items-center justify-start">
                      <div
                        className="h-[112px] w-[90px] rounded-xl border-2 bg-[#faf8f5] overflow-hidden flex items-center justify-center shadow-2xs"
                        style={{ borderColor: "#c59b38" }}
                      >
                        {s.photo_url ? (
                          <img
                            src={s.photo_url}
                            alt={fullName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex flex-col items-center justify-center text-stone-400">
                            <div
                              className="h-10 w-10 rounded-full grid place-items-center text-white font-black text-base"
                              style={{ backgroundColor: sunriseColor }}
                            >
                              {initials || "ST"}
                            </div>
                          </div>
                        )}
                      </div>
                      <span className="mt-1 text-[8px] font-extrabold uppercase tracking-wider text-slate-500 text-center">
                        ADM: {s.admission_no}
                      </span>
                    </div>

                    {/* Middle Column: Clean Ruled Student Bio Table */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center space-y-1 text-[9.5px]">
                      <div className="flex items-baseline border-b border-stone-200/90 pb-0.5">
                        <span
                          className="w-[84px] shrink-0 text-[8.5px] font-extrabold uppercase tracking-tight"
                          style={{ color: sunriseColor }}
                        >
                          STUDENT NAME
                        </span>
                        <span className="font-black px-1" style={{ color: "#c59b38" }}>:</span>
                        <span className="flex-1 font-black text-slate-900 uppercase truncate">
                          {fullName}
                        </span>
                      </div>

                      <div className="flex items-baseline border-b border-stone-200/90 pb-0.5">
                        <span
                          className="w-[84px] shrink-0 text-[8.5px] font-extrabold uppercase tracking-tight"
                          style={{ color: sunriseColor }}
                        >
                          CLASS
                        </span>
                        <span className="font-black px-1" style={{ color: "#c59b38" }}>:</span>
                        <span className="flex-1 font-bold text-slate-900 truncate">
                          {className} {sectionName ? `(${sectionName})` : ""}
                        </span>
                      </div>

                      <div className="flex items-baseline border-b border-stone-200/90 pb-0.5">
                        <span
                          className="w-[84px] shrink-0 text-[8.5px] font-extrabold uppercase tracking-tight"
                          style={{ color: sunriseColor }}
                        >
                          ROLL NO.
                        </span>
                        <span className="font-black px-1" style={{ color: "#c59b38" }}>:</span>
                        <span className="flex-1 font-bold font-mono text-slate-900 truncate">
                          {rollNo}
                          {s.blood_group ? (
                            <span className="ml-2 text-[8px] font-extrabold text-red-700 bg-red-50 px-1 rounded">
                              {s.blood_group}
                            </span>
                          ) : null}
                        </span>
                      </div>

                      <div className="flex items-baseline border-b border-stone-200/90 pb-0.5">
                        <span
                          className="w-[84px] shrink-0 text-[8.5px] font-extrabold uppercase tracking-tight"
                          style={{ color: sunriseColor }}
                        >
                          FATHER NAME
                        </span>
                        <span className="font-black px-1" style={{ color: "#c59b38" }}>:</span>
                        <span className="flex-1 font-bold text-slate-900 truncate">
                          {s.father_name || s.guardian_name || "—"}
                        </span>
                      </div>

                      <div className="flex items-baseline border-b border-stone-200/90 pb-0.5">
                        <span
                          className="w-[84px] shrink-0 text-[8.5px] font-extrabold uppercase tracking-tight"
                          style={{ color: sunriseColor }}
                        >
                          CONTACT NO.
                        </span>
                        <span className="font-black px-1" style={{ color: "#c59b38" }}>:</span>
                        <span className="flex-1 font-bold font-mono text-slate-900 truncate">
                          {s.phone || s.guardian_phone || "—"}
                        </span>
                      </div>

                      <div className="flex items-baseline pb-0.5">
                        <span
                          className="w-[84px] shrink-0 text-[8.5px] font-extrabold uppercase tracking-tight"
                          style={{ color: sunriseColor }}
                        >
                          ADDRESS
                        </span>
                        <span className="font-black px-1" style={{ color: "#c59b38" }}>:</span>
                        <span className="flex-1 font-semibold text-slate-800 truncate text-[9px]">
                          {s.address || "Recorded in school register"}
                        </span>
                      </div>

                      {printFeeStamp && hasFeeDues && (
                        <div className="rounded bg-amber-50 border border-amber-300 px-1.5 py-0.5 text-[8px] font-bold text-amber-900">
                          ⚠️ Fee Due: ₹{sFee.dueAmount}
                        </div>
                      )}
                    </div>

                    {/* Right Column: Gold-Bordered Scan QR Box (Bottom-aligned like reference) */}
                    <div className="shrink-0 flex flex-col items-center justify-end pb-0.5">
                      <div
                        onClick={() => setInspectStudent(s)}
                        className="cursor-pointer rounded-xl border-2 bg-white p-1.5 shadow-2xs hover:shadow-md transition"
                        style={{ borderColor: "#c59b38" }}
                        title="Click to test QR Code"
                      >
                        <QRCodeImage
                          value={qrData}
                          className="h-[74px] w-[74px] object-contain"
                          size={320}
                        />
                      </div>
                      <span
                        className="mt-1 text-[8.5px] font-black uppercase tracking-wide leading-none"
                        style={{ color: sunriseColor }}
                      >
                        SCAN QR
                      </span>
                      <span className="text-[6.5px] font-bold uppercase text-slate-500 mt-0.5 tracking-tight">
                        SCHOOL DETAILS
                      </span>
                    </div>
                  </div>

                  {/* Bottom Gold Accent Bar */}
                  <div
                    className="h-[4px] w-full shrink-0"
                    style={{
                      backgroundColor: "#c59b38",
                      WebkitPrintColorAdjust: "exact",
                      printColorAdjust: "exact",
                    }}
                  />

                  {/* Warm Cream Footer */}
                  <div
                    className="px-4 py-1.5 flex items-center justify-between text-[10px] font-black"
                    style={{
                      backgroundColor: "#faf8f3",
                      color: sunriseColor,
                      WebkitPrintColorAdjust: "exact",
                      printColorAdjust: "exact",
                    }}
                  >
                    <span className="uppercase tracking-wide">SESSION {sessionYear}</span>
                    <span>
                      School Contact: {orgSettings?.phone || "Office Helpline"}
                    </span>
                  </div>
                </div>
              );

              // ================================================================
              // TEMPLATE 5 (USER DESIGN 1): OAKFIELD GOLD & WHITE (LANDSCAPE)
              // ================================================================
              const CardOakfieldGold = (
                <div
                  className="id-card-horizontal id-card-oakfield-gold relative mx-auto w-full max-w-[465px] rounded-2xl border border-slate-300 bg-white shadow-xl overflow-hidden flex flex-col justify-between print:shadow-none print:border-slate-400 print:break-inside-avoid print:w-[440px] print:h-[275px]"
                  style={{ minHeight: "275px" }}
                >
                  {/* Subtle Faceted Low-Poly Geometric Background */}
                  <svg
                    viewBox="0 0 460 275"
                    preserveAspectRatio="none"
                    className="absolute inset-0 h-full w-full pointer-events-none opacity-60"
                  >
                    <polygon points="0,0 160,0 90,95" fill="#f1f5f9" />
                    <polygon points="160,0 320,0 240,80" fill="#f8fafc" />
                    <polygon points="320,0 460,0 460,110 350,85" fill="#f1f5f9" />
                    <polygon points="0,95 90,95 40,210 0,190" fill="#e2e8f0" opacity="0.45" />
                    <polygon points="140,180 280,150 220,275 110,275" fill="#f1f5f9" />
                    <polygon points="350,170 460,140 460,275 310,275" fill="#e2e8f0" opacity="0.4" />
                  </svg>

                  {/* Top Row: School Crest & Name (Left) | Vector Barcode & STUDENT ID (Right) */}
                  <div className="relative z-10 px-4 pt-3 pb-1 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="h-11 w-11 shrink-0 rounded-xl bg-white border border-slate-200 p-0.5 shadow-2xs flex items-center justify-center overflow-hidden">
                        {orgSettings?.logo_url ? (
                          <img
                            src={orgSettings.logo_url}
                            alt={orgName}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <div className="h-full w-full rounded-lg bg-slate-900 border-2 border-[#facc15] grid place-items-center">
                            <GraduationCap size={20} className="text-[#facc15]" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-black text-[14.5px] sm:text-[15.5px] uppercase tracking-tight text-slate-950 leading-none truncate">
                          {orgName}
                        </h4>
                        <p className="text-[8.5px] font-semibold uppercase tracking-wide text-slate-600 truncate mt-1">
                          {orgSettings?.address || "EXCELLENCE IN INNOVATION & LEARNING"}
                        </p>
                      </div>
                    </div>

                    {/* Right: Vector Barcode + Admission ID + STUDENT ID */}
                    <div className="shrink-0 flex flex-col items-center">
                      <BarcodeSvg value={s.admission_no} className="h-6 w-24" />
                      <span className="text-[7.5px] font-mono font-bold text-slate-700 leading-none mt-0.5">
                        [{s.admission_no}]
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-wide text-slate-950 leading-tight">
                        STUDENT ID
                      </span>
                    </div>
                  </div>

                  {/* Middle Content Area with Signature Horizontal Gold Band */}
                  <div className="relative z-10 flex-1 flex flex-col justify-center">
                    {/* Edge-to-Edge Gold Session Ribbon behind lower third */}
                    <div
                      className="absolute inset-x-0 bottom-3 h-[21px] flex items-center justify-center z-0"
                      style={{
                        backgroundColor: "#facc15",
                        WebkitPrintColorAdjust: "exact",
                        printColorAdjust: "exact",
                      }}
                    >
                      <span className="text-[11px] font-black text-slate-950 tracking-wider">
                        [{sessionYear}]
                      </span>
                    </div>

                    {/* 3 Foreground Columns: Framed Photo | Student Bio | Yellow QR Access Card */}
                    <div className="relative z-10 px-4 flex items-start justify-between gap-3">
                      {/* Left: Bright Yellow Framed Student Photo */}
                      <div className="shrink-0 flex flex-col items-center">
                        <div
                          className="h-[106px] w-[86px] bg-white p-[3px] shadow-xs overflow-hidden"
                          style={{ border: "2.5px solid #eab308" }}
                        >
                          {s.photo_url ? (
                            <img
                              src={s.photo_url}
                              alt={fullName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-slate-200 grid place-items-center text-2xl font-black text-slate-600">
                              {initials || "ST"}
                            </div>
                          )}
                        </div>
                        <span className="mt-1 text-[8px] font-black uppercase tracking-tight text-slate-900">
                          [STUDENT PHOTO]
                        </span>
                      </div>

                      {/* Center: Bold Uppercase Student Details */}
                      <div className="flex-1 min-w-0 pt-0.5 space-y-1 text-[9.5px] leading-tight">
                        <div className="truncate">
                          <span className="font-black text-slate-950 uppercase">NAME: </span>
                          <span
                            className="font-extrabold text-slate-950 uppercase pb-0.2"
                            style={{ borderBottom: "2px solid #facc15" }}
                          >
                            {fullName}
                          </span>
                        </div>

                        <div className="truncate">
                          <span className="font-black text-slate-950 uppercase">ROLL NUMBER: </span>
                          <span className="font-bold font-mono text-slate-800">{rollNo}</span>
                          <span className="ml-2 font-black text-slate-950 uppercase">CLASS: </span>
                          <span className="font-bold text-slate-800">
                            {className}{sectionName ? ` (${sectionName})` : ""}
                          </span>
                        </div>

                        <div className="truncate">
                          <span className="font-black text-slate-950 uppercase">FATHER NAME: </span>
                          <span className="font-bold text-slate-800">
                            {s.father_name || s.guardian_name || "—"}
                          </span>
                        </div>

                        <div className="truncate">
                          <span className="font-black text-slate-950 uppercase">DOB: </span>
                          <span className="font-bold text-slate-800">{s.date_of_birth || "—"}</span>
                          <span className="ml-2 font-black text-slate-950 uppercase">PHONE: </span>
                          <span className="font-bold font-mono text-slate-800">
                            {s.phone || s.guardian_phone || "—"}
                          </span>
                        </div>

                        <div className="truncate text-[8.5px]">
                          <span className="font-black text-slate-950 uppercase">ADDRESS: </span>
                          <span className="font-semibold text-slate-700">
                            {s.address || "Recorded in register"}
                          </span>
                        </div>

                        {printFeeStamp && hasFeeDues && (
                          <div className="inline-block rounded bg-amber-100 border border-amber-400 px-1.5 py-0.2 text-[8px] font-bold text-amber-950">
                            ⚠️ Fee Due: ₹{sFee.dueAmount}
                          </div>
                        )}
                      </div>

                      {/* Right: Yellow SCAN FOR ACCESS QR Card */}
                      <div
                        onClick={() => setInspectStudent(s)}
                        className="shrink-0 w-[92px] rounded-md p-[2px] shadow-xs cursor-pointer hover:shadow-md transition"
                        style={{
                          backgroundColor: "#facc15",
                          WebkitPrintColorAdjust: "exact",
                          printColorAdjust: "exact",
                        }}
                        title="Click to test QR Code"
                      >
                        <div className="text-[6.5px] font-black uppercase text-slate-950 text-center py-0.5 tracking-tight">
                          SCAN FOR ACCESS
                        </div>
                        <div className="bg-white p-1 flex items-center justify-center rounded-[3px]">
                          <QRCodeImage
                            value={qrData}
                            className="h-[72px] w-[72px] object-contain"
                            size={320}
                          />
                        </div>
                        <div className="text-[6.5px] font-black uppercase text-slate-950 text-center py-0.5 tracking-tight">
                          SCAN FOR ACCESS
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Signature & Mini Gold Crest Emblem Row */}
                  <div className="relative z-10 px-4 pb-2 pt-0.5 flex items-center justify-between gap-2">
                    <div className="text-[7.5px] font-mono text-slate-500">
                      {s.admission_date ? `Adm Date: ${s.admission_date}` : ""}
                      {s.blood_group ? ` • Blood: ${s.blood_group}` : ""}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-slate-950">
                        Authorized Signature:
                      </span>
                      <span className="text-[9.5px] font-serif italic font-semibold text-slate-700 border-b border-slate-400 px-1.5">
                        {orgSettings?.authorized_signatory || "Principal's Signature"}
                      </span>
                      {/* Mini Yellow Emblem Seal */}
                      <div
                        className="h-6 w-6 rounded-md p-0.5 flex items-center justify-center overflow-hidden shadow-2xs shrink-0"
                        style={{
                          backgroundColor: "#facc15",
                          WebkitPrintColorAdjust: "exact",
                          printColorAdjust: "exact",
                        }}
                      >
                        {orgSettings?.logo_url ? (
                          <img
                            src={orgSettings.logo_url}
                            alt=""
                            className="h-full w-full object-contain rounded-xs bg-white/90"
                          />
                        ) : (
                          <GraduationCap size={14} className="text-slate-950" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );

              // Selected Front Card based on active template
              const CardFront =
                cardTemplate === "royal_cbse"
                  ? CardRoyalCBSE
                  : cardTemplate === "cyber_metro"
                  ? CardCyberMetro
                  : CardModernWave;

              // Selected Horizontal Front Card based on active template
              const CardHorizontal =
                cardTemplate === "oakfield_gold" ? CardOakfieldGold : CardSunriseMaroon;

              // Horizontal Back Card (ONLY rendered when user explicitly turns Back Print ON)
              const CardBackHorizontal = (
                <div
                  className="id-card-horizontal id-card-back relative mx-auto w-full max-w-[465px] rounded-2xl border border-slate-300 bg-white shadow-xl overflow-hidden flex flex-col justify-between print:shadow-none print:border-slate-400 print:break-inside-avoid print:w-[440px] print:h-[275px] p-4 text-xs"
                  style={{ minHeight: "275px" }}
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {orgSettings?.logo_url && (
                        <img
                          src={orgSettings.logo_url}
                          alt={orgName}
                          className="h-7 w-7 rounded-lg object-contain border border-slate-200 p-0.5 bg-white"
                        />
                      )}
                      <div className="min-w-0">
                        <h4 className="font-black text-xs uppercase text-slate-900 truncate">
                          {orgName}
                        </h4>
                        <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500">
                          Identity Card Terms &amp; Emergency Info
                        </span>
                      </div>
                    </div>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[8.5px] font-mono font-bold text-slate-700">
                      SESSION {sessionYear}
                    </span>
                  </div>

                  <div className="my-2 flex items-center justify-between gap-3 flex-1">
                    <div className="flex-1 space-y-1 text-[9px] text-slate-600 leading-snug">
                      <p>
                        1. <strong>Mandatory Daily Use:</strong> Student must wear this ID card daily inside campus &amp; scan at the gate kiosk.
                      </p>
                      <p>
                        2. <strong>Non-Transferable:</strong> Valid exclusively for <strong>{fullName}</strong> (Adm: {s.admission_no}, Roll: {rollNo}).
                      </p>
                      <p>
                        3. <strong>Loss / Replacement:</strong> Report immediately to school office in case of loss or damage.
                      </p>
                      <div className="pt-1 text-[8.5px] text-slate-800">
                        <strong>Residence:</strong> {s.address || "Recorded in school register"}
                        <br />
                        <strong>Emergency Phone:</strong>{" "}
                        <span className="font-mono font-bold">{s.phone || s.guardian_phone || "—"}</span>
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-center bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <QRCodeImage value={qrData} className="h-20 w-20 object-contain" size={320} />
                      <span className="text-[7px] font-mono text-slate-500 mt-0.5">
                        {s.admission_no}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-1.5 flex items-center justify-between text-[8.5px] text-slate-600">
                    <span className="truncate max-w-[270px]">
                      <strong>If found, return to:</strong> {orgSettings?.address || orgName}
                    </span>
                    <span className="font-mono font-bold text-slate-900 shrink-0">
                      {orgSettings?.phone ? `Tel: ${orgSettings.phone}` : ""}
                    </span>
                  </div>
                </div>
              );

              // Vertical Card Back Element (ONLY rendered when user explicitly turns Back Print ON)
              const CardBack = (
                <div
                  className="id-card-back relative mx-auto w-full max-w-[340px] rounded-3xl border border-slate-300 bg-white shadow-xl overflow-hidden flex flex-col justify-between print:shadow-none print:border-slate-400 print:break-inside-avoid print:w-[325px] print:h-[500px] p-4 text-xs"
                  style={{ minHeight: "500px" }}
                >
                  <div>
                    {/* Header */}
                    <div className="text-center border-b border-slate-200 pb-2">
                      <h4 className="font-extrabold text-xs uppercase text-slate-900 tracking-wider">
                        {orgName}
                      </h4>
                      <span className="text-[8.5px] text-purple-700 font-bold uppercase tracking-wider block mt-0.5">
                        Card Holder Guidelines &bull; Terms of Use
                      </span>
                    </div>

                    {/* Student Identification Banner */}
                    <div className="my-2 rounded-xl bg-purple-50/70 border border-purple-200/80 p-2 text-[9.5px]">
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>{fullName}</span>
                        <span className="font-mono text-purple-800">Roll: {rollNo}</span>
                      </div>
                      <div className="mt-0.5 flex justify-between text-[8.5px] text-slate-600">
                        <span>Class: {className} {sectionName ? `(${sectionName})` : ""}</span>
                        <span className="font-mono">Adm: {s.admission_no}</span>
                      </div>
                    </div>

                    {/* Rules List */}
                    <div className="space-y-1.5 text-[9.5px] text-slate-600 leading-snug">
                      <p>
                        1. <strong>Mandatory Attendance:</strong> Student must carry this card daily and scan at the gate kiosk upon entry.
                      </p>
                      <p>
                        2. <strong>Non-Transferable:</strong> This card is issued exclusively for <strong>{fullName}</strong> and is non-transferable.
                      </p>
                      <p>
                        3. <strong>Loss or Damage:</strong> In case of loss or damage, immediately inform the administrative office for a reissue.
                      </p>
                      <p>
                        4. <strong>Live Verification:</strong> Parents and authorities can scan the QR code to verify attendance and fee status.
                      </p>
                    </div>

                    {/* Giant Gate Attendance Fast-Pass QR */}
                    <div className="mt-3 flex flex-col items-center justify-center p-2 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-700 mb-0.5">
                        GATE SCANNER PASS
                      </span>
                      <QRCodeImage
                        value={qrData}
                        className="h-24 w-24 object-contain rounded-xl bg-white p-1 border border-slate-200 shadow-xs"
                        size={360}
                      />
                      <span className="text-[7.5px] text-slate-400 font-mono mt-0.5">
                        Adm No: {s.admission_no} &bull; Blood: {s.blood_group || "O+"}
                      </span>
                    </div>
                  </div>

                  {/* Contact & Return Notice */}
                  <div className="border-t border-slate-200 pt-2 text-[9px] text-slate-700 space-y-1">
                    <div className="rounded-xl bg-slate-50 p-2 space-y-0.5">
                      <p className="font-bold text-slate-900">Student Residence &amp; Emergency:</p>
                      <p className="line-clamp-1">{s.address || "Address in school register"}</p>
                      <p className="font-mono text-purple-900 font-bold">
                        Emergency Contact: {s.phone || s.guardian_phone || "—"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-2 space-y-0.5">
                      <p className="font-bold text-slate-900">If found, please return to:</p>
                      <p className="truncate">{orgSettings?.address || orgName}</p>
                      {orgSettings?.phone && (
                        <p className="font-mono">Helpline: {orgSettings.phone}</p>
                      )}
                    </div>

                    <div className="text-center text-[8px] text-slate-400 font-mono pt-1">
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

                    {/* Rendering Mode: Back Side ONLY prints when includeBackPrint is explicitly clicked ON */}
                    {orientation === "horizontal" ? (
                      <div className="space-y-3">
                        {CardHorizontal}
                        {includeBackPrint && CardBackHorizontal}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {CardFront}
                        {includeBackPrint && CardBack}
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
      {/* A4 PRINT SETUP MODAL                                           */}
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
                          {Math.ceil((cardsToPrint.length * (includeBackPrint ? 2 : 1)) / p.capacity) || 1} Sheet(s) Needed
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Print Options & Explicit Back Print Control */}
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3 text-xs">
              <div className="flex flex-col gap-2.5">
                {/* Explicit Back Print Checkbox (OFF by default) */}
                <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-slate-900 select-none bg-white border border-slate-200 rounded-xl px-3 py-2">
                  <input
                    type="checkbox"
                    checked={includeBackPrint}
                    onChange={(e) => setIncludeBackPrint(e.target.checked)}
                    className="rounded border-slate-300 text-purple-600"
                  />
                  <span className="flex items-center gap-1.5">
                    <Layers size={14} className="text-purple-600" />
                    <span>
                      Include Back Side Print (Optional — Currently{" "}
                      <strong className={includeBackPrint ? "text-purple-700" : "text-emerald-700"}>
                        {includeBackPrint ? "ON: Front + Back" : "OFF: Front Side Only"}
                      </strong>
                      )
                    </span>
                  </span>
                </label>

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
              </div>

              {/* Summary Stats */}
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600">
                <span>
                  Selected Students: <strong className="text-slate-900">{cardsToPrint.length}</strong>
                </span>
                <span>
                  Print Mode:{" "}
                  <strong className="text-purple-700 font-bold">
                    {includeBackPrint ? "Front + Back" : "Front Side Only"}
                  </strong>
                </span>
                <span>
                  Estimated A4 Paper:{" "}
                  <strong className="text-purple-700 font-bold">
                    {Math.ceil((cardsToPrint.length * (includeBackPrint ? 2 : 1)) / activePreset.capacity) || 1} Page(s)
                  </strong>
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

          /* Preset: 8 Horizontal (Recommended Landscape 2x4) */
          .sheet-preset-8_horizontal {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px 12px !important;
          }

          /* Preset: 8 Standard (Vertical 2x4) */
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

          .id-card,
          .id-card-sunrise-maroon,
          .id-card-oakfield-gold,
          .id-card-modern-wave,
          .id-card-royal-cbse,
          .id-card-cyber-metro,
          .id-card-horizontal,
          .id-card-back {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          /* Force all colored headers and badges to print in full color */
          .id-card [style*="background"],
          .id-card-sunrise-maroon [style*="background"],
          .id-card-oakfield-gold [style*="background"],
          .id-card-modern-wave [style*="background"],
          .id-card-royal-cbse [style*="background"],
          .id-card-cyber-metro [style*="background"],
          .id-card-horizontal [style*="background"],
          .id-card-back [style*="background"],
          .bg-purple-50,
          .bg-emerald-100,
          .bg-amber-100,
          .bg-amber-50,
          .bg-red-50,
          .bg-slate-100,
          .bg-slate-900,
          .bg-indigo-950,
          .bg-cyan-50,
          .bg-indigo-50 {
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
