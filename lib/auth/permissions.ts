"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export type Profile = {
  id: string;
  organization_id: string;
  role: string;
  full_name: string;
  login_id: string | null;
  phone: string | null;
  is_active: boolean;
};

export type SystemPermissionDefinition = {
  code: string;
  name: string;
  module: string;
  description: string;
};

export const ALL_SYSTEM_PERMISSIONS: SystemPermissionDefinition[] = [
  // Students & Admissions
  { code: "students.view", name: "View Students Directory", module: "Students", description: "Search, view student profiles and contact information" },
  { code: "students.manage", name: "Edit & Manage Students", module: "Students", description: "Update student details, photos, documents & status" },
  { code: "admissions.manage", name: "Register New Admissions", module: "Students", description: "Enroll new students and generate admission numbers" },

  // Attendance
  { code: "attendance.view", name: "View Attendance Records", module: "Attendance", description: "View daily, monthly & class-wise attendance logs" },
  { code: "attendance.manage", name: "Mark & Update Attendance", module: "Attendance", description: "Take daily attendance and send WhatsApp absence alerts" },

  // Fees & Billing
  { code: "fees.view", name: "View Fees & Defaulters", module: "Fees & Accounts", description: "View fee structures, dues list & defaulters" },
  { code: "fees.manage", name: "Collect Fees & Payments", module: "Fees & Accounts", description: "Record fee collections, cash/UPI receipts" },
  { code: "fees.receipts", name: "Generate & Print Receipts", module: "Fees & Accounts", description: "Print official thermal/A4 fee receipts" },

  // Expenses & Vouchers
  { code: "expenses.view", name: "View Expense Logs", module: "Expenses", description: "View daily school expenditures and vouchers" },
  { code: "expenses.manage", name: "Record School Expenses", module: "Expenses", description: "Add expenses, vendor bills & maintenance costs" },

  // Examinations & Results
  { code: "exams.view", name: "View Exams & Datesheets", module: "Examinations", description: "View scheduled exam timetables and lists" },
  { code: "exams.manage", name: "Create & Manage Exams", module: "Examinations", description: "Create exams, configure subjects & marksheets" },
  { code: "results.manage", name: "Enter Marks & Publish Results", module: "Examinations", description: "Input student marks and generate report cards" },

  // Academic Modules
  { code: "idcards.manage", name: "Generate & Print PVC ID Cards", module: "ID Cards", description: "Preview, customize & batch print PVC student ID cards" },
  { code: "certificates.manage", name: "Issue TC & Certificates", module: "Certificates", description: "Generate Transfer, Character & Bonafide Certificates" },
  { code: "homework.manage", name: "Create & Manage Homework", module: "Homework", description: "Post daily homework, syllabus & attachments for parents" },
  { code: "timetable.manage", name: "Manage Class Timetables", module: "Timetable", description: "Configure period schedules and class routines" },

  // Staff & Operations
  { code: "teachers.view", name: "View Teachers Directory", module: "Teachers", description: "Browse teacher list and contact details" },
  { code: "teachers.manage", name: "Add & Manage Teachers", module: "Teachers", description: "Add new teachers and manage teacher assignments" },
  { code: "notices.manage", name: "Publish & Manage Notices", module: "Notices", description: "Post circulars and push WhatsApp school announcements" },
  { code: "reports.view", name: "View Reports & Analytics", module: "Reports", description: "Access student strength, attendance & collection reports" },
  { code: "staff.manage", name: "Manage Staff & Permissions", module: "Administration", description: "Add staff accounts, assign login IDs and permissions" },
  { code: "settings.manage", name: "Manage Institute Settings", module: "Administration", description: "Configure classes, sections, school profile & branding" },
];

export type RolePreset = {
  id: string;
  name: string;
  roleTitle: string;
  description: string;
  badgeColor: string;
  permissions: string[];
};

