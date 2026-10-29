"use client";

import { useMemo, useState, useEffect } from "react";
import {
  ArrowLeft,
  Download,
  Printer,
  Sparkles,
  QrCode as QrIcon,
  CheckCircle2,
  AlertCircle,
  Award,
  Shield,
  Palette,
  Eye,
  Check,
} from "lucide-react";
import QRCode from "qrcode";

export type MarksheetMark = {
  subject: string;
  marks: number | null;
  max_marks: number;
  pass_percentage: number;
  status?: "marked" | "absent" | "fail" | "pass";
};

export type MarksheetData = {
  student: any;
  exam: any;
  marks: MarksheetMark[];
  org: any;
  settings: any;
  sessionName?: string;
};

const DEFAULT_GRADING_SCALE = [
  { min: 91, grade: "A1", remark: "Outstanding" },
  { min: 81, grade: "A2", remark: "Excellent" },
  { min: 71, grade: "B1", remark: "Very Good" },
  { min: 61, grade: "B2", remark: "Good" },
  { min: 51, grade: "C1", remark: "Above Average" },
  { min: 41, grade: "C2", remark: "Average" },
  { min: 33, grade: "D", remark: "Pass" },
  { min: 0, grade: "E / Fail", remark: "Needs Improvement" },
];

const THEMES = [
  {
    id: "navy",
    name: "Royal Navy & Gold",
    primary: "#0c2340",
    accent: "#c59b27",
    lightBg: "#f8fafc",
    tableHeader: "#0c2340",
    border: "#d4af37",
  },
  {
    id: "emerald",
    name: "Oxford Emerald & Bronze",
    primary: "#093e2f",
    accent: "#b8860b",
    lightBg: "#f6faf8",
    tableHeader: "#093e2f",
    border: "#c5a059",
  },
  {
    id: "maroon",
    name: "Imperial Maroon & Gold",
    primary: "#54121f",
    accent: "#cda851",
    lightBg: "#faf6f6",
    tableHeader: "#54121f",
    border: "#d4af37",
  },
  {
    id: "slate",
    name: "Modern Slate & Indigo",
    primary: "#0f172a",
    accent: "#4f46e5",
    lightBg: "#f8fafc",
    tableHeader: "#0f172a",
    border: "#64748b",
  },
];

const formatDate = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
};

const getInitials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();

function parseGradingScale(v: any) {
  try {
    const p = typeof v === "string" ? JSON.parse(v) : v;
    if (!Array.isArray(p)) return DEFAULT_GRADING_SCALE;
    const r = p
      .map((x: any) => ({
        min: Number(x.min ?? x.minimum ?? x.min_percentage),
        grade: String(x.grade ?? ""),
        remark: String(x.remark ?? x.remarks ?? ""),
      }))
      .filter((x: any) => Number.isFinite(x.min) && x.grade);
    return r.length ? r : DEFAULT_GRADING_SCALE;
  } catch {
    return DEFAULT_GRADING_SCALE;
  }
}

function calculateGrade(percentage: number, scale: any[]) {
  const sorted = [...scale].sort((a, b) => b.min - a.min);
  const found = sorted.find((x) => percentage >= x.min);
  return found || sorted[sorted.length - 1] || { grade: "E", remark: "Fail" };
}

function calculateDivision(percentage: number, passed: boolean) {
  if (!passed) return "NEEDS IMPROVEMENT";
  if (percentage >= 75) return "DISTINCTION (FIRST CLASS WITH HONOURS)";
  if (percentage >= 60) return "FIRST DIVISION";
  if (percentage >= 45) return "SECOND DIVISION";
  if (percentage >= 33) return "THIRD DIVISION";
  return "PASSED";
}

