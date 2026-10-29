"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
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
  Printer,
  Search,
  Send,
  ShieldCheck,
  Sliders,
  Smartphone,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import InstallButton from "@/components/pwa/InstallButton";

export default function Home() {
  // Interactive Calculator State
  const [studentCount, setStudentCount] = useState(250);
  const [selectedPlanType, setSelectedPlanType] = useState<"standard" | "pro">("pro");

  // Dynamic Platform Settings (WhatsApp, Email, Phone, Announcement, Brand)
  const [platformSettings, setPlatformSettings] = useState({
    whatsapp_number: "917903178550",
    contact_phone: "+91 79031 78550",
    contact_email: "edutechlab@gmail.com",
    brand_name: "EduTechLab",
    brand_tagline: "Bharat Ka Sabse Fast & Aasan School Management Software",
    company_address: "India",
    announcement_text: "NEW v2.0: Bharat Ka Sabse Fast & Aasan School Management Software • Risk-Free Trial!",
    announcement_active: true,
    standard_rate: 5,
    pro_rate: 7,
  });

  // Interactive Live Feature Mockup Tab
  const [activeTab, setActiveTab] = useState<"attendance" | "fees" | "exams" | "parents" | "app">("attendance");

  // Institute Type Switcher
  const [activeType, setActiveType] = useState<"schools" | "coaching" | "madrasas" | "colleges">("schools");

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Auto-Redirect for Logged-In Users, Standalone PWA & Load Dynamic Platform Settings
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();

        // 1. Fetch live platform settings (WhatsApp, Email, Announcement, Rates)
        const { data: pSettings } = await supabase
          .from("platform_settings")
          .select("*")
          .eq("id", "global")
          .maybeSingle();

        if (pSettings) {
          setPlatformSettings((prev) => ({
            ...prev,
            whatsapp_number: pSettings.whatsapp_number || prev.whatsapp_number,
            contact_phone: pSettings.contact_phone || prev.contact_phone,
            contact_email: pSettings.contact_email || prev.contact_email,
            brand_name: pSettings.brand_name || prev.brand_name,
            brand_tagline: pSettings.brand_tagline || prev.brand_tagline,
            company_address: pSettings.company_address || prev.company_address,
            announcement_text: pSettings.announcement_text || prev.announcement_text,
            announcement_active: pSettings.announcement_active !== false,
            standard_rate: Number(pSettings.standard_rate || 5),
            pro_rate: Number(pSettings.pro_rate || 7),
          }));
        }

        // 2. Check Auth User
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

  // Pricing Calculation based on Transparent Model: Standard vs Pro
  const ratePerStudent = selectedPlanType === "standard" ? platformSettings.standard_rate : platformSettings.pro_rate;
  const calculatedCost = studentCount * ratePerStudent;
  const legacySoftwareCost = Math.round(studentCount * 35);
  const estimatedSavings = Math.max(
    60,
    Math.round(((legacySoftwareCost - calculatedCost) / legacySoftwareCost) * 100)
  );

  return (
    <main className="min-h-screen bg-white text-slate-900 selection:bg-purple-100 selection:text-purple-900">
      {/* Dynamic Bright Ambient Background Mesh */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[550px] w-[1100px] rounded-full bg-gradient-to-tr from-purple-200/50 via-indigo-100/40 to-teal-100/50 blur-[130px]" />
        <div className="absolute top-[850px] -left-48 h-[500px] w-[600px] rounded-full bg-blue-100/40 blur-[140px]" />
        <div className="absolute top-[1900px] -right-48 h-[600px] w-[700px] rounded-full bg-purple-100/40 blur-[150px]" />
      </div>

      {/* 1. TOP ANNOUNCEMENT TICKER (DYNAMICALLY CONTROLLED BY SUPER ADMIN) */}
      {platformSettings.announcement_active && (
        <div className="relative z-30 border-b border-purple-100 bg-gradient-to-r from-purple-50 via-indigo-50/80 to-teal-50 px-4 py-2.5 text-center">
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 text-xs font-semibold text-purple-900 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
              <Sparkles size={11} /> NEW
            </span>
            <span>{platformSettings.announcement_text}</span>
            <Link
              href="/register"
              className="ml-1 inline-flex items-center gap-1 font-bold text-purple-700 underline underline-offset-4 hover:text-purple-950 transition"
            >
              <span>15-Day Free Trial</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      )}

      {/* 2. MODERN STICKY NAVBAR (CRISP & BRIGHT) */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl transition">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          {/* Brand Logo */}
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="relative grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-[#6657e8] p-0.5 shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform">
              <div className="grid h-full w-full place-items-center rounded-[14px] bg-slate-900">
                <GraduationCap size={20} className="text-white" />
              </div>
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-slate-900">
                EduTech<span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Lab</span>
              </span>
              <span className="hidden sm:inline-block ml-2 rounded-md bg-purple-100 px-1.5 py-0.5 text-[9px] font-extrabold text-purple-800 uppercase tracking-widest">
                PRO
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-8 text-xs font-bold text-slate-600 md:flex">
            <a href="#features" className="hover:text-purple-600 transition">Features</a>
            <a href="#demo" className="hover:text-purple-600 transition">Live Demo</a>
            <a href="#calculator" className="flex items-center gap-1 text-purple-700 font-extrabold hover:text-purple-900 transition">
              <Sliders size={13} className="text-purple-600" />
              <span>Pricing Calculator</span>
            </a>
            <a href="#institutes" className="hover:text-purple-600 transition">For Institutes</a>
            <a href="#faq" className="hover:text-purple-600 transition">FAQ</a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 sm:gap-3">
            <InstallButton className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100 transition shadow-sm" />
            <Link
              href="/login"
              className="rounded-xl px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-purple-700 hover:bg-purple-50 transition"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-600/25 hover:from-purple-500 hover:to-indigo-500 transition hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Start Free Trial</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </header>

      {/* 3. HERO SECTION (HIGH CONVERSION & ENERGETIC) */}
      <section className="relative px-5 pt-12 pb-20 sm:px-8 sm:pt-20 lg:pt-24 overflow-hidden">
        <div className="mx-auto max-w-6xl text-center relative z-10">
          {/* Trust Badge with Live Pulse */}
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-white px-4 py-1.5 text-xs font-bold text-purple-900 shadow-sm shadow-purple-500/10">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Trusted by 150+ Leading Schools, Coaching Centers & Madrasas</span>
            <span className="text-slate-300">•</span>
            <span className="text-purple-700">100% Mobile Ready</span>
          </div>

          {/* Floating Glass Proof Badges */}
          <div className="hidden xl:block absolute -left-12 top-24 z-20 animate-bounce [animation-duration:5s]">
            <div className="flex items-center gap-3 rounded-2xl border border-purple-200/80 bg-white/95 px-4 py-3 shadow-xl shadow-purple-900/10 backdrop-blur-md">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={20} />
              </div>
              <div className="text-left">
                <div className="text-xs font-black text-slate-900">₹45,000 Fees Received</div>
                <div className="text-[10px] font-semibold text-emerald-600">WhatsApp Receipt Sent Instantly</div>
              </div>
            </div>
          </div>

          <div className="hidden xl:block absolute -right-12 top-36 z-20 animate-bounce [animation-duration:6s]">
            <div className="flex items-center gap-3 rounded-2xl border border-indigo-200/80 bg-white/95 px-4 py-3 shadow-xl shadow-indigo-900/10 backdrop-blur-md">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-50 text-purple-600">
                <Smartphone size={20} />
              </div>
              <div className="text-left">
                <div className="text-xs font-black text-slate-900">100% Mobile Ready</div>
                <div className="text-[10px] font-semibold text-purple-600">Teachers Take Haziri in 1-Click</div>
              </div>
            </div>
          </div>

          {/* Bold, Commanding Headline */}
          <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-900 sm:text-6xl lg:text-7xl leading-[1.08]">
            Apne Institute Ko Banayein{" "}
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-600 bg-clip-text text-transparent">
              100% Digital, Fast Aur Tension-Free.
            </span>
          </h1>

          {/* High-Clarity Subtitle */}
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base sm:leading-8 font-medium">
            Admissions, Mobile Haziri (Attendance), UPI QR Fees Receipts, Marksheets,
            aur Parents Portal — sab kuch ek simple app me.
            Kagaz ke registers aur spreadsheets ko hamesha ke liye alvida kahein.
          </p>

          {/* Action Button Row */}
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-purple-600 via-[#6657e8] to-indigo-600 px-7 py-4 text-sm font-extrabold text-white shadow-xl shadow-purple-600/30 hover:from-purple-500 hover:to-indigo-500 transition hover:-translate-y-1"
            >
              <span>Free Trial Shuru Karein (No Card Needed)</span>
              <ArrowRight size={16} className="transition group-hover:translate-x-1" />
            </Link>

            <a
              href="#calculator"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-4 text-sm font-bold text-slate-700 shadow-sm hover:border-purple-300 hover:bg-purple-50/50 hover:text-purple-700 transition"
            >
              <Sliders size={16} className="text-purple-600" />
              <span>Monthly Kharcha Calculate Karein</span>
            </a>
          </div>

          {/* 4-Pillar High-Trust Metric Cards */}
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 max-w-4xl mx-auto">
            <div className="rounded-2xl border border-purple-100 bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="text-2xl sm:text-3xl font-black text-purple-700">150+</div>
              <div className="text-xs font-bold text-slate-700 mt-0.5">Active Institutes</div>
              <div className="text-[10px] text-slate-400 font-medium">Schools & Madrasas</div>
            </div>
            <div className="rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="text-2xl sm:text-3xl font-black text-indigo-700">2 Mins</div>
              <div className="text-xs font-bold text-slate-700 mt-0.5">Quick Setup</div>
              <div className="text-[10px] text-slate-400 font-medium">Zero training required</div>
            </div>
            <div className="rounded-2xl border border-teal-100 bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="text-2xl sm:text-3xl font-black text-teal-700">₹5 - ₹7/Child</div>
              <div className="text-xs font-bold text-slate-700 mt-0.5">Standard & Pro Plans</div>
              <div className="text-[10px] text-slate-400 font-medium">Monthly / Yearly Billing</div>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="text-2xl sm:text-3xl font-black text-emerald-700">100%</div>
              <div className="text-xs font-bold text-slate-700 mt-0.5">Cloud Safe</div>
              <div className="text-[10px] text-slate-400 font-medium">Automatic daily backup</div>
            </div>
          </div>

          {/* Social Proof & Trust Badges */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-bold text-slate-600">
            <span className="flex items-center gap-1 text-amber-500">
              <Star size={14} className="fill-amber-400 text-amber-400" />
              <Star size={14} className="fill-amber-400 text-amber-400" />
              <Star size={14} className="fill-amber-400 text-amber-400" />
              <Star size={14} className="fill-amber-400 text-amber-400" />
              <Star size={14} className="fill-amber-400 text-amber-400" />
              <strong className="text-slate-800 ml-1">4.9 / 5 Rating</strong>
            </span>
            <span className="flex items-center gap-1.5 text-slate-700">
              <CheckCircle2 size={15} className="text-emerald-600" /> Starting Sirf ₹5/child/mahina
            </span>
            <span className="flex items-center gap-1.5 text-slate-700">
              <CheckCircle2 size={15} className="text-emerald-600" /> Zero Setup Fees
            </span>
            <span className="flex items-center gap-1.5 text-slate-700">
              <CheckCircle2 size={15} className="text-emerald-600" /> Mobile Par Direct Install
            </span>
          </div>
        </div>

        {/* 4. INTERACTIVE LIVE PLATFORM DEMO PREVIEW (BRIGHT & STUNNING) */}
        <div id="demo" className="mx-auto mt-14 max-w-5xl relative z-10">
          <div className="rounded-3xl border border-slate-200 bg-white p-2 sm:p-3 shadow-[0_25px_70px_rgba(102,87,232,0.12)]">
            {/* Top Interactive Feature Tabs */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-4 py-3 rounded-t-[20px] overflow-x-auto gap-2">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-2 text-xs font-bold text-slate-700 hidden sm:inline">
                  EduTechLab Live Platform Simulation
                </span>
              </div>

              {/* Clickable Feature Tabs */}
              <div className="flex items-center gap-1.5">
                {[
                  { id: "attendance", label: "Mobile Haziri", icon: ClipboardCheck },
                  { id: "fees", label: "UPI Fees & QR", icon: WalletCards },
                  { id: "exams", label: "Report Cards", icon: Award },
                  { id: "parents", label: "Parents Portal", icon: MessageCircle },
                  { id: "app", label: "Mobile PWA App", icon: Smartphone },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition whitespace-nowrap ${
                        isActive
                          ? "bg-purple-600 text-white shadow-md shadow-purple-600/25"
                          : "text-slate-600 hover:text-slate-900 hover:bg-white"
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
            <div className="p-5 sm:p-8 min-h-[380px] bg-[#fbfcfd] rounded-b-[20px]">
              {/* TAB 1: ATTENDANCE */}
              {activeTab === "attendance" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="inline-block text-[11px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                        1-Click Mobile Haziri
                      </span>
                      <h3 className="text-xl font-bold text-slate-900 mt-1">
                        Class 10-A Today: 44 Present, 2 Absent
                      </h3>
                    </div>
                    <div className="flex gap-2">
                      <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-700">
                        95.6% Marked
                      </span>
                      <span className="rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-1.5 text-xs font-bold text-purple-700">
                        Time: 08:35 AM
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 pt-2">
                    {[
                      { name: "Aarav Sharma", roll: "Roll #01", status: "Present", color: "bg-emerald-100 text-emerald-800" },
                      { name: "Zoya Siddiqui", roll: "Roll #02", status: "Present", color: "bg-emerald-100 text-emerald-800" },
                      { name: "Rahul Verma", roll: "Roll #03", status: "Absent", color: "bg-rose-100 text-rose-800" },
                    ].map((st, i) => (
                      <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm text-slate-900">{st.name}</p>
                          <p className="text-xs text-slate-400 font-medium">{st.roll}</p>
                        </div>
                        <span className={`rounded-xl px-2.5 py-1 text-xs font-bold ${st.color}`}>
                          {st.status}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-center justify-between text-xs text-emerald-900">
                    <span className="flex items-center gap-2">
                      <Send size={15} className="text-emerald-600" />
                      <strong>Automated WhatsApp Alert:</strong> Absent bachche Rahul ke father ko WhatsApp par turant msg chala gaya: <em>"Aadarniya Abhibhavak, Rahul aaj school me anupasthit hai."</em>
                    </span>
                    <span className="font-bold text-emerald-700 shrink-0 hidden sm:inline">Delivered ✓✓</span>
                  </div>
                </div>
              )}

              {/* TAB 2: FEES & UPI QR */}
              {activeTab === "fees" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="inline-block text-[11px] font-extrabold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
                        Digital Fee Collection
                      </span>
                      <h3 className="text-xl font-bold text-slate-900 mt-1">
                        Institute UPI QR Code & Instant PDF Receipts
                      </h3>
                    </div>
                    <span className="rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-1.5 text-xs font-bold text-teal-800">
                      ₹3,42,000 Collected This Month
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 pt-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold text-slate-500">Total Fees Received</p>
                      <p className="text-2xl font-black text-slate-900 mt-1">₹3,42,000</p>
                      <p className="text-[11px] text-emerald-600 font-bold mt-1">↑ 18% Higher collection</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold text-slate-500">Pending Dues</p>
                      <p className="text-2xl font-black text-rose-600 mt-1">₹38,000</p>
                      <p className="text-[11px] text-slate-400 font-medium mt-1">14 Students remaining</p>
                    </div>

                    <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 shadow-sm">
                      <p className="text-xs font-semibold text-purple-700">Direct School QR</p>
                      <p className="text-sm font-bold text-slate-900 mt-1">UPI: schooladmin@upi</p>
                      <p className="text-[11px] text-purple-600 font-medium mt-1">Paisa direct school account me</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4 flex items-center justify-between text-xs text-teal-900">
                    <span className="flex items-center gap-2">
                      <Printer size={15} className="text-teal-600" />
                      <strong>Digital Receipt:</strong> Parent jaise hi fee pay karta hai, system WhatsApp par official branded PDF receipt generate karke de deta hai.
                    </span>
                    <span className="font-bold text-teal-700 shrink-0">1-Click PDF</span>
                  </div>
                </div>
              )}

              {/* TAB 3: REPORT CARDS */}
              {activeTab === "exams" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="inline-block text-[11px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                        Exam & Result Engine
                      </span>
                      <h3 className="text-xl font-bold text-slate-900 mt-1">
                        Auto Calculated Grade, Percentage & Rank
                      </h3>
                    </div>
                    <span className="rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-1.5 text-xs font-bold text-purple-700">
                      Print Ready PDF
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 pt-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
                      <div className="flex justify-between items-center text-sm font-bold text-slate-900">
                        <span>Zaid Khan (Roll #01)</span>
                        <span className="text-emerald-600 font-bold">94.2% • Grade A+ (Rank 1)</span>
                      </div>
                      <div className="text-xs text-slate-600 space-y-1.5 pt-1">
                        <div className="flex justify-between"><span>Mathematics</span><span className="font-mono font-bold text-slate-900">98 / 100</span></div>
                        <div className="flex justify-between"><span>Science</span><span className="font-mono font-bold text-slate-900">95 / 100</span></div>
                        <div className="flex justify-between"><span>English</span><span className="font-mono font-bold text-slate-900">89 / 100</span></div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
                      <div className="flex justify-between items-center text-sm font-bold text-slate-900">
                        <span>Ananya Gupta (Roll #02)</span>
                        <span className="text-emerald-600 font-bold">91.0% • Grade A (Rank 2)</span>
                      </div>
                      <div className="text-xs text-slate-600 space-y-1.5 pt-1">
                        <div className="flex justify-between"><span>Mathematics</span><span className="font-mono font-bold text-slate-900">92 / 100</span></div>
                        <div className="flex justify-between"><span>Science</span><span className="font-mono font-bold text-slate-900">91 / 100</span></div>
                        <div className="flex justify-between"><span>English</span><span className="font-mono font-bold text-slate-900">90 / 100</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-4 text-xs text-purple-900 flex items-center justify-between">
                    <span>Teachers ko calculator lekar baithne ki jarurat nahi. Sirf number bharein, system rank aur percentage khud bana deta hai.</span>
                    <span className="font-bold text-purple-700 shrink-0">Zero Errors</span>
                  </div>
                </div>
              )}

              {/* TAB 4: PARENT PORTAL */}
              {activeTab === "parents" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="inline-block text-[11px] font-extrabold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
                        Zero-Password Parent Portal
                      </span>
                      <h3 className="text-xl font-bold text-slate-900 mt-1">
                        Parents Apne Mobile Par Live Record Dekhein
                      </h3>
                    </div>
                    <Link
                      href="/parent-portal"
                      className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition"
                    >
                      Open Live Portal →
                    </Link>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 pt-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-xs text-slate-400 font-medium">Daily Attendance</p>
                      <p className="text-xl font-bold text-slate-900 mt-1">96% Overall</p>
                      <p className="text-[11px] text-emerald-600 font-bold mt-1">Upsthit / Present</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-xs text-slate-400 font-medium">Fee Receipts</p>
                      <p className="text-xl font-bold text-emerald-600 mt-1">Paid Up-to-date</p>
                      <p className="text-[11px] text-slate-500 mt-1">Receipt available to print</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-xs text-slate-400 font-medium">School Notices</p>
                      <p className="text-sm font-bold text-slate-900 mt-1">Winter Vacation Notice</p>
                      <p className="text-[11px] text-purple-600 font-medium mt-1">From 24th December</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4 text-xs text-teal-900">
                    Parents ko koi app download kiye bina direct admission number se apne bachche ki report live dikhti hai. Phone call karne ki jhanjhat khatam!
                  </div>
                </div>
              )}

              {/* TAB 5: MOBILE PWA APP */}
              {activeTab === "app" && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="inline-block text-[11px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                        Direct Mobile App (PWA)
                      </span>
                      <h3 className="text-xl font-bold text-slate-900 mt-1">
                        Android & iPhone Home Screen Par 1-Click Install
                      </h3>
                    </div>
                    <InstallButton className="rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-purple-600/25 hover:bg-purple-700 transition" />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 pt-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-600">
                        <Smartphone size={20} />
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 mt-3">Zero Play Store Fees</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-5">Client ya teachers ko koi bada app download karne ki jarurat nahi.</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-50 text-purple-600">
                        <Zap size={20} />
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 mt-3">1-Year Persistent Login</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-5">Baar baar ID password nahi maangta, direct native app ki tarah chalta hai.</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                        <ShieldCheck size={20} />
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 mt-3">100% Secure Cloud Backup</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-5">Aapke school ka sara record encrypted aur bank-grade cloud par safe rehta hai.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 5. CURIOSITY MAGNET: BRIGHT INTERACTIVE PRICING CALCULATOR */}
      <section id="calculator" className="relative border-y border-purple-100 bg-gradient-to-b from-purple-50/40 via-white to-indigo-50/40 px-5 py-24 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3.5 py-1 text-xs font-bold text-purple-800 border border-purple-200">
              <Sliders size={13} /> Transparent Per-Child Pricing &bull; Zero Hidden Costs
            </span>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-5xl text-slate-900 tracking-tight">
              Aapke School Ke Liye 2 Simple & Affordable Plans
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 font-medium">
              Aap jitne bachche padhate hain, sirf utna pay karein. No heavy annual software contracts, zero server fees, aur cancel anytime!
            </p>
          </div>

          {/* TWO SIDE-BY-SIDE PLAN CARDS */}
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {/* 1. STANDARD PLAN CARD */}
            <div
              onClick={() => setSelectedPlanType("standard")}
              className={`relative cursor-pointer rounded-3xl border-2 p-6 sm:p-8 transition-all backdrop-blur-md flex flex-col justify-between ${
                selectedPlanType === "standard"
                  ? "border-teal-500 bg-teal-50/30 shadow-xl shadow-teal-900/5 ring-4 ring-teal-500/10"
                  : "border-slate-200 bg-white/90 hover:border-slate-300 shadow-sm"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-teal-800">
                    Standard Plan
                  </span>
                  <span className="text-xs font-semibold text-slate-500">Core School Operations</span>
                </div>

                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="text-4xl sm:text-5xl font-black text-slate-900 font-mono">₹5</span>
                  <span className="text-xs font-bold text-slate-500">/ student / month</span>
                </div>
                <p className="mt-2 text-xs text-slate-500 font-medium">
                  Ideal for budget-conscious schools, tuition centres & simple registers.
                </p>

                {/* Standard Feature List */}
                <div className="mt-6 space-y-3 pt-6 border-t border-slate-100 text-xs text-slate-700">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>Student & Parent Directory</strong> (Photos, Documents, Contact info)</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>Real-Time Attendance Register</strong> with Instant Auto-Save</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>Fees Collection & Defaulters</strong> with A4 / Thermal 80mm Receipts</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>1-Click WhatsApp Parent Alerts</strong> (Absent alerts & Circulars)</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>Daily Homework & Timetable</strong> Management</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-teal-600 shrink-0 mt-0.5" />
                    <span><strong>Mobile PWA App</strong> for Teachers & Office Staff</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPlanType("standard");
                  }}
                  className={`w-full rounded-2xl py-3 text-xs font-bold transition shadow-xs ${
                    selectedPlanType === "standard"
                      ? "bg-teal-700 text-white shadow-teal-700/20"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {selectedPlanType === "standard" ? "✓ Selected (₹5 / Child)" : "Choose Standard Plan"}
                </button>
              </div>
            </div>

            {/* 2. PRO ALL-IN-ONE PLAN CARD (HIGHLIGHTED) */}
            <div
              onClick={() => setSelectedPlanType("pro")}
              className={`relative cursor-pointer rounded-3xl border-2 p-6 sm:p-8 transition-all backdrop-blur-md flex flex-col justify-between ${
                selectedPlanType === "pro"
                  ? "border-purple-600 bg-purple-50/40 shadow-2xl shadow-purple-900/10 ring-4 ring-purple-600/10"
                  : "border-slate-200 bg-white/90 hover:border-purple-300 shadow-sm"
              }`}
            >
              {/* Highlight badge */}
              <div className="absolute -top-3.5 right-6 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
                🔥 Recommended &bull; Best Value
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-purple-800">
                    Pro Plan
                  </span>
                  <span className="text-xs font-bold text-purple-700">Complete Smart Campus</span>
                </div>

                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="text-4xl sm:text-5xl font-black text-purple-950 font-mono">₹7</span>
                  <span className="text-xs font-bold text-slate-500">/ student / month</span>
                </div>
                <p className="mt-2 text-xs text-purple-900 font-semibold">
                  Sirf ₹2 extra me pura Anti-Counterfeit & Gate Security Smart System!
                </p>

                {/* Pro Feature List */}
                <div className="mt-6 space-y-3 pt-6 border-t border-purple-100 text-xs text-slate-800">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-purple-600 shrink-0 mt-0.5" />
                    <span><strong>Sabhi Standard Plan ke Features</strong> Included</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-purple-600 shrink-0 mt-0.5" />
                    <span>📷 <strong>Gate QR Scanner Kiosk:</strong> Live audio synthesis & fee due alerts</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-purple-600 shrink-0 mt-0.5" />
                    <span>🪪 <strong>PVC Student ID Card Generator:</strong> 8-per-page A4 + optical barcodes</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-purple-600 shrink-0 mt-0.5" />
                    <span>📜 <strong>Luxury Board Marksheets:</strong> Gold anti-counterfeit security border & QR verify</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-purple-600 shrink-0 mt-0.5" />
                    <span>🔄 <strong>Academic Session & Promotion Wizard:</strong> 1-click student reshuffle & fee carry-forward</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-purple-600 shrink-0 mt-0.5" />
                    <span>🎓 <strong>TC & Bonafide Certificate Generator:</strong> Official character & leaving certificates</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-purple-600 shrink-0 mt-0.5" />
                    <span>🛡️ <strong>Granular Staff Roles & Permissions:</strong> Teacher, Cashier & Clerk individual logins</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-purple-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPlanType("pro");
                  }}
                  className={`w-full rounded-2xl py-3 text-xs font-bold transition shadow-md ${
                    selectedPlanType === "pro"
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-600/25"
                      : "border border-purple-300 bg-white text-purple-700 hover:bg-purple-50"
                  }`}
                >
                  {selectedPlanType === "pro" ? "✓ Selected (₹7 / Child - Pro)" : "Choose Pro Plan (Recommended)"}
                </button>
              </div>
            </div>
          </div>

          {/* DYNAMIC CALCULATOR BOX */}
          <div className="mt-10 rounded-3xl border border-purple-200 bg-white p-6 sm:p-10 shadow-xl shadow-purple-900/5">
            {/* Plan Switcher Pills inside Calculator */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-100 pb-5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Select Billing Plan For Calculator:
                </span>
                <h3 className="text-base font-extrabold text-slate-900">
                  {selectedPlanType === "pro" ? "Pro Plan (₹7 / Child)" : "Standard Plan (₹5 / Child)"}
                </h3>
              </div>
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setSelectedPlanType("standard")}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                    selectedPlanType === "standard"
                      ? "bg-white text-teal-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Standard (₹5/child)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlanType("pro")}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                    selectedPlanType === "pro"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Pro Plan (₹7/child) 🔥
                </button>
              </div>
            </div>

            {/* Slider Control */}
            <div className="mt-6">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-slate-800">
                  Aapke School / Coaching Me Kitne Bachche Hain?
                </label>
                <span className="rounded-xl bg-purple-600 px-4 py-1.5 text-base font-extrabold text-white shadow-sm font-mono">
                  {studentCount} Students
                </span>
              </div>

              <input
                type="range"
                min="20"
                max="1500"
                step="10"
                value={studentCount}
                onChange={(e) => setStudentCount(Number(e.target.value))}
                className="mt-5 w-full h-2.5 rounded-lg bg-slate-200 appearance-none cursor-pointer accent-purple-600"
              />

              <div className="mt-2.5 flex justify-between text-[11px] font-bold text-slate-400">
                <span>50 (Small Batch)</span>
                <span>250 (Medium School)</span>
                <span>600 (High School)</span>
                <span>1,200+ (Large Academy)</span>
              </div>
            </div>

            {/* Calculated Result Cards */}
            <div className="mt-8 grid gap-4 sm:grid-cols-3 pt-6 border-t border-slate-100">
              <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-5 text-center shadow-xs">
                <p className="text-xs font-bold uppercase tracking-wider text-purple-700">
                  Monthly Total ({selectedPlanType === "pro" ? "Pro ₹7" : "Standard ₹5"})
                </p>
                <p className="mt-2 text-3xl sm:text-4xl font-black text-purple-950 font-mono">
                  ₹{calculatedCost.toLocaleString("en-IN")}
                  <span className="text-xs font-normal text-slate-500"> /month</span>
                </p>
                <p className="mt-2 text-[11px] font-semibold text-purple-700">
                  ₹{(calculatedCost * 12).toLocaleString("en-IN")} / saal ({studentCount} × ₹{ratePerStudent})
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Purana / Market Software
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-400 line-through font-mono">
                  ₹{legacySoftwareCost.toLocaleString("en-IN")}
                  <span className="text-xs font-normal text-slate-400"> /mo</span>
                </p>
                <p className="mt-2 text-[11px] text-slate-400 font-medium">
                  Heavy upfront contract + annual maintenance fee
                </p>
              </div>

              <div className="rounded-2xl border border-teal-200 bg-teal-50/80 p-5 text-center flex flex-col justify-center shadow-xs">
                <span className="inline-flex mx-auto items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-[10px] font-extrabold text-teal-800">
                  🎉 YOUR NET SAVINGS
                </span>
                <p className="mt-2 text-3xl font-black text-teal-700 font-mono">
                  {estimatedSavings}% Sasta
                </p>
                <p className="mt-1 text-[11px] text-teal-800 font-medium">
                  Sirf ₹{(ratePerStudent / 30).toFixed(2)} per child per day!
                </p>
              </div>
            </div>

            {/* CTA inside calculator */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-100">
              <div className="text-xs text-slate-500 text-center sm:text-left font-medium">
                <span className="font-bold text-slate-800">Risk-Free 100% Free Trial:</span> Bina kisi advance payment ya card ke apne {studentCount} bachcho ke sath test karein.
              </div>
              <Link
                href="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3.5 text-xs font-bold text-white shadow-lg shadow-purple-600/20 hover:from-purple-500 hover:to-indigo-500 transition hover:-translate-y-0.5"
              >
                <span>{studentCount} Students Ke Liye Free Trial Chalu Karein</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 6. TAILORED FOR EVERY EDUCATION MODEL (BRIGHT CARDS) */}
      <section id="institutes" className="px-5 py-24 sm:px-8 max-w-6xl mx-auto">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-purple-700 bg-purple-50 px-3 py-1 rounded-full">
            Made For India
          </span>
          <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-5xl tracking-tight">
            Aapka Institute Chahe Koi Bhi Ho, EduTechLab Fit Hai
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600 font-medium">
            Schools, Coaching, Madrasas aur Colleges ke workflows ke according built-in features.
          </p>
        </div>

        {/* Type Switcher Buttons */}
        <div className="mt-10 flex flex-wrap justify-center gap-2.5">
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
                  ? "border-purple-600 bg-purple-600 text-white shadow-lg shadow-purple-600/25"
                  : "border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300 shadow-sm"
              }`}
            >
              <span className="text-sm">{type.label}</span>
              <span className={`text-[10px] font-medium ${activeType === type.id ? "text-purple-100" : "text-slate-400"}`}>
                {type.desc}
              </span>
            </button>
          ))}
        </div>

        {/* Active Type Showcase Card */}
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-xl shadow-slate-900/5">
          {activeType === "schools" && (
            <div className="grid gap-8 lg:grid-cols-2 items-center animate-in fade-in">
              <div>
                <span className="rounded-md bg-purple-100 px-2.5 py-1 text-xs font-bold text-purple-800">
                  For K-12 Schools
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3">
                  Puri School Ki Daily Operations Ek Simple Screen Par
                </h3>
                <p className="text-sm text-slate-600 mt-3 leading-6 font-medium">
                  Class wise admissions, bus transport tracking, CBSE/State board marksheet generation,
                  daily SMS attendance, aur monthly fee collection reports.
                </p>
                <div className="mt-6 space-y-2.5 text-xs text-slate-700 font-semibold">
                  <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-600" /> Digital Student ID Cards with Barcode</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-600" /> Subject-wise Marks Entry & Grade Calculations</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-600" /> Role-based Teacher & Staff permissions</div>
                </div>
              </div>
              <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-6">
                <h4 className="font-bold text-sm text-purple-900">School Principal Review:</h4>
                <p className="mt-2 text-xs italic text-slate-600 leading-6">
                  “Pehle hamare school me fees ki receipt kaatne me aur marksheet banane me teachers ka pura week chala jata tha. EduTechLab lene ke baad har teacher apne mobile se 2 minute me attendance le leta hai aur marksheet 1 click me ban jati hai.”
                </p>
                <p className="mt-4 text-xs font-bold text-purple-950">— Al-Huda Academy, Patna</p>
              </div>
            </div>
          )}

          {activeType === "coaching" && (
            <div className="grid gap-8 lg:grid-cols-2 items-center animate-in fade-in">
              <div>
                <span className="rounded-md bg-teal-100 px-2.5 py-1 text-xs font-bold text-teal-800">
                  For Coaching & Institutes
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3">
                  Batch Wise Fees Aur Test Marks Ka Complete Control
                </h3>
                <p className="text-sm text-slate-600 mt-3 leading-6 font-medium">
                  Morning/Evening batch management, weekly test results, WhatsApp marks alerts to parents,
                  aur per-student monthly fee tracking bina kisi confusion ke.
                </p>
                <div className="mt-6 space-y-2.5 text-xs text-slate-700 font-semibold">
                  <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-teal-600" /> Instant UPI QR code for fee deposit</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-teal-600" /> Student dues reminder list in 1-click</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-teal-600" /> Test series scorecards with rank</div>
                </div>
              </div>
              <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-6">
                <h4 className="font-bold text-sm text-teal-900">Coaching Director Review:</h4>
                <p className="mt-2 text-xs italic text-slate-600 leading-6">
                  “Hume 120 bachchon ke liye mehenga software nahi chahiye tha. EduTechLab ne ₹5 aur ₹7/student ka itna sasta aur transparent plan diya ki ab har mahine sirf ₹600-800 me pura coaching manage ho jata hai.”
                </p>
                <p className="mt-4 text-xs font-bold text-teal-950">— Target Science Coaching, Gaya</p>
              </div>
            </div>
          )}

          {activeType === "madrasas" && (
            <div className="grid gap-8 lg:grid-cols-2 items-center animate-in fade-in">
              <div>
                <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                  For Madrasas & Maktabs
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3">
                  Hifz Record, Talaba Attendance Aur Mahana Fees
                </h3>
                <p className="text-sm text-slate-600 mt-3 leading-6 font-medium">
                  Madrasas ke liye vishesh taur par banaya gaya simple interface: Hifz para tracking,
                  hostel/khana kharcha dues, donor contributions, aur talaba ki attendance.
                </p>
                <div className="mt-6 space-y-2.5 text-xs text-slate-700 font-semibold">
                  <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-600" /> Hifz / Nazra daily progress log</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-600" /> Mahana fees aur rashan donation records</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-600" /> Phone par chalta hai bina computer ke</div>
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6">
                <h4 className="font-bold text-sm text-emerald-900">Nazim-e-Ala Feedback:</h4>
                <p className="mt-2 text-xs italic text-slate-600 leading-6">
                  “Alhamdulillah hamare madrasa me computer nahi tha, par asatiza apne mobile par hi EduTechLab se haziri aur mahana khorak ka hisab rakh rahe hain. Bahut hi aasan aur mufeed hai.”
                </p>
                <p className="mt-4 text-xs font-bold text-emerald-950">— Jamia Arabia Islamia</p>
              </div>
            </div>
          )}

          {activeType === "colleges" && (
            <div className="grid gap-8 lg:grid-cols-2 items-center animate-in fade-in">
              <div>
                <span className="rounded-md bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-800">
                  For Higher Academies & Colleges
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3">
                  Multi-Department Staff Access & Semester Exams
                </h3>
                <p className="text-sm text-slate-600 mt-3 leading-6 font-medium">
                  Stream-wise (Science, Commerce, Arts) enrollments, multi-semester grade evaluation,
                  faculty permission management, aur high-speed data exports.
                </p>
                <div className="mt-6 space-y-2.5 text-xs text-slate-700 font-semibold">
                  <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-indigo-600" /> Departmental admin and teacher permissions</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-indigo-600" /> High-volume CSV/Excel bulk import & exports</div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-indigo-600" /> Instant financial audit reports</div>
                </div>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-6">
                <h4 className="font-bold text-sm text-indigo-900">Institute Founder:</h4>
                <p className="mt-2 text-xs italic text-slate-600 leading-6">
                  “Scaling from 300 to 1,200 students was seamless. The per-student pricing means we don't have to negotiate expensive enterprise software contracts every academic year.”
                </p>
                <p className="mt-4 text-xs font-bold text-indigo-950">— Apex Global Academy</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 7. COMPARISON TABLE: OLD WAY VS EDUTECHLAB */}
      <section className="px-5 py-24 sm:px-8 border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Purana Tareeqa vs. EduTechLab
            </h2>
            <p className="text-sm text-slate-600 mt-2 font-medium">
              Kyun 90% naye institutes traditional software chhodkar EduTechLab par shift ho rahe hain.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {/* Old Way */}
            <div className="rounded-3xl border border-rose-200 bg-white p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-2 text-rose-700 font-extrabold text-base">
                <span className="text-xl">❌</span>
                <span>Purana / Market Software</span>
              </div>
              <ul className="mt-6 space-y-3.5 text-xs text-slate-600 leading-5 font-medium">
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-600 font-bold text-sm">✕</span>
                  <span><strong>₹20,000 - ₹50,000/saal</strong> ka heavy upfront contract chahe bachche kam ho.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-600 font-bold text-sm">✕</span>
                  <span>Kewal computer par chalta hai, teachers mobile se use nahi kar sakte.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-600 font-bold text-sm">✕</span>
                  <span>Fees ki entry karke duplicate receipt dhoondhna aur WhatsApp bhejna mushkil hota hai.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-600 font-bold text-sm">✕</span>
                  <span>Complex training chahiye hoti hai jo aam staff samajh nahi pata.</span>
                </li>
              </ul>
            </div>

            {/* EduTechLab Way */}
            <div className="rounded-3xl border-2 border-purple-600 bg-white p-6 sm:p-8 relative overflow-hidden shadow-xl shadow-purple-600/10">
              <div className="absolute top-0 right-0 bg-gradient-to-l from-purple-600 to-indigo-600 px-4 py-1 rounded-bl-2xl text-[10px] font-extrabold text-white uppercase tracking-wider">
                RECOMMENDED
              </div>
              <div className="flex items-center gap-2 text-purple-900 font-extrabold text-base">
                <span className="text-xl">✅</span>
                <span>The EduTechLab Way</span>
              </div>
              <ul className="mt-6 space-y-3.5 text-xs text-slate-700 leading-5 font-semibold">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Starting Sirf ₹5/child/mahina</strong> — Standard (₹5) aur Pro (₹7) plans me complete freedom.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Mobile App Built-in</strong> — Teachers apne mobile phone se 1 minute me haziri lein.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Instant UPI QR & Receipts</strong> — Parents ko turant WhatsApp par branded receipt mil jati hai.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
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
          <span className="text-xs font-bold uppercase tracking-widest text-purple-700 bg-purple-50 px-3 py-1 rounded-full">
            Got Questions?
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
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
              q: "Standard (₹5) aur Pro (₹7) plan me kya farq hai?",
              a: "Standard Plan (₹5/child/mo) me Student directory, Attendance register with auto-save, Fees collection with thermal/A4 receipts, homework, timetable aur WhatsApp notices aate hain. Pro Plan (₹7/child/mo) me in sabke alawa Smart Gate QR Scanner Kiosk, PVC ID Card generator, Luxury Board Marksheets, Class promotion wizard, aur TC certificate generator shamil hain.",
            },
            {
              q: "Subscription me student badhane ya ghatane ka kya hisab hai?",
              a: "Aapko koi saal bhar ka binding contract nahi hai. Aap jitne active students onboard karte hain sirf utne bachcho ka hisab rehta hai (₹5 ya ₹7 per student). Naye session me bachche badhne par aap direct capacity upgrade kar sakte hain.",
            },
            {
              q: "Free trial ke liye kya hume credit card ya pehle payment karni hogi?",
              a: "Nahi, bilkul nahi! Free trial 100% free hai bina kisi card ya payment details ke. Aap bina kisi risk ke pura software apne institute ke sath test karein, pasand aaye tabhi aage continue karein.",
            },
            {
              q: "Fees payment kaise hoti hai? Kya school ka apna QR code lagega?",
              a: "Haan! School Admin apna khud ka UPI QR code aur UPI ID dalte hain. Parents scan karke direct aapke bank account me fee transfer karte hain, aur system instant digital receipt generate karta hai.",
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
                className="rounded-2xl border border-slate-200 bg-white overflow-hidden transition shadow-sm"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left text-sm font-bold text-slate-900 hover:bg-slate-50 transition"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    size={16}
                    className={`text-purple-600 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs leading-6 text-slate-600 border-t border-slate-100 pt-3 animate-in fade-in font-medium">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 9. HIGH CONVERTING FINAL CTA BANNER (BRIGHT GRADIENT) */}
      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-5xl rounded-[36px] bg-gradient-to-r from-purple-700 via-[#6657e8] to-indigo-700 p-8 sm:p-14 text-center relative overflow-hidden shadow-2xl shadow-purple-600/25 border border-purple-400">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1 text-xs font-bold text-white backdrop-blur-md">
            <Sparkles size={13} className="text-yellow-300" /> Shuru Karein Sirf 2 Minute Me
          </span>

          <h2 className="mt-5 text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Apne Institute Ko De Nayi Udaan. <br />
            Aaj Hi Free Trial Shuru Karein!
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-purple-100 font-medium">
            Koi credit card nahi, koi setup fee nahi. Bina payment ke sabhi features full speed me chala kar dekhein.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-sm font-black text-purple-900 shadow-xl hover:bg-slate-50 transition hover:-translate-y-0.5"
            >
              <span>Create Your Institute Free</span>
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/40 bg-white/10 px-6 py-4 text-sm font-bold text-white hover:bg-white/20 transition backdrop-blur-md"
            >
              <span>Already Have Account? Sign In</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 10. CLEAN LIGHT FOOTER (DYNAMICALLY UPDATED BY SUPER ADMIN) */}
      <footer className="border-t border-slate-200 bg-white px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-500 font-medium">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-slate-900 text-white">
                <GraduationCap size={15} />
              </div>
              <span className="font-extrabold text-slate-900">{platformSettings.brand_name}</span>
            </div>
            <span>© 2026. All rights reserved.</span>
            {platformSettings.company_address && (
              <span className="text-slate-400 hidden sm:inline">&bull; 📍 {platformSettings.company_address}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-slate-600 font-semibold">
            {platformSettings.contact_phone && (
              <a href={`tel:${platformSettings.contact_phone.replace(/\s+/g, "")}`} className="hover:text-purple-600 transition">
                📞 {platformSettings.contact_phone}
              </a>
            )}
            {platformSettings.contact_email && (
              <a href={`mailto:${platformSettings.contact_email}`} className="hover:text-purple-600 transition">
                ✉️ {platformSettings.contact_email}
              </a>
            )}
            <Link href="/parent-portal" className="hover:text-purple-600 transition">
              Parent Portal
            </Link>
            <Link href="/login" className="hover:text-purple-600 transition">
              Staff / Admin Login
            </Link>
            <Link href="/register" className="hover:text-purple-600 transition">
              Register Institute
            </Link>
          </div>
        </div>
      </footer>

      {/* Floating Quick WhatsApp Consultation Button (LIVE FROM SUPER ADMIN) */}
      <a
        href={`https://wa.me/${platformSettings.whatsapp_number.replace(/\D/g, "")}?text=${encodeURIComponent(
          `Hello ${platformSettings.brand_name}, mujhe apne institute ke liye software demo chahiye.`
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-full bg-emerald-500 px-4 py-3 text-xs font-extrabold text-white shadow-2xl shadow-emerald-500/40 hover:bg-emerald-600 hover:scale-105 transition active:scale-95 group"
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
        </span>
        <MessageCircle size={18} className="text-white fill-white" />
        <span className="hidden sm:inline font-bold">Ask Demo On WhatsApp</span>
      </a>
    </main>
  );
}