export const STAFF_ROLE_PRESETS: RolePreset[] = [
  {
    id: "teacher",
    name: "Teacher / Class In-Charge",
    roleTitle: "Teacher",
    description: "Mark attendance, manage daily homework, view timetable, and record exam marks.",
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
    permissions: [
      "attendance.view",
      "attendance.manage",
      "students.view",
      "homework.manage",
      "timetable.manage",
      "exams.view",
      "results.manage",
      "notices.manage",
    ],
  },
  {
    id: "accountant",
    name: "Accountant / Cashier",
    roleTitle: "Accountant",
    description: "Collect fees, generate official receipts, manage defaulters, and record school expenses.",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    permissions: [
      "fees.view",
      "fees.manage",
      "fees.receipts",
      "expenses.view",
      "expenses.manage",
      "students.view",
      "reports.view",
    ],
  },
  {
    id: "receptionist",
    name: "Front Desk / Clerk",
    roleTitle: "Office Clerk",
    description: "New admissions, student directory, batch print PVC ID cards, issue TC certificates & notices.",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
    permissions: [
      "students.view",
      "students.manage",
      "admissions.manage",
      "attendance.view",
      "attendance.manage",
      "idcards.manage",
      "certificates.manage",
      "notices.manage",
    ],
  },
  {
    id: "exam_incharge",
    name: "Exam Coordinator",
    roleTitle: "Exam In-Charge",
    description: "Design exam schedules, configure marksheets, input subject marks, and publish report cards.",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
    permissions: [
      "exams.view",
      "exams.manage",
      "results.manage",
      "students.view",
    ],
  },
  {
    id: "vice_principal",
    name: "Vice Principal / Manager",
    roleTitle: "Vice Principal",
    description: "Comprehensive academic & operational control across all daily modules.",
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
    permissions: [
      "students.view",
      "students.manage",
      "admissions.manage",
      "attendance.view",
      "attendance.manage",
      "teachers.view",
      "homework.manage",
      "timetable.manage",
      "exams.view",
      "exams.manage",
      "results.manage",
      "idcards.manage",
      "certificates.manage",
      "notices.manage",
      "reports.view",
    ],
  },
];

export function useUserAccess(requiredCodes: string[] = []) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [hasAccess, setHasAccess] = useState(false);
  const [error, setError] = useState("");

  const check = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        window.location.href = "/login";
        return;
      }

      const { data: p, error: pErr } = await supabase
        .from("profiles")
        .select("id, organization_id, role, full_name, login_id, phone, is_active, organizations(name, is_active, status)")
        .eq("id", user.id)
        .single();

      if (pErr || !p) {
        setError("Could not load user profile or organization.");
        setLoading(false);
        return;
      }

      if (p.is_active === false) {
        await supabase.auth.signOut();
        window.location.href = "/login";
        return;
      }

      const orgData = (p as any).organizations;
      if (orgData && (orgData.is_active === false || orgData.status === "suspended")) {
        setError("This institution has been suspended by the platform administrator.");
        setLoading(false);
        return;
      }

      setProfile(p as Profile);
      const role = String(p.role || "").trim().toLowerCase();
      const isAdmin = role === "owner" || role === "admin";

      let granted = new Set<string>();
      if (isAdmin) {
        // Admin gets all system permissions automatically
        granted = new Set(ALL_SYSTEM_PERMISSIONS.map(x => x.code));
      } else {
        const { data: grants } = await supabase
          .from("staff_permissions")
          .select("permissions(code)")
          .eq("staff_id", user.id)
          .eq("organization_id", p.organization_id)
          .eq("enabled", true);

        granted = new Set(
          (grants ?? [])
            .map((g: any) => g.permissions?.code)
            .filter(Boolean)
        );
      }

      setPermissions(granted);

      if (requiredCodes.length === 0) {
        setHasAccess(true);
      } else {
        const permitted = isAdmin || requiredCodes.some((code) => granted.has(code));
        setHasAccess(permitted);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Access verification failed.");
    } finally {
      setLoading(false);
    }
  }, [supabase, requiredCodes.join(",")]);

  useEffect(() => {
    check();
  }, [check]);

  const can = (code: string) => {
    const role = String(profile?.role || "").trim().toLowerCase();
    return role === "owner" || role === "admin" || permissions.has(code);
  };

  const canAny = (codes: string[]) => {
    const role = String(profile?.role || "").trim().toLowerCase();
    return role === "owner" || role === "admin" || codes.some((code) => permissions.has(code));
  };

  const isAdmin = ["owner", "admin"].includes(String(profile?.role || "").trim().toLowerCase());

  return {
    loading,
    profile,
    orgId: profile?.organization_id || "",
    permissions,
    hasAccess,
    can,
    canAny,
    isAdmin,
    error,
    refresh: check,
  };
}
