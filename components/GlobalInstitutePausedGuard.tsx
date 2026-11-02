"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import InstitutePausedModal from "./InstitutePausedModal";

// Routes where the lockout should NOT trigger
const EXEMPT_PREFIXES = [
  "/login",
  "/super-admin",
  "/platform-gateway",
  "/register",
  "/preview",
  "/parent-portal",
  "/api",
];

export default function GlobalInstitutePausedGuard() {
  const pathname = usePathname();
  const [isPaused, setIsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState<string | null>(null);
  const [pausedAt, setPausedAt] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string>("Your Institution");
  const [supportPhone, setSupportPhone] = useState<string>("+91 79031 78550");
  const [supportWhatsapp, setSupportWhatsapp] = useState<string>("917903178550");

  const checkStatus = useCallback(async () => {
    if (!pathname) return;

    // Skip public and super admin pages
    if (
      pathname === "/" ||
      EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))
    ) {
      setIsPaused(false);
      return;
    }

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsPaused(false);
        return;
      }

      // Fetch user's profile and organization
      let orgData: any = null;
      let role = "";
      let p: any = null;

      // 1. Try selecting with is_paused columns first
      const res1 = await supabase
        .from("profiles")
        .select("id, role, organization_id, organizations(name, is_active, status, enabled_features, is_paused, pause_reason, paused_at)")
        .eq("id", user.id)
        .maybeSingle();

      if (!res1.error && res1.data) {
        p = res1.data;
        orgData = (res1.data as any)?.organizations;
      } else {
        // Fallback without new columns in case migration 0017 not run yet
        const res2 = await supabase
          .from("profiles")
          .select("id, role, organization_id, organizations(name, is_active, status, enabled_features)")
          .eq("id", user.id)
          .maybeSingle();
        if (res2.data) {
          p = res2.data;
          orgData = (res2.data as any)?.organizations;
        }
      }

      if (p) {
        role = String(p.role || "").trim().toLowerCase();
      }

      // Platform owners are never blocked
      if (role === "platform_owner" || role === "super_admin") {
        setIsPaused(false);
        return;
      }

      if (!orgData && p?.organization_id) {
        const resOrg1 = await supabase
          .from("organizations")
          .select("name, is_active, status, enabled_features, is_paused, pause_reason, paused_at")
          .eq("id", p.organization_id)
          .maybeSingle();

        if (!resOrg1.error && resOrg1.data) {
          orgData = resOrg1.data;
        } else {
          const resOrg2 = await supabase
            .from("organizations")
            .select("name, is_active, status, enabled_features")
            .eq("id", p.organization_id)
            .maybeSingle();
          if (resOrg2.data) {
            orgData = resOrg2.data;
          }
        }
      }

      if (!orgData) return;

      if (orgData.name) {
        setOrgName(orgData.name);
      }

      let paused = false;
      let reason: string | null = null;
      let pDate: string | null = null;

      // 1. Direct column check if present
      if (orgData.is_paused === true) {
        paused = true;
        reason = orgData.pause_reason || null;
        pDate = orgData.paused_at || null;
      }

      // 2. Check enabled_features JSON (100% reliable across Supabase)
      const rawFeat = orgData.enabled_features;
      if (typeof rawFeat === "object" && rawFeat !== null) {
        if (rawFeat._is_paused === true) {
          paused = true;
          reason = rawFeat._pause_reason || reason;
          pDate = rawFeat._paused_at || pDate;
        }
      }

      // 3. Subscription table check
      if (p?.organization_id) {
        try {
          const { data: sub } = await supabase
            .from("institution_subscriptions")
            .select("notes, status")
            .eq("organization_id", p.organization_id)
            .maybeSingle();

          if (sub?.notes && typeof sub.notes === "string" && sub.notes.includes("_is_paused")) {
            try {
              const parsed = JSON.parse(sub.notes);
              if (parsed._is_paused === true) {
                paused = true;
                reason = parsed._pause_reason || reason;
                pDate = parsed._paused_at || pDate;
              }
            } catch {}
          }
        } catch {}
      }

      // 4. Fetch dynamic platform settings for support contact
      try {
        const { data: pSettings } = await supabase
          .from("platform_settings")
          .select("whatsapp_number, contact_phone")
          .eq("id", "global")
          .maybeSingle();

        if (pSettings) {
          if (pSettings.whatsapp_number) setSupportWhatsapp(pSettings.whatsapp_number);
          if (pSettings.contact_phone) setSupportPhone(pSettings.contact_phone);
        }
      } catch {}

      setIsPaused(paused);
      setPauseReason(reason);
      setPausedAt(pDate);
    } catch {}
  }, [pathname]);

  useEffect(() => {
    checkStatus();

    // Re-check on tab focus
    const handleFocus = () => {
      checkStatus();
    };
    window.addEventListener("focus", handleFocus);

    // Periodic check every 25 seconds
    const interval = setInterval(checkStatus, 25000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, [checkStatus]);

  // On subscription page, let them submit payment proof (they still see the pause notice there)
  if (pathname === "/subscription") {
    return null;
  }

  if (!isPaused) {
    return null;
  }

  return (
    <InstitutePausedModal
      organizationName={orgName}
      pauseReason={pauseReason}
      pausedAt={pausedAt}
      supportPhone={supportPhone}
      supportWhatsapp={supportWhatsapp}
    />
  );
}