export default function MarksheetTemplate({
  data,
  showToolbar = true,
}: {
  data: MarksheetData;
  showToolbar?: boolean;
}) {
  const { student, exam, marks, org, settings, sessionName } = data;

  // Selected Theme State
  const [selectedThemeId, setSelectedThemeId] = useState<string>("navy");
  const [showWatermark, setShowWatermark] = useState<boolean>(true);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  const activeTheme = useMemo(() => {
    return THEMES.find((t) => t.id === selectedThemeId) || THEMES[0];
  }, [selectedThemeId]);

  const scale = useMemo(() => parseGradingScale(settings?.grading_scale), [settings?.grading_scale]);

  // Overall calculations
  const totals = useMemo(() => {
    const total = marks.reduce((sum, r) => sum + Number(r.marks ?? 0), 0);
    const max = marks.reduce((sum, r) => sum + Number(r.max_marks || 0), 0);
    const percentage = max ? (total / max) * 100 : 0;

    const passed =
      marks.length > 0 &&
      marks.every((r) => {
        if (r.status === "absent" || r.status === "fail") return false;
        if (r.status === "pass" && r.marks == null) return true;
        const passReq = Number(r.pass_percentage ?? 33);
        const scoredPct = r.max_marks ? (Number(r.marks ?? 0) / Number(r.max_marks)) * 100 : 0;
        return scoredPct >= passReq;
      });

    const overall = calculateGrade(percentage, scale);
    const division = calculateDivision(percentage, passed);

    return { total, max, percentage, overall, passed, division };
  }, [marks, scale]);

  const orgName = org?.name || "EduTechLab Academy";
  const studentFullName = [student?.first_name, student?.last_name].filter(Boolean).join(" ") || "Student Name";
  const className =
    student?.classes?.name ||
    student?.class_name ||
    (student?.class_id ? "Class " + student.class_id.slice(0, 4) : "—");
  const sectionName = student?.sections?.name || student?.section_name || "";
  const classDisplay = sectionName ? `${className} - Sec ${sectionName}` : className;

  // Generate QR Code on mount
  useEffect(() => {
    const verificationText = `VERIFIED ACADEMIC RECORD\nInstitution: ${orgName}\nStudent: ${studentFullName} (${student?.admission_no || "N/A"})\nExam: ${exam?.name || "Exam"}\nTotal: ${totals.total}/${totals.max} (${totals.percentage.toFixed(1)}%)\nResult: ${totals.passed ? "PASS" : "FAIL"}\nVerified on EduTechLab Portal`;

    QRCode.toDataURL(verificationText, {
      margin: 1,
      width: 140,
      color: {
        dark: activeTheme.primary,
        light: "#ffffff",
      },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch(() => {});
  }, [orgName, studentFullName, student?.admission_no, exam?.name, totals, activeTheme]);

  const primaryColor = activeTheme.primary;
  const accentColor = activeTheme.accent;
  const borderColor = activeTheme.border;

  return (
    <main className="min-h-screen bg-slate-100 py-6 px-2 sm:px-6">
      {/* ============================================================== */}
      {/* SCREEN TOOLBAR (HIDDEN ON PRINT)                              */}
      {/* ============================================================== */}
      {showToolbar && (
        <div className="no-print mx-auto mb-6 flex max-w-[850px] flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => history.back()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
            >
              <ArrowLeft size={15} /> Back
            </button>
            <span className="hidden text-xs text-slate-400 sm:inline">|</span>
            <div className="flex items-center gap-1.5">
              <Palette size={14} className="text-slate-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Theme:</span>
              <div className="flex gap-1">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setSelectedThemeId(theme.id)}
                    title={theme.name}
                    className={`h-6 w-6 rounded-full border-2 transition ${
                      selectedThemeId === theme.id ? "scale-110 shadow-md ring-2 ring-indigo-400" : "opacity-75 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: theme.primary, borderColor: theme.border }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="hidden cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:flex">
              <input
                type="checkbox"
                checked={showWatermark}
                onChange={(e) => setShowWatermark(e.target.checked)}
                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>Watermark</span>
            </label>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition"
            >
              <Printer size={15} /> Print / Save PDF
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MARKSHEET CERTIFICATE CANVAS (EXACT A4 DIMENSIONS)             */}
      {/* ============================================================== */}
      <article className="marksheet-canvas relative mx-auto w-full max-w-[820px] bg-white text-slate-900 shadow-2xl transition">
        {/* Outer Guilloche Security Border */}
        <div
          className="relative m-2.5 border-[4px] p-1.5"
          style={{ borderColor: primaryColor }}
        >
          {/* Inner Golden Hairline Border */}
          <div
            className="relative border-[2px] p-6 sm:p-8"
            style={{ borderColor: borderColor }}
          >
            {/* Corner Decorative Accents */}
            <div
              className="absolute -top-2.5 -left-2.5 h-6 w-6 border-t-[3px] border-l-[3px]"
              style={{ borderColor: accentColor }}
            />
            <div
              className="absolute -top-2.5 -right-2.5 h-6 w-6 border-t-[3px] border-r-[3px]"
              style={{ borderColor: accentColor }}
            />
            <div
              className="absolute -bottom-2.5 -left-2.5 h-6 w-6 border-b-[3px] border-l-[3px]"
              style={{ borderColor: accentColor }}
            />
            <div
              className="absolute -bottom-2.5 -right-2.5 h-6 w-6 border-b-[3px] border-r-[3px]"
              style={{ borderColor: accentColor }}
            />

            {/* Background Security Watermark */}
            {showWatermark && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.035]">
                <div className="text-center font-serif font-black uppercase tracking-widest text-slate-900">
                  <span className="block text-[65px] leading-tight">{orgName}</span>
                  <span className="block text-[28px] tracking-[0.5em] mt-2">OFFICIAL TRANSCRIPT</span>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* 1. INSTITUTIONAL HEADER & BRANDING                             */}
            {/* ============================================================== */}
            <header className="relative border-b-2 pb-5" style={{ borderColor: borderColor }}>
              <div className="flex items-center justify-between gap-4">
                {/* School Crest / Logo */}
                <div
                  className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] bg-white shadow-xs"
                  style={{ borderColor: accentColor }}
                >
                  {settings?.logo_signed ? (
                    <img
                      src={settings.logo_signed}
                      className="h-full w-full object-contain p-1.5"
                      alt={orgName}
                    />
                  ) : (
                    <span className="font-serif text-2xl font-black" style={{ color: primaryColor }}>
                      {getInitials(orgName)}
                    </span>
                  )}
                </div>

                {/* Institution Name & Details */}
                <div className="flex-1 text-center">
                  <p
                    className="text-[9px] font-bold uppercase tracking-[0.35em]"
                    style={{ color: accentColor }}
                  >
                    Excellence in Academics • Integrity • Discipline
                  </p>
                  <h1
                    className="mt-1 font-serif text-2xl font-extrabold uppercase tracking-tight text-slate-900 sm:text-[28px]"
                    style={{ color: primaryColor }}
                  >
                    {orgName}
                  </h1>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">
                    {[settings?.address, settings?.phone, settings?.email].filter(Boolean).join("  •  ") ||
                      "Affiliated to State / Central Board of Secondary Education"}
                  </p>
                </div>

                {/* Verification QR Code Badge */}
                <div className="shrink-0 text-center">
                  <div
                    className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border-2 bg-white p-1 shadow-2xs"
                    style={{ borderColor: borderColor }}
                  >
                    {qrCodeDataUrl ? (
                      <img
                        src={qrCodeDataUrl}
                        alt="Verification QR"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <QrIcon size={32} className="text-slate-300" />
                    )}
                  </div>
                  <span className="mt-1 block font-mono text-[8px] font-bold uppercase tracking-wider text-slate-400">
                    Scan to Verify
                  </span>
                </div>
              </div>

              {/* Title Ribbon */}
              <div className="mt-4 text-center">
                <div
                  className="mx-auto inline-block rounded-lg px-6 py-1.5 text-center shadow-xs"
                  style={{ backgroundColor: primaryColor }}
                >
                  <h2 className="font-serif text-xs font-black uppercase tracking-[0.25em] text-white sm:text-sm">
                    {settings?.marksheet_title || "Official Statement of Marks & Evaluation"}
                  </h2>
                </div>
                <p className="mt-1.5 text-xs font-bold text-slate-700">
                  {exam?.name || "Annual Academic Examination"}{" "}
                  {sessionName ? `• Academic Session ${sessionName}` : ""}
                  {exam?.exam_date ? ` • Held on ${formatDate(exam.exam_date)}` : ""}
                </p>
              </div>
            </header>

            {/* ============================================================== */}
            {/* 2. STUDENT ACADEMIC CREDENTIALS & PROFILE                      */}
            {/* ============================================================== */}
            <section
              className="relative mt-4 rounded-2xl border p-4 shadow-2xs"
              style={{ borderColor: `${borderColor}66`, backgroundColor: activeTheme.lightBg }}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* 2-Column Info Grid */}
                <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2.5 text-xs sm:grid-cols-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Student Full Name
                    </span>
                    <p className="font-bold text-slate-900 text-[13px] truncate">{studentFullName}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Admission / S.R. No.
                    </span>
                    <p className="font-mono font-bold text-slate-800">{student?.admission_no || "—"}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Class & Section
                    </span>
                    <p className="font-bold text-slate-900 text-[13px]">{classDisplay}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Roll Number
                    </span>
                    <p className="font-mono font-bold text-slate-800">{student?.roll_number || "—"}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Father / Guardian
                    </span>
                    <p className="font-semibold text-slate-800 truncate">
                      {student?.father_name || student?.guardian_name || "—"}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Mother Name
                    </span>
                    <p className="font-semibold text-slate-800 truncate">{student?.mother_name || "—"}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Date of Birth
                    </span>
                    <p className="font-semibold text-slate-800">{formatDate(student?.date_of_birth)}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Academic Evaluation
                    </span>
                    <p
                      className={`font-black uppercase text-[12px] ${
                        totals.passed ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {totals.passed ? "✓ QUALIFIED (PASS)" : "✕ NOT QUALIFIED"}
                    </p>
                  </div>
                </div>

                {/* Passport Photo */}
                <div className="shrink-0 text-center">
                  <div
                    className="mx-auto h-[100px] w-[82px] overflow-hidden rounded-xl border-2 bg-slate-100 shadow-2xs"
                    style={{ borderColor: borderColor }}
                  >
                    {student?.photo_signed ? (
                      <img
                        src={student.photo_signed}
                        alt={studentFullName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center p-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        <span>Affix Photo</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* ============================================================== */}
            {/* 3. SUBJECT-WISE ASSESSMENT MATRIX                              */}
            {/* ============================================================== */}
            <section className="relative mt-4">
              <div className="overflow-hidden rounded-xl border" style={{ borderColor: borderColor }}>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr style={{ backgroundColor: primaryColor, color: "#ffffff" }}>
                      <th className="w-12 px-3 py-2.5 text-center font-bold">Sr.</th>
                      <th className="px-4 py-2.5 font-bold">Subject Name</th>
                      <th className="px-3 py-2.5 text-center font-bold">Maximum Marks</th>
                      <th className="px-3 py-2.5 text-center font-bold">Pass Marks</th>
                      <th className="px-3 py-2.5 text-center font-bold">Marks Scored</th>
                      <th className="px-3 py-2.5 text-center font-bold">Grade</th>
                      <th className="px-3 py-2.5 text-center font-bold">Performance Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {marks.map((r, i) => {
                      const p = r.max_marks ? (Number(r.marks ?? 0) / r.max_marks) * 100 : 0;
                      const g = calculateGrade(p, scale);
                      const isAbsent = r.status === "absent";
                      const isFail = r.status === "fail";
                      const isPassing = !isAbsent && !isFail && p >= Number(r.pass_percentage ?? 33);

                      const displayMarks = isAbsent
                        ? "ABSENT"
                        : r.marks == null
                        ? r.status?.toUpperCase() || "—"
                        : r.marks;

                      return (
                        <tr
                          key={r.subject + i}
                          className={i % 2 === 0 ? "bg-white" : "bg-slate-50/70"}
                        >
                          <td className="px-3 py-2.5 text-center font-mono font-semibold text-slate-400">
                            {String(i + 1).padStart(2, "0")}
                          </td>
                          <td className="px-4 py-2.5 font-bold text-slate-900">{r.subject}</td>
                          <td className="px-3 py-2.5 text-center font-semibold text-slate-600">
                            {r.max_marks}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-500">
                            {Math.round((r.max_marks * Number(r.pass_percentage ?? 33)) / 100)}
                          </td>
                          <td
                            className={`px-3 py-2.5 text-center font-black text-sm ${
                              isAbsent || isFail || !isPassing ? "text-red-600" : "text-slate-900"
                            }`}
                          >
                            {displayMarks}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className="inline-block rounded-md px-2 py-0.5 font-bold text-[11px]"
                              style={{
                                backgroundColor: isPassing ? `${accentColor}25` : "#fee2e2",
                                color: isPassing ? primaryColor : "#b91c1c",
                              }}
                            >
                              {isAbsent ? "AB" : g.grade}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center text-[11px] font-medium text-slate-600">
                            {isAbsent ? (
                              <span className="font-bold text-red-600">Absent</span>
                            ) : (
                              g.remark
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Grand Total Row */}
                    <tr
                      className="border-t-2 font-black"
                      style={{
                        backgroundColor: `${accentColor}18`,
                        borderColor: borderColor,
                      }}
                    >
                      <td colSpan={2} className="px-4 py-3 text-right uppercase tracking-wider text-xs">
                        Grand Total Aggregate
                      </td>
                      <td className="px-3 py-3 text-center text-xs font-bold text-slate-700">
                        {totals.max}
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-slate-400">—</td>
                      <td
                        className="px-3 py-3 text-center text-base font-black"
                        style={{ color: primaryColor }}
                      >
                        {totals.total}
                      </td>
                      <td
                        className="px-3 py-3 text-center text-sm font-black"
                        style={{ color: primaryColor }}
                      >
                        {totals.overall.grade}
                      </td>
                      <td className="px-3 py-3 text-center text-xs uppercase" style={{ color: primaryColor }}>
                        {totals.overall.remark}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* ============================================================== */}
            {/* 4. PERFORMANCE INDICATORS & DIVISION RIBBON                   */}
            {/* ============================================================== */}
            <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div
                className="rounded-xl border p-3 text-center shadow-2xs"
                style={{ borderColor: `${borderColor}66`, backgroundColor: activeTheme.lightBg }}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Total Percentage
                </span>
                <p className="mt-0.5 text-xl font-black text-slate-900">
                  {totals.percentage.toFixed(2)}%
                </p>
              </div>

              <div
                className="rounded-xl border p-3 text-center shadow-2xs"
                style={{ borderColor: `${borderColor}66`, backgroundColor: activeTheme.lightBg }}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Overall Grade
                </span>
                <p className="mt-0.5 text-xl font-black" style={{ color: primaryColor }}>
                  {totals.overall.grade}
                </p>
              </div>

              <div
                className="rounded-xl border p-3 text-center shadow-2xs"
                style={{ borderColor: `${borderColor}66`, backgroundColor: activeTheme.lightBg }}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Examination Result
                </span>
                <p
                  className={`mt-0.5 text-lg font-black ${
                    totals.passed ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {totals.passed ? "PASSED" : "FAILED"}
                </p>
              </div>

              <div
                className="rounded-xl border p-3 text-center shadow-2xs"
                style={{ borderColor: `${borderColor}66`, backgroundColor: activeTheme.lightBg }}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Division Classification
                </span>
                <p className="mt-0.5 text-xs font-black uppercase text-indigo-900 truncate">
                  {totals.division}
                </p>
              </div>
            </section>

            {/* ============================================================== */}
            {/* 5. GRADING SCALE & TEACHER REMARKS BOX                         */}
            {/* ============================================================== */}
            <section className="mt-4 grid gap-3 sm:grid-cols-2">
              {/* Grading Legend Table */}
              <div
                className="rounded-xl border p-3 shadow-2xs"
                style={{ borderColor: `${borderColor}66`, backgroundColor: activeTheme.lightBg }}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Grading Standard Scale
                </span>
                <div className="mt-2 grid grid-cols-4 gap-1 text-[10px]">
                  {scale.map((s) => (
                    <div
                      key={s.grade}
                      className="rounded-md border border-slate-200/60 bg-white p-1 text-center"
                    >
                      <span className="font-bold text-slate-900">{s.grade}</span>
                      <span className="block text-[9px] text-slate-500">≥ {s.min}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Class Teacher / Principal Remarks Box */}
              <div
                className="rounded-xl border p-3 shadow-2xs"
                style={{ borderColor: `${borderColor}66`, backgroundColor: activeTheme.lightBg }}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Official Academic Remarks
                </span>
                <p className="mt-1.5 text-xs italic leading-relaxed text-slate-700">
                  {totals.passed
                    ? totals.percentage >= 75
                      ? "Outstanding academic accomplishment with honours. Exhibited superior conceptual mastery and exemplary classroom discipline."
                      : "Successfully qualified examination requirements with satisfactory subject proficiency. Promoted to the next academic grade."
                    : "The student has not attained the minimum pass threshold in one or more subjects. Supplemental examination recommended."}
                </p>
              </div>
            </section>

            {/* ============================================================== */}
            {/* 6. SIGNATURES & OFFICIAL INSTITUTION SEAL                      */}
            {/* ============================================================== */}
            <section className="mt-8 grid grid-cols-3 items-end gap-6 text-center">
              {/* Class Teacher Signature */}
              <div>
                <div className="border-b-2 border-slate-400 pb-1" />
                <p className="mt-1 text-[11px] font-bold text-slate-800 uppercase">Class Teacher</p>
                <p className="text-[9px] text-slate-400">Signature & Date</p>
              </div>

              {/* Official Stamp / Seal */}
              <div className="text-center">
                <div
                  className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed p-1"
                  style={{ borderColor: borderColor }}
                >
                  <span
                    className="font-serif text-[8px] font-black uppercase tracking-widest text-center leading-tight"
                    style={{ color: primaryColor }}
                  >
                    INSTITUTION<br />SEAL
                  </span>
                </div>
                <p className="mt-1 text-[10px] font-bold text-slate-500 uppercase">School Stamp</p>
              </div>

              {/* Principal / Authorized Signatory */}
              <div>
                <div className="border-b-2 border-slate-400 pb-1" />
                <p className="mt-1 text-[11px] font-bold text-slate-800 uppercase">
                  {settings?.authorized_signatory || "Principal / Headmaster"}
                </p>
                <p className="text-[9px] text-slate-400">Signature & Seal</p>
              </div>
            </section>

            {/* Footer Notice */}
            <footer className="mt-6 border-t border-slate-200/80 pt-2 text-center text-[9px] text-slate-400">
              This document is an authentic academic statement issued by {orgName}. Verification ID:{" "}
              <span className="font-mono text-slate-600">EDUTRANS-{student?.id?.slice(0, 8).toUpperCase()}</span> • Generated through EduTechLab School ERP
            </footer>
          </div>
        </div>
      </article>

      {/* ============================================================== */}
      {/* EXACT PRINT & PDF STYLES (A4 FIT, NO MULTI-PAGE SPILL)         */}
      {/* ============================================================== */}
      <style jsx global>{`
        @media print {
          html,
          body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .marksheet-canvas {
            width: 210mm !important;
            height: 297mm !important;
            max-width: none !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            page-break-after: always;
            break-after: page;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </main>
  );
}
