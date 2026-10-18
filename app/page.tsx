"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  Download,
  GraduationCap,
  Layers,
  Lock,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Users,
  WalletCards,
  Zap,
  Building2,
  BookOpen,
  Award,
  TrendingUp,
  Sliders,
  Printer,
  Calendar,
  Send,
  HelpCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import InstallButton from "@/components/pwa/InstallButton";

export default function Home() {
  // Interactive Calculator State
  const [studentCount, setStudentCount] = useState(150);

  // Interactive Live Feature Mockup Tab
  const [activeTab, setActiveTab] = useState<"attendance" | "fees" | "exams" | "parents" | "app">("attendance");

  // Institute Type Switcher
  const [activeType, setActiveType] = useState<"schools" | "coaching" | "madrasas" | "colleges">("schools");

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Auto-Redirect for Logged-In Users & Installed Standalone PWA
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
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
          return;
        }

        // Standalone PWA mobile app auto-redirect to login
        const isStandalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          (window.navigator as any).standalone === true ||
          document.referrer.includes("android-app://");

        if (isStandalone) {
          window.location.replace("/login");
        }
      } catch {
        // Fallback: stay on landing
      }
    })();
  }, []);

  // Pricing Calculation based on user model: ₹149 for 20 students + ₹7 per student
  const calculatedCost =
    studentCount <= 20 ? 149 : 149 + (studentCount - 20) * 7;
  const legacySoftwareCost = Math.round(studentCount * 38);
  const estimatedSavings = Math.max(
    50,
    Math.round(((legacySoftwareCost - calculatedCost) / legacySoftwareCost) * 100)
  );

  return (
    <main className="min-h-screen bg-[#0d0c18] text-slate-100 selection:bg-purple-500 selection:text-white">
      {/* Dynamic Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[1000px] rounded-full bg-gradient-to-tr from-purple-700/25 via-indigo-600/20 to-teal-500/15 blur-[140px]" />
        <div className="absolute top-[800px] -left-60 h-[500px] w-[600px] rounded-full bg-purple-900/15 blur-[120px]" />
        <div className="absolute top-[1800px] -right-60 h-[600px] w-[700px] rounded-full bg-teal-600/10 blur-[150px]" />
      </div>

      {/* 1. TOP ANNOUNCEMENT TICKER */}
      <div className="relative z-30 border-b border-purple-500/20 bg-gradient-to-r from-purple-950/80 via-[#18162e]/90 to-purple-950/80 px-4 py-2 text-center backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 text-xs font-semibold text-purple-200">
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/25 px-2.5 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-400/30">
            <Sparkles size={11} className="text-purple-300" /> NEW v2.0
          </span>
          <span>
            Ab Har School, Coaching & Madrasa ke liye Direct Mobile App Ready!
          </span>
          <span className="hidden sm:inline font-bold text-teal-300">
            • 15-Day Free Trial Available
          </span>
          <Link
            href="/register"
            className="ml-2 underline underline-offset-4 hover:text-white transition"
          >
            Claim Trial →
          </Link>
        </div>
      </div>

      {/* 2. STICKY MODERN NAVBAR */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0d0c18]/80 backdrop-blur-xl transition">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          {/* Brand Logo */}
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="relative grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-teal-400 p-0.5 shadow-lg shadow-purple-600/30 group-hover:scale-105 transition-transform">
              <div className="grid h-full w-full place-items-center rounded-[14px] bg-[#121124]">
                <GraduationCap size={20} className="text-white" />
              </div>
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-white">
                EduTech<span className="bg-gradient-to-r from-purple-400 to-teal-300 bg-clip-text text-transparent">Lab</span>
              </span>
              <span className="hidden sm:inline-block ml-2 rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-purple-300 uppercase tracking-widest">
                OS
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-7 text-xs font-semibold text-slate-300 md:flex">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#demo" className="hover:text-white transition">Live Demo</a>
            <a href="#calculator" className="hover:text-white transition flex items-center gap-1 text-purple-300">
              <Sparkles size={12} /> Pricing Calculator
            </a>
            <a href="#institutes" className="hover:text-white transition">For Institutes</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 sm:gap-3">
            <InstallButton className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-teal-500/40 bg-teal-500/10 px-3 py-1.5 text-xs font-bold text-teal-300 hover:bg-teal-500/20 transition shadow-sm" />
            <Link
              href="/login"
              className="rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-[#6657e8] px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-600/30 hover:from-purple-500 hover:to-purple-600 transition hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Start Free Trial</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </header>

      {/* 3. HERO SECTION (HIGH IMPACT FIRST IMPRESSION) */}
      <section className="relative px-5 pt-16 pb-20 sm:px-8 sm:pt-24 lg:pt-28">
        <div className="mx-auto max-w-6xl text-center">
          {/* Trust Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-950/60 px-4 py-1.5 text-xs font-medium text-purple-200 shadow-inner backdrop-blur-md animate-in fade-in slide-in-from-top-3">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Modern Education Management System for India</span>
            <span className="hidden sm:inline opacity-40">•</span>
            <span className="hidden sm:inline text-teal-300 font-bold">100% Mobile Ready</span>
          </div>

          {/* Punchy Hero Headline */}
          <h1 className="mt-7 text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl leading-[1.08]">
            Apne School & Coaching Ko Banayein{" "}
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-teal-300 bg-clip-text text-transparent">
              100% Digital, Fast Aur Paperless.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
            Admissions, 1-Click Mobile Attendance, Automated Fee Receipts with QR code,
            Smart Marksheets, aur Parents Portal — sab kuch ek simple, powerful app me.
            Spreadsheets aur purane registers ko hamesha ke liye alvida kahein.
          </p>

          {/* Action Button Row */}
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-[#6657e8] px-7 py-4 text-sm font-bold text-white shadow-xl shadow-purple-600/30 hover:from-purple-500 hover:to-purple-600 transition hover:-translate-y-0.5"
            >
              <span>Institute Register Karein (Free Trial)</span>
              <ArrowRight size={16} className="transition group-hover:translate-x-1" />
            </Link>

            <a
              href="#calculator"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-sm font-bold text-white backdrop-blur-md hover:bg-white/10 transition"
            >
              <Sliders size={16} className="text-teal-400" />
              <span>Calculate Your Monthly Cost</span>
            </a>
          </div>

          {/* Key Value Highlights */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-300">
              <CheckCircle2 size={14} className="text-teal-400" /> Starting Sirf ₹149/mahina
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <CheckCircle2 size={14} className="text-teal-400" /> Zero Software Setup Cost
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <CheckCircle2 size={14} className="text-teal-400" /> Direct Mobile Par App Install
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <CheckCircle2 size={14} className="text-teal-400" /> Har Mahine Cancel / Change Anytime
            </span>
          </div>
        </div>

        {/* 4. INTERACTIVE LIVE PLATFORM DEMO PREVIEW */}
        <div id="demo" className="mx-auto mt-16 max-w-5xl">
          {/* Glassmorphic Container */}
          <div className="relative rounded-3xl border border-white/15 bg-slate-900/80 p-2 shadow-[0_30px_100px_rgba(102,87,232,0.25)] backdrop-blur-2xl">
            {/* Top Interactive Feature Tabs */}
            <div className="flex items-center justify-between border-b border-white/10 bg-[#141226] px-4 py-3 rounded-t-[22px] overflow-x-auto gap-2">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-400/80" />
                <span className="h-3 w-3 rounded-full bg-amber-400/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
                <span className="ml-2 text-xs font-bold text-slate-400 hidden sm:inline">
                  EduTechLab Live Workspace
                </span>
              </div>

              {/* Tab Selector */}
              <div className="flex items-center gap-1">
                {[
                  { id: "attendance", label: "Attendance", icon: ClipboardCheck },
                  { id: "fees", label: "Fee Collection", icon: WalletCards },
                  { id: "exams", label: "Report Cards", icon: Award },
                  { id: "parents", label: "Parent Portal", icon: MessageCircle },
                  { id: "app", label: "Mobile PWA", icon: Smartphone },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                        isActive
                          ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <Icon size={14} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Interactive Preview Canvas */}
            <div className="p-4 sm:p-7 min-h-[360px] bg-[#100e20] rounded-b-[22px]">
              {/* TAB 1: ATTENDANCE */}
              {activeTab === "attendance" && (
                <div className="animate-in fade-in duration-300 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-purple-400">
                        Live Attendance Monitoring
                      </p>
                      <h3 className="text-xl font-bold text-white mt-0.5">
                        Today’s Class Attendance: 94.6% Marked
                      </h3>
                    </div>
                    <div className="flex gap-2">
                      <span className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400">
                        432 Present
                      </span>
                      <span className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-400">
                        24 Absent
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 pt-2">
                    {[
                      { class: "Class 10-A", teacher: "Mr. Sharma", status: "100% Done", color: "text-emerald-400" },
                      { class: "Class 9-B", teacher: "Ms. Khan", status: "96% Present", color: "text-emerald-400" },
                      { class: "Class 8-A", teacher: "Mr. Verma", status: "Pending (2min)", color: "text-amber-400" },
                    ].map((item, i) => (
                      <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-sm text-white">{item.class}</span>
                          <span className={`text-xs font-bold ${item.color}`}>{item.status}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Teacher: {item.teacher}</p>
                        <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-purple-500 to-teal-400 rounded-full" style={{ width: i === 0 ? "100%" : i === 1 ? "96%" : "60%" }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-purple-500/20 bg-purple-950/30 p-3.5 flex items-center justify-between text-xs text-purple-200">
                    <span className="flex items-center gap-2">
                      <Send size={15} className="text-purple-400" />
                      Absent hone wale bachchon ke parents ko automated WhatsApp SMS alert bhej diya gaya hai.
                    </span>
                    <span className="font-bold text-teal-300">Automated</span>
                  </div>
                </div>
              )}

              {/* TAB 2: FEES & QR CODE */}
              {activeTab === "fees" && (
                <div className="animate-in fade-in duration-300 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-teal-400">
                        Monthly Fee Collection & UPI Tracking
                      </p>
                      <h3 className="text-xl font-bold text-white mt-0.5">
                        October 2026: ₹3,42,000 Collected (89%)
                      </h3>
                    </div>
                    <span className="rounded-xl border border-teal-500/30 bg-teal-500/10 px-3 py-1.5 text-xs font-bold text-teal-300">
                      Institute UPI QR Active
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 pt-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs text-slate-400">Total Collected</p>
                      <p className="text-2xl font-bold text-white mt-1">₹3,42,000</p>
                      <p className="text-[11px] text-emerald-400 mt-1">+14% vs last month</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs text-slate-400">Pending Dues</p>
                      <p className="text-2xl font-bold text-rose-400 mt-1">₹42,500</p>
                      <p className="text-[11px] text-slate-400 mt-1">18 Students remaining</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs text-slate-400">Recent Payment</p>
                      <p className="text-base font-bold text-white mt-1">Aman Verma (Class 10)</p>
                      <p className="text-[11px] text-teal-300 mt-1">₹2,500 via PhonePe • Receipt #8721</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-teal-500/20 bg-teal-950/30 p-3.5 flex items-center justify-between text-xs text-teal-200">
                    <span className="flex items-center gap-2">
                      <Printer size={15} className="text-teal-400" />
                      Parents ko payment ke turant baad branded PDF fee receipt WhatsApp par chali jati hai.
                    </span>
                    <span className="font-bold text-white">Instant Receipt</span>
                  </div>
                </div>
              )}

              {/* TAB 3: REPORT CARDS */}
              {activeTab === "exams" && (
                <div className="animate-in fade-in duration-300 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-purple-400">
                        Exam Planning & Instant Marksheets
                      </p>
                      <h3 className="text-xl font-bold text-white mt-0.5">
                        Half Yearly Exam 2026 — Class 10 Result
                      </h3>
                    </div>
                    <span className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-bold text-purple-300">
                      1-Click PDF Marksheet
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 pt-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                      <div className="flex justify-between items-center text-sm font-bold text-white">
                        <span>Zaid Khan (Roll #01)</span>
                        <span className="text-emerald-400">92.4% • Grade A+ (Rank 1)</span>
                      </div>
                      <div className="text-xs text-slate-400 space-y-1">
                        <div className="flex justify-between"><span>Maths</span><span className="text-white font-mono">98/100</span></div>
                        <div className="flex justify-between"><span>Science</span><span className="text-white font-mono">94/100</span></div>
                        <div className="flex justify-between"><span>English</span><span className="text-white font-mono">88/100</span></div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                      <div className="flex justify-between items-center text-sm font-bold text-white">
                        <span>Ananya Gupta (Roll #02)</span>
                        <span className="text-emerald-400">89.8% • Grade A (Rank 2)</span>
                      </div>
                      <div className="text-xs text-slate-400 space-y-1">
                        <div className="flex justify-between"><span>Maths</span><span className="text-white font-mono">92/100</span></div>
                        <div className="flex justify-between"><span>Science</span><span className="text-white font-mono">90/100</span></div>
                        <div className="flex justify-between"><span>English</span><span className="text-white font-mono">87/100</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-purple-500/20 bg-purple-950/30 p-3.5 flex items-center justify-between text-xs text-purple-200">
                    <span className="flex items-center gap-2">
                      <Award size={15} className="text-purple-400" />
                      Sabhi subjects ke number bharte hi complete class ka marksheet aur rank card auto-generate ho jata hai.
                    </span>
                  </div>
                </div>
              )}

              {/* TAB 4: PARENT PORTAL */}
              {activeTab === "parents" && (
                <div className="animate-in fade-in duration-300 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-teal-400">
                        Zero Friction Parent Access
                      </p>
                      <h3 className="text-xl font-bold text-white mt-0.5">
                        Parents Apne Mobile Par Live Bachche Ka Record Dekhein
                      </h3>
                    </div>
                    <Link
                      href="/parent-portal"
                      className="rounded-xl border border-teal-500/30 bg-teal-500/10 px-3 py-1.5 text-xs font-bold text-teal-300 hover:bg-teal-500/20 transition"
                    >
                      Open Parent Portal →
                    </Link>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 pt-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <span className="text-xs text-slate-400">Attendance Tracker</span>
                      <p className="text-xl font-bold text-white mt-1">96% Overall</p>
                      <p className="text-[11px] text-teal-400 mt-1">All days recorded</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <span className="text-xs text-slate-400">Fees Status</span>
                      <p className="text-xl font-bold text-emerald-400 mt-1">Cleared</p>
                      <p className="text-[11px] text-slate-400 mt-1">Receipt available to download</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <span className="text-xs text-slate-400">School Notices</span>
                      <p className="text-sm font-bold text-white mt-1">Sports Day Notice</p>
                      <p className="text-[11px] text-purple-300 mt-1">Event on 25th October</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-teal-500/20 bg-teal-950/30 p-3.5 text-xs text-teal-200">
                    Parents ko koi app download kiye bina direct admission number se apne bachche ki attendance, notices aur fees live dikhti hai.
                  </div>
                </div>
              )}

              {/* TAB 5: MOBILE PWA APP */}
              {activeTab === "app" && (
                <div className="animate-in fade-in duration-300 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-purple-400">
                        Native Mobile Experience (PWA)
                      </p>
                      <h3 className="text-xl font-bold text-white mt-0.5">
                        Direct Android & iPhone Home Screen Par Install Karein
                      </h3>
                    </div>
                    <InstallButton className="rounded-xl border border-purple-500/40 bg-purple-500/20 px-3.5 py-1.5 text-xs font-bold text-purple-300 hover:bg-purple-500/30 transition shadow-sm" />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 pt-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <Smartphone size={22} className="text-teal-400" />
                      <h4 className="font-bold text-sm text-white mt-2">Zero Play Store Hassle</h4>
                      <p className="text-xs text-slate-400 mt-1">Bina kisi play store download ke 1-click me direct install.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <Zap size={22} className="text-purple-400" />
                      <h4 className="font-bold text-sm text-white mt-2">1-Year Persistent Login</h4>
                      <p className="text-xs text-slate-400 mt-1">Baar-baar ID password daalne ki jarurat nahi, app seedha khulta hai.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <Lock size={22} className="text-indigo-400" />
                      <h4 className="font-bold text-sm text-white mt-2">Secret Super Admin Entry</h4>
                      <p className="text-xs text-slate-400 mt-1">Logo par 5-tap gesture se master console protected rehta hai.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 5. CURIOSITY HOOK: INTERACTIVE PRICING CALCULATOR */}
      <section id="calculator" className="relative border-y border-white/10 bg-gradient-to-b from-[#0f0e1d] to-[#141228] px-5 py-24 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 px-3.5 py-1 text-xs font-bold text-teal-300 border border-teal-500/30">
              <Sliders size={13} /> Transparent Per-Student Pricing
            </span>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-5xl text-white">
              Dekhein Aapka Monthly Kharcha Kitna Hoga
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">
              No hidden fees. Starting sirf ₹149 me 20 bachche, uske baad sirf ₹7 per bachcha.
              Jitne bachche, utna hi bill!
            </p>
          </div>

          {/* Interactive Calculator Box */}
          <div className="mt-12 rounded-3xl border border-purple-500/30 bg-[#121024] p-6 sm:p-10 shadow-2xl shadow-purple-900/20 backdrop-blur-xl">
            {/* Slider Control */}
            <div>
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-slate-300">
                  Aapke School / Coaching Me Kitne Bachche Hain?
                </label>
                <span className="rounded-xl bg-purple-600/30 border border-purple-500/40 px-3.5 py-1 text-base font-extrabold text-purple-300 font-mono">
                  {studentCount} Students
                </span>
              </div>

              <input
                type="range"
                min="10"
                max="1000"
                step="5"
                value={studentCount}
                onChange={(e) => setStudentCount(Number(e.target.value))}
                className="mt-5 w-full h-2.5 rounded-lg bg-slate-800 appearance-none cursor-pointer accent-purple-500"
              />

              <div className="mt-2 flex justify-between text-[11px] font-semibold text-slate-500">
                <span>10 Students (Mini Coaching)</span>
                <span>250 Students (Standard)</span>
                <span>500 Students (Medium School)</span>
                <span>1,000+ (Large School)</span>
              </div>
            </div>

            {/* Calculated Result Card */}
            <div className="mt-8 grid gap-4 sm:grid-cols-3 pt-6 border-t border-white/10">
              <div className="rounded-2xl border border-purple-500/30 bg-purple-950/40 p-5 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-purple-300">
                  EduTechLab Total Cost
                </p>
                <p className="mt-2 text-3xl sm:text-4xl font-extrabold text-white">
                  ₹{calculatedCost.toLocaleString("en-IN")}
                  <span className="text-xs font-normal text-slate-400"> /month</span>
                </p>
                <p className="mt-2 text-[11px] text-purple-300">
                  {studentCount <= 20
                    ? "Base Plan (₹149 up to 20 students)"
                    : `₹149 Base + ${studentCount - 20} × ₹7 = ₹${calculatedCost}`}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Market / Traditional Software
                </p>
                <p className="mt-2 text-3xl font-extrabold text-slate-400 line-through">
                  ₹{legacySoftwareCost.toLocaleString("en-IN")}
                  <span className="text-xs font-normal text-slate-500"> /mo</span>
                </p>
                <p className="mt-2 text-[11px] text-slate-500">
                  Heavy upfront setup cost + server fees
                </p>
              </div>

              <div className="rounded-2xl border border-teal-500/40 bg-teal-950/40 p-5 text-center flex flex-col justify-center">
                <span className="inline-flex mx-auto items-center gap-1 rounded-full bg-teal-500/20 px-2.5 py-0.5 text-[10px] font-extrabold text-teal-300 border border-teal-500/30">
                  🎉 YOUR ESTIMATED SAVINGS
                </span>
                <p className="mt-2 text-3xl font-black text-teal-300">
                  {estimatedSavings}% Less
                </p>
                <p className="mt-1 text-[11px] text-teal-200">
                  Bina kisi contract ke, cancel anytime
                </p>
              </div>
            </div>

            {/* CTA inside calculator */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/10">
              <div className="text-xs text-slate-400 text-center sm:text-left">
                <span className="font-bold text-white">Pehle 15 Din Free Trial:</span> Try karke dekhein, koi payment card nahi maanga jata.
              </div>
              <Link
                href="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-[#6657e8] px-6 py-3 text-xs font-bold text-white shadow-lg shadow-purple-600/30 hover:from-purple-500 hover:to-purple-600 transition"
              >
                <span>{studentCount} Students Ke Liye Free Trial Chalu Karein</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 6. TAILORED FOR EVERY INSTITUTE TYPE */}
      <section id="institutes" className="px-5 py-24 sm:px-8 max-w-6xl mx-auto">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-purple-400">
            Tailored For Education
          </span>
          <h2 className="mt-3 text-3xl font-extrabold text-white sm:text-5xl">
            Aapka Institute Chahe Koi Bhi Ho, EduTechLab Fit Hai
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">
            Schools, Coaching, Madrasas aur Academies ke workflow ke hisaab se ready features.
          </p>
        </div>

        {/* Type Switcher Buttons */}
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {[
            { id: "schools", label: "🏫 K-12 Schools", desc: "Private & Public Schools" },
            { id: "coaching", label: "📚 Coaching & Tuitions", desc: "Batches & Test Series" },
            { id: "madrasas", label: "🕌 Madrasas & Maktabs", desc: "Hifz & Community Ledger" },
            { id: "colleges", label: "🎓 Colleges & Academies", desc: "Departments & Semesters" },
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => setActiveType(type.id as any)}
              className={`rounded-2xl border px-5 py-3 text-xs font-bold transition flex flex-col items-center sm:items-start ${
                activeType === type.id
                  ? "border-purple-500 bg-purple-950/60 text-white shadow-lg shadow-purple-900/30"
                  : "border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <span className="text-sm">{type.label}</span>
              <span className="text-[10px] opacity-60 font-normal">{type.desc}</span>
            </button>
          ))}
        </div>

        {/* Active Type Showcase Card */}
        <div className="mt-8 rounded-3xl border border-white/15 bg-gradient-to-br from-slate-900 via-[#131124] to-slate-900 p-6 sm:p-10">
          {activeType === "schools" && (
            <div className="grid gap-8 lg:grid-cols-2 items-center animate-in fade-in">
              <div>
                <span className="rounded-md bg-purple-500/20 px-2.5 py-1 text-xs font-bold text-purple-300">
                  For K-12 Schools
                </span>
                <h3 className="text-2xl sm:text-3xl font-bold text-white mt-3">
                  Puri School Ki Daily Operations Ek Simple Screen Par
                </h3>
                <p className="text-sm text-slate-300 mt-3 leading-6">
                  Class wise admissions, bus / transport record, CBSE/State board marksheet generation,
                  daily SMS attendance, aur monthly fee collection reports.
                </p>
                <div className="mt-6 space-y-2.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-teal-400" /> Digital Student ID Cards with Photo</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-teal-400" /> Subject-wise Marks Entry & Grade Calculations</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-teal-400" /> Role-based Teacher & Staff permissions</div>
                </div>
              </div>
              <div className="rounded-2xl border border-purple-500/20 bg-purple-950/30 p-6">
                <h4 className="font-bold text-sm text-purple-200">School Principal Review:</h4>
                <p className="mt-2 text-xs italic text-slate-300 leading-5">
                  “Pehle hamare school me fees ki receipt kaatne me aur marksheet banane me teachers ka pura week chala jata tha. EduTechLab lene ke baad har teacher apne mobile se 2 minute me attendance le leta hai aur marksheet 1 click me ban jati hai.”
                </p>
                <p className="mt-4 text-xs font-bold text-white">— Al-Huda Academy, Patna</p>
              </div>
            </div>
          )}

          {activeType === "coaching" && (
            <div className="grid gap-8 lg:grid-cols-2 items-center animate-in fade-in">
              <div>
                <span className="rounded-md bg-teal-500/20 px-2.5 py-1 text-xs font-bold text-teal-300">
                  For Coaching & Institutes
                </span>
                <h3 className="text-2xl sm:text-3xl font-bold text-white mt-3">
                  Batch Wise Fees Aur Test Marks Ka Complete Control
                </h3>
                <p className="text-sm text-slate-300 mt-3 leading-6">
                  Morning/Evening batch management, weekly test results, WhatsApp marks alerts to parents,
                  aur per-student monthly fee tracking bina kisi confusion ke.
                </p>
                <div className="mt-6 space-y-2.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-teal-400" /> Instant UPI QR code for fee deposit</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-teal-400" /> Student dues reminder list in 1-click</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-teal-400" /> Test series scorecards with rank</div>
                </div>
              </div>
              <div className="rounded-2xl border border-teal-500/20 bg-teal-950/30 p-6">
                <h4 className="font-bold text-sm text-teal-200">Coaching Director Review:</h4>
                <p className="mt-2 text-xs italic text-slate-300 leading-5">
                  “Hume 120 bachchon ke liye mehenga software nahi chahiye tha. EduTechLab ne ₹149 + ₹7/student ka itna sasta plan diya ki ab har mahine sirf ₹800-900 me pura coaching manage ho jata hai.”
                </p>
                <p className="mt-4 text-xs font-bold text-white">— Target Science Coaching, Gaya</p>
              </div>
            </div>
          )}

          {activeType === "madrasas" && (
            <div className="grid gap-8 lg:grid-cols-2 items-center animate-in fade-in">
              <div>
                <span className="rounded-md bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-300">
                  For Madrasas & Maktabs
                </span>
                <h3 className="text-2xl sm:text-3xl font-bold text-white mt-3">
                  Hifz Record, Talaba Attendance Aur Mahana Fees
                </h3>
                <p className="text-sm text-slate-300 mt-3 leading-6">
                  Madrasas ke liye vishesh taur par banaya gaya simple interface: Hifz para tracking,
                  hostel/khana kharcha dues, donor contributions, aur talaba ki attendance.
                </p>
                <div className="mt-6 space-y-2.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-400" /> Hifz / Nazra daily progress log</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-400" /> Mahana fees aur rashan donation records</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-400" /> Asani se phone par chalta hai bina computer ke</div>
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/30 p-6">
                <h4 className="font-bold text-sm text-emerald-200">Nazim-e-Ala Feedback:</h4>
                <p className="mt-2 text-xs italic text-slate-300 leading-5">
                  “Alhamdulillah hamare madrasa me computer nahi tha, par asatiza apne mobile par hi EduTechLab se haziri aur mahana khorak ka hisab rakh rahe hain. Bahut hi aasan aur mufeed hai.”
                </p>
                <p className="mt-4 text-xs font-bold text-white">— Jamia Arabia Islamia</p>
              </div>
            </div>
          )}

          {activeType === "colleges" && (
            <div className="grid gap-8 lg:grid-cols-2 items-center animate-in fade-in">
              <div>
                <span className="rounded-md bg-indigo-500/20 px-2.5 py-1 text-xs font-bold text-indigo-300">
                  For Higher Academies & Colleges
                </span>
                <h3 className="text-2xl sm:text-3xl font-bold text-white mt-3">
                  Multi-Department Staff Access & Semester Exams
                </h3>
                <p className="text-sm text-slate-300 mt-3 leading-6">
                  Stream-wise (Science, Commerce, Arts) enrollments, multi-semester grade evaluation,
                  faculty permission management, aur high-speed data exports.
                </p>
                <div className="mt-6 space-y-2.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-indigo-400" /> Departmental admin and teacher permissions</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-indigo-400" /> High-volume CSV/Excel bulk import & exports</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-indigo-400" /> Instant financial audit reports</div>
                </div>
              </div>
              <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/30 p-6">
                <h4 className="font-bold text-sm text-indigo-200">Institute Founder:</h4>
                <p className="mt-2 text-xs italic text-slate-300 leading-5">
                  “Scaling from 300 to 1,200 students was seamless. The per-student pricing means we don't have to negotiate expensive enterprise software contracts every academic year.”
                </p>
                <p className="mt-4 text-xs font-bold text-white">— Apex Global Academy</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 7. COMPARISON TABLE: OLD WAY VS EDUTECHLAB */}
      <section className="px-5 py-24 sm:px-8 border-t border-white/10 bg-[#0d0c18]">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Purana Tareeqa vs. EduTechLab
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Kyun 90% naye institutes traditional software chhodkar EduTechLab par shift ho rahe hain.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {/* Old Way */}
            <div className="rounded-3xl border border-rose-500/20 bg-rose-950/15 p-6 sm:p-8">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-base">
                <span className="text-xl">❌</span>
                <span>Purana / Traditional Software</span>
              </div>
              <ul className="mt-6 space-y-3.5 text-xs text-slate-300 leading-5">
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-400 font-bold text-sm">✕</span>
                  <span><strong>₹20,000 - ₹50,000/saal</strong> ka heavy upfront contract chahe bachche kam ho.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-400 font-bold text-sm">✕</span>
                  <span>Kewal computer par chalta hai, teachers mobile se use nahi kar sakte.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-400 font-bold text-sm">✕</span>
                  <span>Fees ki entry karke duplicate receipt dhoondhna mushkil hota hai.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-400 font-bold text-sm">✕</span>
                  <span>Complex training chahiye hoti hai jo aam staff samajh nahi pata.</span>
                </li>
              </ul>
            </div>

            {/* EduTechLab Way */}
            <div className="rounded-3xl border border-teal-500/40 bg-teal-950/20 p-6 sm:p-8 relative overflow-hidden shadow-xl shadow-teal-950/30">
              <div className="absolute top-0 right-0 bg-gradient-to-l from-teal-500 to-purple-600 px-4 py-1 rounded-bl-2xl text-[10px] font-extrabold text-white uppercase tracking-wider">
                Recommended
              </div>
              <div className="flex items-center gap-2 text-teal-300 font-bold text-base">
                <span className="text-xl">✅</span>
                <span>The EduTechLab Way</span>
              </div>
              <ul className="mt-6 space-y-3.5 text-xs text-slate-200 leading-5">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-teal-400 shrink-0 mt-0.5" />
                  <span><strong>Starting Sirf ₹149/mahina</strong> — jitne bachche utna pay karein (+₹7/student).</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-teal-400 shrink-0 mt-0.5" />
                  <span><strong>Mobile App Built-in</strong> — Teachers apne mobile phone se 1 minute me haziri lein.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-teal-400 shrink-0 mt-0.5" />
                  <span><strong>Instant UPI QR & Receipts</strong> — Parents ko turant WhatsApp par receipt mil jati hai.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-teal-400 shrink-0 mt-0.5" />
                  <span><strong>Itna Simple Ki Koi Bhi Chala Le</strong> — Zero training needed, clean Indian UI.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 8. CLIENT FAQ ACCORDION SECTION */}
      <section id="faq" className="px-5 py-24 sm:px-8 max-w-4xl mx-auto">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-purple-400">
            Got Questions?
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-white">
            Aksar Pooche Jaane Wale Sawal (FAQ)
          </h2>
        </div>

        <div className="mt-10 space-y-3">
          {[
            {
              q: "Kya hum ise mobile me app jaisa chala sakte hain?",
              a: "Haan, bilkul! EduTechLab PWA (Progressive Web App) technology par bana hai. Jab aap phone me link kholenge to neeche 'Install App' ka option aayega. Ek click me yeh aapke mobile ki home screen par app ban jayegi with logo aur bina browser ke full-screen chalegi.",
            },
            {
              q: "Subscription me student badhane ya ghatane ka kya hisab hai?",
              a: "Aapko koi saal bhar ka contract bandhne ki jarurat nahi hai. Starting plan ₹149 me 20 bachche shamil hain. Uske baad ₹7 per bachcha lagta hai. Agar agle mahine bachche badhte ya ghadte hain, to aap apna plan change kar sakte hain.",
            },
            {
              q: "Free trial ke liye kya hume credit card ya pehle payment karni hogi?",
              a: "Nahi, bilkul nahi! Free trial 100% free hai bina kisi payment details ke. Pehle 15 din tak aap pura software apne school ke bachchon ke sath test karein, achha lage tabhi continue karein.",
            },
            {
              q: "Fees payment kaise hoti hai? Kya school ka apna QR code lagega?",
              a: "Haan! Super Admin / School Admin apna khud ka UPI QR code aur UPI ID dalte hain. Parents scan karke direct aapke bank account me fee transfer karte hain, aur system instant digital receipt generate karta hai.",
            },
            {
              q: "Kya teachers ko alag login milta hai?",
              a: "Haan, Admin har teacher ke liye Staff ID (jaise STAFF-XXXX) generate karta hai. Teacher sirf unhi features ko dekh sakta hai jo admin allow kare (jaise sirf attendance ya marksheet entry).",
            },
          ].map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden transition"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left text-sm font-bold text-white hover:bg-white/5 transition"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    size={16}
                    className={`text-purple-400 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs leading-6 text-slate-300 border-t border-white/5 pt-3 animate-in fade-in">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 9. HIGH CONVERTING FINAL CTA BANNER */}
      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-5xl rounded-[36px] bg-gradient-to-tr from-purple-900 via-[#31236d] to-[#125350] p-8 sm:p-14 text-center relative overflow-hidden shadow-2xl border border-purple-400/30">
          <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl pointer-events-none" />

          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur-md">
            <Sparkles size={13} className="text-teal-300" /> Shuru Karein Sirf 2 Minute Me
          </span>

          <h2 className="mt-5 text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Apne Institute Ko De Nayi Udaan. <br />
            Aaj Hi Free Trial Shuru Karein!
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-purple-100">
            Koi credit card nahi, koi setup fee nahi. 15 din tak sare features bilkul free chala kar dekhein.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-sm font-extrabold text-[#171625] shadow-xl hover:bg-slate-100 transition hover:-translate-y-0.5"
            >
              <span>Create Your Institute Free</span>
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-6 py-4 text-sm font-bold text-white hover:bg-white/20 transition backdrop-blur-md"
            >
              <span>Already Have Account? Sign In</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 10. MODERN FOOTER */}
      <footer className="border-t border-white/10 bg-[#090812] px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-white">
              <GraduationCap size={15} />
            </div>
            <span className="font-bold text-slate-300">EduTechLab Platform</span>
            <span>© 2026. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6 text-slate-400 font-medium">
            <Link href="/parent-portal" className="hover:text-white transition">
              Parent Portal
            </Link>
            <Link href="/login" className="hover:text-white transition">
              Staff / Admin Login
            </Link>
            <Link href="/register" className="hover:text-white transition">
              Register Institute
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
