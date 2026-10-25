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
  Receipt,
  CreditCard,
  ScrollText,
  CalendarDays,
  LogOut,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { ALL_SYSTEM_PERMISSIONS } from "@/lib/auth/permissions";

const ALL_NAV_ITEMS = [
  { label: "Dashboard", href: "/staff-dashboard", icon: LayoutDashboard, required: [] as string[] },
  { label: "Attendance", href: "/attendance", icon: ClipboardCheck, required: ["attendance.view", "attendance.manage"] },
  { label: "Students", href: "/students", icon: Users, required: ["students.view", "students.manage", "admissions.manage"] },
  { label: "Fees & Dues", href: "/fees", icon: WalletCards, required: ["fees.view", "fees.manage", "fees.receipts"] },
  { label: "Expenses", href: "/expenses", icon: Receipt, required: ["expenses.view", "expenses.manage", "settings.manage"] },
  { label: "Exams & Results", href: "/exams", icon: FileText, required: ["exams.view", "exams.manage", "results.manage"] },
  { label: "Smart PVC ID Cards", href: "/id-cards", icon: CreditCard, required: ["idcards.manage", "students.view", "students.manage"] },
  { label: "Certificates (TC)", href: "/certificates", icon: ScrollText, required: ["certificates.manage", "students.manage", "students.view"] },
  { label: "Class Homework", href: "/homework", icon: BookOpen, required: ["homework.manage", "students.view"] },
  { label: "Class Timetable", href: "/timetable", icon: CalendarDays, required: ["timetable.manage", "settings.manage"] },
  { label: "Teachers Directory", href: "/teachers", icon: GraduationCap, required: ["teachers.view", "teachers.manage"] },
  { label: "Notice Board", href: "/notices", icon: Bell, required: ["notices.manage", "students.view", "attendance.view"] },
  { label: "Academics & Classes", href: "/academics", icon: Settings, required: ["settings.manage", "students.manage"] },
];

type Profile = {
  id: string;
  full_name: string;
  login_id: string | null;
  organization_id: string;
  role: string;
  phone: string | null;
  organizations: { name: string } | null;
};

type LiveStats = {
  students: number;
  teachers: number;
  attendance: number | null;
  fees: number;
  expenses: number;
  exams: number;
  notices: number;
};

