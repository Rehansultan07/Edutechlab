import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.1";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers:cors});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:cors});
  if (req.method !== "POST") return json({error:"Method not allowed"},405);
  try {
    const {loginId} = await req.json();
    const normalized = String(loginId ?? "").trim().toUpperCase();
    const isStaff = normalized.startsWith("STAFF-");
    const isEdu = normalized.startsWith("EDU-");
    if (!isStaff && !isEdu) return json({error: "Invalid login ID format."}, 400);

    if (isEdu && !/^EDU-[A-Z0-9]{1,12}[0-9]{4}(?:-[2-9][0-9]*)?$/.test(normalized)) {
      return json({error:"Invalid institute ID."},400);
    }
    if (isStaff && !/^STAFF-[A-Z0-9_-]{4,32}$/.test(normalized)) {
      return json({error:"Invalid staff ID format."},400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:profile,error} = await admin.from("profiles").select("id, full_name, is_active").eq("login_id",normalized).maybeSingle();
    if (error || !profile) return json({error: isStaff ? "Staff ID or password is incorrect." : "Institute ID or password is incorrect."},401);
    if (profile.is_active === false) return json({error: "This staff account has been deactivated. Please contact your institute administrator."}, 403);

    const {data:userData,error:userError} = await admin.auth.admin.getUserById(profile.id);
    if (userError || !userData.user?.email) return json({error: isStaff ? "Staff account could not be found." : "Institute account could not be found."},401);
    return json({email:userData.user.email});
  } catch { return json({error:"Unable to sign in right now."},500); }
});