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
  Check,
  Search,
  Building2,
  Clock,
  TrendingDown,
  Layers,
  UserCheck,
  UserX,
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
  | "staff"
  | "classes"
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
  const [currentSessionName, setCurrentSessionName] = useState<string>("");
  const [activeStudents, setActiveStudents] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<{ id: string; name: string }[]>([]);
  const [teachersCount, setTeachersCount] = useState<number>(0);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [feePaymentsList, setFeePaymentsList] = useState<any[]>([]);
  const [feeDuesList, setFeeDuesList] = useState<any[]>([]);
  const [monthlyExpense, setMonthlyExpense] = useState<number>(0);
  const [expenseList, setExpenseList] = useState<any[]>([]);
  const [examsList, setExamsList] = useState<any[]>([]);
  const [teachersList, setTeachersList] = useState<
    { id: string; full_name: string; phone?: string | null; email?: string | null }[]
  >([]);
  const [teacherAttendance, setTeacherAttendance] = useState<Record<string, string>>({});
  const [teacherFilter, setTeacherFilter] = useState<"all" | "present" | "absent">("all");
  const [cutoffTime, setCutoffTime] = useState<string>("09:30");
  const [instituteType, setInstituteType] = useState<string>("school");
  const [recentNotices, setRecentNotices] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isEnforcingCutoff, setIsEnforcingCutoff] = useState<boolean>(false);
  const [todayDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Interactive Report Modal State
  const [activeReport, setActiveReport] = useState<ActiveReportType>(null);
  const [modalSearchQuery, setModalSearchQuery] = useState<string>("");
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
          sesRes,
          tAttRes,
          setRes,
          notRes,
        ] = await Promise.all([
          supabase
            .from("students")
            .select("id,first_name,last_name,admission_no,gender,class_id,phone,guardian_phone,created_at")
            .eq("organization_id", orgId)
            .eq("status", "active")
            .order("created_at", { ascending: false }),
          supabase.from("classes").select("id,name").eq("organization_id", orgId).order("sort_order"),
          supabase.from("teachers").select("id,full_name,phone,email").eq("organization_id", orgId).order("full_name"),
          supabase.from("attendance").select("student_id,status").eq("organization_id", orgId).eq("attendance_date", today),
          supabase.from("fee_payments").select("id,amount,method,paid_on,student_id,created_at").eq("organization_id", orgId).gte("paid_on", monthDate).order("created_at", { ascending: false }),
          supabase.from("student_fee_months").select("student_id,amount_due,amount_paid,status,fee_month").eq("organization_id", orgId),
          supabase.rpc("get_institution_subscription", { p_org_id: orgId }),
          supabase.from("students").select("id,first_name,last_name,date_of_birth,class_id").eq("organization_id", orgId).not("date_of_birth", "is", null),
          supabase.from("school_expenses").select("id,title,category,amount,expense_date").eq("organization_id", orgId).gte("expense_date", monthDate),
          supabase.from("exams").select("id,name,exam_date").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(6),
          supabase.from("academic_sessions").select("name,is_current").eq("organization_id", orgId),
          supabase.from("teacher_attendance").select("teacher_id,status").eq("organization_id", orgId).eq("attendance_date", today).then((r) => r, () => ({ data: [], error: null })),
          supabase.from("organization_settings").select("*").eq("organization_id", orgId).maybeSingle(),
          supabase.from("notices").select("id,title,published_at,created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(4),
        ]);

        const currentSes = (sesRes.data || []).find((s: any) => s.is_current);
        if (currentSes) setCurrentSessionName(currentSes.name);

        setActiveStudents(stRes.data || []);
        setClassesList(clRes.data || []);
        setTeachersList(tcRes.data || []);
        setTeachersCount((tcRes.data || []).length);
        setAttendanceRecords(attRes.data || []);
        setFeePaymentsList(payRes.data || []);
        setFeeDuesList(duesRes.data || []);
        setExamsList(examRes.data || []);

        // Load daily teacher attendance
        const loadedTAtt: Record<string, string> = {};
        (tAttRes?.data || []).forEach((r: any) => {
          loadedTAtt[r.teacher_id] = r.status;
        });
        setTeacherAttendance(loadedTAtt);

        if ((setRes?.data as any)?.attendance_cutoff_time) {
          setCutoffTime((setRes.data as any).attendance_cutoff_time);
        }
        if ((setRes?.data as any)?.institute_type) {
          setInstituteType((setRes.data as any).institute_type);
        }
        setRecentNotices(notRes?.data || []);

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

  // Check if current time is past daily attendance cutoff
  const isPastCutoff = useMemo(() => {
    const [ch, cm] = (cutoffTime || "09:30").split(":").map(Number);
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const cutoffMinutes = (isNaN(ch) ? 9 : ch) * 60 + (isNaN(cm) ? 30 : cm);
    return currentMinutes >= cutoffMinutes;
  }, [cutoffTime]);

  // Attendance Analytics (Accurately auto-accounts for absentees after cutoff time)
  const attendanceStats = useMemo(() => {
    const presentIds = new Set(
      attendanceRecords.filter((x) => x.status === "present").map((x) => x.student_id)
    );
    const lateIds = new Set(
      attendanceRecords.filter((x) => x.status === "late").map((x) => x.student_id)
    );
    const leaveIds = new Set(
      attendanceRecords.filter((x) => x.status === "leave").map((x) => x.student_id)
    );
    const explicitlyAbsentIds = new Set(
      attendanceRecords.filter((x) => x.status === "absent").map((x) => x.student_id)
    );

    const present = presentIds.size;
    const late = lateIds.size;
    const leave = leaveIds.size;

    // After cutoff time, any student without present/late/leave is automatically considered absent
    const effectiveAbsentStudents = activeStudents.filter((s) => {
      if (explicitlyAbsentIds.has(s.id)) return true;
      if (isPastCutoff && !presentIds.has(s.id) && !lateIds.has(s.id) && !leaveIds.has(s.id)) {
        return true;
      }
      return false;
    });

    const absent = effectiveAbsentStudents.length;
    const totalActive = activeStudents.length;
    const marked = present + absent + late + leave;
    const rate = totalActive > 0 ? Math.round((present / totalActive) * 100) : 0;

    // Class wise presence percentage
    const classBreakdown = classesList.map((c) => {
      const classStudents = activeStudents.filter((s) => s.class_id === c.id);
      const studentIds = new Set(classStudents.map((s) => s.id));
      const classPresent = attendanceRecords.filter(
        (x) => studentIds.has(x.student_id) && x.status === "present"
      ).length;
      return {
        className: c.name,
        total: classStudents.length,
        present: classPresent,
        rate: classStudents.length > 0 ? Math.round((classPresent / classStudents.length) * 100) : 0,
      };
    });

    return {
      present,
      absent,
      late,
      leave,
      marked,
      rate,
      absentStudents: effectiveAbsentStudents,
      classBreakdown,
    };
  }, [attendanceRecords, activeStudents, classesList, isPastCutoff]);

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

  // Best & Worst Attendance Classes for Today
  const bestAndWorstClasses = useMemo(() => {
    if (!classesList.length) return { best: null, worst: null };
    const valid = attendanceStats.classBreakdown.filter((c) => c.total > 0);
    if (!valid.length) return { best: null, worst: null };

    const sorted = [...valid].sort((a, b) => b.rate - a.rate);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    return { best, worst };
  }, [classesList, attendanceStats.classBreakdown]);

  // Faculty / Teacher Attendance Analytics
  const teacherStats = useMemo(() => {
    const total = teachersList.length;
    const present = teachersList.filter((t) => teacherAttendance[t.id] === "present").length;
    const absent = teachersList.filter((t) => teacherAttendance[t.id] === "absent").length;
    const leave = teachersList.filter((t) => teacherAttendance[t.id] === "leave").length;
    const unmarked = total - present - absent - leave;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, leave, unmarked, rate };
  }, [teachersList, teacherAttendance]);

  // Fee Collection Rates
  const feeTotalExpected = feeStats.totalCollected + feeStats.totalOutstanding;
  const feeCollectedRate =
    feeTotalExpected > 0
      ? Math.round((feeStats.totalCollected / feeTotalExpected) * 100)
      : feeStats.totalCollected > 0
      ? 100
      : 0;

  // Real-Time Recent Activities feed
  const recentActivities = useMemo(() => {
    const items: Array<{
      id: string;
      icon: "user" | "fee" | "attendance" | "notice";
      title: string;
      subtitle: string;
      time: string;
    }> = [];

    // Latest student
    if (activeStudents.length > 0) {
      const latestSt = activeStudents[0];
      const cName = latestSt.class_id ? classMap.get(latestSt.class_id) || "Class" : "Class";
      items.push({
        id: "st-" + latestSt.id,
        icon: "user",
        title: `New student added — ${latestSt.first_name} ${latestSt.last_name || ""}`.trim(),
        subtitle: `${cName} • Adm No: ${latestSt.admission_no}`,
        time: latestSt.created_at ? new Date(latestSt.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Today",
      });
    }

    // Latest fee payment
    if (feePaymentsList.length > 0) {
      const latestPay = feePaymentsList[0];
      const payStudent = activeStudents.find((s) => s.id === latestPay.student_id);
      const sName = payStudent ? `${payStudent.first_name} ${payStudent.last_name || ""}`.trim() : "Student";
      const cName = payStudent?.class_id ? classMap.get(payStudent.class_id) || "" : "";
      items.push({
        id: "pay-" + latestPay.id,
        icon: "fee",
        title: `Fee received — ₹${Number(latestPay.amount).toLocaleString("en-IN")}`,
        subtitle: `${sName}${cName ? ` (${cName})` : ""} via ${String(latestPay.method || "cash").toUpperCase()}`,
        time: latestPay.created_at ? new Date(latestPay.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Today",
      });
    }

    // Attendance activity
    if (attendanceStats.marked > 0) {
      const best = bestAndWorstClasses.best;
      items.push({
        id: "att-today",
        icon: "attendance",
        title: `Attendance marked — ${best ? `${best.className} (${best.rate}%)` : `School Wide (${attendanceStats.rate}%)`}`,
        subtitle: `${attendanceStats.present} Present • ${attendanceStats.absent} Absent • ${attendanceStats.marked} Total`,
        time: "Today",
      });
    }

    // Latest notice
    if (recentNotices.length > 0) {
      const n = recentNotices[0];
      items.push({
        id: "not-" + n.id,
        icon: "notice",
        title: `Notice published — ${n.title}`,
        subtitle: `Official school circular active for parents & staff`,
        time: n.published_at ? new Date(n.published_at).toLocaleDateString([], { month: "short", day: "numeric" }) : "Recent",
      });
    }

    return items;
  }, [activeStudents, feePaymentsList, attendanceStats, bestAndWorstClasses, recentNotices, classMap]);

  // Toggle teacher attendance
  const handleToggleTeacher = async (teacherId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "present" ? "absent" : "present";
    setTeacherAttendance((prev) => ({
      ...prev,
      [teacherId]: nextStatus,
    }));

    try {
      let rpcWorked = false;
      try {
        const { data, error } = await supabase.rpc("mark_teacher_attendance", {
          p_teacher_id: teacherId,
          p_org_id: profile?.organization_id,
          p_date: todayDate,
          p_status: nextStatus,
        });
        if (!error && data?.success) rpcWorked = true;
      } catch {}

      if (!rpcWorked) {
        await supabase.from("teacher_attendance").upsert(
          {
            organization_id: profile?.organization_id,
            teacher_id: teacherId,
            attendance_date: todayDate,
            status: nextStatus,
          },
          { onConflict: "teacher_id,attendance_date" }
        );
      }
    } catch (err) {
      console.warn("Failed to toggle teacher attendance:", err);
    }
  };

  // Mark all teachers present
  const handleMarkAllTeachersPresent = async () => {
    if (teachersList.length === 0) return;
    const nextMap: Record<string, string> = {};
    teachersList.forEach((t) => {
      nextMap[t.id] = "present";
    });
    setTeacherAttendance(nextMap);

    try {
      const batch = teachersList.map((t) => ({
        teacher_id: t.id,
        status: "present",
      }));

      let rpcWorked = false;
      try {
        const { data, error } = await supabase.rpc("save_batch_teacher_attendance", {
          p_records: batch,
          p_org_id: profile?.organization_id,
          p_date: todayDate,
        });
        if (!error && data?.success) rpcWorked = true;
      } catch {}

      if (!rpcWorked) {
        const upsertRows = teachersList.map((t) => ({
          organization_id: profile?.organization_id,
          teacher_id: t.id,
          attendance_date: todayDate,
          status: "present",
        }));
        await supabase.from("teacher_attendance").upsert(upsertRows, { onConflict: "teacher_id,attendance_date" });
      }
    } catch (err) {
      console.warn("Failed to mark all teachers present:", err);
    }
  };

  // Auto-Mark remaining students absent after cutoff
  const handleEnforceCutoffDashboard = async () => {
    setIsEnforcingCutoff(true);
    try {
      const unmarkedStudents = activeStudents.filter(
        (s) => !attendanceRecords.some((a) => a.student_id === s.id)
      );
      if (unmarkedStudents.length === 0) {
        alert("All enrolled students already have attendance recorded for today.");
        return;
      }

      let rpcWorked = false;
      try {
        const { data, error } = await supabase.rpc("enforce_attendance_cutoff", {
          p_org_id: profile?.organization_id,
          p_date: todayDate,
        });
        if (!error && data?.success) rpcWorked = true;
      } catch {}

      if (!rpcWorked) {
        const recordsToInsert = unmarkedStudents.map((st) => ({
          organization_id: profile?.organization_id,
          student_id: st.id,
          attendance_date: todayDate,
          status: "absent",
          note: `Auto-marked absent (Cutoff ${cutoffTime} passed)`,
        }));
        await supabase.from("attendance").upsert(recordsToInsert, { onConflict: "student_id,attendance_date" });
      }

      setAttendanceRecords((prev) => [
        ...prev,
        ...unmarkedStudents.map((st) => ({ student_id: st.id, status: "absent" })),
      ]);

      alert(`✓ Attendance Cutoff Enforced! ${unmarkedStudents.length} students placed in Absent list.`);
      setActiveReport("attendance");
    } catch (err: any) {
      alert("Failed to enforce cutoff: " + (err?.message || "Unknown error"));
    } finally {
      setIsEnforcingCutoff(false);
    }
  };

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
        {/* Top Header Matching Screenshot */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 sm:px-6 backdrop-blur-2xl shadow-xs gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden text-slate-600 hover:text-slate-900 p-1.5 rounded-xl hover:bg-slate-100 transition"
              onClick={() => setOpen(true)}
              aria-label="Toggle Navigation"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 border border-amber-200 text-amber-700 shrink-0">
                <Building2 size={20} />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 truncate tracking-tight">
                  {instituteName}
                </h2>
                <p className="text-[11px] text-slate-500 font-medium truncate capitalize">
                  {instituteType} Management System &bull; Active Session: {currentSessionName || "2026-27"}
                </p>
              </div>
            </div>
          </div>

          {/* Central Search Bar (Screenshot Style) */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search student, staff, class..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-16 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white transition"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-400">
                Ctrl + K
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Notification Bell */}
            <Link
              href="/notices"
              className="relative grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
              title="Notices & Notifications"
            >
              <Bell size={18} />
              {recentNotices.length > 0 && (
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
              )}
            </Link>

            {/* Profile Menu Pill */}
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2.5 rounded-full p-1 hover:bg-slate-100 transition"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white shadow-sm">
                  {initials}
                </div>
                <div className="hidden sm:block text-left pr-1">
                  <span className="text-xs font-bold text-slate-900 block leading-tight">Admin</span>
                  <span className="text-[10px] text-slate-500 font-medium block">School Admin</span>
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
        <main className="mx-auto max-w-7xl p-4 sm:p-7 space-y-6">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          {/* Subscription Expiry / Trial Warning Pill (If applicable) */}
          {subInfo && (subInfo.is_expired || subInfo.is_trial) && (
            <div
              className={`rounded-2xl border px-4 py-2.5 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs font-semibold ${
                subInfo.is_expired
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={15} />
                <span>
                  {subInfo.is_expired
                    ? "Subscription expired. Please renew to avoid interruption."
                    : `Free Trial Active (${subInfo.days_remaining} Days Remaining) • ${activeStudents.length}/${subInfo.student_limit} Students Quota`}
                </span>
              </div>
              <Link
                href="/subscription"
                className="underline underline-offset-2 hover:text-purple-700 font-bold"
              >
                Manage Subscription →
              </Link>
            </div>
          )}

          {/* WELCOME BAR & DATE PILL (MATCHING SCREENSHOT) */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Welcome, {firstName}</span>
                <span>👋</span>
              </h1>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium">
                Here&apos;s what&apos;s happening at your school today.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs">
                <Calendar size={14} className="text-purple-600" />
                <span>
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <ChevronRight size={14} className="text-slate-400 rotate-90" />
              </div>
            </div>
          </div>

          {/* TOP 5 METRIC KPI TILES (HIGH-DEFINITION CRYSTAL GLASSMORPHISM) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
            {/* 1. Total Students */}
            <div
              onClick={() => {
                setModalSearchQuery("");
                setActiveReport("students");
              }}
              className="group relative cursor-pointer overflow-hidden rounded-3xl border border-white/90 bg-white/75 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl ring-1 ring-slate-900/[0.04] transition-all duration-300 hover:-translate-y-1 hover:bg-white/90 hover:shadow-xl hover:shadow-blue-500/10 hover:border-white"
            >
              {/* Gloss Specular Light Beam */}
              <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-95" />
              {/* Ambient Glow Orb */}
              <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-blue-500/12 blur-2xl transition duration-500 group-hover:bg-blue-500/22 pointer-events-none" />

              <div className="relative z-10 flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/30 ring-2 ring-white/90 group-hover:scale-110 group-hover:rotate-2 transition duration-300">
                  <Users size={19} />
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-700 backdrop-blur-md">
                  ↑ Active
                </span>
              </div>
              <div className="relative z-10 mt-4">
                <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                  {loading ? "—" : activeStudents.length}
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Total Students</span>
                  <span className="text-[10px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    View list →
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Total Staff */}
            <div
              onClick={() => {
                setModalSearchQuery("");
                setActiveReport("staff");
              }}
              className="group relative cursor-pointer overflow-hidden rounded-3xl border border-white/90 bg-white/75 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl ring-1 ring-slate-900/[0.04] transition-all duration-300 hover:-translate-y-1 hover:bg-white/90 hover:shadow-xl hover:shadow-purple-500/10 hover:border-white"
            >
              {/* Gloss Specular Light Beam */}
              <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-95" />
              {/* Ambient Glow Orb */}
              <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-purple-500/12 blur-2xl transition duration-500 group-hover:bg-purple-500/22 pointer-events-none" />

              <div className="relative z-10 flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-md shadow-purple-500/30 ring-2 ring-white/90 group-hover:scale-110 group-hover:rotate-2 transition duration-300">
                  <GraduationCap size={19} />
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 text-[11px] font-extrabold text-purple-700 backdrop-blur-md">
                  Faculty
                </span>
              </div>
              <div className="relative z-10 mt-4">
                <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                  {loading ? "—" : teachersCount}
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Total Staff</span>
                  <span className="text-[10px] font-bold text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    Directory →
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Total Classes */}
            <div
              onClick={() => {
                setModalSearchQuery("");
                setActiveReport("classes");
              }}
              className="group relative cursor-pointer overflow-hidden rounded-3xl border border-white/90 bg-white/75 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl ring-1 ring-slate-900/[0.04] transition-all duration-300 hover:-translate-y-1 hover:bg-white/90 hover:shadow-xl hover:shadow-amber-500/10 hover:border-white"
            >
              {/* Gloss Specular Light Beam */}
              <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-95" />
              {/* Ambient Glow Orb */}
              <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-amber-500/12 blur-2xl transition duration-500 group-hover:bg-amber-500/22 pointer-events-none" />

              <div className="relative z-10 flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/30 ring-2 ring-white/90 group-hover:scale-110 group-hover:rotate-2 transition duration-300">
                  <Layers size={19} />
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-700 backdrop-blur-md">
                  Active
                </span>
              </div>
              <div className="relative z-10 mt-4">
                <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                  {loading ? "—" : classesList.length}
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Total Classes</span>
                  <span className="text-[10px] font-bold text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    Batches →
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Today's Attendance */}
            <div
              onClick={() => {
                setModalSearchQuery("");
                setActiveReport("attendance");
              }}
              className="group relative cursor-pointer overflow-hidden rounded-3xl border border-white/90 bg-white/75 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl ring-1 ring-slate-900/[0.04] transition-all duration-300 hover:-translate-y-1 hover:bg-white/90 hover:shadow-xl hover:shadow-emerald-500/10 hover:border-white"
            >
              {/* Gloss Specular Light Beam */}
              <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-95" />
              {/* Ambient Glow Orb */}
              <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-emerald-500/12 blur-2xl transition duration-500 group-hover:bg-emerald-500/22 pointer-events-none" />

              <div className="relative z-10 flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30 ring-2 ring-white/90 group-hover:scale-110 group-hover:rotate-2 transition duration-300">
                  <Calendar size={19} />
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-700 backdrop-blur-md">
                  Live Rate
                </span>
              </div>
              <div className="relative z-10 mt-4">
                <p className="text-3xl sm:text-4xl font-black text-emerald-700 tracking-tight">
                  {loading ? "—" : attendanceStats.rate !== null ? `${attendanceStats.rate}%` : "0%"}
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Today&apos;s Attendance</span>
                  <span className="text-[10px] font-bold text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    Breakdown →
                  </span>
                </div>
              </div>
            </div>

            {/* 5. Fees Collected */}
            <div
              onClick={() => setActiveReport("fees")}
              className="group relative cursor-pointer overflow-hidden rounded-3xl border border-white/90 bg-white/75 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl ring-1 ring-slate-900/[0.04] transition-all duration-300 hover:-translate-y-1 hover:bg-white/90 hover:shadow-xl hover:shadow-rose-500/10 hover:border-white col-span-2 sm:col-span-1"
            >
              {/* Gloss Specular Light Beam */}
              <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-95" />
              {/* Ambient Glow Orb */}
              <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-rose-500/12 blur-2xl transition duration-500 group-hover:bg-rose-500/22 pointer-events-none" />

              <div className="relative z-10 flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-md shadow-rose-500/30 ring-2 ring-white/90 group-hover:scale-110 group-hover:rotate-2 transition duration-300">
                  <WalletCards size={19} />
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 text-[11px] font-extrabold text-rose-700 backdrop-blur-md">
                  {feeCollectedRate}% rec.
                </span>
              </div>
              <div className="relative z-10 mt-4">
                <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight truncate">
                  {loading ? "—" : `₹${feeStats.totalCollected.toLocaleString("en-IN")}`}
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Fees Collected</span>
                  <span className="text-[10px] font-bold text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    Ledger →
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* MIDDLE FOCUS ROW: ATTENDANCE HIGHLIGHTS (NO GRAPH) + FEE DONUT RING */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: Today's Student Attendance Overview */}
            <div
              onClick={() => setActiveReport("attendance")}
              className="group relative cursor-pointer overflow-hidden rounded-3xl border border-white/90 bg-white/80 p-6 sm:p-7 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-900/[0.04] hover:bg-white/95 hover:border-white hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 flex flex-col justify-between"
            >
              {/* Gloss Specular Light Beam */}
              <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-95" />
              {/* Ambient Glow Orb */}
              <div className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none group-hover:bg-emerald-500/18 transition duration-500" />

              <div className="relative z-10">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100/80">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25 ring-2 ring-white/90">
                      <ClipboardCheck size={20} />
                    </span>
                    <div>
                      <h3 className="font-extrabold text-base text-slate-900 group-hover:text-emerald-700 transition">
                        Today&apos;s Attendance Overview
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Student presence &amp; class-wise performance
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[11px] font-extrabold text-emerald-700 backdrop-blur-md">
                    Live Record
                  </span>
                </div>

                {/* Main Rate and Counters */}
                <div className="mt-5 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider font-extrabold text-slate-400">
                      School-Wide Ratio
                    </span>
                    <div className="flex items-baseline gap-2">
                      <p className="text-4xl font-black text-slate-900 tracking-tight">
                        {attendanceStats.rate !== null ? `${attendanceStats.rate}%` : "Not Marked"}
                      </p>
                      <span className="text-xs font-bold text-emerald-600">
                        ({attendanceStats.present} of {activeStudents.length} present)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="rounded-2xl border border-white/80 bg-white/80 px-3.5 py-2 text-center backdrop-blur-md shadow-2xs ring-1 ring-slate-900/[0.04]">
                      <span className="text-[10px] text-emerald-800 font-bold block">Present</span>
                      <strong className="text-base font-black text-emerald-700">{attendanceStats.present}</strong>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white/80 px-3.5 py-2 text-center backdrop-blur-md shadow-2xs ring-1 ring-slate-900/[0.04]">
                      <span className="text-[10px] text-rose-800 font-bold block">Absent</span>
                      <strong className="text-base font-black text-rose-700">{attendanceStats.absent}</strong>
                    </div>
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div className="mt-4 h-2.5 w-full rounded-full bg-slate-100 overflow-hidden ring-1 ring-slate-200/50">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-full transition-all duration-700"
                    style={{ width: `${attendanceStats.rate || 0}%` }}
                  />
                </div>

                {/* Best & Lowest Attendance Class (User explicitly requested!) */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/80 bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-white/70 p-4 backdrop-blur-md shadow-2xs ring-1 ring-emerald-500/10">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-emerald-900 flex items-center gap-1">
                        🏆 Best Attendance Class
                      </span>
                      <span className="text-xs font-black text-emerald-700 font-mono">
                        {bestAndWorstClasses.best ? `${bestAndWorstClasses.best.rate}%` : "—"}
                      </span>
                    </div>
                    <p className="text-sm font-black text-slate-900 mt-1">
                      {bestAndWorstClasses.best ? bestAndWorstClasses.best.className : "All classes uniform"}
                    </p>
                    <span className="text-[11px] text-emerald-800 font-medium">
                      {bestAndWorstClasses.best
                        ? `${bestAndWorstClasses.best.present} of ${bestAndWorstClasses.best.total} students present`
                        : "No class data"}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-white/80 bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-white/70 p-4 backdrop-blur-md shadow-2xs ring-1 ring-amber-500/10">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-amber-900 flex items-center gap-1">
                        ⚠️ Lowest Attendance Class
                      </span>
                      <span className="text-xs font-black text-amber-700 font-mono">
                        {bestAndWorstClasses.worst ? `${bestAndWorstClasses.worst.rate}%` : "—"}
                      </span>
                    </div>
                    <p className="text-sm font-black text-slate-900 mt-1">
                      {bestAndWorstClasses.worst ? bestAndWorstClasses.worst.className : "No low classes"}
                    </p>
                    <span className="text-[11px] text-amber-800 font-medium">
                      {bestAndWorstClasses.worst
                        ? `${bestAndWorstClasses.worst.present} of ${bestAndWorstClasses.worst.total} students present`
                        : "No absentees"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Click banner */}
              <div className="relative z-10 mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700 group-hover:text-emerald-800">
                <span>View Full Class Breakdown & Absentee List with WhatsApp Alerts</span>
                <ArrowRight size={15} className="group-hover:translate-x-1 transition" />
              </div>
            </div>

            {/* Card 2: Fee Collection Overview (Exact circular Donut Ring chart!) */}
            <div
              onClick={() => setActiveReport("fees")}
              className="group relative cursor-pointer overflow-hidden rounded-3xl border border-white/90 bg-white/80 p-6 sm:p-7 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-900/[0.04] hover:bg-white/95 hover:border-white hover:shadow-xl hover:shadow-teal-500/10 transition-all duration-300 flex flex-col justify-between"
            >
              {/* Gloss Specular Light Beam */}
              <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-95" />
              {/* Ambient Glow Orb */}
              <div className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-teal-500/10 blur-3xl pointer-events-none group-hover:bg-teal-500/18 transition duration-500" />

              <div className="relative z-10">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100/80">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/25 ring-2 ring-white/90">
                      <WalletCards size={20} />
                    </span>
                    <div>
                      <h3 className="font-extrabold text-base text-slate-900 group-hover:text-emerald-700 transition">
                        Fee Collection Overview
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Monthly collection progress &amp; outstanding ledger
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100/90 border border-slate-200/80 px-3 py-1 text-[11px] font-bold text-slate-700 backdrop-blur-md">
                    This Month
                  </span>
                </div>

                {/* Circular Donut Ring Chart + Legend (Matching Screenshot!) */}
                <div className="mt-5 flex flex-col sm:flex-row items-center justify-around gap-6">
                  {/* The SVG Donut Ring */}
                  <div className="relative flex items-center justify-center h-44 w-44 shrink-0">
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        stroke="#e2e8f0"
                        strokeWidth="11"
                        fill="transparent"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        stroke="#10b981"
                        strokeWidth="11"
                        fill="transparent"
                        strokeDasharray={238.76}
                        strokeDashoffset={238.76 - (238.76 * feeCollectedRate) / 100}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                      <span className="text-2xl font-black text-slate-900 tracking-tight">
                        {feeCollectedRate}%
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700">
                        Collected
                      </span>
                    </div>
                  </div>

                  {/* Legend matching screenshot */}
                  <div className="space-y-3.5 min-w-[190px]">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm bg-emerald-500" />
                        <span className="font-bold text-slate-700">Collected</span>
                      </div>
                      <span className="font-black text-slate-900 font-mono">
                        ₹{feeStats.totalCollected.toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm bg-slate-300" />
                        <span className="font-bold text-slate-700">Pending</span>
                      </div>
                      <span className="font-black text-slate-900 font-mono">
                        ₹{feeStats.totalOutstanding.toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-4 text-sm">
                      <span className="font-extrabold text-slate-900">Total</span>
                      <span className="font-black text-slate-900 font-mono">
                        ₹{feeTotalExpected.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Click banner */}
              <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700 group-hover:text-emerald-800">
                <span>View Outstanding Dues & Defaulters List with WhatsApp Reminders</span>
                <ArrowRight size={15} className="group-hover:translate-x-1 transition" />
              </div>
            </div>
          </div>

          {/* TEACHER & STAFF DAILY ATTENDANCE SECTION (CRYSTAL GLASSMORPHISM) */}
          <div className="group relative overflow-hidden rounded-3xl border border-white/90 bg-white/80 p-6 sm:p-7 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-900/[0.04] transition-all duration-300">
            {/* Gloss Specular Light Beam */}
            <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-95" />
            {/* Ambient Glow Orb */}
            <div className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-purple-500/10 blur-3xl pointer-events-none group-hover:bg-purple-500/18 transition duration-500" />

            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100/80 gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-md shadow-purple-500/25 ring-2 ring-white/90">
                      <GraduationCap size={20} />
                    </span>
                    <div>
                      <h3 className="font-extrabold text-base text-slate-900">
                        Teacher &amp; Staff Attendance Today
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Live faculty tracking &bull; Tap status badge to toggle
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-2xl bg-white/90 border border-slate-200/70 p-1 text-xs font-bold text-slate-600 backdrop-blur-md shadow-2xs">
                    <button
                      onClick={() => setTeacherFilter("all")}
                      className={`px-3 py-1 rounded-xl transition ${
                        teacherFilter === "all" ? "bg-slate-900 text-white shadow-xs" : "hover:text-slate-900"
                      }`}
                    >
                      All ({teacherStats.total})
                    </button>
                    <button
                      onClick={() => setTeacherFilter("present")}
                      className={`px-3 py-1 rounded-xl transition ${
                        teacherFilter === "present" ? "bg-emerald-600 text-white shadow-xs" : "hover:text-slate-900"
                      }`}
                    >
                      Present ({teacherStats.present})
                    </button>
                    <button
                      onClick={() => setTeacherFilter("absent")}
                      className={`px-3 py-1 rounded-xl transition ${
                        teacherFilter === "absent" ? "bg-rose-600 text-white shadow-xs" : "hover:text-slate-900"
                      }`}
                    >
                      Absent ({teacherStats.absent})
                    </button>
                  </div>

                  <button
                    onClick={handleMarkAllTeachersPresent}
                    className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-300 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-extrabold text-emerald-800 hover:bg-emerald-500/20 backdrop-blur-md transition active:scale-95"
                  >
                    <UserCheck size={14} className="text-emerald-700" />
                    <span>Mark All Present</span>
                  </button>
                </div>
              </div>

              {/* Teacher Cards Grid */}
              <div className="mt-5">
                {teachersList.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-400 font-medium">
                    No teachers added to the directory yet.{" "}
                    <Link href="/teachers" className="text-purple-600 font-bold underline">
                      Add teachers here
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {teachersList
                      .filter((t) => {
                        const st = teacherAttendance[t.id];
                        if (teacherFilter === "present") return st === "present";
                        if (teacherFilter === "absent") return st === "absent";
                        return true;
                      })
                      .map((t) => {
                        const status = teacherAttendance[t.id] || "unmarked";
                        const tInitials = t.full_name
                          .split(/\s+/)
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase();

                        return (
                          <div
                            key={t.id}
                            className="flex items-center justify-between p-3.5 rounded-2xl border border-white/80 bg-white/70 hover:bg-white/95 hover:border-purple-200/80 shadow-2xs hover:shadow-md backdrop-blur-xl ring-1 ring-slate-900/[0.03] transition-all duration-200"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="grid h-9 w-9 place-items-center rounded-xl bg-purple-100 text-purple-700 text-xs font-bold shrink-0">
                                {tInitials}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-slate-900 truncate">{t.full_name}</h4>
                                <p className="text-[10px] text-slate-400 font-medium truncate">
                                  {t.phone || "Faculty Member"}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleTeacher(t.id, status)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition active:scale-95 ${
                                status === "present"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200"
                                  : status === "absent"
                                  ? "bg-rose-100 text-rose-800 border border-rose-200 hover:bg-rose-200"
                                  : "bg-slate-200/80 text-slate-700 hover:bg-emerald-100 hover:text-emerald-800"
                              }`}
                              title="Click to toggle teacher attendance"
                            >
                              {status === "present" ? (
                                <>
                                  <Check size={11} />
                                  <span>Present</span>
                                </>
                              ) : status === "absent" ? (
                                <>
                                  <X size={11} />
                                  <span>Absent</span>
                                </>
                              ) : (
                                <span>Mark Present</span>
                              )}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* BOTTOM ROW: QUICK REPORTS (CRYSTAL GLASSMORPHISM) + RECENT ACTIVITIES FEED */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Quick Reports */}
            <div className="group relative overflow-hidden lg:col-span-2 rounded-3xl border border-white/90 bg-white/80 p-6 sm:p-7 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-900/[0.04]">
              {/* Gloss Specular Light Beam */}
              <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-95" />
              <div className="relative z-10">
                <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100/80">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-purple-100 text-purple-700">
                    <FileText size={16} />
                  </span>
                  <h3 className="font-extrabold text-base text-slate-900">Quick Reports</h3>
                </div>

                <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  {/* 1. Attendance Report */}
                  <button
                    type="button"
                    onClick={() => setActiveReport("attendance")}
                    className="group/btn relative cursor-pointer overflow-hidden rounded-2xl border border-white/90 bg-white/75 p-4 text-center shadow-[0_4px_20px_rgb(0,0,0,0.02)] backdrop-blur-xl ring-1 ring-slate-900/[0.04] transition-all duration-300 hover:-translate-y-1 hover:bg-white/95 hover:shadow-lg hover:shadow-blue-500/10 hover:border-white flex flex-col items-center justify-center gap-2.5"
                  >
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-90" />
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-white/90 group-hover/btn:scale-110 group-hover/btn:rotate-2 transition duration-300">
                      <Calendar size={18} />
                    </span>
                    <span className="text-xs font-black text-slate-800 group-hover/btn:text-blue-700 transition">Attendance Report</span>
                  </button>

                  {/* 2. Fees Report */}
                  <button
                    type="button"
                    onClick={() => setActiveReport("fees")}
                    className="group/btn relative cursor-pointer overflow-hidden rounded-2xl border border-white/90 bg-white/75 p-4 text-center shadow-[0_4px_20px_rgb(0,0,0,0.02)] backdrop-blur-xl ring-1 ring-slate-900/[0.04] transition-all duration-300 hover:-translate-y-1 hover:bg-white/95 hover:shadow-lg hover:shadow-amber-500/10 hover:border-white flex flex-col items-center justify-center gap-2.5"
                  >
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-90" />
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25 ring-2 ring-white/90 group-hover/btn:scale-110 group-hover/btn:rotate-2 transition duration-300">
                      <WalletCards size={18} />
                    </span>
                    <span className="text-xs font-black text-slate-800 group-hover/btn:text-amber-700 transition">Fees Report</span>
                  </button>

                  {/* 3. Result Report */}
                  <button
                    type="button"
                    onClick={() => setActiveReport("exams")}
                    className="group/btn relative cursor-pointer overflow-hidden rounded-2xl border border-white/90 bg-white/75 p-4 text-center shadow-[0_4px_20px_rgb(0,0,0,0.02)] backdrop-blur-xl ring-1 ring-slate-900/[0.04] transition-all duration-300 hover:-translate-y-1 hover:bg-white/95 hover:shadow-lg hover:shadow-purple-500/10 hover:border-white flex flex-col items-center justify-center gap-2.5"
                  >
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-90" />
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-md shadow-purple-500/25 ring-2 ring-white/90 group-hover/btn:scale-110 group-hover/btn:rotate-2 transition duration-300">
                      <TrendingUp size={18} />
                    </span>
                    <span className="text-xs font-black text-slate-800 group-hover/btn:text-purple-700 transition">Result Report</span>
                  </button>

                  {/* 4. Student Summary */}
                  <button
                    type="button"
                    onClick={() => setActiveReport("students")}
                    className="group/btn relative cursor-pointer overflow-hidden rounded-2xl border border-white/90 bg-white/75 p-4 text-center shadow-[0_4px_20px_rgb(0,0,0,0.02)] backdrop-blur-xl ring-1 ring-slate-900/[0.04] transition-all duration-300 hover:-translate-y-1 hover:bg-white/95 hover:shadow-lg hover:shadow-emerald-500/10 hover:border-white flex flex-col items-center justify-center gap-2.5"
                  >
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-90" />
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25 ring-2 ring-white/90 group-hover/btn:scale-110 group-hover/btn:rotate-2 transition duration-300">
                      <Users size={18} />
                    </span>
                    <span className="text-xs font-black text-slate-800 group-hover/btn:text-emerald-700 transition">Student Summary</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right 1 Col: Recent Activities */}
            <div className="group relative overflow-hidden rounded-3xl border border-white/90 bg-white/80 p-6 sm:p-7 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-900/[0.04]">
              {/* Gloss Specular Light Beam */}
              <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent opacity-95" />
              <div className="relative z-10">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100/80">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-slate-600">
                      <Clock size={16} />
                    </span>
                    <h3 className="font-extrabold text-base text-slate-900">Recent Activities</h3>
                  </div>
                  <Link href="/notices" className="text-xs font-extrabold text-purple-600 hover:underline">
                    View All
                  </Link>
                </div>

              <div className="mt-4 space-y-3">
                {recentActivities.map((act) => (
                  <div key={act.id} className="flex items-start justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-slate-600 shrink-0 mt-0.5">
                        {act.icon === "user" && <Users size={14} className="text-blue-600" />}
                        {act.icon === "fee" && <WalletCards size={14} className="text-emerald-600" />}
                        {act.icon === "attendance" && <Calendar size={14} className="text-purple-600" />}
                        {act.icon === "notice" && <Bell size={14} className="text-amber-600" />}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">{act.title}</p>
                        <p className="text-[10px] text-slate-400 truncate">{act.subtitle}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium shrink-0">{act.time}</span>
                  </div>
                ))}
              </div>
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
                  {activeReport === "staff" && <GraduationCap size={24} className="text-violet-600" />}
                  {activeReport === "classes" && <Layers size={24} className="text-amber-600" />}
                  {activeReport === "finances" && <TrendingUp size={24} className="text-rose-600" />}
                  {activeReport === "exams" && <FileText size={24} className="text-cyan-600" />}
                  {activeReport === "idcards" && <QrCode size={24} className="text-pink-600" />}
                </span>
                <div>
                  <h3 className="text-xl font-black text-slate-900">
                    {activeReport === "attendance" && "Comprehensive Attendance & Absentee Report"}
                    {activeReport === "fees" && "Fee Collection Ledger & Dues Breakdown"}
                    {activeReport === "students" && "Student Directory & Enrollment Roster"}
                    {activeReport === "staff" && "Faculty & Staff Directory (Teachers & Staff)"}
                    {activeReport === "classes" && "Academic Classes & Sections Breakdown"}
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
                {/* Cutoff Status Banner */}
                <div
                  className={`rounded-2xl border p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold ${
                    isPastCutoff
                      ? "border-amber-200 bg-amber-50/80 text-amber-900"
                      : "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Clock size={16} className={isPastCutoff ? "text-amber-600" : "text-emerald-600"} />
                    <span>
                      Daily Attendance Cutoff: <strong>{cutoffTime}</strong> &bull;{" "}
                      {isPastCutoff
                        ? "Cutoff passed! Unmarked students are automatically accounted as Absent."
                        : "Cutoff pending. Students can still be marked present."}
                    </span>
                  </div>
                  <span className="rounded-full bg-white/90 border border-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                    Live Status
                  </span>
                </div>

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
                      {attendanceStats.rate !== null ? `${attendanceStats.rate}%` : "Not Marked"}
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
                {attendanceStats.absentStudents.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700">
                        Absent Students Today ({attendanceStats.absentStudents.length}) &bull; 1-Click Parent WhatsApp Alert
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          const lines = attendanceStats.absentStudents.map((st, i) => {
                            const parentPhone = st.guardian_phone || st.phone || "No Phone";
                            const cName = st.class_id ? classMap.get(st.class_id) || "Class" : "Class";
                            return `${i + 1}. ${st.first_name} ${st.last_name || ""} (${cName}, Adm: ${st.admission_no}) - Parent: ${parentPhone}`;
                          });
                          navigator.clipboard.writeText(
                            `📢 ABSENT STUDENTS LIST - ${todayDate}\n🏫 ${instituteName}\n\n${lines.join("\n")}`
                          );
                          alert("✓ Absent students list copied to clipboard!");
                        }}
                        className="text-[11px] font-bold text-purple-600 hover:text-purple-800 underline"
                      >
                        Copy All Absent List
                      </button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
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
                            date: todayDate,
                            originUrl,
                            studentId: st.id,
                          })
                        );

                        return (
                          <div
                            key={st.id}
                            className="flex items-center justify-between p-3 rounded-2xl border border-rose-100 bg-rose-50/30 hover:bg-white hover:border-slate-300 transition shadow-2xs gap-3"
                          >
                            <div className="min-w-0">
                              <span className="font-bold text-xs text-slate-900 truncate block">
                                {st.first_name} {st.last_name || ""}
                              </span>
                              <span className="text-[10px] text-slate-500 block font-medium truncate">
                                {cName} &bull; Adm: {st.admission_no} &bull;{" "}
                                {targetPhone ? (
                                  <span className="font-semibold text-slate-700">📞 {targetPhone}</span>
                                ) : (
                                  <span className="text-rose-500 font-semibold">⚠️ No parent phone</span>
                                )}
                              </span>
                            </div>

                            {/* Ready-to-send WhatsApp button right next to each absent student */}
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setNotifiedParents((p) => new Set(p).add(st.id))}
                              className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition active:scale-95 shadow-xs ${
                                isSent
                                  ? "bg-slate-100 text-slate-600 border border-slate-300"
                                  : "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-600/25 ring-1 ring-emerald-500/40"
                              }`}
                              title={
                                targetPhone
                                  ? `Send absent alert to parent (${targetPhone})`
                                  : "Open WhatsApp to choose parent contact"
                              }
                            >
                              <MessageCircle size={14} className={isSent ? "text-emerald-600" : "text-white"} />
                              <span>{isSent ? "Alert Sent ✓" : "WhatsApp Msg"}</span>
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs font-semibold text-emerald-700 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                    🎉 Excellent! Zero students absent today. All students are present!
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
            {/* 3. STUDENT ENROLLMENT & DIRECTORY                        */}
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

                {/* Search Bar */}
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search enrolled student by name, admission no, or phone..."
                    value={modalSearchQuery}
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white transition"
                  />
                </div>

                {/* Student Roster List */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Enrolled Students List ({activeStudents.filter((st) => {
                      if (!modalSearchQuery.trim()) return true;
                      const q = modalSearchQuery.toLowerCase();
                      return (
                        st.first_name?.toLowerCase().includes(q) ||
                        st.last_name?.toLowerCase().includes(q) ||
                        st.admission_no?.toLowerCase().includes(q) ||
                        st.phone?.includes(q)
                      );
                    }).length})
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {activeStudents
                      .filter((st) => {
                        if (!modalSearchQuery.trim()) return true;
                        const q = modalSearchQuery.toLowerCase();
                        return (
                          st.first_name?.toLowerCase().includes(q) ||
                          st.last_name?.toLowerCase().includes(q) ||
                          st.admission_no?.toLowerCase().includes(q) ||
                          st.phone?.includes(q)
                        );
                      })
                      .map((st) => {
                        const cName = st.class_id ? classMap.get(st.class_id) || "Class" : "Class";
                        const targetPhone = st.guardian_phone || st.phone;
                        return (
                          <div
                            key={st.id}
                            className="flex items-center justify-between p-3 rounded-2xl border border-slate-200/90 bg-white hover:border-purple-300 transition shadow-2xs text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="grid h-8 w-8 place-items-center rounded-xl bg-purple-100 text-purple-700 font-bold text-xs shrink-0">
                                {st.first_name?.[0]?.toUpperCase() || "S"}
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 truncate block">
                                  {st.first_name} {st.last_name || ""}
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium truncate block">
                                  {cName} &bull; Adm: <strong>{st.admission_no}</strong> {targetPhone && `• 📞 ${targetPhone}`}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-2 py-0.5 shrink-0">
                              Active
                            </span>
                          </div>
                        );
                      })}
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
                    <span>Open Full Student Directory</span>
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
            {/* 3B. FACULTY & STAFF DIRECTORY MODAL                      */}
            {/* -------------------------------------------------------- */}
            {activeReport === "staff" && (
              <div className="space-y-5">
                {/* 3 Metric Badges */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-3.5">
                    <span className="text-[10px] text-purple-800 uppercase font-semibold">Total Faculty</span>
                    <p className="text-2xl font-black text-slate-900 mt-0.5">{teachersCount}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5">
                    <span className="text-[10px] text-emerald-800 uppercase font-semibold">Present Today</span>
                    <p className="text-2xl font-black text-emerald-700 mt-0.5">{teacherStats.present}</p>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5">
                    <span className="text-[10px] text-rose-800 uppercase font-semibold">Absent Today</span>
                    <p className="text-2xl font-black text-rose-700 mt-0.5">{teacherStats.absent}</p>
                  </div>
                </div>

                {/* Search Bar & Mark All Present */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative flex-1 w-full">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search teacher by name, phone, or email..."
                      value={modalSearchQuery}
                      onChange={(e) => setModalSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white transition"
                    />
                  </div>
                  <button
                    onClick={handleMarkAllTeachersPresent}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition active:scale-95 shrink-0"
                  >
                    <UserCheck size={14} className="text-emerald-600" />
                    <span>Mark All Present Today</span>
                  </button>
                </div>

                {/* Faculty List */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Faculty Roster & Today&apos;s Presence ({teachersList.filter((t) => {
                      if (!modalSearchQuery.trim()) return true;
                      const q = modalSearchQuery.toLowerCase();
                      return (
                        t.full_name?.toLowerCase().includes(q) ||
                        t.phone?.includes(q) ||
                        t.email?.toLowerCase().includes(q)
                      );
                    }).length})
                  </h4>
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {teachersList.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400 font-medium">
                        No teachers logged yet. Add your teaching staff in the directory.
                      </div>
                    ) : (
                      teachersList
                        .filter((t) => {
                          if (!modalSearchQuery.trim()) return true;
                          const q = modalSearchQuery.toLowerCase();
                          return (
                            t.full_name?.toLowerCase().includes(q) ||
                            t.phone?.includes(q) ||
                            t.email?.toLowerCase().includes(q)
                          );
                        })
                        .map((t) => {
                          const status = teacherAttendance[t.id] || "unmarked";
                          const tInitials = t.full_name
                            .split(/\s+/)
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase();

                          return (
                            <div
                              key={t.id}
                              className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition shadow-2xs gap-3 text-xs"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="grid h-9 w-9 place-items-center rounded-xl bg-purple-100 text-purple-700 text-xs font-bold shrink-0">
                                  {tInitials}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-bold text-slate-900 truncate">{t.full_name}</h4>
                                  <p className="text-[10px] text-slate-400 font-medium truncate">
                                    {t.phone ? `📞 ${t.phone}` : "Faculty Member"} {t.email && `• ${t.email}`}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleTeacher(t.id, status)}
                                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 ${
                                    status === "present"
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200"
                                      : status === "absent"
                                      ? "bg-rose-100 text-rose-800 border border-rose-200 hover:bg-rose-200"
                                      : "bg-slate-100 text-slate-700 hover:bg-emerald-100 hover:text-emerald-800 border border-slate-200"
                                  }`}
                                  title="Click to toggle teacher attendance"
                                >
                                  {status === "present" ? (
                                    <>
                                      <Check size={12} />
                                      <span>Present</span>
                                    </>
                                  ) : status === "absent" ? (
                                    <>
                                      <X size={12} />
                                      <span>Absent</span>
                                    </>
                                  ) : (
                                    <span>Mark Present</span>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    href="/teachers"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white transition shadow-sm"
                  >
                    <span>Open Staff Directory & Payroll</span>
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
            {/* 3C. ACADEMIC CLASSES & ENROLLMENT BREAKDOWN              */}
            {/* -------------------------------------------------------- */}
            {activeReport === "classes" && (
              <div className="space-y-5">
                {/* 3 Metric Badges */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5">
                    <span className="text-[10px] text-amber-800 uppercase font-semibold">Total Classes</span>
                    <p className="text-2xl font-black text-slate-900 mt-0.5">{classesList.length}</p>
                  </div>
                  <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-3.5">
                    <span className="text-[10px] text-purple-800 uppercase font-semibold">Total Students</span>
                    <p className="text-2xl font-black text-purple-700 mt-0.5">{activeStudents.length}</p>
                  </div>
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-3.5">
                    <span className="text-[10px] text-cyan-800 uppercase font-semibold">Avg Class Size</span>
                    <p className="text-2xl font-black text-cyan-800 mt-0.5">
                      {classesList.length > 0 ? Math.round(activeStudents.length / classesList.length) : 0}
                    </p>
                  </div>
                </div>

                {/* Class Breakdown Grid */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Class Roster & Attendance Health
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {attendanceStats.classBreakdown.map((c) => (
                      <div
                        key={c.className}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-amber-300 transition"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-sm text-slate-900">{c.className}</span>
                          <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                            {c.rate}% Present
                          </span>
                        </div>
                        <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full"
                            style={{ width: `${c.rate}%` }}
                          />
                        </div>
                        <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 font-medium">
                          <span>{c.total} Enrolled</span>
                          <span>{c.present} Present</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    href="/academics"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2 text-xs font-bold text-white transition shadow-sm"
                  >
                    <span>Manage Classes, Subjects & Timetable</span>
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
