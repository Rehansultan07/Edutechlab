"use client";

import Link from "next/link";
import {
  Monitor,
  Smartphone,
  Play,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Video,
  Layers,
  CheckCircle2,
  Share2,
  Clock,
  Zap,
} from "lucide-react";

export default function PreviewHubPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-purple-500 selection:text-white">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-purple-600/25 to-cyan-500/20 blur-[130px] rounded-full" />
        <div className="absolute top-1/2 -left-40 w-[450px] h-[450px] bg-blue-600/15 blur-[120px] rounded-full" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Top Tagline */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-950/50 px-3.5 py-1 text-xs font-semibold text-purple-300 backdrop-blur-md">
            <Sparkles size={14} className="text-yellow-400" />
            <span>EduTechLab • Interactive Video Presentation Hub</span>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Choose Your Presentation Format
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-slate-400 leading-relaxed">
            2 dynamic, self-animating preview pages designed for 10-second client demos &amp; screen recording. Click on either format to start the animated showcase!
          </p>
        </div>

        {/* 2 Format Cards */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {/* Card 1: 16:9 Cinematic Storyboard */}
          <div className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8 backdrop-blur-xl transition hover:border-purple-500/50 hover:shadow-2xl hover:shadow-purple-500/10">
            <div className="flex items-center justify-between">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30 group-hover:scale-110 transition">
                <Monitor size={24} />
              </span>
              <span className="rounded-full bg-purple-500/10 px-3 py-1 text-[11px] font-bold text-purple-400 border border-purple-500/20 uppercase tracking-wider">
                16:9 Landscape
              </span>
            </div>

            <h3 className="mt-6 text-xl font-bold text-white group-hover:text-purple-300 transition">
              Option 1: 10-Sec Cinematic SaaS Storyboard
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
              Best for <strong>Laptops, Projectors, Desktop Demos &amp; YouTube</strong>. Animates through 4 sequential stages: Morning Attendance Rush, 3-Second Fee Collection with PDF Receipt, Instant CBSE Marksheets, and Master Mobile Control.
            </p>

            <ul className="mt-5 space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>Synchronized audio chimes &amp; live animated counters</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>1-Click <strong>&quot;Clean Record Mode&quot;</strong> (Hides controls for pristine screen recording)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>Timeline scrubber, Play/Pause &amp; 1x/1.5x speed toggle</span>
              </li>
            </ul>

            <div className="mt-8 pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <Clock size={13} />
                <span>~12s Auto-run cycle</span>
              </span>
              <Link
                href="/preview/story"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-600/30 hover:from-purple-500 hover:to-indigo-500 transition group-hover:translate-x-1"
              >
                <span>Launch 16:9 Presentation</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          {/* Card 2: 9:16 Mobile Reel Mockup */}
          <div className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8 backdrop-blur-xl transition hover:border-cyan-500/50 hover:shadow-2xl hover:shadow-cyan-500/10">
            <div className="flex items-center justify-between">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 group-hover:scale-110 transition">
                <Smartphone size={24} />
              </span>
              <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] font-bold text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">
                9:16 Vertical Reel
              </span>
            </div>

            <h3 className="mt-6 text-xl font-bold text-white group-hover:text-cyan-300 transition">
              Option 2: Realistic Smartphone Reel Simulator
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
              Best for <strong>Instagram Reels, YouTube Shorts, WhatsApp Status &amp; Mobile Clients</strong>. Renders inside an iPhone 16 Pro mockup simulating live finger taps, typing login credentials, and Dynamic Island notifications!
            </p>

            <ul className="mt-5 space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-cyan-400" />
                <span>Simulated live touch typing with Institute Demo ID</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-cyan-400" />
                <span>Dynamic Island expands with real-time WhatsApp fee alerts</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-cyan-400" />
                <span>Designed strictly to fit vertical 9:16 phone screen recordings</span>
              </li>
            </ul>

            <div className="mt-8 pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <Clock size={13} />
                <span>~10s Smooth loop</span>
              </span>
              <Link
                href="/preview/mobile-reel"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-cyan-600/30 hover:from-cyan-500 hover:to-blue-500 transition group-hover:translate-x-1"
              >
                <span>Launch Mobile Reel</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>

        {/* Recording Tip Banner */}
        <div className="mt-8 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 text-center sm:text-left sm:flex sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
              <Video size={18} />
            </span>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white">How to record a 10-second commercial video:</h4>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                1. Open either presentation page. &bull; 2. Press <strong>&quot;Clean Record Mode&quot;</strong> (or press key <code>R</code>) to hide all UI controls. &bull; 3. Start your phone or PC Screen Recorder and let it play for 10-12 seconds!
              </p>
            </div>
          </div>
          <div className="mt-3 sm:mt-0 shrink-0">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
            >
              <span>Back to App Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
