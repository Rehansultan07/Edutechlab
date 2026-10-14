"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export type Profile = {
  id: string;
  organization_id: string;
  role: string;
  full_name: string;
  login_id: string | null;
  is_active: boolean;
};

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
        .select("id, organization_id, role, full_name, login_id, is_active, organizations(name, is_active, status)")
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
        granted = new Set([
          "students.view", "students.manage", "admissions.manage",
          "teachers.view", "teachers.manage",
          "attendance.view", "attendance.manage",
          "fees.view", "fees.manage", "fees.receipts",
          "exams.view", "exams.manage", "results.manage",
          "notices.manage",
          "staff.manage",
          "settings.manage",
          "reports.view"
        ]);
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
