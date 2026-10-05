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

function makeBaseLoginId(instituteName: string) {
  const words = instituteName
    .trim()
    .replace(/[^a-zA-Z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const initials = words.map((word) => word[0]).join("").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const year = new Date().getFullYear();
  return "EDU-" + (initials || "INST").slice(0, 12) + year;
}

async function makeUniqueLoginId(admin: ReturnType<typeof createClient>, instituteName: string) {
  const base = makeBaseLoginId(instituteName);
  const { data, error } = await admin
    .from("profiles")
    .select("login_id")
    .like("login_id", base + "%");

  if (error) throw error;

  const used = new Set(
    (data ?? [])
      .map((row) => String(row.login_id ?? "").toUpperCase())
      .filter(Boolean),
  );

  if (!used.has(base)) return base;

  let number = 2;
  while (used.has(base + "-" + number)) number++;
  return base + "-" + number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const instituteName = String(body.instituteName ?? "").trim();
    const instituteType = String(body.instituteType ?? "school").trim();
    const address = String(body.address ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const instituteEmail = String(body.instituteEmail ?? "").trim();
    const adminName = String(body.adminName ?? "").trim();
    const adminEmail = String(body.adminEmail ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!instituteName || !adminName || !adminEmail || password.length < 8) {
      return json({ error: "Please complete all required fields. Password must be at least 8 characters." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    let loginId = await makeUniqueLoginId(admin, instituteName);

    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: adminName },
    });
    if (userError || !userData.user) {
      return json({ error: userError?.message ?? "Could not create the admin account." }, 400);
    }

    const userId = userData.user.id;

    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({ name: instituteName, slug: instituteName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "institute" })
      .select("id")
      .single();

    if (orgError || !org) {
      await admin.auth.admin.deleteUser(userId);
      return json({ error: orgError?.message ?? "Could not create the institute workspace." }, 400);
    }

    let profileError: { message: string } | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = await admin.from("profiles").insert({
        id: userId,
        organization_id: org.id,
        full_name: adminName,
        role: "owner",
        login_id: loginId,
      });

      profileError = result.error;
      if (!profileError) break;

      // A concurrent registration can select the same readable ID.
      // Recalculate the next available suffix instead of failing the signup.
      if (profileError.code !== "23505" || !profileError.message.includes("login_id")) break;
      loginId = await makeUniqueLoginId(admin, instituteName);
    }

    if (profileError) {
      await admin.from("organizations").delete().eq("id", org.id);
      await admin.auth.admin.deleteUser(userId);
      return json({ error: profileError.message }, 400);
    }

    const { error: settingsError } = await admin.from("organization_settings").insert({
      organization_id: org.id,
      institute_type: instituteType,
      phone,
      email: instituteEmail || adminEmail,
      address,
    });

    if (settingsError) {
      await admin.from("profiles").delete().eq("id", userId);
      await admin.from("organizations").delete().eq("id", org.id);
      await admin.auth.admin.deleteUser(userId);
      return json({ error: settingsError.message }, 400);
    }

    return json({ loginId, instituteName, adminName });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Registration failed." }, 500);
  }
});
