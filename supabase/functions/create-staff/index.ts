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

function generateStaffLoginId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let randomPart = "";
  for (let i = 0; i < 8; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `STAFF-${randomPart}`;
}

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
      return json({ error: "Only institute Owner or Admin can create staff accounts." }, 403);
    }

    const body = await req.json();
    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "teacher").trim().toLowerCase().replace(/[^a-z0-9_ -]/g, "").replace(/\s+/g, "_") || "teacher";

    if (!fullName || !email || password.length < 8) {
      return json({ error: "Full name, valid email, and password (minimum 8 characters) are required." }, 400);
    }

    // Generate unique staff login ID
    let loginId = generateStaffLoginId();
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await admin.from("profiles").select("id").eq("login_id", loginId).maybeSingle();
      if (!existing) break;
      loginId = generateStaffLoginId();
    }

    const { data: newUserData, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError || !newUserData.user) {
      return json({ error: createError?.message ?? "Could not create staff authentication account." }, 400);
    }

    const newUserId = newUserData.user.id;

    const { error: profileError } = await admin.from("profiles").insert({
      id: newUserId,
      organization_id: callerProfile.organization_id,
      full_name: fullName,
      role: role,
      login_id: loginId,
      is_active: true,
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(newUserId);
      return json({ error: profileError.message }, 400);
    }

    return json({ staffId: newUserId, loginId });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Staff creation failed." }, 500);
  }
});
