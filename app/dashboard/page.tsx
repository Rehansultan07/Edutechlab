"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ClipboardCheck,
  WalletCards,
  FileText,
  Bell,
  Settings,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  BookOpen,
  CreditCard,
  Sparkles,
  AlertCircle,
  Printer,
  Award,
  Receipt,
  Calendar,
  LogOut,
  Video,
  TrendingUp,
  MessageCircle,
  Activity,
  QrCode,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import InstallButton from "@/components/pwa/InstallButton";
import {
  fetchInstitutionFeatures,
  getDefaultFeaturesMap,
  EnabledFeaturesMap,
  FeatureKey,
  parseFeatures,
} from "@/lib/features";
import {
  createWhatsAppUrl,
  formatAbsentAlertMessage,
  formatFeeReminderMessage,
} from "@/lib/whatsapp";

const ROUTE_FEATURE_MAP: Record<string, FeatureKey> = {
  "/students": "students",
  "/id-cards": "id_cards",
  "/certificates": "certificates",
  "/academics": "academics",
  "/timetable": "timetable",
  "/homework": "homework",
  "/teachers": "teachers",
  "/attendance": "attendance",
  "/fees": "fees",
  "/expenses": "expenses",
  "/exams": "exams",
  "/notices": "notices",
  "/staff": "staff",
};

const nav = [
  ["Dashboard", "/dashboard", LayoutDashboard, []],
  ["Students", "/students", Users, ["students.view", "students.manage", "admissions.manage"]],
  ["ID Cards", "/id-cards", Printer, ["students.view"]],
  ["Certificates & TC", "/certificates", Award, ["students.manage"]],
  ["Academics", "/academics", BookOpen, ["settings.manage", "students.manage"]],
  ["Class Timetable", "/timetable", Calendar, ["settings.manage"]],
  ["Daily Homework", "/homework", BookOpen, ["students.view"]],
  ["Teachers", "/teachers", GraduationCap, ["teachers.view", "teachers.manage"]],
  ["Attendance", "/attendance", ClipboardCheck, ["attendance.view", "attendance.manage"]],
  ["Fees & Receipts", "/fees", WalletCards, ["fees.view", "fees.manage", "fees.receipts"]],
  ["School Expenses", "/expenses", Receipt, ["settings.manage"]],
  ["Exams & Results", "/exams", FileText, ["exams.view", "exams.manage", "results.manage"]],
  ["Notices", "/notices", Bell, ["notices.manage"]],
  ["Staff & Permissions", "/staff", ShieldCheck, ["staff.manage"]],
  ["Subscription", "/subscription", CreditCard, ["settings.manage"]],
] as const;

type Profile = {
  full_name: string;
  login_id: string | null;
  organization_id: string;
  role: string;
  organizations: { name: string; enabled_features?: any } | null;
};

type ActiveReportType =
  | null
  | "attendance"
  | "fees"
  | "students"
  | "finances"
  | "exams"
  | "idcards";

