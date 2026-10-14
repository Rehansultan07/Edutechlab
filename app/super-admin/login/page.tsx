"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  AlertTriangle,
  Server,
  Layers,
  GraduationCap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SuperAdminLoginPage() {
  const supabase = createClient();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      let email = identifier.trim();

      // If user typed their Master ID (e.g. EDU-...), resolve to email
      if (email.toUpperCase().startsWith("EDU-")) {
        const { data: resolved, error: resolveErr } = await supabase.functions.invoke(
          "resolve-login-id",
          { body: { loginId: email.toUpperCase() } }
        );

        if (resolveErr || !resolved?.email) {
          throw new Error("Invalid Super Admin ID or password.");
        }
        email = resolved.email;
      }

      // Step 1: Authenticate with password
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authErr || !authData.user) {
        throw new Error("Invalid platform credentials or password.");
      }

      // Step 2: Strictly verify Platform Admin role
      const [{ data: isSuper }, { data: adminRecord }] = await Promise.all([
        supabase.rpc("is_platform_admin"),
        supabase
          .from("platform_admins")
          .select("role")
          .eq("user_id", authData.user.id)
          .maybeSingle(),
      ]);

      const isAuthorized = isSuper === true || !!adminRecord;

      if (!isAuthorized) {
        // Sign out immediately if not a super admin
        await supabase.auth.signOut();
        throw new Error(
          "Access Denied: Your account does not have platform super administrator privileges."
        );
      }

      // Step 3: Redirect directly to Super Admin Console
      window.location.href = "/super-admin";
    } catch (err: any) {
      setError(err.message || "Failed to sign in to platform console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0d0d14] px-4 py-8 text-white sm:px-6 sm:py-16">
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-white/10 bg-[#161622] shadow-[0_25px_80px_rgba(0,0,0,0.6)] md:grid-cols-[1.1fr_1fr]">
          {/* Left Hero Panel */}
          <div className="hidden flex-col justify-between border-r border-white/10 bg-gradient-to-br from-[#1a192c] to-[#0e0e17] p-10 md:flex">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white shadow-lg shadow-purple-600/30">
                  <ShieldCheck size={22} />
                </span>
                <div>
                  <div className="font-bold tracking-tight">EduTechLab</div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-purple-400">
                    Platform Owner Portal
                  </div>
                </div>
              </div>

              <div className="mt-16">
                <span className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-purple-300">
                  Restricted Console
                </span>
                <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white lg:text-4xl">
                  Super Admin Management
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Access multi-tenant health, real-time institute metrics, account lifecycle
                  controls, and global platform configurations.
                </p>
              </div>
            </div>

            <div className="space-y-3 border-t border-white/10 pt-6 text-xs text-slate-400">
              <div className="flex items-center gap-2.5">
                <Server size={15} className="text-purple-400" />
                <span>Multi-tenant SaaS architecture control</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Layers size={15} className="text-purple-400" />
                <span>Cross-institution lifecycle & suspension</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Lock size={15} className="text-purple-400" />
                <span>Cryptographically secured RLS isolation</span>
              </div>
            </div>
          </div>

          {/* Right Login Form */}
          <div className="flex flex-col justify-between p-8 sm:p-10">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-purple-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-400">
                  Secure Access
                </span>
                <Link
                  href="/login"
                  className="text-xs text-slate-400 transition hover:text-slate-200"
                >
                  Institute Login →
                </Link>
              </div>

              <h2 className="mt-6 text-2xl font-bold tracking-tight text-white">
                Platform Sign In
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Enter your Super Admin Email or Master ID and password.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Email or Master ID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. admin@edutechlab.com or EDU-..."
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#0d0d14] px-4 py-3 text-sm text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Master Password
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Super Admin Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#0d0d14] px-4 py-3 pr-11 text-sm text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-400">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-purple-600/30 transition hover:bg-purple-500 disabled:opacity-50"
                >
                  {loading ? "Authenticating..." : "Sign In to Super Admin"}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>
            </div>

            <div className="mt-10 border-t border-white/10 pt-5 text-center text-[11px] text-slate-500">
              Restricted to authorized EduTechLab SaaS personnel only. Unauthorized access attempts
              are monitored and logged.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