export default function StaffDashboard() {
  const supabase = createClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<LiveStats>({
    students: 0,
    teachers: 0,
    attendance: null,
    fees: 0,
    expenses: 0,
    exams: 0,
    notices: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
          .select("id, full_name, login_id, organization_id, role, phone, organizations(name)")
          .eq("id", user.id)
          .single();

        if (pError || !p) {
          setError("We couldn't load your staff workspace profile.");
          setLoading(false);
          return;
        }

        setProfile(p as unknown as Profile);
        const orgId = p.organization_id;
        const role = String(p.role || "").trim().toLowerCase();
        const isAdmin = role === "owner" || role === "admin";

        if (isAdmin) {
          window.location.replace("/dashboard");
          return;
        }

        // Fetch permissions for staff
        const { data: grants } = await supabase
          .from("staff_permissions")
          .select("permissions(code)")
          .eq("staff_id", user.id)
          .eq("organization_id", orgId)
          .eq("enabled", true);

        const granted = new Set(
          (grants ?? [])
            .map((g: any) => g.permissions?.code)
            .filter(Boolean) as string[]
        );

        setPermissions(granted);

        // Fetch live stats only for modules they are permitted to view
        const today = new Date().toISOString().slice(0, 10);
        const monthStart = new Date();
        monthStart.setDate(1);
        const monthDate = monthStart.toISOString().slice(0, 10);

        const canCheck = (codes: string[]) => codes.some((c) => granted.has(c));

        const [studentsRes, teachersRes, attendanceRes, feesRes, expensesRes, examsRes, noticesRes] =
          await Promise.all([
            canCheck(["students.view", "students.manage", "admissions.manage"])
              ? supabase
                  .from("students")
                  .select("id", { count: "exact", head: true })
                  .eq("organization_id", orgId)
                  .eq("status", "active")
              : Promise.resolve({ count: 0 }),

            canCheck(["teachers.view", "teachers.manage"])
              ? supabase
                  .from("teachers")
                  .select("id", { count: "exact", head: true })
                  .eq("organization_id", orgId)
              : Promise.resolve({ count: 0 }),

            canCheck(["attendance.view", "attendance.manage"])
              ? supabase
                  .from("attendance")
                  .select("status")
                  .eq("organization_id", orgId)
                  .eq("attendance_date", today)
              : Promise.resolve({ data: [] }),

            canCheck(["fees.view", "fees.manage", "fees.receipts"])
              ? supabase
                  .from("fee_payments")
                  .select("amount")
                  .eq("organization_id", orgId)
                  .gte("paid_on", monthDate)
              : Promise.resolve({ data: [] }),

            canCheck(["expenses.view", "expenses.manage", "settings.manage"])
              ? supabase
                  .from("expenses")
                  .select("amount")
                  .eq("organization_id", orgId)
                  .gte("expense_date", monthDate)
              : Promise.resolve({ data: [] }),

            canCheck(["exams.view", "exams.manage", "results.manage"])
              ? supabase
                  .from("exams")
                  .select("id", { count: "exact", head: true })
                  .eq("organization_id", orgId)
              : Promise.resolve({ count: 0 }),

            canCheck(["notices.manage", "students.view", "attendance.view"])
              ? supabase
                  .from("notices")
                  .select("id", { count: "exact", head: true })
                  .eq("organization_id", orgId)
              : Promise.resolve({ count: 0 }),
          ]);

        const present =
          attendanceRes.data?.filter((x: { status: string }) => x.status === "present").length ?? 0;
        const marked =
          attendanceRes.data?.filter(
            (x: { status: string }) => x.status === "present" || x.status === "absent"
          ).length ?? 0;

        setStats({
          students: studentsRes.count ?? 0,
          teachers: teachersRes.count ?? 0,
          attendance: marked ? Math.round((present / marked) * 1000) / 10 : null,
          fees: (feesRes.data ?? []).reduce((sum, r) => sum + Number(r.amount ?? 0), 0),
          expenses: (expensesRes.data ?? []).reduce((sum, r) => sum + Number(r.amount ?? 0), 0),
          exams: examsRes.count ?? 0,
          notices: noticesRes.count ?? 0,
        });
      } catch (e: any) {
        setError(e.message || "Failed to load workspace.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLogout = async () => {
    if (confirm("Are you sure you want to log out?")) {
      await supabase.auth.signOut();
      window.location.href = "/login";
    }
  };

  const can = (code: string) => permissions.has(code);
  const canAny = (codes: string[]) => codes.some((c) => permissions.has(c));

  // Filter navigation items
  const visibleNav = useMemo(() => {
    return ALL_NAV_ITEMS.filter(
      (item) => item.href === "/staff-dashboard" || canAny(item.required)
    );
  }, [permissions]);

  // List of active feature names assigned to this staff
  const assignedFeatureNames = useMemo(() => {
    return ALL_SYSTEM_PERMISSIONS.filter((p) => permissions.has(p.code)).map((p) => p.name);
  }, [permissions]);

  const instituteName = profile?.organizations?.name || "EduTechLab Institute";
  const staffRole = (profile?.role || "Staff")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-xs font-medium text-slate-500">Loading your staff portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#f8fafc] text-slate-800">
      {/* Soft Ambient Mesh Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-indigo-200/35 blur-3xl" />
        <div className="absolute top-1/4 -right-40 h-[420px] w-[420px] rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 h-[450px] w-[450px] rounded-full bg-emerald-200/25 blur-3xl" />
      </div>

      {/* Sidebar Navigation for Desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl transition-transform lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-xs">
                <Sparkles size={16} />
              </div>
              <span className="text-base font-bold text-slate-900 tracking-tight">EduTechLab</span>
            </div>
            <p className="mt-1 max-w-[190px] truncate text-xs font-medium text-slate-500" title={instituteName}>
              {instituteName}
            </p>
          </div>
          <button className="lg:hidden text-slate-500 hover:text-slate-800" onClick={() => setMobileMenuOpen(false)}>
            <X size={19} />
          </button>
        </div>

        {/* Staff Identity Capsule */}
        <div className="mt-4 rounded-xl border border-slate-200/70 bg-slate-50/70 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Staff Account</p>
          <p className="mt-0.5 truncate text-sm font-bold text-slate-900">{profile?.full_name}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200/60">
              {staffRole}
            </span>
            <span className="font-mono text-[11px] text-slate-500">{profile?.login_id || "STAFF"}</span>
          </div>
        </div>

        {/* Dynamic Navigation Links based on Permissions */}
        <div className="mt-5 flex-1 overflow-y-auto">
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Assigned Modules ({visibleNav.length - 1})
          </p>
          <nav className="space-y-1">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === "/staff-dashboard";
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    isActive
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Logout Button */}
        <div className="border-t border-slate-100 pt-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 px-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={18} />
            </button>
            <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <span>{instituteName}</span>
              <ChevronRight size={14} />
              <span className="font-semibold text-slate-900">Staff Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-bold text-slate-900">{profile?.full_name}</p>
              <p className="text-[11px] text-slate-500">{staffRole}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 text-xs font-bold text-white shadow-xs">
              {(profile?.full_name || "S").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl p-5 sm:p-8">
          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          {/* Welcome Banner Card */}
          <div className="rounded-3xl border border-slate-200/80 bg-white/85 p-6 shadow-xs backdrop-blur-xl">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50/80 px-3 py-1 text-[11px] font-bold text-indigo-700">
                  <ShieldCheck size={13} /> {staffRole} Portal
                </span>
                <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  Welcome back, {profile?.full_name?.split(" ")[0]}!
                </h1>
                <p className="mt-1 text-xs text-slate-500">
                  You are logged into <strong className="text-slate-800">{instituteName}</strong>. You can view
                  and manage the modules assigned to you by your School Administrator.
                </p>
              </div>

              <div className="flex flex-col items-start gap-1 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:items-end">
                <span className="text-[11px] font-medium text-slate-500">Your Staff Login ID</span>
                <span className="font-mono text-sm font-bold text-indigo-700">{profile?.login_id || "STAFF-ID"}</span>
              </div>
            </div>

            {/* Assigned Permissions Badges */}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Your Assigned Permissions ({assignedFeatureNames.length})
              </p>
              {assignedFeatureNames.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {assignedFeatureNames.map((name) => (
                    <span
                      key={name}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs"
                    >
                      ✓ {name}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800">
                  <ShieldAlert size={16} className="text-amber-600 shrink-0" />
                  <span>
                    No modules or permissions have been assigned to your account yet. Please contact your School Administrator to grant feature access.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Dynamic Stat KPI Cards (Only permitted modules) */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {canAny(["attendance.view", "attendance.manage"]) && (
              <div className="group rounded-2xl border border-rose-200/80 bg-white/90 p-5 shadow-xs backdrop-blur-xl transition hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Today Attendance</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                    <ClipboardCheck size={16} />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  {stats.attendance !== null ? `${stats.attendance}%` : "Not Marked"}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Daily student presence</span>
                  <Link
                    href="/attendance"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline"
                  >
                    Mark <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            )}

            {canAny(["students.view", "students.manage", "admissions.manage"]) && (
              <div className="group rounded-2xl border border-indigo-200/80 bg-white/90 p-5 shadow-xs backdrop-blur-xl transition hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Active Students</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Users size={16} />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-black text-slate-900">{stats.students.toLocaleString()}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Enrolled student strength</span>
                  <Link
                    href="/students"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline"
                  >
                    Directory <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            )}

            {canAny(["fees.view", "fees.manage", "fees.receipts"]) && (
              <div className="group rounded-2xl border border-emerald-200/80 bg-white/90 p-5 shadow-xs backdrop-blur-xl transition hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Fees Collected (Month)</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <WalletCards size={16} />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  ₹{stats.fees.toLocaleString("en-IN")}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Payments recorded</span>
                  <Link
                    href="/fees"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:underline"
                  >
                    Collect <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            )}

            {canAny(["expenses.view", "expenses.manage"]) && (
              <div className="group rounded-2xl border border-amber-200/80 bg-white/90 p-5 shadow-xs backdrop-blur-xl transition hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Expenses (Month)</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Receipt size={16} />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-black text-slate-900">
                  ₹{stats.expenses.toLocaleString("en-IN")}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">School vouchers</span>
                  <Link
                    href="/expenses"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:underline"
                  >
                    Manage <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Quick Action Tiles Grid */}
          <div className="mt-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Available Workspaces</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {can("attendance.manage") && (
                <Link
                  href="/attendance"
                  className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-xs transition hover:border-rose-300 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                    <ClipboardCheck size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Take Daily Attendance</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Mark present, absent & send 1-click WhatsApp alerts to parents.
                    </p>
                  </div>
                </Link>
              )}

              {can("homework.manage") && (
                <Link
                  href="/homework"
                  className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-xs transition hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Class Homework & Diary</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Assign daily homework, topics and study material for classes.
                    </p>
                  </div>
                </Link>
              )}

              {can("fees.manage") && (
                <Link
                  href="/fees"
                  className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-xs transition hover:border-emerald-300 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <WalletCards size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Fee Collection & Receipts</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Record student fee payments and generate instant print receipts.
                    </p>
                  </div>
                </Link>
              )}

              {canAny(["exams.view", "results.manage"]) && (
                <Link
                  href="/exams"
                  className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-xs transition hover:border-purple-300 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Exams & Marksheets</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Enter student marks, generate report cards & publish results.
                    </p>
                  </div>
                </Link>
              )}

              {can("idcards.manage") && (
                <Link
                  href="/id-cards"
                  className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-xs transition hover:border-sky-300 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Smart PVC ID Cards</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Preview student identity cards and print high-res batch cards.
                    </p>
                  </div>
                </Link>
              )}

              {can("certificates.manage") && (
                <Link
                  href="/certificates"
                  className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-xs transition hover:border-amber-300 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <ScrollText size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Issue Certificates (TC)</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Generate official Transfer, Bonafide & Character certificates.
                    </p>
                  </div>
                </Link>
              )}

              {can("timetable.manage") && (
                <Link
                  href="/timetable"
                  className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-xs transition hover:border-indigo-300 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <CalendarDays size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Class Timetable</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      View class schedule routines and subject periods.
                    </p>
                  </div>
                </Link>
              )}

              {can("notices.manage") && (
                <Link
                  href="/notices"
                  className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-xs transition hover:border-teal-300 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                    <Bell size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Notice Board</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Post official circulars and push announcements to parents.
                    </p>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
