"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Printer,
  Plus,
  FileText,
  Check,
  Copy,
  Trash2,
  Edit3,
  ArrowLeft,
  Building2,
  Calendar,
  ShieldCheck,
  Share2,
  Eye,
  Search,
  Sparkles,
  X,
  FileCheck,
  RefreshCw,
  Sliders,
  ChevronRight,
  Send,
  Download,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUserAccess } from "@/lib/auth/permissions";
import AccessDenied from "@/components/auth/AccessDenied";
import FeatureGate from "@/components/FeatureGate";
import { fetchInstitutionFeatures } from "@/lib/features";
import { resolveStorageUrl } from "@/lib/storage";

// ============================================================================
// TYPES & DATA CONTRACTS
// ============================================================================

export type Signatory = {
  role: string;
  name: string;
  enabled: boolean;
};

export type OfficialNotice = {
  id: string;
  ref_no: string;
  notice_date: string;
  title: string;
  body: string;
  category: string;
  target_audience: string;
  signatories: Signatory[];
  show_stamp: boolean;
  copies_to: string;
  created_at?: string;
};

type SchoolHeaderInfo = {
  name: string;
  affiliation: string;
  reg_no: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logo_url: string | null;
  primary_color: string;
};

// ============================================================================
// PRE-BUILT INSTITUTION NOTICE TEMPLATES (1-Click Fill)
// ============================================================================

const NOTICE_TEMPLATES = [
  {
    label: "Winter Vacation & Reopening",
    category: "Holiday / Vacation",
    audience: "All Parents / Guardians & Students",
    title: "ANNOUNCEMENT REGARDING WINTER BREAK & RESUMPTION OF CLASSES",
    body: `This is to formally notify all parents, guardians, and students that the school will observe Winter Vacation starting from [Start Date] to [End Date].

Classes will formally resume on [Reopening Date] as per standard winter timings (09:00 AM to 02:30 PM).

Important Guidelines for Students & Parents:
1. Subject-wise Holiday Homework and project assignments have been distributed. Completed assignments must be submitted to the respective class teachers on the reopening day.
2. Special remedial and doubt-clearing sessions for Board Examination classes (X & XII) will continue online as per the pre-notified routine.
3. Parents are requested to ensure their ward follows a disciplined revision schedule and adheres to proper winter health precautions.

The management and faculty wish all our dear students and families a restful and safe winter break.`,
  },
  {
    label: "Fee Clearance & Due Date Reminder",
    category: "Fees & Accounts",
    audience: "All Respected Parents / Guardians",
    title: "IMPORTANT CIRCULAR: FINAL FEE CLEARANCE FOR CURRENT ACADEMIC TERM",
    body: `Respected Parents / Guardians,

This is a gentle reminder regarding the settlement of outstanding school tuition and transport fees for the ongoing academic term. We request you to clear all dues on or before [Due Date].

Key Details:
1. The school fee counter will remain operational on all working days from 08:30 AM to 02:00 PM.
2. Digital online fee payment is readily available via the official School Parent Portal with instant receipt generation.
3. Prompt clearance of dues ensures timely issuance of examination admit cards, report cards, and seamless portal access.

Your continuous cooperation and timely support are deeply appreciated in maintaining institutional standards.`,
  },
  {
    label: "Parent-Teacher Meeting (PTM)",
    category: "Academic Circular",
    audience: "Parents / Guardians of Classes Pre-Nur to XII",
    title: "CIRCULAR: SCHEDULED PARENT-TEACHER PROGRESS REVIEW MEETING (PTM)",
    body: `Dear Parents and Guardians,

A Parent-Teacher Meeting (PTM) has been scheduled on [Date] to review your ward's comprehensive academic performance, unit test marks, and classroom engagement.

Meeting Timings & Slots:
• Roll Numbers 01 to 20: 09:00 AM to 10:30 AM
• Roll Numbers 21 to 40: 10:30 AM to 12:00 PM
• Roll Numbers 41 and above: 12:00 PM to 01:15 PM

Note:
• Students accompanying parents must be dressed in complete, neat school uniform with their institutional ID cards.
• Class teachers and subject specialists will be available for one-on-one constructive feedback.`,
  },
  {
    label: "School Timings Revision (Weather/Seasonal)",
    category: "Operational Notice",
    audience: "All Students, Parents & Transport Staff",
    title: "NOTIFICATION: REVISION IN DAILY SCHOOL TIMINGS",
    body: `In compliance with district administrative directives and seasonal weather conditions, please be informed that school timings are revised with effect from [Effective Date].

Revised Daily Timings:
• Morning Assembly & Gates Close: 08:45 AM
• First Academic Period: 09:00 AM
• Kindergarten & Primary Dispersal: 01:30 PM
• Middle & Senior Wing Dispersal: 02:30 PM

All school transport routes and pickup times have been adjusted by 30 minutes accordingly. Parents dropping children privately are requested to follow the updated schedule strictly.`,
  },
  {
    label: "Annual Sports & Cultural Meet",
    category: "Events & Celebrations",
    audience: "All Students & Respected Parents",
    title: "CELEBRATION OF ANNUAL SPORTS & CULTURAL MEET 2026",
    body: `We take immense pride and pleasure in announcing that our school will celebrate its Annual Sports and Cultural Meet on [Date] at the main school athletic grounds.

Event Highlights:
• Inter-house track and field competitions, drill march past, and cultural performances.
• Selection trials for track events and drills will commence on [Trial Date]. Interested students should register with their House Captains.
• Parents and guardians are cordially invited to grace the occasion and encourage our budding athletes.

Detailed event schedule and entry invitation passes will be dispatched through the student diary shortly.`,
  },
  {
    label: "Examinations & Admit Card Issuance",
    category: "Examination Advisory",
    audience: "Students of Class IX, X, XI & XII",
    title: "URGENT CIRCULAR: COMMENCEMENT OF TERM EXAMINATIONS & ADMIT CARDS",
    body: `This is to formally inform all students of Classes IX to XII that the Term Examinations will commence from [Exam Date]. The complete date sheet and syllabus blueprint have been attached on the school notice board and student portal.

Essential Guidelines:
1. Admit Cards will be distributed by class teachers from [Admit Card Date]. Carrying the original admit card and school ID card is mandatory inside examination halls.
2. Students must be seated in their designated examination rooms 15 minutes prior to the first bell.
3. Use of mobile phones, smart watches, or unauthorized revision notes is strictly prohibited.`,
  },
];

