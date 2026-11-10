"use client";

import { useEffect, useState, useMemo, FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgePercent,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  IndianRupee,
  KeyRound,
  LogOut,
  MessageCircle,
  Pause,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  TrendingUp,
  UserCheck,
  Wallet,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import InstallButton from "@/components/pwa/InstallButton";

const AGENT_SESSION_KEY = "edutechlab_agent_session";

type AgentProfile = {
  id: string;
  full_name: string;
  agent_code: string;
  email: string | null;
  phone: string;
  city: string | null;
  joining_commission_percent: number;
  recurring_commission_percent: number;
  upi_id: string | null;
  bank_details: string | null;
  created_at: string;
};

type AgentWallet = {
  total_earned: number;
  joining_earned: number;
  recurring_earned: number;
  bonus_earned: number;
  total_paid: number;
  pending_balance: number;
  total_revenue_generated: number;
};

type ReferredSchool = {
  id: string;
  name: string;
  created_at: string;
  is_paused: boolean;
  is_active: boolean;
  student_count: number;
  student_limit: number;
  plan_type: string;
  is_trial: boolean;
  sub_status: string;
  monthly_amount: number;
  valid_until: string | null;
  total_school_paid: number;
  agent_earned_from_school: number;
};

type CommissionEntry = {
  id: string;
  organization_name: string;
  commission_type: "joining_fee" | "recurring" | "bonus_adjustment";
  gross_payment_amount: number;
  commission_percent: number;
  commission_amount: number;
  reference_utr: string | null;
  notes: string | null;
  created_at: string;
};

type PayoutEntry = {
  id: string;
  amount: number;
  payment_method: string;
  reference_no: string | null;
  paid_for_month: string | null;
  notes: string | null;
  paid_at: string;
};

type PortalDashboardData = {
  authenticated: boolean;
  error?: string;
  agent: AgentProfile;
  wallet: AgentWallet;
  schools: ReferredSchool[];
  commissions: CommissionEntry[];
  payouts: PayoutEntry[];
  platform_contact?: {
    brand_name?: string;
    contact_phone?: string;
    whatsapp_number?: string;
    contact_email?: string;
    standard_rate?: number;
    pro_rate?: number;
  };
};

export default function AgentPortalPage() {
  const supabase = createClient();

  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionToken, setSessionToken] = useState<string>("");
  const [dashboard, setDashboard] = useState<PortalDashboardData | null>(null);
  const [origin, setOrigin] = useState("https://edutechlab-9fz4.vercel.app");

  // Login State
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  // Feedback
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Dashboard Tabs & Filters
  const [activeTab, setActiveTab] = useState<"schools" | "commissions" | "payouts">("schools");
  const [schoolSearch, setSchoolSearch] = useState("");
  const [commFilter, setCommFilter] = useState<"all" | "joining_fee" | "recurring" | "bonus_adjustment">("all");
  const [copiedKey, setCopiedKey] = useState<"" | "code" | "link" | "pitch">("");
  const [refreshing, setRefreshing] = useState(false);

  // Payout Settings Form
  const [upiInput, setUpiInput] = useState("");
  const [bankInput, setBankInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Change Form
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const loadDashboard = async (token: string, silent = false) => {
    if (!token) {
      setCheckingSession(false);
      return;
    }
    if (!silent) setCheckingSession(true);
    setRefreshing(true);
    setError("");

    try {
      const { data, error: rpcErr } = await supabase.rpc("get_agent_portal_dashboard", {
        p_session_token: token,
      });

      if (rpcErr) throw rpcErr;

      const parsed = data as PortalDashboardData;
      if (!parsed || !parsed.authenticated) {
        try {
          localStorage.removeItem(AGENT_SESSION_KEY);
        } catch {}
        setSessionToken("");
        setDashboard(null);
        if (parsed?.error) {
          setError(parsed.error);
        }
        return;
      }

      setDashboard(parsed);
      setSessionToken(token);
      setUpiInput(parsed.agent.upi_id || "");
      setBankInput(parsed.agent.bank_details || "");
      setPhoneInput(parsed.agent.phone || "");
    } catch (err: any) {
      setError(err.message || "Could not load partner portal. Please try again.");
    } finally {
      setCheckingSession(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        setOrigin(window.location.origin);
        const saved = localStorage.getItem(AGENT_SESSION_KEY) || "";
        if (saved) {
          setSessionToken(saved);
          loadDashboard(saved);
          return;
        }
      }
    } catch {}
    setCheckingSession(false);
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError("Please enter your Agent Code / Email / Phone and Password.");
      return;
    }

    setLoggingIn(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: loginErr } = await supabase.rpc("agent_login", {
        p_identifier: identifier.trim(),
        p_password: password,
      });

      if (loginErr) throw loginErr;

      if (!data?.success || !data?.token) {
        setError(data?.error || "Invalid credentials. Please check your Partner ID & Password.");
        return;
      }

      try {
        localStorage.setItem(AGENT_SESSION_KEY, data.token);
      } catch {}
      setPassword("");
      await loadDashboard(data.token);
    } catch (err: any) {
      setError(err.message || "Login failed. Please ensure the sales partner module is enabled.");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (sessionToken) {
        await supabase.rpc("agent_logout", { p_session_token: sessionToken });
      }
    } catch {}
    try {
      localStorage.removeItem(AGENT_SESSION_KEY);
    } catch {}
    setSessionToken("");
    setDashboard(null);
    setSuccess("");
    setError("");
  };

  const handleSavePayoutDetails = async (e: FormEvent) => {
    e.preventDefault();
    if (!sessionToken) return;
    setSavingProfile(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: rpcErr } = await supabase.rpc("agent_update_payout_details", {
        p_session_token: sessionToken,
        p_upi_id: upiInput.trim() || null,
        p_bank_details: bankInput.trim() || null,
        p_phone: phoneInput.trim() || null,
      });
      if (rpcErr) throw rpcErr;
      setSuccess(data?.message || "Your UPI & bank payout details have been updated.");
      await loadDashboard(sessionToken, true);
    } catch (err: any) {
      setError(err.message || "Failed to update payout details.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!sessionToken) return;
    if (newPassword.trim().length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    setChangingPassword(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: rpcErr } = await supabase.rpc("agent_change_password", {
        p_session_token: sessionToken,
        p_old_password: oldPassword,
        p_new_password: newPassword.trim(),
      });
      if (rpcErr) throw rpcErr;

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(data?.message || "Password updated successfully.");
    } catch (err: any) {
      setError(err.message || "Could not change password.");
    } finally {
      setChangingPassword(false);
    }
  };

  const copyText = (text: string, key: "code" | "link" | "pitch") => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 2500);
    }
  };

  const schools = dashboard?.schools || [];
  const commissions = dashboard?.commissions || [];
  const payouts = dashboard?.payouts || [];

  const filteredSchools = useMemo(() => {
    const q = schoolSearch.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) => s.name.toLowerCase().includes(q));
  }, [schools, schoolSearch]);

  const filteredCommissions = useMemo(() => {
    if (commFilter === "all") return commissions;
    return commissions.filter((c) => c.commission_type === commFilter);
  }, [commissions, commFilter]);

  const activePaidSchoolsCount = useMemo(
    () =>
      schools.filter(
        (s) => !s.is_paused && !s.is_trial && s.sub_status === "active" && (!s.valid_until || new Date(s.valid_until) >= new Date())
      ).length,
    [schools]
  );

  const trialSchoolsCount = useMemo(() => schools.filter((s) => s.is_trial).length, [schools]);

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-2xl border border-purple-200 bg-white p-1.5 shadow-sm flex items-center justify-center">
            <img src="/icons/icon-192.png" alt="EduTechLab" className="h-full w-full object-contain rounded-xl" />
          </div>
          <p className="text-sm font-semibold text-slate-600">Loading Partner Portal...</p>
        </div>
      </main>
    );
  }

  // =========================================================================
  // LOGIN VIEW
  // =========================================================================
  if (!dashboard?.authenticated) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 flex flex-col justify-center p-5 sm:p-8">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/20 transition"
            >
              <ArrowLeft size={14} /> Back to Website
            </Link>
            <InstallButton />
          </div>

          <div className="rounded-3xl border border-white/15 bg-white p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-purple-200 bg-white p-0.5 shadow-sm flex items-center justify-center">
                <img
                  src="/icons/icon-192.png"
                  alt="EduTechLab Logo"
                  className="h-full w-full object-contain rounded-xl"
                />
              </div>
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-purple-800">
                  <BadgePercent size={11} /> Sales Partner Portal
                </span>
                <h1 className="mt-0.5 text-xl font-black text-slate-900">
                  EduTechLab Agent Login
                </h1>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-500 leading-relaxed">
              Log in to access your Referral Link, track your onboarded schools, view Joining Fee &amp; Monthly Recurring Commissions, and check your payouts.
            </p>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Agent Code / Email / Phone
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. AGT-RAHUL01 or 9876543210"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Partner Password
                </label>
                <div className="relative mt-1.5">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-11 text-sm font-semibold text-slate-900 outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-600/25 hover:from-purple-500 hover:to-teal-500 active:scale-[0.99] transition disabled:opacity-50"
              >
                {loggingIn ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Signing In...
                  </>
                ) : (
                  <>
                    <UserCheck size={16} />
                    Sign In to Partner Dashboard
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-[11px] text-slate-500 space-y-1">
              <p className="font-semibold text-slate-700">Need an Agent ID or Password Reset?</p>
              <p>
                Contact EduTechLab Super Admin to activate your Partner Account and set your custom Joining &amp; Monthly Commission slabs.
              </p>
              <div className="pt-1 flex items-center justify-between text-xs font-semibold">
                <Link href="/login" className="text-purple-700 hover:underline">
                  School / Staff Login &rarr;
                </Link>
                <Link href="/register" className="text-teal-700 hover:underline">
                  Register a School &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // =========================================================================
  // AUTHENTICATED PARTNER DASHBOARD VIEW
  // =========================================================================
  const { agent, wallet, platform_contact } = dashboard;
  const referralUrl = `${origin}/register?ref=${encodeURIComponent(agent.agent_code)}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=6&data=${encodeURIComponent(referralUrl)}`;
  const stdRate = platform_contact?.standard_rate || 5;
  const proRate = platform_contact?.pro_rate || 7;

  const whatsappPitchText = `🌟 *EduTechLab School & Coaching Management ERP* 🌟

Apne school ko banayein 100% Digital!
✅ QR Smart Gate Attendance + Auto Absent Alerts
✅ Online / Offline Fee Receipts & Dues Tracker
✅ One-Click Luxury Marksheets, Admit Cards & PVC ID Cards
✅ Mobile App & Parent Communication

💰 *Affordable Pricing:* Only ₹${stdRate}/student (Standard) & ₹${proRate}/student (Pro) — Free Demo Trial Available!

👇 *Apna School Register Karein (Partner Code: ${agent.agent_code}):*
${referralUrl}

Kisi bhi setup ya live demo ke liye call/WhatsApp karein: ${agent.phone}`;

  const superAdminWhatsapp = (platform_contact?.whatsapp_number || "917903178550").replace(/\D/g, "");

  return (
    <main className="min-h-screen bg-slate-50/70 pb-16">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-2xl border border-purple-200 bg-white p-0.5 shadow-sm flex items-center justify-center">
              <img src="/icons/icon-192.png" alt="EduTechLab" className="h-full w-full object-contain rounded-xl" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900">{agent.full_name}</h1>
                <span className="rounded-lg bg-purple-100 px-2 py-0.5 font-mono text-[11px] font-black text-purple-800">
                  {agent.agent_code}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700 border border-emerald-200">
                  Joining Bonus: {Number(agent.joining_commission_percent)}%
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-indigo-700 border border-indigo-200">
                  Monthly Recurring: {Number(agent.recurring_commission_percent)}%
                </span>
                {agent.city && <span className="text-slate-400 font-medium">• {agent.city}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <InstallButton />
            <button
              type="button"
              onClick={() => loadDashboard(sessionToken, true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 space-y-6">
        {/* Alerts */}
        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm font-medium text-red-700">
            <AlertTriangle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs sm:text-sm font-medium text-emerald-800">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Referral Toolkit Hero Card */}
        <section className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 p-5 sm:p-7 text-white shadow-xl">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-[11px] font-bold text-emerald-300">
                <Sparkles size={13} /> Partner Commission Model Active
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                  Share Your Referral Link &amp; Build Monthly Passive Income
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm text-indigo-200/90 leading-relaxed max-w-2xl">
                  Jab bhi koi school aapke referral link ya code (<strong className="text-white font-mono">{agent.agent_code}</strong>) se join karta hai, aapko unki{" "}
                  <strong className="text-emerald-300">{Number(agent.joining_commission_percent)}% One-Time Joining Fee</strong> + har mahine active recharge par{" "}
                  <strong className="text-cyan-300">{Number(agent.recurring_commission_percent)}% Recurring Commission</strong> milta hai!
                </p>
              </div>

              {/* Referral Link Copy Box */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 backdrop-blur">
                  <span className="font-mono text-xs text-purple-100 truncate mr-3">{referralUrl}</span>
                  <button
                    type="button"
                    onClick={() => copyText(referralUrl, "link")}
                    className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-extrabold text-slate-900 hover:bg-purple-50 transition"
                  >
                    {copiedKey === "link" ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    {copiedKey === "link" ? "Copied!" : "Copy Link"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => copyText(agent.agent_code, "code")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition"
                >
                  {copiedKey === "code" ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
                  Code: {agent.agent_code}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => copyText(whatsappPitchText, "pitch")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-emerald-400 transition shadow-md"
                >
                  {copiedKey === "pitch" ? <Check size={14} /> : <Send size={14} />}
                  {copiedKey === "pitch" ? "WhatsApp Pitch Copied!" : "Copy WhatsApp Sales Pitch"}
                </button>

                <a
                  href={`https://wa.me/?text=${encodeURIComponent(whatsappPitchText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/20 px-4 py-2.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/30 transition"
                >
                  <MessageCircle size={14} />
                  Share on WhatsApp
                </a>

                <a
                  href={`https://wa.me/${superAdminWhatsapp}?text=${encodeURIComponent(
                    `Namaste Admin, I am Partner ${agent.full_name} (${agent.agent_code}). I need assistance regarding my account/payout.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-white/20 transition"
                >
                  <ExternalLink size={13} /> Support Admin
                </a>
              </div>
            </div>

            {/* Right: Scannable Partner Referral QR */}
            <div className="lg:col-span-4 flex flex-col items-center justify-center rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <div className="rounded-2xl bg-white p-2.5 shadow-lg">
                <img src={qrImageUrl} alt="Agent Referral QR" className="h-36 w-36 object-contain" />
              </div>
              <p className="mt-2.5 text-xs font-bold text-white flex items-center gap-1.5">
                <QrCode size={14} className="text-emerald-300" /> Instant School Onboarding QR
              </p>
              <p className="text-[11px] text-indigo-200 text-center">
                School Principal scans this to register directly under you
              </p>
            </div>
          </div>
        </section>

        {/* Wallet KPI Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Pending Balance */}
          <div className="rounded-3xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Pending Payout Balance
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-600 text-white">
                <Wallet size={16} />
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-emerald-950 font-mono">
              ₹{Number(wallet.pending_balance || 0).toLocaleString("en-IN")}
            </p>
            <p className="mt-1.5 text-[11px] text-emerald-700 font-medium">
              {agent.upi_id ? `Payout UPI: ${agent.upi_id}` : "Set your UPI / Bank in Payouts tab"}
            </p>
          </div>

          {/* Card 2: Total Commission Earned */}
          <div className="rounded-3xl border border-purple-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-800">
                Total Commission Earned
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-purple-100 text-purple-700">
                <TrendingUp size={16} />
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-slate-900 font-mono">
              ₹{Number(wallet.total_earned || 0).toLocaleString("en-IN")}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-slate-600">
              <span>
                Joining: <strong className="text-emerald-700">₹{Number(wallet.joining_earned || 0).toLocaleString("en-IN")}</strong>
              </span>
              <span>•</span>
              <span>
                Monthly: <strong className="text-indigo-700">₹{Number(wallet.recurring_earned || 0).toLocaleString("en-IN")}</strong>
              </span>
            </div>
          </div>

          {/* Card 3: Already Paid Out */}
          <div className="rounded-3xl border border-blue-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
                Total Paid Out
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-100 text-blue-700">
                <CreditCard size={16} />
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-slate-900 font-mono">
              ₹{Number(wallet.total_paid || 0).toLocaleString("en-IN")}
            </p>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Across {payouts.length} settlement{payouts.length === 1 ? "" : "s"} by Admin
            </p>
          </div>

          {/* Card 4: Onboarded Schools */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                My Referred Schools
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-slate-700">
                <Building2 size={16} />
              </span>
            </div>
            <p className="mt-3 text-3xl font-black text-slate-900 font-mono">{schools.length}</p>
            <p className="mt-1.5 text-[11px] text-slate-600">
              <strong className="text-emerald-700">{activePaidSchoolsCount} Active Paid</strong> •{" "}
              <strong className="text-purple-700">{trialSchoolsCount} On Trial</strong>
            </p>
          </div>
        </section>

        {/* Sub-Tabs Navigation */}
        <div className="flex border-b border-slate-200 bg-white rounded-t-2xl px-2 pt-2 text-xs sm:text-sm font-bold overflow-x-auto shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("schools")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 whitespace-nowrap transition ${
              activeTab === "schools"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Building2 size={15} />
            My Schools ({schools.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("commissions")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 whitespace-nowrap transition ${
              activeTab === "commissions"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <IndianRupee size={15} />
            Commission Ledger ({commissions.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("payouts")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 whitespace-nowrap transition ${
              activeTab === "payouts"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Wallet size={15} />
            Payouts &amp; Bank Settings ({payouts.length})
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: REFERRED SCHOOLS                                        */}
        {/* ============================================================== */}
        {activeTab === "schools" && (
          <section className="rounded-b-3xl rounded-tr-3xl border border-slate-200 bg-white shadow-sm overflow-hidden -mt-6">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Schools Joined Using Your Code</h3>
                <p className="text-xs text-slate-500">
                  Track trial conversions, active student quota, and total commission earned per school.
                </p>
              </div>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search school name..."
                  value={schoolSearch}
                  onChange={(e) => setSchoolSearch(e.target.value)}
                  className="w-full sm:w-64 rounded-xl border border-slate-200 pl-9 pr-3.5 py-2 text-xs outline-none focus:border-purple-600"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[11px] text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3.5">School Name</th>
                    <th className="px-5 py-3.5">Students / Quota</th>
                    <th className="px-5 py-3.5">Subscription Status</th>
                    <th className="px-5 py-3.5">Valid Until</th>
                    <th className="px-5 py-3.5 text-right">School Paid</th>
                    <th className="px-5 py-3.5 text-right">Your Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSchools.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-sm text-slate-500">
                        {schools.length === 0
                          ? `Abhi tak koi school aapke referral code (${agent.agent_code}) se register nahi hua hai. Upar diya gaya referral link schools ke sath share karein!`
                          : "No referred schools match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredSchools.map((s) => {
                      const isExpired = s.valid_until && new Date(s.valid_until) < new Date();
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/60">
                          <td className="px-5 py-4">
                            <div className="font-bold text-slate-900 text-sm">{s.name}</div>
                            <div className="text-[11px] text-slate-400">
                              Joined {new Date(s.created_at).toLocaleDateString("en-IN")}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="font-bold text-slate-900">{s.student_count}</span>{" "}
                            <span className="text-slate-400">/ {s.student_limit} students</span>
                          </td>
                          <td className="px-5 py-4">
                            {s.is_paused ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                                <Pause size={10} /> Paused
                              </span>
                            ) : s.is_trial ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-bold text-purple-800">
                                <Clock size={10} /> Free Trial
                              </span>
                            ) : isExpired ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-700">
                                Expired
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                                <CheckCircle2 size={10} /> Active Paid
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-slate-600">
                            {s.valid_until
                              ? new Date(s.valid_until).toLocaleDateString("en-IN")
                              : "—"}
                          </td>
                          <td className="px-5 py-4 text-right font-mono font-semibold text-slate-700">
                            ₹{Number(s.total_school_paid || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="px-5 py-4 text-right font-mono font-extrabold text-emerald-700 text-sm">
                            +₹{Number(s.agent_earned_from_school || 0).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ============================================================== */}
        {/* TAB 2: COMMISSION LEDGER                                       */}
        {/* ============================================================== */}
        {activeTab === "commissions" && (
          <section className="rounded-b-3xl rounded-tr-3xl border border-slate-200 bg-white shadow-sm overflow-hidden -mt-6">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Commission Earnings Ledger</h3>
                <p className="text-xs text-slate-500">
                  Every approved Joining Fee &amp; Monthly Subscription payment automatically credits your wallet here.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1 text-xs font-bold">
                {(
                  [
                    ["all", "All"],
                    ["joining_fee", "Joining Fee"],
                    ["recurring", "Monthly"],
                    ["bonus_adjustment", "Bonus"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCommFilter(key)}
                    className={`rounded-lg px-3 py-1.5 transition ${
                      commFilter === key
                        ? "bg-white text-purple-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[11px] text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">School / Particulars</th>
                    <th className="px-5 py-3.5">Type</th>
                    <th className="px-5 py-3.5 text-right">School Paid</th>
                    <th className="px-5 py-3.5 text-center">Rate</th>
                    <th className="px-5 py-3.5 text-right">Credited</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCommissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-sm text-slate-500">
                        No commission entries recorded yet. Commissions credit automatically when Super Admin approves school payments.
                      </td>
                    </tr>
                  ) : (
                    filteredCommissions.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/60">
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                          {new Date(c.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-900">{c.organization_name}</div>
                          {(c.notes || c.reference_utr) && (
                            <div className="text-[11px] text-slate-400">
                              {c.notes} {c.reference_utr ? `• ${c.reference_utr}` : ""}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {c.commission_type === "joining_fee" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                              Joining Fee Bonus
                            </span>
                          ) : c.commission_type === "recurring" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800">
                              Monthly Recurring
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                              Bonus / Adjustment
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-slate-700">
                          ₹{Number(c.gross_payment_amount || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-5 py-4 text-center font-mono font-bold text-purple-700">
                          {Number(c.commission_percent || 0)}%
                        </td>
                        <td className="px-5 py-4 text-right font-mono font-black text-emerald-700 text-sm">
                          +₹{Number(c.commission_amount || 0).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ============================================================== */}
        {/* TAB 3: PAYOUT SETTLEMENTS & PROFILE SETTINGS                   */}
        {/* ============================================================== */}
        {activeTab === "payouts" && (
          <section className="grid gap-6 lg:grid-cols-12 -mt-2">
            {/* Left: Payout History (7 cols) */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden lg:col-span-7">
              <div className="border-b border-slate-100 p-5">
                <h3 className="text-base font-bold text-slate-900">Payout Settlement History</h3>
                <p className="text-xs text-slate-500">
                  Payments transferred by EduTechLab Super Admin to your UPI ID or Bank Account.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[11px] text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3.5">Paid Date</th>
                      <th className="px-5 py-3.5">Method / Month</th>
                      <th className="px-5 py-3.5">UTR / Ref</th>
                      <th className="px-5 py-3.5 text-right">Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payouts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-10 text-center text-sm text-slate-500">
                          No payouts settled yet. When Super Admin sends your commission payout, the receipt will appear here.
                        </td>
                      </tr>
                    ) : (
                      payouts.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/60">
                          <td className="px-5 py-4 text-slate-700 font-medium whitespace-nowrap">
                            {new Date(p.paid_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-5 py-4">
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 font-bold uppercase text-[10px] text-blue-800">
                              {p.payment_method}
                            </span>
                            {p.paid_for_month && (
                              <span className="ml-2 text-slate-500 font-medium">{p.paid_for_month}</span>
                            )}
                            {p.notes && <div className="mt-0.5 text-[11px] text-slate-400">{p.notes}</div>}
                          </td>
                          <td className="px-5 py-4 font-mono text-slate-700">{p.reference_no || "—"}</td>
                          <td className="px-5 py-4 text-right font-mono font-extrabold text-blue-700 text-sm">
                            ₹{Number(p.amount).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Payout Bank/UPI & Password Forms (5 cols) */}
            <div className="space-y-6 lg:col-span-5">
              {/* Update UPI / Bank Form */}
              <form
                onSubmit={handleSavePayoutDetails}
                className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                    <Wallet size={18} />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Your Payout Receiving Details</h3>
                    <p className="text-[11px] text-slate-500">
                      Super Admin isi UPI / Bank par aapka commission bhejega.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    UPI ID (PhonePe / GPay / Paytm)
                  </label>
                  <input
                    type="text"
                    value={upiInput}
                    onChange={(e) => setUpiInput(e.target.value)}
                    placeholder="e.g. rahul@ybl"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono outline-none focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Bank Account Details (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={bankInput}
                    onChange={(e) => setBankInput(e.target.value)}
                    placeholder="Account Holder, A/C No, IFSC Code, Bank Name"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs outline-none focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Contact / WhatsApp Phone
                  </label>
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-purple-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition disabled:opacity-50"
                >
                  {savingProfile ? "Saving Details..." : "Save Payout Details"}
                </button>
              </form>

              {/* Change Password Form */}
              <form
                onSubmit={handleChangePassword}
                className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-xl bg-purple-100 p-2 text-purple-700">
                    <KeyRound size={18} />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Change Portal Password</h3>
                    <p className="text-[11px] text-slate-500">Update your Agent Portal login password</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-purple-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-purple-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-purple-600"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={changingPassword}
                  className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {changingPassword ? "Updating Password..." : "Update Password"}
                </button>
              </form>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
