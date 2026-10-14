import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userAuthError } = await userClient.auth.getUser();
    if (userAuthError || !user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerProfile, error: callerError } = await admin
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single();

    if (callerError || !callerProfile || !["owner", "admin"].includes(callerProfile.role)) {
      return json({ error: "Only institute Owner or Admin can delete staff accounts." }, 403);
    }

    const body = await req.json();
    const staffId = String(body.staffId ?? "").trim();
    if (!staffId) return json({ error: "Staff ID is required." }, 400);

    if (staffId === user.id) {
      return json({ error: "You cannot delete your own account." }, 400);
    }

    const { data: targetProfile, error: targetError } = await admin
      .from("profiles")
      .select("id, organization_id, role, full_name")
      .eq("id", staffId)
      .maybeSingle();

    if (targetError || !targetProfile) {
      return json({ error: "Staff member not found." }, 404);
    }

    if (targetProfile.organization_id !== callerProfile.organization_id) {
      return json({ error: "Unauthorized access to another organization's staff." }, 403);
    }

    if (["owner", "admin"].includes(targetProfile.role.toLowerCase())) {
      return json({ error: "Protected administrator and owner accounts cannot be deleted through this action." }, 403);
    }

    // Clean up staff permissions
    await admin.from("staff_permissions").delete().eq("staff_id", staffId);

    // Delete profile
    const { error: deleteProfileError } = await admin.from("profiles").delete().eq("id", staffId);
    if (deleteProfileError) {
      return json({ error: deleteProfileError.message }, 400);
    }

    // Delete auth user
    await admin.auth.admin.deleteUser(staffId);

    return json({ success: true, message: `Staff account deleted: ${targetProfile.full_name}` });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Staff deletion failed." }, 500);
  }
});
