import { SupabaseClient } from "@supabase/supabase-js";

export interface CleanupResult {
  success: boolean;
  homework_deleted: number;
  notices_deleted: number;
  invites_deleted: number;
  approved_payments_deleted: number;
  storage_files_deleted: number;
  executed_at: string;
  method?: "rpc" | "client_fallback";
  error?: string;
}

/**
 * Runs the comprehensive automated cleanup routine:
 * 1. Approved Subscription Payments & Screenshots: Purged after 7 days (1 week)
 * 2. Class Homework: Auto-deleted after 90 days
 * 3. School Notices / Circulars: Auto-deleted after 90 days
 * 4. Staff Invites: Auto-deleted after 90 days
 */
export async function runSystemCleanup(supabase: SupabaseClient): Promise<CleanupResult> {
  const result: CleanupResult = {
    success: true,
    homework_deleted: 0,
    notices_deleted: 0,
    invites_deleted: 0,
    approved_payments_deleted: 0,
    storage_files_deleted: 0,
    executed_at: new Date().toISOString(),
    method: "rpc",
  };

  try {
    // 1. Try invoking the dedicated database RPC
    const { data, error } = await supabase.rpc("run_system_cleanup");

    if (!error && data && data.success) {
      return {
        ...result,
        ...data,
        method: "rpc",
      };
    }

    // 2. Fallback: If RPC not yet applied in remote Supabase, execute direct queries
    result.method = "client_fallback";

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysIso = ninetyDaysAgo.toISOString();
    const ninetyDaysDateOnly = ninetyDaysIso.slice(0, 10);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysIso = sevenDaysAgo.toISOString();

    // A. Clean Class Homework (> 90 days)
    try {
      const { data: hwDeleted } = await supabase
        .from("class_homework")
        .delete()
        .lt("assigned_date", ninetyDaysDateOnly)
        .select("id");
      result.homework_deleted = hwDeleted?.length || 0;
    } catch {
      // Table might not exist in some setups
    }

    // B. Clean Notices (> 90 days)
    try {
      const { data: noticesDeleted } = await supabase
        .from("notices")
        .delete()
        .lt("created_at", ninetyDaysIso)
        .select("id");
      result.notices_deleted = noticesDeleted?.length || 0;
    } catch {
      // Ignore
    }

    // C. Clean Staff Invites (> 90 days)
    try {
      const { data: invitesDeleted } = await supabase
        .from("staff_invites")
        .delete()
        .lt("created_at", ninetyDaysIso)
        .select("id");
      result.invites_deleted = invitesDeleted?.length || 0;
    } catch {
      // Ignore
    }

    // D. Clean Approved Subscription Payments (> 7 days) & delete screenshot from storage
    try {
      const { data: oldApproved } = await supabase
        .from("subscription_payments")
        .select("id,screenshot_url")
        .eq("status", "approved")
        .lt("reviewed_at", sevenDaysIso);

      if (oldApproved && oldApproved.length > 0) {
        // Extract storage file paths
        const storagePathsToDelete: string[] = [];
        oldApproved.forEach((p) => {
          if (p.screenshot_url) {
            const parts = p.screenshot_url.split("/subscription-proofs/");
            if (parts.length > 1) {
              storagePathsToDelete.push(decodeURIComponent(parts[1]));
            }
          }
        });

        // Delete from storage bucket
        if (storagePathsToDelete.length > 0) {
          const { data: removedFiles } = await supabase.storage
            .from("subscription-proofs")
            .remove(storagePathsToDelete);
          result.storage_files_deleted = removedFiles?.length || storagePathsToDelete.length;
        }

        // Delete payment records from database
        const idsToDelete = oldApproved.map((p) => p.id);
        const { data: paymentsDeleted } = await supabase
          .from("subscription_payments")
          .delete()
          .in("id", idsToDelete)
          .select("id");
        result.approved_payments_deleted = paymentsDeleted?.length || idsToDelete.length;
      }
    } catch {
      // Ignore
    }

    return result;
  } catch (err: any) {
    return {
      ...result,
      success: false,
      error: err.message || "Unknown error during cleanup",
    };
  }
}
