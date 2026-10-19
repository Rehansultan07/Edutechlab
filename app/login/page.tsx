"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  ShieldCheck,
  KeyRound,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MASTER_ACCESS_CODE = "Edutechlab@#78692";

export default function LoginPage() {
  const supabase = createClient();
  const [checkingSession, setCheckingSession] = useState(true);
  const [mode, setMode] = useState<"admin" | "staff">("admin");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Exclusive Secret Method: 5-Tap Gesture on EduTechLab Logo
  const [secretTaps, setSecretTaps] = useState(0);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretAccessCode, setSecretAccessCode] = useState("");
  const [secretEmail, setSecretEmail] = useState("edutechlab@gmail.com");
  const [secretPassword, setSecretPassword] = useState("");
  const [showSecretPassword, setShowSecretPassword] = useState(false);
  const [secretLoading, setSecretLoading] = useState(false);
  const [secretError, setSecretError] = useState("");

  // 1. Auto-Redirect if user is already logged in (Persistent Session)
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || !isMounted) {
          setCheckingSession(false);
          return;
        }

        // Check if user is Super Admin
        const isKnownSuperEmail =
          !!user.email &&
          ([
            "edutechlab@gmail.com",
            "edutechlabb@gmail.com",
            "rehanedutechlab@gmail.com",
            "admin@edutechlab.com",
          ].includes(user.email.toLowerCase()) ||
            user.email.toLowerCase().includes("edutechlab"));

        const [{ data: isSuper }, { data: adminRecord }] = await Promise.all([
          supabase.rpc("is_platform_admin"),
          supabase
            .from("platform_admins")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (isSuper === true || !!adminRecord || isKnownSuperEmail) {
          localStorage.setItem("edutechlab_master_gate_unlocked", "true");
          sessionStorage.setItem("edutechlab_master_gate_unlocked", "true");
          document.cookie =
            "edutechlab_master_gate_unlocked=true; path=/; max-age=31536000; SameSite=Lax";
          window.location.replace("/super-admin");
          return;
        }

        // Regular institute user check
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        const role = String(profile?.role || "").trim().toLowerCase();
        window.location.replace(
          role === "owner" || role === "admin"
            ? "/dashboard"
            : "/staff-dashboard"
        );
      } catch {
        if (isMounted) setCheckingSession(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Secret 5-Tap Gesture on Logo (Only way to trigger Super Admin Gateway)
  const handleLogoTap = () => {
    setSecretTaps((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        setShowSecretModal(true);
        setSecretError("");
        return 0;
      }
      return next;
    });

    setTimeout(() => {
      setSecretTaps(0);
    }, 3000);
  };

  // 3. Regular Institute / Staff Form Submit (Strictly Normal Login)
  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const rawInput = loginId.trim();
    let emailToAuth = "";

    if (rawInput.includes("@")) {
      emailToAuth = rawInput.toLowerCase();
    } else {
      const normalized = rawInput.toUpperCase();
      const expectedPrefix = mode === "staff" ? "STAFF-" : "EDU-";
      if (!normalized.startsWith(expectedPrefix)) {
        setError(
          mode === "staff"
            ? "Enter the Staff ID provided by your institute."
            : "Enter your Institute ID (e.g. EDU-XXXX) or registered Email."
        );
        setLoading(false);
        return;
      }

      const { data: resolved, error: resolveError } =
        await supabase.functions.invoke("resolve-login-id", {
          body: { loginId: normalized },
        });

      if (resolveError || !resolved?.email) {
        setError(
          resolveError?.message ||
            resolved?.error ||
            "Institute / Staff ID or password is incorrect."
        );
        setLoading(false);
        return;
      }
      emailToAuth = resolved.email;
    }

    const { data: sessionData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: emailToAuth,
        password,
      });

    if (authError || !sessionData.user) {
      setError("Institute / Staff ID or password is incorrect.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", sessionData.user.id)
      .single();

    const role = String(profile?.role || "").trim().toLowerCase();
    window.location.href =
      role === "owner" || role === "admin" ? "/dashboard" : "/staff-dashboard";
  }

  // 4. Secret Modal Submit (Triggered ONLY via 5-Tap Gesture)
  async function handleSecretSubmit(e: FormEvent) {
    e.preventDefault();
    setSecretLoading(true);
    setSecretError("");

    if (secretAccessCode.trim() !== MASTER_ACCESS_CODE) {
      setSecretError("Invalid Master Access Code.");
      setSecretLoading(false);
      return;
    }

    try {
      const email = secretEmail.trim().toLowerCase() || "edutechlab@gmail.com";
      const { data: authData, error: authErr } =
        await supabase.auth.signInWithPassword({
          email,
          password: secretPassword,
        });

      if (authErr || !authData.user) {
        throw new Error("Invalid super admin email or password.");
      }

      const [{ data: isSuper }, { data: adminRecord }] = await Promise.all([
        supabase.rpc("is_platform_admin"),
        supabase
          .from("platform_admins")
          .select("role")
          .eq("user_id", authData.user.id)
          .maybeSingle(),
      ]);

      const isKnown =
        !!authData.user.email &&
        ([
          "edutechlab@gmail.com",
          "edutechlabb@gmail.com",
          "rehanedutechlab@gmail.com",
          "admin@edutechlab.com",
        ].includes(authData.user.email.toLowerCase()) ||
          authData.user.email.toLowerCase().includes("edutechlab"));

      if (!isSuper && !adminRecord && !isKnown) {
        await supabase.auth.signOut();
        throw new Error("Access Denied: This account is not a super administrator.");
      }

      localStorage.setItem("edutechlab_master_gate_unlocked", "true");
      sessionStorage.setItem("edutechlab_master_gate_unlocked", "true");
      document.cookie =
        "edutechlab_master_gate_unlocked=true; path=/; max-age=31536000; SameSite=Lax";
      window.location.href = "/super-admin";
    } catch (err: any) {
      setSecretError(err.message || "Failed to authenticate super admin.");
    } finally {
      setSecretLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f7f4]">
        <div className="flex flex-col items-center gap-3 text-slate-500 text-sm">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#6657e8] border-t-transparent" />
          <p className="font-medium">Connecting to workspace...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-5 py-8 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_100px_rgba(30,24,75,.12)] md:grid-cols-[1.05fr_.95fr]">
          {/* Left Hero Pane */}
          <div className="hidden bg-[#171625] p-12 text-white md:block">
            <button
              type="button"
              onClick={handleLogoTap}
              className="flex items-center gap-2.5 text-left outline-none cursor-default"
              title="EduTechLab Platform"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-[#171625]">
                <GraduationCap size={18} />
              </span>
              <span className="font-bold">EduTechLab</span>
            </button>

            <div className="mt-28">
              <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#58dfcc]">
                {mode === "staff" ? "Staff workspace" : "Admin workspace"}
              </p>
              <h1 className="mt-4 text-5xl font-semibold leading-[.95] tracking-[-.07em]">
                {mode === "staff" ? (
                  <>
                    Your work.
                    <br />
                    In the right place.
                  </>
                ) : (
                  <>
                    Your institution,
                    <br />
                    under control.
                  </>
                )}
              </h1>
              <p className="mt-6 max-w-sm text-sm leading-7 text-white/50">
                {mode === "staff"
                  ? "Sign in with the Staff ID and password created for you. Your workspace will show only the features your administrator has enabled."
                  : "Manage students, attendance, fees, exams, staff and notices from one connected workspace."}
              </p>
              <div className="mt-9 space-y-3 text-xs text-white/65">
                <div className="flex items-center gap-3">
                  <ShieldCheck size={16} className="text-[#58dfcc]" /> Separate institute
                  workspace
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck size={16} className="text-[#58dfcc]" /> Role-based staff
                  access
                </div>
              </div>
            </div>
          </div>

          {/* Right Form Pane */}
          <div className="p-7 sm:p-10 md:p-12">
            <div className="md:hidden">
              <button
                type="button"
                onClick={handleLogoTap}
                className="flex items-center gap-2.5 text-left outline-none cursor-default"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#171625] text-white">
                  <GraduationCap size={18} />
                </span>
                <span className="font-bold text-slate-900">EduTechLab</span>
              </button>
            </div>

            <div className="mx-auto mt-8 max-w-sm md:mt-16">
              <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#6657e8]">
                Welcome back
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-.05em] text-slate-900">
                {mode === "staff" ? "Staff sign in" : "Admin sign in"}
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                {mode === "staff"
                  ? "Use the Staff ID and password given to you by your institute administrator."
                  : "Use the Institute ID and password you received when you registered."}
              </p>

              {/* Institute / Staff Toggle */}
              <div className="mt-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("admin");
                    setLoginId("");
                    setError("");
                  }}
                  className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${
                    mode === "admin"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  Admin / Institute
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("staff");
                    setLoginId("");
                    setError("");
                  }}
                  className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${
                    mode === "staff"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  Staff
                </button>
              </div>

              <form onSubmit={submit} className="mt-8 space-y-5">
                <label className="block text-sm font-semibold text-slate-700">
                  {mode === "staff" ? "Staff ID" : "Institute ID"}
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3.5 font-mono uppercase tracking-[.08em] outline-none focus:border-[#6657e8] focus:ring-4 focus:ring-[#6657e8]/10"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder={
                      mode === "staff" ? "STAFF-AB12CD3456" : "EDU-NSPS2026"
                    }
                    required
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Password
                  <div className="relative mt-2">
                    <input
                      className="w-full rounded-xl border border-slate-300 px-4 py-3.5 pr-12 outline-none focus:border-[#6657e8] focus:ring-4 focus:ring-[#6657e8]/10"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>

                {error && (
                  <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </p>
                )}

                <button
                  disabled={loading}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#171625] px-5 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {loading
                    ? "Signing in..."
                    : mode === "staff"
                    ? "Sign in to staff panel"
                    : "Sign in to admin panel"}
                  {!loading && (
                    <ArrowRight
                      size={16}
                      className="transition group-hover:translate-x-1"
                    />
                  )}
                </button>
              </form>

              <div className="mt-7 border-t border-slate-100 pt-6 text-center text-sm text-slate-500">
                New institute?{" "}
                <Link href="/register" className="font-bold text-[#6657e8]">
                  Register your institute
                </Link>
              </div>

              <div className="mt-3 text-center text-xs text-slate-500">
                Are you a parent or guardian?{" "}
                <Link
                  href="/parent-portal"
                  className="font-bold text-slate-900 hover:underline"
                >
                  Access Parent Portal
                </Link>
              </div>

              <p className="mt-5 text-center text-[11px] text-slate-400">
                Keep your login ID and password private. Staff access is controlled by your institute administrator.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Exclusive Secret Modal: Master Super Admin Access (Triggered ONLY by 5-Tap Gesture on Logo) */}
      {showSecretModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-800 bg-[#12111d] p-6 text-white shadow-2xl">
            <button
              onClick={() => {
                setShowSecretModal(false);
                setSecretError("");
              }}
              className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Platform Master Gateway</h3>
                <p className="text-xs text-slate-400">Restricted to Super Administrators</p>
              </div>
            </div>

            <form onSubmit={handleSecretSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Master Access Code
                </label>
                <div className="relative">
                  <KeyRound
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    type="password"
                    value={secretAccessCode}
                    onChange={(e) => setSecretAccessCode(e.target.value)}
                    placeholder="Enter Master Access Code"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/90 py-3 pl-10 pr-4 text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Super Admin Email
                </label>
                <input
                  type="email"
                  value={secretEmail}
                  onChange={(e) => setSecretEmail(e.target.value)}
                  placeholder="edutechlab@gmail.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-4 py-3 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showSecretPassword ? "text" : "password"}
                    value={secretPassword}
                    onChange={(e) => setSecretPassword(e.target.value)}
                    placeholder="Super Admin Password"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-4 py-3 pr-10 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecretPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showSecretPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {secretError && (
                <p className="rounded-xl border border-red-500/30 bg-red-950/50 p-3 text-xs text-red-300">
                  {secretError}
                </p>
              )}

              <div className="mt-5 flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSecretModal(false)}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 py-3 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={secretLoading}
                  className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-[#6657e8] py-3 text-xs font-bold text-white shadow-lg shadow-purple-600/30 hover:from-purple-500 hover:to-purple-600 transition disabled:opacity-50"
                >
                  {secretLoading ? "Authorizing..." : "Unlock Master Console"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