export default function Dashboard() {
  const supabase = createClient();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subInfo, setSubInfo] = useState<any>(null);
  const [birthdays, setBirthdays] = useState<any[]>([]);
  const [features, setFeatures] = useState<EnabledFeaturesMap>(getDefaultFeaturesMap());

  // Deep Data for Interactive Glassmorphic Reports
  const [activeStudents, setActiveStudents] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<{ id: string; name: string }[]>([]);
  const [teachersCount, setTeachersCount] = useState<number>(0);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [feePaymentsList, setFeePaymentsList] = useState<any[]>([]);
  const [feeDuesList, setFeeDuesList] = useState<any[]>([]);
  const [monthlyExpense, setMonthlyExpense] = useState<number>(0);
  const [expenseList, setExpenseList] = useState<any[]>([]);
  const [examsList, setExamsList] = useState<any[]>([]);

  // Interactive Report Modal State
  const [activeReport, setActiveReport] = useState<ActiveReportType>(null);
  const [notifiedParents, setNotifiedParents] = useState<Set<string>>(new Set());

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          window.location.href = "/login";
          return;
        }

        const { data: p, error: pError } = await supabase
          .from("profiles")
          .select("full_name,login_id,organization_id,role,organizations(name,enabled_features)")
          .eq("id", user.id)
          .single();

        if (pError || !p) {
          setError("We couldn't load your institute workspace.");
          setLoading(false);
          return;
        }

        setProfile(p as unknown as Profile);
        const orgId = p.organization_id;
        const role = String(p.role || "").trim().toLowerCase();
        const isAdmin = role === "owner" || role === "admin";
        if (!isAdmin) {
          window.location.replace("/staff-dashboard");
          return;
        }

        let granted = new Set<string>();
        if (isAdmin) {
          granted = new Set(nav.flatMap((x) => x[3]));
        } else {
          const { data: grants } = await supabase
            .from("staff_permissions")
            .select("permissions(code)")
            .eq("staff_id", user.id)
            .eq("organization_id", orgId)
            .eq("enabled", true);
          granted = new Set((grants ?? []).map((g: any) => g.permissions?.code).filter(Boolean));
        }
        setPermissions(granted);

        // Fetch institution enabled features
        const pFeat = (p as any)?.organizations?.enabled_features;
        if (pFeat) {
          setFeatures(parseFeatures(pFeat));
        }
        const instFeatures = await fetchInstitutionFeatures(supabase, orgId);
        setFeatures(instFeatures);

        const today = new Date().toISOString().slice(0, 10);
        const monthStart = new Date();
        monthStart.setDate(1);
        const monthDate = monthStart.toISOString().slice(0, 10);

        // Parallel fetch of all essential records for live interactive reports
        const [
          stRes,
          clRes,
          tcRes,
          attRes,
          payRes,
          duesRes,
          subRes,
          bdayRes,
          expRes,
          examRes,
        ] = await Promise.all([
          supabase
            .from("students")
            .select("id,first_name,last_name,admission_no,gender,class_id,phone,guardian_phone")
            .eq("organization_id", orgId)
            .eq("status", "active"),
          supabase.from("classes").select("id,name").eq("organization_id", orgId).order("sort_order"),
          supabase.from("teachers").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
          supabase.from("attendance").select("student_id,status").eq("organization_id", orgId).eq("attendance_date", today),
          supabase.from("fee_payments").select("id,amount,method,paid_on,student_id").eq("organization_id", orgId).gte("paid_on", monthDate),
          supabase.from("student_fee_months").select("student_id,amount_due,amount_paid,status,fee_month").eq("organization_id", orgId),
          supabase.rpc("get_institution_subscription", { p_org_id: orgId }),
          supabase.from("students").select("id,first_name,last_name,date_of_birth,class_id").eq("organization_id", orgId).not("date_of_birth", "is", null),
          supabase.from("school_expenses").select("id,title,category,amount,expense_date").eq("organization_id", orgId).gte("expense_date", monthDate),
          supabase.from("exams").select("id,name,exam_date").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(6),
        ]);

        setActiveStudents(stRes.data || []);
        setClassesList(clRes.data || []);
        setTeachersCount(tcRes.count || 0);
        setAttendanceRecords(attRes.data || []);
        setFeePaymentsList(payRes.data || []);
        setFeeDuesList(duesRes.data || []);
        setExamsList(examRes.data || []);

        // Calculate birthdays
        const todayMMDD = today.slice(5);
        const todaysBdays = (bdayRes.data || []).filter(
          (s: any) => s.date_of_birth && s.date_of_birth.slice(5) === todayMMDD
        );
        setBirthdays(todaysBdays);

        // Calculate monthly expenses
        let totalExp = (expRes.data || []).reduce(
          (sum: number, r: any) => sum + Number(r.amount || 0),
          0
        );
        if (totalExp === 0 && typeof window !== "undefined") {
          try {
            const localExp = JSON.parse(
              localStorage.getItem(`edutechlab_expenses_${orgId}`) || "[]"
            );
            totalExp = localExp
              .filter((e: any) => e.expense_date >= monthDate)
              .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
          } catch {}
        }
        setMonthlyExpense(totalExp);
        setExpenseList(expRes.data || []);

        if (subRes.data) setSubInfo(subRes.data);
      } catch (err: any) {
        setError(err.message || "Failed to initialize dashboard.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const instituteName = profile?.organizations?.name || "Your Institute";
  const firstName = profile?.full_name?.trim()?.split(/\s+/)[0] || "Admin";
  const initials = (profile?.full_name || "A")
    .split(/\s+/)
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isFeatActive = (href: string) => {
    const k = ROUTE_FEATURE_MAP[href];
    if (!k) return true;
    return features[k] !== false;
  };

  const visibleNav = nav.filter(
    ([, href, , required]) =>
      isFeatActive(href) &&
      (href === "/dashboard" ||
        profile?.role === "owner" ||
        profile?.role === "admin" ||
        required.some((c) => permissions.has(c)))
  );

  // ==============================================================
  // COMPUTED REPORT ANALYTICS
  // ==============================================================
  const classMap = useMemo(() => {
    const m = new Map<string, string>();
    classesList.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [classesList]);

  // Attendance Analytics
  const attendanceStats = useMemo(() => {
    const present = attendanceRecords.filter((x) => x.status === "present").length;
    const absent = attendanceRecords.filter((x) => x.status === "absent").length;
    const late = attendanceRecords.filter((x) => x.status === "late").length;
    const leave = attendanceRecords.filter((x) => x.status === "leave").length;
    const marked = present + absent + late + leave;
    const rate = marked > 0 ? Math.round((present / marked) * 100) : null;

    // Absent students list for 1-click WhatsApp
    const absentIds = new Set(
      attendanceRecords.filter((x) => x.status === "absent").map((x) => x.student_id)
    );
    const absentStudents = activeStudents.filter((s) => absentIds.has(s.id));

    // Class wise presence percentage
    const classBreakdown = classesList.map((c) => {
      const classStudents = activeStudents.filter((s) => s.class_id === c.id);
      const studentIds = new Set(classStudents.map((s) => s.id));
      const classPresent = attendanceRecords.filter(
        (x) => studentIds.has(x.student_id) && x.status === "present"
      ).length;
      const classMarked = attendanceRecords.filter((x) => studentIds.has(x.student_id)).length;
      return {
        className: c.name,
        total: classStudents.length,
        present: classPresent,
        rate: classMarked > 0 ? Math.round((classPresent / classMarked) * 100) : 0,
      };
    });

    return { present, absent, late, leave, marked, rate, absentStudents, classBreakdown };
  }, [attendanceRecords, activeStudents, classesList]);

  // Fee Analytics
  const feeStats = useMemo(() => {
    const totalCollected = feePaymentsList.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    // Outstanding Dues & Defaulters
    const duesByStudent: Record<string, { due: number; months: number }> = {};
    feeDuesList.forEach((m) => {
      const balance = Math.max(0, Number(m.amount_due) - Number(m.amount_paid));
      if (balance > 0) {
        if (!duesByStudent[m.student_id]) {
          duesByStudent[m.student_id] = { due: 0, months: 0 };
        }
        duesByStudent[m.student_id].due += balance;
        duesByStudent[m.student_id].months += 1;
      }
    });

    const totalOutstanding = Object.values(duesByStudent).reduce((a, b) => a + b.due, 0);

    // Defaulters enriched with student details
    const defaulters = Object.entries(duesByStudent)
      .map(([studentId, d]) => {
        const student = activeStudents.find((s) => s.id === studentId);
        return {
          studentId,
          studentName: student ? `${student.first_name} ${student.last_name || ""}`.trim() : "Student",
          admissionNo: student?.admission_no || "—",
          className: student?.class_id ? classMap.get(student.class_id) || "Class" : "Class",
          phone: student?.guardian_phone || student?.phone,
          due: d.due,
          months: d.months,
        };
      })
      .sort((a, b) => b.due - a.due);

    // Methods breakdown
    const methods: Record<string, number> = {};
    feePaymentsList.forEach((p) => {
      const m = p.method || "cash";
      methods[m] = (methods[m] || 0) + Number(p.amount || 0);
    });

    return { totalCollected, totalOutstanding, defaulters, methods };
  }, [feePaymentsList, feeDuesList, activeStudents, classMap]);

  // Demographics Analytics
  const studentStats = useMemo(() => {
    const total = activeStudents.length;
    const boys = activeStudents.filter((s) => (s.gender || "").toLowerCase() === "male").length;
    const girls = activeStudents.filter((s) => (s.gender || "").toLowerCase() === "female").length;
    const other = total - boys - girls;

    const classDistribution = classesList.map((c) => ({
      name: c.name,
      count: activeStudents.filter((s) => s.class_id === c.id).length,
    }));

    return { total, boys, girls, other, classDistribution };
  }, [activeStudents, classesList]);

  // Financial Pulse
  const financePulse = useMemo(() => {
    const income = feeStats.totalCollected;
    const expense = monthlyExpense;
    const net = income - expense;
    const margin = income > 0 ? Math.round((net / income) * 100) : 0;
    return { income, expense, net, margin };
  }, [feeStats.totalCollected, monthlyExpense]);

  const originUrl =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://edutechlab-9fz4.vercel.app";

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 relative overflow-x-hidden selection:bg-purple-600 selection:text-white">
      {/* ============================================================== */}
      {/* AMBIENT LIGHT PASTEL MESH GLOW ORBS (CLEAN & EYE-PLEASING)     */}
      {/* ============================================================== */}
      <div className="fixed top-[-6%] left-[-6%] w-[550px] h-[550px] rounded-full bg-gradient-to-tr from-purple-200/50 via-indigo-100/40 to-transparent blur-[140px] pointer-events-none" />
      <div className="fixed top-[20%] right-[-6%] w-[600px] h-[600px] rounded-full bg-gradient-to-bl from-cyan-200/50 via-sky-100/40 to-transparent blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[-6%] left-[20%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-emerald-200/40 via-teal-100/30 to-transparent blur-[150px] pointer-events-none" />
      <div className="fixed bottom-[25%] right-[25%] w-[450px] h-[450px] rounded-full bg-gradient-to-bl from-rose-200/40 via-pink-100/30 to-transparent blur-[140px] pointer-events-none" />

      {/* ============================================================== */}
      {/* SIDEBAR NAVIGATION (BRIGHT FROSTED GLASS)                      */}
      {/* ============================================================== */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200/80 bg-white/80 p-5 backdrop-blur-2xl transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-black tracking-tight bg-gradient-to-r from-purple-700 via-indigo-600 to-cyan-600 bg-clip-text text-transparent">
              EduTechLab
            </div>
            <div className="mt-0.5 max-w-[190px] truncate text-xs font-semibold text-slate-500">
              {instituteName}
            </div>
          </div>
          <button
            className="lg:hidden text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 transition"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="mt-7 space-y-1 overflow-y-auto max-h-[calc(100vh-180px)] pr-1">
          {visibleNav.map(([label, href, Icon]) => {
            const isActive = href === "/dashboard";
            return (
              <Link
                key={label}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-bold transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 text-white shadow-md shadow-purple-600/25"
                    : "text-slate-600 hover:text-purple-700 hover:bg-purple-50/60 hover:translate-x-1"
                }`}
              >
                <Icon
                  size={17}
                  className={isActive ? "text-yellow-300" : "text-slate-400 group-hover:text-purple-600"}
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-5 left-5 right-5 border-t border-slate-200/80 pt-4">
          <InstallButton className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition" />
        </div>
      </aside>

      {/* ============================================================== */}
      {/* MAIN VIEWPORT                                                  */}
      {/* ============================================================== */}
      <div className="lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 px-5 backdrop-blur-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-slate-600 hover:text-slate-900 p-1.5 rounded-xl hover:bg-slate-100 transition"
              onClick={() => setOpen(true)}
            >
              <Menu size={22} />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className="font-semibold text-slate-800">{instituteName}</span>
              <ChevronRight size={14} className="text-slate-400" />
              <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
                School Admin Console
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-purple-400/50 transition focus:outline-none"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-xs font-black text-white shadow-md shadow-purple-600/30 hover:scale-105 transition">
                  {initials}
                </div>
              </button>

              {profileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileMenuOpen(false)} />
                  <div className="absolute right-0 top-12 z-50 w-72 rounded-3xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur-2xl ring-1 ring-black/5">
                    <div className="px-3 py-2.5 border-b border-slate-100">
                      <p className="text-sm font-bold text-slate-900 truncate">{profile?.full_name || "Admin"}</p>
                      <div className="mt-0.5 flex items-center justify-between">
                        <span className="text-xs text-slate-500 truncate max-w-[150px]">{instituteName}</span>
                        <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[9px] font-bold text-purple-700 border border-purple-200 uppercase">
                          {profile?.role || "Admin"}
                        </span>
                      </div>
                    </div>

                    <div className="py-2 space-y-1">
                      <Link
                        href="/settings"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                      >
                        <Settings size={15} className="text-cyan-600" />
                        <span>Institute Settings</span>
                      </Link>
                      <Link
                        href="/subscription"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                      >
                        <CreditCard size={15} className="text-purple-600" />
                        <span>Subscription & Billing</span>
                      </Link>
                      <Link
                        href="/preview"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-2xl px-3 py-2 text-xs font-semibold text-pink-700 hover:bg-pink-50 transition"
                      >
                        <Video size={15} className="text-pink-600" />
                        <span>Animated Video Demos</span>
                      </Link>
                    </div>

                    <div className="border-t border-slate-100 pt-2">
                      <button
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                      >
                        <LogOut size={15} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Main Canvas */}
        <main className="mx-auto max-w-7xl p-5 sm:p-8 space-y-7">
          {error && (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* ============================================================== */}
          {/* WELCOME HERO & ACTION BAR (LIGHT COLORFUL GLASS)               */}
          {/* ============================================================== */}
          <div className="relative overflow-hidden rounded-3xl border border-purple-200/70 bg-gradient-to-r from-purple-50/90 via-indigo-50/80 to-cyan-50/80 p-6 sm:p-8 backdrop-blur-xl shadow-sm">
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-purple-100 border border-purple-200 px-3.5 py-1 text-xs font-bold text-purple-700 shadow-xs">
                  <Sparkles size={13} className="text-amber-500 animate-spin" />
                  <span>{instituteName} Workspace</span>
                </div>
                <h1 className="mt-2 text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
                  Welcome back,{" "}
                  <span className="bg-gradient-to-r from-purple-700 via-indigo-600 to-cyan-600 bg-clip-text text-transparent">
                    {firstName}
                  </span>
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-xl font-medium">
                  Real-time operational dashboard &bull; Attendance, fee collections, student strength, and daily kharcha.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  href="/students"
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-600/25 hover:from-purple-500 hover:to-indigo-500 transition active:scale-95"
                >
                  <Users size={15} />
                  <span>+ New Student</span>
                </Link>
                <Link
                  href="/attendance"
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-300 bg-white/90 px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-400 transition active:scale-95"
                >
                  <QrCode size={15} className="text-cyan-600" />
                  <span>Gate QR Kiosk</span>
                </Link>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* SUBSCRIPTION PLAN BANNER                                       */}
          {/* ============================================================== */}
          {subInfo && (
            <div
              className={`rounded-3xl border p-4 sm:p-5 backdrop-blur-xl transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm ${
                subInfo.is_expired
                  ? "border-rose-200 bg-rose-50/80 text-rose-900"
                  : subInfo.is_trial
                  ? "border-amber-200 bg-amber-50/80 text-amber-900"
                  : "border-purple-200 bg-purple-50/80 text-purple-900"
              }`}
            >
              <div className="flex items-center gap-3.5">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl shadow-sm ${
                  subInfo.is_expired ? "bg-rose-100 text-rose-700" : "bg-purple-100 text-purple-700"
                }`}>
                  {subInfo.is_expired ? <AlertCircle size={22} /> : <CreditCard size={22} />}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm sm:text-base text-slate-900">
                      {subInfo.is_expired
                        ? "Subscription Expired"
                        : subInfo.is_trial
                        ? `Free Trial Active (${subInfo.days_remaining} Days Remaining)`
                        : "Standard Institutional Plan"}
                    </span>
                    <span className="rounded-full bg-white/90 border border-current/20 px-2.5 py-0.5 text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                      {activeStudents.length} / {subInfo.student_limit} Students Quota
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-60 max-w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-600 to-cyan-500 rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round((activeStudents.length / Math.max(1, subInfo.student_limit)) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <Link
                href="/subscription"
                className="inline-flex items-center gap-1.5 rounded-2xl bg-white border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition self-start sm:self-auto"
              >
                <span>Manage Plan & Quota</span>
                <ChevronRight size={14} />
              </Link>
            </div>
          )}

          {/* ============================================================== */}
          {/* BIRTHDAY CELEBRATION LIGHT BANNER                              */}
          {/* ============================================================== */}
          {birthdays.length > 0 && (
            <div className="rounded-3xl border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-700 text-2xl shadow-sm">
                  🎂
                </span>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-900">
                    Today&apos;s Birthday Celebrations ({birthdays.length})
                  </span>
                  <p className="text-sm font-extrabold text-slate-900">
                    {birthdays.map((b: any) => `${b.first_name} ${b.last_name || ""}`).join(", ")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  const names = birthdays.map((b: any) => b.first_name).join(", ");
                  navigator.clipboard.writeText(
                    `🎉 *Happy Birthday from ${instituteName}!* Dear ${names}, we wish you a joyful year of academic success and health!`
                  );
                  alert("Birthday wish message copied to clipboard!");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95 self-start sm:self-auto"
              >
                <span>Copy Birthday Wish</span>
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* TOP 4 VIBRANT LIGHT GLASS KPI TILES                            */}
          {/* ============================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Tile 1: Total Students */}
            <div
              onClick={() => setActiveReport("students")}
              className="group cursor-pointer rounded-3xl border border-purple-200/80 bg-white/80 p-5 backdrop-blur-xl hover:border-purple-400 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-700">
                  Total Students
                </span>
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-purple-100 text-purple-700 group-hover:scale-110 transition">
                  <Users size={19} />
                </span>
              </div>
              <p className="mt-3 text-3xl font-black text-slate-900">
                {loading ? "—" : activeStudents.length}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Active Enrolled</span>
                <span className="text-purple-700 text-[11px] font-bold group-hover:translate-x-0.5 transition flex items-center gap-0.5">
                  View Classes →
                </span>
              </div>
            </div>

            {/* Tile 2: Faculty */}
            <div
              onClick={() => setActiveReport("students")}
              className="group cursor-pointer rounded-3xl border border-cyan-200/80 bg-white/80 p-5 backdrop-blur-xl hover:border-cyan-400 hover:shadow-xl hover:shadow-cyan-500/10 transition-all duration-300 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-800">
                  Teachers & Faculty
                </span>
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-100 text-cyan-700 group-hover:scale-110 transition">
                  <GraduationCap size={19} />
                </span>
              </div>
              <p className="mt-3 text-3xl font-black text-slate-900">
                {loading ? "—" : teachersCount}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Assigned Teachers</span>
                <span className="text-cyan-700 text-[11px] font-bold group-hover:translate-x-0.5 transition flex items-center gap-0.5">
                  Directory →
                </span>
              </div>
            </div>

            {/* Tile 3: Today's Attendance */}
            <div
              onClick={() => setActiveReport("attendance")}
              className="group cursor-pointer rounded-3xl border border-emerald-200/80 bg-white/80 p-5 backdrop-blur-xl hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Today&apos;s Attendance
                </span>
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 group-hover:scale-110 transition">
                  <ClipboardCheck size={19} />
                </span>
              </div>
              <p className="mt-3 text-3xl font-black text-emerald-700">
                {loading ? "—" : attendanceStats.rate === null ? "Not marked" : `${attendanceStats.rate}%`}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>{attendanceStats.present} Present &bull; {attendanceStats.absent} Absent</span>
                <span className="text-emerald-700 text-[11px] font-bold group-hover:translate-x-0.5 transition flex items-center gap-0.5">
                  Drilldown →
                </span>
              </div>
            </div>

            {/* Tile 4: Fees Collected Month */}
            <div
              onClick={() => setActiveReport("fees")}
              className="group cursor-pointer rounded-3xl border border-amber-200/80 bg-white/80 p-5 backdrop-blur-xl hover:border-amber-400 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300 relative overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  Fees This Month
                </span>
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-100 text-amber-700 group-hover:scale-110 transition">
                  <WalletCards size={19} />
                </span>
              </div>
              <p className="mt-3 text-3xl font-black text-slate-900">
                {loading ? "—" : `₹${feeStats.totalCollected.toLocaleString("en-IN")}`}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Due: ₹{feeStats.totalOutstanding.toLocaleString("en-IN")}</span>
                <span className="text-amber-700 text-[11px] font-bold group-hover:translate-x-0.5 transition flex items-center gap-0.5">
                  Ledger →
                </span>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* CENTRAL LIVE REPORTS & ANALYTICS SHOWCASE HUB                  */}
          {/* ============================================================== */}
          <div className="pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-purple-100 border border-purple-200 px-3 py-1 text-xs font-bold text-purple-700 shadow-xs">
                  <Activity size={13} className="text-cyan-600 animate-pulse" />
                  <span>Central Operations & Reports Hub</span>
                </div>
                <h2 className="mt-1.5 text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Interactive Institutional Reports</span>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                    Click Any Tile to Open Full Report
                  </span>
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Instant deep-dive reports with class breakdown, defaulters list, profit & loss, and 1-click WhatsApp alerts.
                </p>
              </div>
            </div>

            {/* 6 High-Impact Light Glassmorphic Report Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Report 1: Attendance Report Card */}
              <div
                onClick={() => setActiveReport("attendance")}
                className="group cursor-pointer rounded-3xl border border-emerald-200/90 bg-white/85 p-6 backdrop-blur-xl hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 relative flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 border border-emerald-200 group-hover:scale-105 transition">
                      <ClipboardCheck size={22} />
                    </span>
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Attendance
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-700 transition">
                    Daily Attendance & Absentees
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Class-wise attendance tracking, instant absentee count, and 1-click WhatsApp alerts to parents.
                  </p>

                  <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-2.5">
                      <span className="text-[10px] text-emerald-800 font-semibold block">Present</span>
                      <strong className="text-base text-emerald-700 font-black">{attendanceStats.present}</strong>
                    </div>
                    <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-2.5">
                      <span className="text-[10px] text-rose-800 font-semibold block">Absent</span>
                      <strong className="text-base text-rose-700 font-black">{attendanceStats.absent}</strong>
                    </div>
                    <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-2.5">
                      <span className="text-[10px] text-cyan-800 font-semibold block">Ratio</span>
                      <strong className="text-base text-cyan-700 font-black">
                        {attendanceStats.rate ? `${attendanceStats.rate}%` : "—"}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700 group-hover:text-emerald-800">
                  <span>View Full Attendance Breakdown</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition" />
                </div>
              </div>

              {/* Report 2: Fees & Dues Collection Report */}
              <div
                onClick={() => setActiveReport("fees")}
                className="group cursor-pointer rounded-3xl border border-amber-200/90 bg-white/85 p-6 backdrop-blur-xl hover:border-amber-400 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300 relative flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700 border border-amber-200 group-hover:scale-105 transition">
                      <WalletCards size={22} />
                    </span>
                    <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                      {feeStats.defaulters.length} Defaulters
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-slate-900 group-hover:text-amber-700 transition">
                    Fee Collection & Defaulters
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Monthly income collection, pending balance tracker, and automated fee due reminders on WhatsApp.
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-2.5">
                      <span className="text-[10px] text-emerald-800 font-semibold block">Collected (Month)</span>
                      <strong className="text-base text-emerald-700 font-black">
                        ₹{feeStats.totalCollected.toLocaleString("en-IN")}
                      </strong>
                    </div>
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-2.5">
                      <span className="text-[10px] text-amber-800 font-semibold block">Total Outstanding</span>
                      <strong className="text-base text-amber-700 font-black">
                        ₹{feeStats.totalOutstanding.toLocaleString("en-IN")}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-amber-700 group-hover:text-amber-800">
                  <span>Open Dues & Defaulters Ledger</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition" />
                </div>
              </div>

              {/* Report 3: Student Enrollment & Demographics */}
              <div
                onClick={() => setActiveReport("students")}
                className="group cursor-pointer rounded-3xl border border-purple-200/90 bg-white/85 p-6 backdrop-blur-xl hover:border-purple-400 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300 relative flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-100 text-purple-700 border border-purple-200 group-hover:scale-105 transition">
                      <Users size={22} />
                    </span>
                    <span className="rounded-full bg-purple-50 border border-purple-200 px-2.5 py-1 text-[11px] font-bold text-purple-700">
                      {classesList.length} Classes
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-slate-900 group-hover:text-purple-700 transition">
                    Class Enrollment & Demographics
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Total student strength, boys vs girls ratio, and class-wise capacity breakdown across all grades.
                  </p>

                  <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-2.5">
                      <span className="text-[10px] text-purple-800 font-semibold block">Total</span>
                      <strong className="text-base text-slate-900 font-black">{studentStats.total}</strong>
                    </div>
                    <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-2.5">
                      <span className="text-[10px] text-cyan-800 font-semibold block">Boys</span>
                      <strong className="text-base text-cyan-700 font-black">{studentStats.boys}</strong>
                    </div>
                    <div className="rounded-2xl border border-pink-100 bg-pink-50/70 p-2.5">
                      <span className="text-[10px] text-pink-800 font-semibold block">Girls</span>
                      <strong className="text-base text-pink-700 font-black">{studentStats.girls}</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-purple-700 group-hover:text-purple-800">
                  <span>View Class-Wise Strength</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition" />
                </div>
              </div>

              {/* Report 4: Financial Pulse & PnL */}
              <div
                onClick={() => setActiveReport("finances")}
                className="group cursor-pointer rounded-3xl border border-rose-200/90 bg-white/85 p-6 backdrop-blur-xl hover:border-rose-400 hover:shadow-xl hover:shadow-rose-500/10 transition-all duration-300 relative flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-100 text-rose-700 border border-rose-200 group-hover:scale-105 transition">
                      <TrendingUp size={22} />
                    </span>
                    <span className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-1 text-[11px] font-bold text-rose-700">
                      Cash Flow
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-slate-900 group-hover:text-rose-700 transition">
                    Income vs Expenses (P&L)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Real-time comparison of collected fee revenue versus institutional outflows and operational kharcha.
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-2.5">
                      <span className="text-[10px] text-rose-800 font-semibold block">Expenses (Outflow)</span>
                      <strong className="text-base text-rose-700 font-black">
                        ₹{monthlyExpense.toLocaleString("en-IN")}
                      </strong>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-2.5">
                      <span className="text-[10px] text-emerald-800 font-semibold block">Net Cash Surplus</span>
                      <strong className="text-base text-emerald-700 font-black">
                        ₹{financePulse.net.toLocaleString("en-IN")}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-rose-700 group-hover:text-rose-800">
                  <span>Open Expense & Surplus Ledger</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition" />
                </div>
              </div>

              {/* Report 5: Academic Exams & Results */}
              <div
                onClick={() => setActiveReport("exams")}
                className="group cursor-pointer rounded-3xl border border-sky-200/90 bg-white/85 p-6 backdrop-blur-xl hover:border-sky-400 hover:shadow-xl hover:shadow-sky-500/10 transition-all duration-300 relative flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-100 text-sky-700 border border-sky-200 group-hover:scale-105 transition">
                      <FileText size={22} />
                    </span>
                    <span className="rounded-full bg-sky-50 border border-sky-200 px-2.5 py-1 text-[11px] font-bold text-sky-700">
                      {examsList.length} Exams Recorded
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-slate-900 group-hover:text-sky-700 transition">
                    Exams & Performance Report
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Terminal examinations, subject score sheets, marksheet generation, and student report cards.
                  </p>

                  <div className="mt-5 space-y-1.5">
                    {examsList.length === 0 ? (
                      <div className="py-2.5 text-center text-xs text-slate-400 font-medium">
                        No examination sessions scheduled yet.
                      </div>
                    ) : (
                      examsList.slice(0, 2).map((e) => (
                        <div
                          key={e.id}
                          className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 border border-slate-200/80"
                        >
                          <span className="font-semibold text-slate-800 truncate">{e.name}</span>
                          <span className="text-[10px] text-sky-700 font-mono font-semibold">{e.exam_date || "Active"}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-sky-700 group-hover:text-sky-800">
                  <span>Open Examination Analytics</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition" />
                </div>
              </div>

              {/* Report 6: Smart ID Cards & Gate Kiosk */}
              <div
                onClick={() => setActiveReport("idcards")}
                className="group cursor-pointer rounded-3xl border border-pink-200/90 bg-white/85 p-6 backdrop-blur-xl hover:border-pink-400 hover:shadow-xl hover:shadow-pink-500/10 transition-all duration-300 relative flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-pink-100 text-pink-700 border border-pink-200 group-hover:scale-105 transition">
                      <QrCode size={22} />
                    </span>
                    <span className="rounded-full bg-pink-50 border border-pink-200 px-2.5 py-1 text-[11px] font-bold text-pink-700">
                      Smart ID Ready
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-slate-900 group-hover:text-pink-700 transition">
                    Smart PVC ID Cards & Scanner
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Large scannable QR card generation, 8/9/10 A4 sheet print presets with cut guides, and entrance kiosk scanner.
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-2xl border border-pink-100 bg-pink-50/70 p-2.5">
                      <span className="text-[10px] text-pink-800 font-semibold block">A4 Sheet Layouts</span>
                      <strong className="text-sm text-pink-700 font-bold">8, 9, 10 Cards</strong>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-2.5">
                      <span className="text-[10px] text-emerald-800 font-semibold block">Color Print</span>
                      <strong className="text-sm text-emerald-700 font-bold">100% Locked</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-pink-700 group-hover:text-pink-800">
                  <span>Manage ID Cards & Presets</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition" />
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* QUICK SHORTCUTS & WORKSPACE OVERVIEW                           */}
          {/* ============================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
            {/* Left 2 Cols: Workspace Shortcuts */}
            <div className="lg:col-span-2 rounded-3xl border border-slate-200/80 bg-white/80 p-6 backdrop-blur-xl shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-slate-900">Direct Administrative Actions</h3>
                  <span className="rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5 text-[10px] font-bold border border-emerald-200">
                    One-Click
                  </span>
                </div>
                <span className="text-xs font-mono font-medium text-slate-400">{profile?.login_id || "Admin"}</span>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                  href="/attendance"
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-emerald-50/80 hover:border-emerald-300 transition group"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                      <ClipboardCheck size={20} />
                    </span>
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">Mark Today&apos;s Attendance</span>
                      <span className="text-[10px] text-slate-500 font-medium">Register or Gate QR Scanner</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-emerald-700 transition" />
                </Link>

                <Link
                  href="/fees"
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-amber-50/80 hover:border-amber-300 transition group"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700">
                      <WalletCards size={20} />
                    </span>
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">Record Fee Payment</span>
                      <span className="text-[10px] text-slate-500 font-medium">Generate receipt & ledger</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-amber-700 transition" />
                </Link>

                <Link
                  href="/id-cards"
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-purple-50/80 hover:border-purple-300 transition group"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-purple-100 text-purple-700">
                      <Printer size={20} />
                    </span>
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">Print Student ID Cards</span>
                      <span className="text-[10px] text-slate-500 font-medium">A4 layout presets with cut guides</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-purple-700 transition" />
                </Link>

                <Link
                  href="/expenses"
                  className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-rose-50/80 hover:border-rose-300 transition group"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-rose-100 text-rose-700">
                      <Receipt size={20} />
                    </span>
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">School Expenses & Kharcha</span>
                      <span className="text-[10px] text-slate-500 font-medium">Track fuel, repairs, maintenance</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-rose-700 transition" />
                </Link>
              </div>
            </div>

            {/* Right 1 Col: Quick Links */}
            <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 backdrop-blur-xl shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 pb-3 border-b border-slate-100">
                  Navigation Essentials
                </h3>
                <div className="mt-3 space-y-2">
                  <Link
                    href="/certificates"
                    className="flex items-center justify-between text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-purple-50/60 hover:border-purple-200 text-slate-700 hover:text-purple-900 transition font-medium"
                  >
                    <span>Issue TC & Bonafide Certificate</span>
                    <ChevronRight size={14} className="text-slate-400" />
                  </Link>
                  <Link
                    href="/timetable"
                    className="flex items-center justify-between text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-purple-50/60 hover:border-purple-200 text-slate-700 hover:text-purple-900 transition font-medium"
                  >
                    <span>Class Timetable Routine</span>
                    <ChevronRight size={14} className="text-slate-400" />
                  </Link>
                  <Link
                    href="/homework"
                    className="flex items-center justify-between text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-purple-50/60 hover:border-purple-200 text-slate-700 hover:text-purple-900 transition font-medium"
                  >
                    <span>Daily Homework Diary</span>
                    <ChevronRight size={14} className="text-slate-400" />
                  </Link>
                  <Link
                    href="/notices"
                    className="flex items-center justify-between text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-purple-50/60 hover:border-purple-200 text-slate-700 hover:text-purple-900 transition font-medium"
                  >
                    <span>School Notices & Circulars</span>
                    <ChevronRight size={14} className="text-slate-400" />
                  </Link>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
                🔒 Protected by End-to-End Enterprise Role Permissions.
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ============================================================== */}
      {/* INTERACTIVE FULL REPORT MODAL (LIGHT FROSTED GLASS)            */}
      {/* ============================================================== */}
      {activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/40 backdrop-blur-md overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-4xl rounded-3xl bg-white/95 border border-slate-200 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl space-y-6 max-h-[90vh] overflow-y-auto text-slate-800">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-100 text-purple-700 border border-purple-200">
                  {activeReport === "attendance" && <ClipboardCheck size={24} className="text-emerald-600" />}
                  {activeReport === "fees" && <WalletCards size={24} className="text-amber-600" />}
                  {activeReport === "students" && <Users size={24} className="text-purple-600" />}
                  {activeReport === "finances" && <TrendingUp size={24} className="text-rose-600" />}
                  {activeReport === "exams" && <FileText size={24} className="text-cyan-600" />}
                  {activeReport === "idcards" && <QrCode size={24} className="text-pink-600" />}
                </span>
                <div>
                  <h3 className="text-xl font-black text-slate-900">
                    {activeReport === "attendance" && "Comprehensive Attendance & Absentee Report"}
                    {activeReport === "fees" && "Fee Collection Ledger & Dues Breakdown"}
                    {activeReport === "students" && "Class-Wise Enrollment & Demographics"}
                    {activeReport === "finances" && "Financial Pulse: Revenue vs Expenses (P&L)"}
                    {activeReport === "exams" && "Academic Examination Performance Report"}
                    {activeReport === "idcards" && "Smart PVC ID Cards & Gate Kiosk Overview"}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {instituteName} &bull; Generated Live on {new Date().toLocaleDateString("en-IN")}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveReport(null)}
                className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* -------------------------------------------------------- */}
            {/* 1. ATTENDANCE DRILL-DOWN REPORT                          */}
            {/* -------------------------------------------------------- */}
            {activeReport === "attendance" && (
              <div className="space-y-5">
                {/* 4 Metric Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-center">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Students</span>
                    <p className="text-xl font-black text-slate-900 mt-0.5">{activeStudents.length}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-center">
                    <span className="text-[10px] text-emerald-800 uppercase font-semibold">Present Today</span>
                    <p className="text-xl font-black text-emerald-700 mt-0.5">{attendanceStats.present}</p>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3 text-center">
                    <span className="text-[10px] text-rose-800 uppercase font-semibold">Absent Today</span>
                    <p className="text-xl font-black text-rose-700 mt-0.5">{attendanceStats.absent}</p>
                  </div>
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-3 text-center">
                    <span className="text-[10px] text-cyan-800 uppercase font-semibold">Attendance Ratio</span>
                    <p className="text-xl font-black text-cyan-800 mt-0.5">
                      {attendanceStats.rate ? `${attendanceStats.rate}%` : "Not Marked"}
                    </p>
                  </div>
                </div>

                {/* Class Wise Breakdown */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Class-By-Class Presence Summary
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {attendanceStats.classBreakdown.map((c) => (
                      <div key={c.className} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900">{c.className}</span>
                          <span className="font-mono text-cyan-800 font-bold">{c.rate}%</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"
                            style={{ width: `${c.rate}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium mt-1 block">
                          {c.present} of {c.total} Present
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Absent Students with 1-Click WhatsApp Button */}
                {attendanceStats.absentStudents.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700">
                        Absent Students Today ({attendanceStats.absentStudents.length}) &bull; 1-Click Parent WhatsApp
                      </h4>
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {attendanceStats.absentStudents.map((st) => {
                        const targetPhone = st.guardian_phone || st.phone;
                        const isSent = notifiedParents.has(st.id);
                        const cName = st.class_id ? classMap.get(st.class_id) || "Class" : "Class";
                        const waUrl = createWhatsAppUrl(
                          targetPhone,
                          formatAbsentAlertMessage({
                            studentName: `${st.first_name} ${st.last_name || ""}`.trim(),
                            admissionNo: st.admission_no,
                            className: cName,
                            schoolName: instituteName,
                            date: new Date().toISOString().slice(0, 10),
                            originUrl,
                            studentId: st.id,
                          })
                        );

                        return (
                          <div
                            key={st.id}
                            className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white shadow-xs"
                          >
                            <div>
                              <span className="font-bold text-xs text-slate-900">
                                {st.first_name} {st.last_name || ""}
                              </span>
                              <span className="text-[10px] text-slate-500 block font-medium">
                                {cName} &bull; Adm: {st.admission_no} &bull; {targetPhone ? `📞 ${targetPhone}` : "No Phone"}
                              </span>
                            </div>

                            {targetPhone ? (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setNotifiedParents((p) => new Set(p).add(st.id))}
                                className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                                  isSent
                                    ? "bg-slate-100 text-slate-600 border border-slate-200"
                                    : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                                }`}
                              >
                                <MessageCircle size={13} />
                                <span>{isSent ? "Sent ✓" : "WhatsApp"}</span>
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium">Missing Phone</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    href="/attendance"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white transition shadow-sm"
                  >
                    <span>Open Attendance Register & Scanner</span>
                    <ExternalLink size={13} />
                  </Link>
                  <button
                    onClick={() => setActiveReport(null)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                  >
                    Close Report
                  </button>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------- */}
            {/* 2. FEES & OUTSTANDING DEFAULTERS REPORT                  */}
            {/* -------------------------------------------------------- */}
            {activeReport === "fees" && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-center">
                    <span className="text-[10px] text-emerald-800 uppercase font-semibold">Collected This Month</span>
                    <p className="text-2xl font-black text-emerald-700 mt-1">
                      ₹{feeStats.totalCollected.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-center">
                    <span className="text-[10px] text-amber-800 uppercase font-semibold">Total Outstanding Dues</span>
                    <p className="text-2xl font-black text-amber-700 mt-1">
                      ₹{feeStats.totalOutstanding.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5 text-center">
                    <span className="text-[10px] text-rose-800 uppercase font-semibold">Students With Dues</span>
                    <p className="text-2xl font-black text-rose-700 mt-1">{feeStats.defaulters.length}</p>
                  </div>
                </div>

                {/* Defaulters Table with 1-Click WhatsApp Reminders */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Pending Fee Defaulters ({feeStats.defaulters.length})
                  </h4>
                  <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                          <tr>
                            <th className="p-3">Student</th>
                            <th className="p-3">Class</th>
                            <th className="p-3">Overdue Months</th>
                            <th className="p-3">Pending Balance</th>
                            <th className="p-3 text-right">Reminder Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {feeStats.defaulters.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-slate-500 font-medium">
                                🎉 All student fee accounts are fully cleared!
                              </td>
                            </tr>
                          ) : (
                            feeStats.defaulters.map((d) => {
                              const isSent = notifiedParents.has(d.studentId);
                              const waUrl = createWhatsAppUrl(
                                d.phone,
                                formatFeeReminderMessage({
                                  studentName: d.studentName,
                                  admissionNo: d.admissionNo,
                                  className: d.className,
                                  schoolName: instituteName,
                                  dueAmount: d.due,
                                  dueMonthsCount: d.months,
                                  originUrl,
                                  studentId: d.studentId,
                                })
                              );

                              return (
                                <tr key={d.studentId} className="hover:bg-slate-50 transition">
                                  <td className="p-3 font-bold text-slate-900">
                                    {d.studentName}
                                    <span className="text-[10px] font-mono font-normal text-slate-400 block">
                                      {d.admissionNo}
                                    </span>
                                  </td>
                                  <td className="p-3 text-slate-600 font-medium">{d.className}</td>
                                  <td className="p-3 text-amber-700 font-bold">{d.months} Mos</td>
                                  <td className="p-3 font-bold text-rose-600">₹{d.due.toLocaleString("en-IN")}</td>
                                  <td className="p-3 text-right">
                                    {d.phone ? (
                                      <a
                                        href={waUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => setNotifiedParents((p) => new Set(p).add(d.studentId))}
                                        className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                                          isSent
                                            ? "bg-slate-100 text-slate-600 border border-slate-200"
                                            : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                                        }`}
                                      >
                                        <MessageCircle size={12} />
                                        <span>{isSent ? "Sent ✓" : "Remind"}</span>
                                      </a>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-medium">No Phone</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    href="/fees"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2 text-xs font-bold text-white transition shadow-sm"
                  >
                    <span>Open Fee Manager & Receipts</span>
                    <ExternalLink size={13} />
                  </Link>
                  <button
                    onClick={() => setActiveReport(null)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                  >
                    Close Report
                  </button>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------- */}
            {/* 3. STUDENT ENROLLMENT & DEMOGRAPHICS                     */}
            {/* -------------------------------------------------------- */}
            {activeReport === "students" && (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-3.5">
                    <span className="text-[10px] text-purple-800 uppercase font-semibold">Total Students</span>
                    <p className="text-2xl font-black text-slate-900 mt-0.5">{studentStats.total}</p>
                  </div>
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-3.5">
                    <span className="text-[10px] text-cyan-800 uppercase font-semibold">Boys</span>
                    <p className="text-2xl font-black text-cyan-700 mt-0.5">{studentStats.boys}</p>
                  </div>
                  <div className="rounded-2xl border border-pink-200 bg-pink-50/70 p-3.5">
                    <span className="text-[10px] text-pink-800 uppercase font-semibold">Girls</span>
                    <p className="text-2xl font-black text-pink-700 mt-0.5">{studentStats.girls}</p>
                  </div>
                </div>

                {/* Class Distribution Table */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Class-By-Class Capacity & Enrollment
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {studentStats.classDistribution.map((c) => (
                      <div key={c.name} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3 text-center">
                        <span className="text-xs font-bold text-slate-800 block">{c.name}</span>
                        <p className="text-xl font-black text-purple-700 mt-1">{c.count}</p>
                        <span className="text-[10px] text-slate-500 font-medium">Enrolled Students</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    href="/students"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white transition shadow-sm"
                  >
                    <span>Open Student Directory</span>
                    <ExternalLink size={13} />
                  </Link>
                  <button
                    onClick={() => setActiveReport(null)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                  >
                    Close Report
                  </button>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------- */}
            {/* 4. FINANCIAL SURPLUS & EXPENSES (P&L)                    */}
            {/* -------------------------------------------------------- */}
            {activeReport === "finances" && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5">
                    <span className="text-[10px] text-emerald-800 uppercase font-semibold">Total Revenue (Fees)</span>
                    <p className="text-2xl font-black text-emerald-700 mt-0.5">
                      ₹{financePulse.income.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5">
                    <span className="text-[10px] text-rose-800 uppercase font-semibold">Total Outflow (Expenses)</span>
                    <p className="text-2xl font-black text-rose-700 mt-0.5">
                      ₹{financePulse.expense.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-3.5">
                    <span className="text-[10px] text-cyan-800 uppercase font-semibold">Net Operating Surplus</span>
                    <p className="text-2xl font-black text-cyan-800 mt-0.5">
                      ₹{financePulse.net.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>

                {/* Recent Expense Entries */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Recent Institutional Kharcha & Outflows
                  </h4>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {expenseList.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-500 font-medium">
                        No expenses logged for this month yet.
                      </div>
                    ) : (
                      expenseList.map((x) => (
                        <div
                          key={x.id}
                          className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white shadow-xs text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900">{x.title}</span>
                            <span className="text-[10px] text-slate-500 block font-medium">
                              {x.category || "General"} &bull; {x.expense_date}
                            </span>
                          </div>
                          <strong className="text-rose-600 font-black">₹{Number(x.amount).toLocaleString("en-IN")}</strong>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    href="/expenses"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white transition shadow-sm"
                  >
                    <span>Manage All Expenses</span>
                    <ExternalLink size={13} />
                  </Link>
                  <button
                    onClick={() => setActiveReport(null)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                  >
                    Close Report
                  </button>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------- */}
            {/* 5. ACADEMIC EXAMS REPORT                                 */}
            {/* -------------------------------------------------------- */}
            {activeReport === "exams" && (
              <div className="space-y-5">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Scheduled & Completed Examinations
                  </h4>
                  <div className="space-y-2.5">
                    {examsList.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500 font-medium">
                        No exams recorded yet in this academic session.
                      </div>
                    ) : (
                      examsList.map((e) => (
                        <div
                          key={e.id}
                          className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-white shadow-xs"
                        >
                          <div>
                            <span className="font-bold text-sm text-slate-900">{e.name}</span>
                            <span className="text-[11px] text-slate-500 block font-mono">
                              Date: {e.exam_date || "Not set"}
                            </span>
                          </div>
                          <Link
                            href={`/exams/${e.id}/marksheets`}
                            className="inline-flex items-center gap-1 rounded-xl bg-cyan-600 hover:bg-cyan-700 px-3 py-1.5 text-xs font-bold text-white transition shadow-sm"
                          >
                            <Printer size={13} />
                            <span>Print Marksheets</span>
                          </Link>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    href="/exams"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 px-4 py-2 text-xs font-bold text-white transition shadow-sm"
                  >
                    <span>Open Exam Center</span>
                    <ExternalLink size={13} />
                  </Link>
                  <button
                    onClick={() => setActiveReport(null)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                  >
                    Close Report
                  </button>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------- */}
            {/* 6. SMART PVC ID CARDS & GATE KIOSK REPORT                */}
            {/* -------------------------------------------------------- */}
            {activeReport === "idcards" && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-center">
                  <div className="rounded-2xl border border-pink-200 bg-pink-50/70 p-4">
                    <span className="text-[10px] text-pink-800 uppercase font-bold tracking-wider">
                      Batch Printing Layouts
                    </span>
                    <p className="text-xl font-black text-slate-900 mt-1">8, 9, 10 Cards / Sheet</p>
                    <span className="text-[11px] text-slate-600 font-medium mt-0.5 block">
                      With scissor cut guides (✂ CUT)
                    </span>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <span className="text-[10px] text-emerald-800 uppercase font-bold tracking-wider">
                      Color Print Fidelity
                    </span>
                    <p className="text-xl font-black text-emerald-700 mt-1">100% Color-Locked</p>
                    <span className="text-[11px] text-slate-600 font-medium mt-0.5 block">
                      Gradient borders & sharp text
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-xs text-slate-700 space-y-2">
                  <p className="font-bold text-slate-900">💡 Gate QR Scanner & ID Card Printing Tips:</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                    <li>Every ID card features an optical high-contrast 100px QR Code.</li>
                    <li>Students can show their card to any tablet/phone at the school entrance.</li>
                    <li>The scanner logs attendance as Present and alerts gatekeepers of any fee dues immediately.</li>
                  </ul>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex gap-2">
                    <Link
                      href="/id-cards"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-pink-600 hover:bg-pink-700 px-4 py-2 text-xs font-bold text-white transition shadow-sm"
                    >
                      <Printer size={13} />
                      <span>Print ID Cards</span>
                    </Link>
                    <Link
                      href="/attendance"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white transition shadow-sm"
                    >
                      <QrCode size={13} />
                      <span>Launch Kiosk</span>
                    </Link>
                  </div>
                  <button
                    onClick={() => setActiveReport(null)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                  >
                    Close Report
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