export default function OfficialNoticesPage() {
  const supabase = createClient();
  const { loading: authLoading, orgId, hasAccess, can } = useUserAccess([
    "notices.manage",
    "settings.manage",
    "students.view",
  ]);

  const [featureActive, setFeatureActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState<OfficialNotice[]>([]);
  const [activeTab, setActiveTab] = useState<"editor" | "archive">("editor");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewDevice, setPreviewDevice] = useState<"a4" | "fit">("fit");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // School Details (Prefilled from Supabase)
  const [schoolHeader, setSchoolHeader] = useState<SchoolHeaderInfo>({
    name: "St. Xavier's International School",
    affiliation: "Affiliated to CBSE, New Delhi | Affiliation No: 2130849",
    reg_no: "School Code: 10452 | U-DISE Code: 09240103402",
    address: "Civil Lines, Near Circuit House, Knowledge Park, Pin: 201301",
    phone: "+91 98765 43210 / +91 87654 32109",
    email: "principal@stxavierschool.edu.in",
    website: "www.stxavierschool.edu.in",
    logo_url: null,
    primary_color: "#1e3a8a",
  });

  const [headerSettingsOpen, setHeaderSettingsOpen] = useState(false);

  // Notice Form State
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [currentNotice, setCurrentNotice] = useState<OfficialNotice>({
    id: "",
    ref_no: `NOT/${new Date().getFullYear()}/${String(Math.floor(Math.random() * 900) + 100)}`,
    notice_date: todayStr,
    title: "NOTICE REGARDING WINTER VACATION AND HOLIDAY HOMEWORK SUBMISSION",
    body: `This is to formally notify all parents, guardians, and students that the school will observe Winter Vacation starting from 25th December 2026 to 05th January 2027.

The school will formally resume on 06th January 2027 as per standard winter timings (09:00 AM to 02:30 PM).

Important Guidelines for Students & Parents:
1. Subject-wise Holiday Homework has been assigned and must be submitted to the respective class teachers on the reopening day.
2. Special remedial and doubt-clearing sessions for Board Examination classes (X & XII) will continue online as per schedule.
3. Parents are requested to ensure their ward completes daily revision and maintains proper health precautions.

Wishing all students and families a restful and joyous winter break.`,
    category: "General Notice",
    target_audience: "All Respected Parents / Guardians & Students",
    signatories: [
      { role: "Principal", name: "Dr. R. K. Sharma (M.A., M.Ed., Ph.D.)", enabled: true },
      { role: "Director / Manager", name: "Er. S. N. Verma", enabled: true },
      { role: "Examination Controller", name: "Prof. Anjali Gupta", enabled: false },
    ],
    show_stamp: true,
    copies_to: "1. School Notice Board 2. Staff Room 3. Class Teachers 4. School Web Portal 5. Office Archive",
  });

  const printAreaRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // LOAD DATA & INITIALIZE
  // ============================================================================

  useEffect(() => {
    if (!orgId || !hasAccess) return;

    (async () => {
      setLoading(true);
      try {
        // 1. Check Feature Gate
        const feat = await fetchInstitutionFeatures(supabase, orgId);
        if (feat && feat.official_notices === false) {
          setFeatureActive(false);
          setLoading(false);
          return;
        }

        // 2. Load Organization & Settings
        const [orgRes, setRes] = await Promise.all([
          supabase.from("organizations").select("name").eq("id", orgId).single(),
          supabase
            .from("organization_settings")
            .select("phone,address,email,website,logo_url,primary_color,authorized_signatory")
            .eq("organization_id", orgId)
            .maybeSingle(),
        ]);

        const orgName = orgRes.data?.name || "Official School & Institution";
        let logoUrl: string | null = null;
        if (setRes.data?.logo_url) {
          logoUrl = await resolveStorageUrl(supabase, setRes.data.logo_url);
        }

        // Check local storage for any custom letterhead overrides for this school
        let savedHeader: any = null;
        try {
          const raw = localStorage.getItem(`edutechlab_letterhead_info_${orgId}`);
          if (raw) savedHeader = JSON.parse(raw);
        } catch {}

        setSchoolHeader((prev) => ({
          ...prev,
          name: orgName,
          phone: savedHeader?.phone || setRes.data?.phone || prev.phone,
          address: savedHeader?.address || setRes.data?.address || prev.address,
          email: savedHeader?.email || setRes.data?.email || prev.email,
          website: savedHeader?.website || setRes.data?.website || prev.website,
          affiliation: savedHeader?.affiliation || prev.affiliation,
          reg_no: savedHeader?.reg_no || prev.reg_no,
          logo_url: logoUrl || prev.logo_url,
          primary_color: setRes.data?.primary_color || prev.primary_color,
        }));

        // If authorized signatory exists, prefill Principal
        const authSig = setRes.data?.authorized_signatory;
        if (authSig) {
          setCurrentNotice((prev) => ({
            ...prev,
            signatories: prev.signatories.map((s) =>
              s.role === "Principal" ? { ...s, name: authSig } : s
            ),
          }));
        }

        // 3. Load Saved Notices from Database & LocalStorage fallback
        await loadSavedNotices(orgId);
      } catch (err) {
        console.error("Error loading official notices data:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId, hasAccess]);

  const loadSavedNotices = async (institutionId: string) => {
    let dbNotices: OfficialNotice[] = [];
    try {
      const { data, error } = await supabase
        .from("official_notices")
        .select("*")
        .eq("organization_id", institutionId)
        .order("notice_date", { ascending: false });

      if (!error && data && data.length > 0) {
        dbNotices = data.map((d: any) => ({
          id: d.id,
          ref_no: d.ref_no,
          notice_date: d.notice_date,
          title: d.title,
          body: d.body,
          category: d.category || "General Notice",
          target_audience: d.target_audience || "All Parents / Guardians",
          signatories: Array.isArray(d.signatories) ? d.signatories : [],
          show_stamp: d.show_stamp !== false,
          copies_to: d.copies_to || "",
          created_at: d.created_at,
        }));
      }
    } catch {
      // Table may not yet be migrated on remote database - fallback gracefully
    }

    // Merge with localStorage
    try {
      const localRaw = localStorage.getItem(`edutechlab_official_notices_${institutionId}`);
      if (localRaw) {
        const localList: OfficialNotice[] = JSON.parse(localRaw);
        // Combine by unique id or ref_no
        const map = new Map<string, OfficialNotice>();
        dbNotices.forEach((n) => map.set(n.id || n.ref_no, n));
        localList.forEach((n) => {
          if (!map.has(n.id || n.ref_no)) {
            map.set(n.id || n.ref_no, n);
          }
        });
        setNotices(Array.from(map.values()));
        return;
      }
    } catch {}

    setNotices(dbNotices);
  };

  // ============================================================================
  // SAVE / PRINT / EXPORT ACTIONS
  // ============================================================================

  const handleSaveNotice = async () => {
    if (!orgId) return;
    if (!currentNotice.title.trim()) {
      alert("Please enter a notice title / subject.");
      return;
    }
    if (!currentNotice.body.trim()) {
      alert("Please enter the notice body / message.");
      return;
    }

    setSaveStatus("Saving...");
    const noticeId = currentNotice.id || `not_${Date.now()}`;
    const noticeToSave: OfficialNotice = {
      ...currentNotice,
      id: noticeId,
      created_at: currentNotice.created_at || new Date().toISOString(),
    };

    // 1. Try DB Insert / Update
    try {
      const payload = {
        id: noticeId.startsWith("not_") ? undefined : noticeId,
        organization_id: orgId,
        ref_no: noticeToSave.ref_no,
        notice_date: noticeToSave.notice_date,
        title: noticeToSave.title,
        body: noticeToSave.body,
        category: noticeToSave.category,
        target_audience: noticeToSave.target_audience,
        signatories: noticeToSave.signatories,
        show_stamp: noticeToSave.show_stamp,
        copies_to: noticeToSave.copies_to,
        updated_at: new Date().toISOString(),
      };

      if (currentNotice.id && !currentNotice.id.startsWith("not_")) {
        await supabase.from("official_notices").update(payload).eq("id", currentNotice.id);
      } else {
        const { data } = await supabase.from("official_notices").insert(payload).select("id").single();
        if (data?.id) {
          noticeToSave.id = data.id;
        }
      }
    } catch (err) {
      console.warn("DB insert notice note (using local cache fallback):", err);
    }

    // 2. Persist in LocalStorage (Zero-Loss Resilience)
    try {
      const updatedList = [
        noticeToSave,
        ...notices.filter((n) => n.id !== noticeToSave.id && n.ref_no !== noticeToSave.ref_no),
      ];
      localStorage.setItem(`edutechlab_official_notices_${orgId}`, JSON.stringify(updatedList));
      setNotices(updatedList);
    } catch {}

    setCurrentNotice(noticeToSave);
    setSaveStatus("Saved Successfully!");
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSelectTemplate = (tpl: (typeof NOTICE_TEMPLATES)[0]) => {
    setCurrentNotice((prev) => ({
      ...prev,
      title: tpl.title,
      body: tpl.body,
      category: tpl.category,
      target_audience: tpl.audience,
    }));
  };

  const handleEditSavedNotice = (n: OfficialNotice) => {
    setCurrentNotice({ ...n });
    setActiveTab("editor");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteSavedNotice = async (id: string, refNo: string) => {
    if (!confirm(`Are you sure you want to delete notice "${refNo}"?`)) return;
    try {
      if (!id.startsWith("not_")) {
        await supabase.from("official_notices").delete().eq("id", id);
      }
    } catch {}

    const updated = notices.filter((n) => n.id !== id && n.ref_no !== refNo);
    setNotices(updated);
    if (orgId) {
      try {
        localStorage.setItem(`edutechlab_official_notices_${orgId}`, JSON.stringify(updated));
      } catch {}
    }
  };

  const handleNewNotice = () => {
    setCurrentNotice({
      id: "",
      ref_no: `NOT/${new Date().getFullYear()}/${String(Math.floor(Math.random() * 900) + 100)}`,
      notice_date: todayStr,
      title: "",
      body: "",
      category: "General Notice",
      target_audience: "All Parents / Guardians",
      signatories: [
        { role: "Principal", name: schoolHeader.name ? "Principal" : "", enabled: true },
        { role: "Director / Manager", name: "", enabled: true },
        { role: "Examination Controller", name: "", enabled: false },
      ],
      show_stamp: true,
      copies_to: "1. School Notice Board 2. Staff Room 3. Class Teachers 4. Office Archive",
    });
    setActiveTab("editor");
  };

  const handleCopyWhatsAppNotice = (n: OfficialNotice) => {
    const text = `📢 *OFFICIAL NOTICE - ${schoolHeader.name.toUpperCase()}*\n` +
      `📅 *Date:* ${new Date(n.notice_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}\n` +
      `🔖 *Ref No:* ${n.ref_no}\n` +
      `👥 *To:* ${n.target_audience}\n\n` +
      `📌 *Subject: ${n.title}*\n\n` +
      `${n.body}\n\n` +
      `🏛️ *Issued By:* School Administration & Principal Office\n` +
      `🌐 ${schoolHeader.website || "Official School Portal"}`;

    navigator.clipboard.writeText(text);
    setCopiedId(n.id || n.ref_no);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleSaveHeaderInfo = () => {
    if (orgId) {
      try {
        localStorage.setItem(`edutechlab_letterhead_info_${orgId}`, JSON.stringify(schoolHeader));
      } catch {}
    }
    setHeaderSettingsOpen(false);
  };

  const formattedDate = useMemo(() => {
    if (!currentNotice.notice_date) return "";
    try {
      const d = new Date(currentNotice.notice_date);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return currentNotice.notice_date;
    }
  }, [currentNotice.notice_date]);

  // Filtered Archive
  const filteredNotices = useMemo(() => {
    if (!searchQuery.trim()) return notices;
    const q = searchQuery.toLowerCase();
    return notices.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.ref_no.toLowerCase().includes(q) ||
        n.category.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q)
    );
  }, [notices, searchQuery]);

  // ============================================================================
  // GUARDS & PERMISSIONS
  // ============================================================================

  if (authLoading || loading) {
    return (
      <main className="mx-auto max-w-7xl p-8 text-center text-sm text-slate-500">
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="font-semibold text-slate-700">Loading Official A4 Notice Pad Generator...</p>
        </div>
      </main>
    );
  }

  if (!hasAccess) {
    return <AccessDenied moduleName="Official A4 Notice & Letterhead Pad" />;
  }

  if (!featureActive) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <FeatureGate featureKey="official_notices" instituteName={schoolHeader.name} />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100/70 pb-20">
      {/* ============================================================== */}
      {/* TOP APPLICATION BAR (Hidden in Print)                           */}
      {/* ============================================================== */}
      <div className="no-print sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur shadow-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              <ArrowLeft size={14} />
              Dashboard
            </Link>
            <div className="hidden h-5 w-px bg-slate-200 sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 border border-indigo-200">
                  Feature #14
                </span>
                <h1 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Official Notice &amp; A4 Letter Pad
                </h1>
              </div>
              <p className="hidden text-[11px] text-slate-500 sm:block">
                Create official notices with prefilled school branding, stamp, &amp; signatures on A4 letterhead.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setHeaderSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
              title="Customize school branding details, affiliation, and address"
            >
              <Building2 size={13} className="text-indigo-600" />
              <span className="hidden sm:inline">Letterhead Branding</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-slate-800 transition"
              title="Print official A4 letter pad notice or save as PDF"
            >
              <Printer size={14} />
              <span>Print A4 Notice</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        {/* ============================================================== */}
        {/* TAB TOGGLES: EDITOR VS ARCHIVE (Hidden in Print)                */}
        {/* ============================================================== */}
        <div className="no-print mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
            <button
              onClick={() => setActiveTab("editor")}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
                activeTab === "editor"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Edit3 size={14} />
              Notice Designer &amp; Live A4 Preview
            </button>
            <button
              onClick={() => setActiveTab("archive")}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
                activeTab === "archive"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <FileCheck size={14} />
              Saved Notices Archive ({notices.length})
            </button>
          </div>

          {activeTab === "editor" && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewNotice}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
              >
                <Plus size={14} />
                New Notice
              </button>
              <button
                onClick={handleSaveNotice}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition"
              >
                <Check size={14} />
                {saveStatus || "Save Notice"}
              </button>
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* TAB 1: DESIGNER & LIVE A4 PREVIEW                              */}
        {/* ============================================================== */}
        {activeTab === "editor" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
            {/* ------------------------------------------------------------ */}
            {/* LEFT COLUMN: SIMPLE INPUTS & TEMPLATES (5 Cols)             */}
            {/* ------------------------------------------------------------ */}
            <div className="no-print space-y-5 lg:col-span-5">
              {/* Quick Template Picker */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-indigo-700">
                    <Sparkles size={14} />
                    1-Click Ready Templates
                  </span>
                  <span className="text-[11px] text-slate-400">Auto-fill formal text</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {NOTICE_TEMPLATES.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl)}
                      className="group flex flex-col items-start rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-left hover:border-indigo-200 hover:bg-indigo-50/50 transition"
                    >
                      <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-900 line-clamp-1">
                        {tpl.label}
                      </span>
                      <span className="mt-0.5 text-[10px] text-slate-500 line-clamp-1">{tpl.category}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Inputs (Ultra-Simple as requested: Title, Date, Body) */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-900">Notice Details</h3>
                  <span className="text-[11px] text-slate-400">Only fill title, date &amp; message</span>
                </div>

                {/* Title / Subject Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Notice Title / Subject <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={currentNotice.title}
                    onChange={(e) => setCurrentNotice({ ...currentNotice, title: e.target.value })}
                    placeholder="e.g. Announcement regarding Summer Vacation..."
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Date & Ref No Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Notice Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={currentNotice.notice_date}
                      onChange={(e) => setCurrentNotice({ ...currentNotice, notice_date: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Dispatch Ref. No.
                    </label>
                    <input
                      type="text"
                      value={currentNotice.ref_no}
                      onChange={(e) => setCurrentNotice({ ...currentNotice, ref_no: e.target.value })}
                      placeholder="e.g. NOT/2026/014"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Notice Audience */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Addressed To / Target Audience
                  </label>
                  <input
                    type="text"
                    value={currentNotice.target_audience}
                    onChange={(e) => setCurrentNotice({ ...currentNotice, target_audience: e.target.value })}
                    placeholder="e.g. All Parents / Guardians & Students"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Notice Body */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Notice Content / Body <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={8}
                    value={currentNotice.body}
                    onChange={(e) => setCurrentNotice({ ...currentNotice, body: e.target.value })}
                    placeholder="Type the official message here. Paragraph breaks and numbered points are preserved..."
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs sm:text-sm font-normal text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed"
                  />
                </div>

                {/* Copies To */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Copy Dispatched To:
                  </label>
                  <input
                    type="text"
                    value={currentNotice.copies_to}
                    onChange={(e) => setCurrentNotice({ ...currentNotice, copies_to: e.target.value })}
                    placeholder="1. Notice Board 2. Staff Room 3. Class Teachers..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Bottom Stamp & Signature Controls (User requested explicitly) */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Stamp &amp; Signatures</h3>
                    <p className="text-[11px] text-slate-400">Configure institutional seal and signatories</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={currentNotice.show_stamp}
                      onChange={(e) => setCurrentNotice({ ...currentNotice, show_stamp: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    Include School Stamp
                  </label>
                </div>

                <div className="space-y-3">
                  {currentNotice.signatories.map((sig, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5"
                    >
                      <input
                        type="checkbox"
                        checked={sig.enabled}
                        onChange={(e) => {
                          const updated = [...currentNotice.signatories];
                          updated[idx].enabled = e.target.checked;
                          setCurrentNotice({ ...currentNotice, signatories: updated });
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={sig.role}
                          onChange={(e) => {
                            const updated = [...currentNotice.signatories];
                            updated[idx].role = e.target.value;
                            setCurrentNotice({ ...currentNotice, signatories: updated });
                          }}
                          placeholder="Designation / Role"
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-800 bg-white"
                        />
                        <input
                          type="text"
                          value={sig.name}
                          onChange={(e) => {
                            const updated = [...currentNotice.signatories];
                            updated[idx].name = e.target.value;
                            setCurrentNotice({ ...currentNotice, signatories: updated });
                          }}
                          placeholder="Signatory Name (Optional)"
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-700 bg-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleSaveNotice}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-slate-800 transition"
                  >
                    <Check size={14} />
                    {saveStatus || "Save Notice to Archive"}
                  </button>
                </div>
              </div>
            </div>

            {/* ------------------------------------------------------------ */}
            {/* RIGHT COLUMN: LIVE A4 LETTER PAD PREVIEW (7 Cols)            */}
            {/* ------------------------------------------------------------ */}
            <div className="lg:col-span-7">
              {/* Preview Bar (No print) */}
              <div className="no-print mb-3 flex items-center justify-between rounded-xl bg-slate-200/80 px-4 py-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Eye size={14} />
                  Live A4 Letter Pad Preview
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyWhatsAppNotice(currentNotice)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition"
                    title="Copy announcement text formatted for WhatsApp groups"
                  >
                    {copiedId ? <Check size={12} /> : <Share2 size={12} />}
                    {copiedId ? "Copied!" : "WhatsApp Text"}
                  </button>
                  <button
                    onClick={handlePrint}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1 text-[11px] font-bold text-white hover:bg-slate-800 transition"
                  >
                    <Printer size={12} />
                    Print A4
                  </button>
                </div>
              </div>

              {/* A4 CANVAS CONTAINER */}
              <div className="overflow-x-auto pb-8 flex justify-center">
                <div
                  id="printable-letterhead-notice"
                  ref={printAreaRef}
                  className="letterpad-canvas relative bg-white text-slate-900 shadow-2xl rounded-sm transition-all"
                  style={{
                    width: "210mm",
                    minHeight: "297mm",
                    padding: "18mm 20mm 18mm 20mm",
                    boxSizing: "border-box",
                    fontFamily: "'Times New Roman', Times, serif, system-ui",
                  }}
                >
                  {/* Subtle Background Watermark of School Logo */}
                  <div
                    className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden"
                    style={{ zIndex: 0 }}
                  >
                    {schoolHeader.logo_url ? (
                      <img
                        src={schoolHeader.logo_url}
                        alt=""
                        className="w-96 h-96 object-contain opacity-[0.04] grayscale"
                      />
                    ) : (
                      <div className="w-96 h-96 rounded-full border-8 border-slate-300 opacity-[0.05] flex items-center justify-center">
                        <Building2 className="w-48 h-48 text-slate-400" />
                      </div>
                    )}
                  </div>

                  {/* CONTENT WRAPPER */}
                  <div className="relative z-10 flex flex-col justify-between" style={{ minHeight: "261mm" }}>
                    {/* 1. LETTERHEAD HEADER */}
                    <div>
                      <div className="flex items-center justify-between gap-4 border-b-2 border-slate-900 pb-3">
                        {/* Left: School Logo */}
                        <div className="w-24 h-24 shrink-0 flex items-center justify-center">
                          {schoolHeader.logo_url ? (
                            <img
                              src={schoolHeader.logo_url}
                              alt="Logo"
                              className="max-h-24 max-w-24 object-contain rounded-full border border-slate-200 p-0.5 shadow-xs"
                            />
                          ) : (
                            <div className="w-20 h-20 rounded-full border-2 border-slate-800 flex flex-col items-center justify-center text-slate-800 bg-slate-50">
                              <Building2 size={32} />
                              <span className="text-[9px] font-bold tracking-tight uppercase mt-0.5">ESTD</span>
                            </div>
                          )}
                        </div>

                        {/* Center: School Branding & Details */}
                        <div className="flex-1 text-center px-2">
                          <h1
                            className="text-2xl sm:text-[26px] font-black uppercase tracking-wider text-slate-950 font-serif leading-tight"
                            style={{ letterSpacing: "1px" }}
                          >
                            {schoolHeader.name}
                          </h1>
                          <p className="mt-1 text-[11px] font-bold text-slate-700 tracking-wide">
                            {schoolHeader.affiliation}
                          </p>
                          <p className="text-[10px] font-semibold text-slate-600">
                            {schoolHeader.reg_no}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-600 leading-snug">
                            {schoolHeader.address}
                          </p>
                          <p className="mt-0.5 text-[10px] font-medium text-slate-600">
                            <span>Phone: {schoolHeader.phone}</span>
                            <span className="mx-1.5">•</span>
                            <span>Email: {schoolHeader.email}</span>
                            {schoolHeader.website && (
                              <>
                                <span className="mx-1.5">•</span>
                                <span>Web: {schoolHeader.website}</span>
                              </>
                            )}
                          </p>
                        </div>

                        {/* Right: School Emblem / Seal Placeholder */}
                        <div className="w-20 shrink-0 text-right hidden sm:block">
                          <div className="inline-block text-center border border-slate-300 rounded-md p-1 bg-slate-50/50">
                            <span className="block text-[8px] font-extrabold uppercase tracking-widest text-slate-500">
                              OFFICIAL
                            </span>
                            <span className="block text-[9px] font-black text-slate-900">
                              CIRCULAR
                            </span>
                            <span className="block text-[8px] text-slate-500 font-mono mt-0.5">
                              REF-A4
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Accent Double Rule */}
                      <div className="h-0.5 w-full bg-slate-900 mt-0.5" />
                      <div className="h-px w-full bg-slate-400 mt-0.5" />

                      {/* 2. NOTICE META ROW (Ref No & Date) */}
                      <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-800">
                        <div>
                          <span>Ref. No: </span>
                          <span className="font-mono text-slate-900 font-extrabold underline decoration-slate-400 underline-offset-2">
                            {currentNotice.ref_no || "NOT/2026/001"}
                          </span>
                        </div>
                        <div>
                          <span>Date: </span>
                          <span className="font-serif text-slate-900 font-extrabold underline decoration-slate-400 underline-offset-2">
                            {formattedDate}
                          </span>
                        </div>
                      </div>

                      {/* 3. CENTER NOTICE BADGE */}
                      <div className="mt-5 text-center">
                        <div className="inline-block border-2 border-slate-900 px-6 py-1 bg-slate-100/60 shadow-xs">
                          <h2 className="text-base sm:text-lg font-black uppercase tracking-[0.25em] text-slate-950 font-serif">
                            N O T I C E
                          </h2>
                        </div>
                      </div>

                      {/* 4. RECIPIENT & SUBJECT */}
                      <div className="mt-4 space-y-1.5">
                        {currentNotice.target_audience && (
                          <div className="text-xs font-bold text-slate-800">
                            <span>To: </span>
                            <span className="font-semibold text-slate-900">{currentNotice.target_audience}</span>
                          </div>
                        )}

                        <div className="text-xs sm:text-sm font-black text-slate-950 font-serif leading-snug pt-1">
                          <span className="underline uppercase decoration-slate-900 decoration-1 underline-offset-4">
                            SUBJECT: {currentNotice.title || "OFFICIAL INSTITUTE CIRCULAR & NOTICE"}
                          </span>
                        </div>
                      </div>

                      {/* 5. NOTICE BODY (Crisp Typography) */}
                      <div className="mt-5 text-[12px] sm:text-[13px] text-slate-800 font-serif leading-relaxed text-justify space-y-3 whitespace-pre-wrap">
                        {currentNotice.body ||
                          "This is the official notice statement. All text entered in the editor will appear here formatted precisely for official distribution and record keeping."}
                      </div>
                    </div>

                    {/* 6. BOTTOM SIGNATURES, STAMP & COPIES SECTION */}
                    <div className="mt-10 pt-4">
                      {/* Stamp & Signatories Row */}
                      <div className="flex items-end justify-between gap-4">
                        {/* Left: Official School Stamp / Seal */}
                        <div className="w-40 shrink-0">
                          {currentNotice.show_stamp ? (
                            <div className="relative inline-block select-none">
                              {/* Realistic Circular Ink Stamp */}
                              <div
                                className="w-28 h-28 rounded-full border-2 border-dashed border-blue-900/90 flex flex-col items-center justify-center p-2 text-center text-blue-900 rotate-[-4deg]"
                                style={{
                                  boxShadow: "inset 0 0 0 2px rgba(30, 58, 138, 0.7)",
                                  backgroundColor: "rgba(239, 246, 255, 0.2)",
                                }}
                              >
                                <span className="text-[7.5px] font-black uppercase tracking-tight line-clamp-1 leading-none">
                                  {schoolHeader.name}
                                </span>
                                <div className="my-0.5 flex items-center gap-1">
                                  <span className="text-[7px]">★</span>
                                  <span className="text-[8px] font-black uppercase tracking-wider">OFFICIAL</span>
                                  <span className="text-[7px]">★</span>
                                </div>
                                <span className="text-[8.5px] font-extrabold uppercase tracking-widest text-blue-950">
                                  SEAL
                                </span>
                                <span className="text-[7px] font-semibold text-blue-900/80 mt-0.5">
                                  {currentNotice.notice_date}
                                </span>
                                <span className="text-[6.5px] font-bold uppercase tracking-tight line-clamp-1 mt-0.5">
                                  GOVT. RECOGNIZED
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="h-20" />
                          )}
                        </div>

                        {/* Right: Signatory Blocks */}
                        <div className="flex items-end justify-end gap-6 sm:gap-10">
                          {currentNotice.signatories
                            .filter((s) => s.enabled)
                            .map((sig, idx) => (
                              <div key={idx} className="text-center min-w-[120px] sm:min-w-[140px]">
                                {/* Signature Space */}
                                <div className="h-14 flex items-end justify-center pb-1">
                                  <span className="text-[10px] italic text-slate-300 font-sans">
                                    [Sign Over Line]
                                  </span>
                                </div>
                                <div className="border-t-2 border-slate-900 pt-1">
                                  {sig.name && (
                                    <p className="text-[11px] font-black text-slate-950 font-serif leading-tight">
                                      {sig.name}
                                    </p>
                                  )}
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-800">
                                    {sig.role}
                                  </p>
                                  <p className="text-[9px] text-slate-600 line-clamp-1 font-sans">
                                    {schoolHeader.name}
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Dispatch Copies Line */}
                      {currentNotice.copies_to && (
                        <div className="mt-6 border-t border-slate-300 pt-2 text-[9px] text-slate-600 font-sans">
                          <span className="font-bold text-slate-700">Copy forwarded for information and necessary action to: </span>
                          <span>{currentNotice.copies_to}</span>
                        </div>
                      )}

                      {/* Footer Note */}
                      <div className="mt-2 flex items-center justify-between text-[8px] text-slate-400 font-sans border-t border-slate-200 pt-1">
                        <span>EduTechLab Official Document Generator • Page 1 of 1</span>
                        <span>Official Dispatch Ref: {currentNotice.ref_no}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: SAVED NOTICES ARCHIVE                                   */}
        {/* ============================================================== */}
        {activeTab === "archive" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Saved Letter Pad Notices</h3>
                <p className="text-xs text-slate-500">
                  Search, view, re-print or copy past notices issued by your institution.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search notices..."
                    className="rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-900 outline-none focus:border-indigo-500 w-48 sm:w-64"
                  />
                </div>
                <button
                  onClick={handleNewNotice}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition"
                >
                  <Plus size={14} />
                  Create New Notice
                </button>
              </div>
            </div>

            {filteredNotices.length === 0 ? (
              <div className="py-16 text-center">
                <FileText className="mx-auto h-12 w-12 text-slate-300" />
                <h4 className="mt-2 text-sm font-bold text-slate-700">No official notices saved yet</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Create your first A4 letter pad notice in the designer tab and save it.
                </p>
                <button
                  onClick={() => setActiveTab("editor")}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700"
                >
                  Open Notice Designer
                </button>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-slate-100">
                {filteredNotices.map((n) => (
                  <div
                    key={n.id || n.ref_no}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 rounded-xl px-2 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {n.ref_no}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                          <Calendar size={12} />
                          {new Date(n.notice_date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {n.category || "General Notice"}
                        </span>
                      </div>
                      <h4 className="mt-1.5 text-sm font-bold text-slate-900 truncate">
                        {n.title}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{n.body}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleCopyWhatsAppNotice(n)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition"
                        title="Copy formatted announcement text for WhatsApp"
                      >
                        {copiedId === (n.id || n.ref_no) ? <Check size={13} /> : <Share2 size={13} />}
                        <span>{copiedId === (n.id || n.ref_no) ? "Copied" : "WhatsApp"}</span>
                      </button>

                      <button
                        onClick={() => handleEditSavedNotice(n)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                        title="Open in Designer & Print"
                      >
                        <Edit3 size={13} />
                        <span>Edit &amp; Print</span>
                      </button>

                      <button
                        onClick={() => handleDeleteSavedNotice(n.id, n.ref_no)}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Delete notice"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL: CUSTOMIZE LETTERHEAD BRANDING DETAILS                   */}
      {/* ============================================================== */}
      {headerSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Customize Letterhead Branding</h3>
                <p className="text-xs text-slate-500">
                  These details will appear in the top letterhead of all printed notices.
                </p>
              </div>
              <button
                onClick={() => setHeaderSettingsOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Institution Name</label>
                <input
                  type="text"
                  value={schoolHeader.name}
                  onChange={(e) => setSchoolHeader({ ...schoolHeader, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Affiliation / Board Text</label>
                <input
                  type="text"
                  value={schoolHeader.affiliation}
                  onChange={(e) => setSchoolHeader({ ...schoolHeader, affiliation: e.target.value })}
                  placeholder="e.g. Affiliated to CBSE, New Delhi | Affiliation No: ..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reg / School Code / U-DISE</label>
                <input
                  type="text"
                  value={schoolHeader.reg_no}
                  onChange={(e) => setSchoolHeader({ ...schoolHeader, reg_no: e.target.value })}
                  placeholder="e.g. School Code: 10452 | U-DISE: 0924..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">School Full Address</label>
                <input
                  type="text"
                  value={schoolHeader.address}
                  onChange={(e) => setSchoolHeader({ ...schoolHeader, address: e.target.value })}
                  placeholder="e.g. Civil Lines, Main City Road, PIN: ..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={schoolHeader.phone}
                    onChange={(e) => setSchoolHeader({ ...schoolHeader, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Official Email</label>
                  <input
                    type="text"
                    value={schoolHeader.email}
                    onChange={(e) => setSchoolHeader({ ...schoolHeader, email: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Website URL</label>
                <input
                  type="text"
                  value={schoolHeader.website}
                  onChange={(e) => setSchoolHeader({ ...schoolHeader, website: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setHeaderSettingsOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveHeaderInfo}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white hover:bg-slate-800"
              >
                Save Letterhead Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* EXACT CSS PRINT STYLES (A4 FIT, NO MULTI-PAGE SPILL)           */}
      {/* ============================================================== */}
      <style jsx global>{`
        @media print {
          html,
          body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          #printable-letterhead-notice {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            padding: 16mm 18mm 16mm 18mm !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            page-break-after: always;
            break-after: page;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>
    </main>
  );
}
