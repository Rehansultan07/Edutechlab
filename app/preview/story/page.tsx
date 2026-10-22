"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Video,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Users,
  Wallet,
  GraduationCap,
  FileText,
  Clock,
  Send,
  Smartphone,
  ShieldCheck,
  QrCode,
  School,
  Download,
  Share2,
} from "lucide-react";

// Web Audio API Sound Synthesizer for self-contained UI effects
function playSound(type: "ding" | "click" | "chime") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === "ding") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === "chime") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else {
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    }
  } catch {}
}

const TOTAL_SCENES = 4;
const SCENE_DURATIONS = [3800, 4200, 4000, 4000]; // Duration in ms for each of the 4 scenes (~16s total)
const TOTAL_CYCLE_TIME = SCENE_DURATIONS.reduce((a, b) => a + b, 0);

export default function StoryboardPresentationPage() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0); // in ms
  const [activeScene, setActiveScene] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [speed, setSpeed] = useState<1 | 1.25 | 1.5>(1);
  const [recordMode, setRecordMode] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const prevSceneRef = useRef(0);
  const reqIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Compute active scene from elapsed
  const getSceneFromElapsed = useCallback((ms: number) => {
    let accumulated = 0;
    for (let i = 0; i < SCENE_DURATIONS.length; i++) {
      accumulated += SCENE_DURATIONS[i];
      if (ms < accumulated) return i;
    }
    return TOTAL_SCENES - 1;
  }, []);

  // Main Animation Loop
  useEffect(() => {
    if (!isPlaying || countdown !== null) {
      lastTimeRef.current = null;
      return;
    }

    const loop = (timestamp: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }
      const delta = (timestamp - lastTimeRef.current) * speed;
      lastTimeRef.current = timestamp;

      setElapsed((prev) => {
        const next = (prev + delta) % TOTAL_CYCLE_TIME;
        const currentScene = getSceneFromElapsed(next);

        if (currentScene !== prevSceneRef.current) {
          if (soundEnabled) {
            playSound(currentScene === 1 ? "ding" : currentScene === 2 ? "chime" : "click");
          }
          prevSceneRef.current = currentScene;
          setActiveScene(currentScene);
        }

        return next;
      });

      reqIdRef.current = requestAnimationFrame(loop);
    };

    reqIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
    };
  }, [isPlaying, speed, soundEnabled, countdown, getSceneFromElapsed]);

  // Jump to specific scene
  const goToScene = (index: number) => {
    let target = 0;
    for (let i = 0; i < index; i++) target += SCENE_DURATIONS[i];
    setElapsed(target);
    setActiveScene(index);
    prevSceneRef.current = index;
    if (soundEnabled) playSound("click");
  };

  // Trigger Clean Record Mode with 3s Countdown
  const startRecordMode = () => {
    setCountdown(3);
    setRecordMode(true);
    setIsPlaying(false);
    setElapsed(0);
    setActiveScene(0);
    prevSceneRef.current = 0;

    let count = 3;
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
        if (soundEnabled) playSound("click");
      } else {
        clearInterval(interval);
        setCountdown(null);
        setIsPlaying(true);
        if (soundEnabled) playSound("ding");
      }
    }, 1000);
  };

  // Keyboard Shortcuts: Space for play/pause, R for record mode, Esc to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === "KeyR") {
        setRecordMode((r) => !r);
      } else if (e.code === "Escape") {
        setRecordMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const progressPercent = (elapsed / TOTAL_CYCLE_TIME) * 100;

  return (
    <div className="relative min-h-screen bg-slate-950 text-white overflow-hidden flex flex-col justify-between selection:bg-purple-500">
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-600/20 blur-[120px] rounded-full" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-600/20 blur-[120px] rounded-full" />
      </div>

      {/* Record Mode Countdown Overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="text-center">
            <span className="text-xs uppercase tracking-widest text-purple-400 font-bold">
              Starting Clean Presentation In
            </span>
            <div className="mt-2 text-7xl sm:text-9xl font-black text-white animate-pulse">
              {countdown}
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Start your screen recorder now. All toolbars are hidden!
            </p>
          </div>
        </div>
      )}

      {/* TOP HEADER: Hidden in Record Mode */}
      {!recordMode && (
        <header className="relative z-10 flex items-center justify-between px-4 py-3 sm:px-8 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Link
              href="/preview"
              className="grid h-8 w-8 place-items-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
              title="Back to Preview Hub"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
                  <Sparkles size={14} className="text-purple-400" />
                  EduTechLab
                </span>
                <span className="rounded-md bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-300 border border-purple-500/30">
                  16:9 Presentation
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Cinematic 4-Stage School Transformation Video Storyboard
              </p>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled((s) => !s)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition ${
                soundEnabled
                  ? "border-purple-500/40 bg-purple-950/40 text-purple-300"
                  : "border-slate-800 bg-slate-900 text-slate-500"
              }`}
              title="Toggle Audio Chimes"
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              <span className="hidden sm:inline">{soundEnabled ? "Audio On" : "Muted"}</span>
            </button>

            <button
              onClick={() => {
                const speeds: (1 | 1.25 | 1.5)[] = [1, 1.25, 1.5];
                const nextIdx = (speeds.indexOf(speed) + 1) % speeds.length;
                setSpeed(speeds[nextIdx]);
              }}
              className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
              title="Playback Speed"
            >
              {speed}x
            </button>

            <button
              onClick={startRecordMode}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-red-600/30 hover:from-red-500 hover:to-rose-500 transition animate-pulse"
              title="Hide all controls for video screen recording (Hotkey: R)"
            >
              <Video size={14} />
              <span>Clean Record Mode</span>
            </button>
          </div>
        </header>
      )}

      {/* Floating Exit Banner in Record Mode */}
      {recordMode && (
        <div className="fixed top-3 right-4 z-40 opacity-30 hover:opacity-100 transition duration-300">
          <button
            onClick={() => setRecordMode(false)}
            className="rounded-full bg-slate-900/80 border border-slate-700 px-3 py-1 text-[10px] text-slate-300 backdrop-blur-md hover:bg-slate-800"
          >
            Press Esc or Click to Exit Record Mode
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* MAIN VIEWPORT: 16:9 CINEMATIC STAGE                            */}
      {/* ============================================================== */}
      <main className="relative flex-1 flex items-center justify-center p-3 sm:p-6">
        <div className="relative w-full max-w-5xl aspect-[16/10] sm:aspect-[16/9] rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-4 sm:p-8 shadow-2xl shadow-purple-950/50 flex flex-col justify-between overflow-hidden">
          {/* Subtle grid background */}
          <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

          {/* Top Stage Bar */}
          <div className="relative z-10 flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-black text-xs shadow-sm">
                E
              </span>
              <div>
                <span className="text-xs sm:text-sm font-extrabold tracking-tight text-white">
                  Delhi Public Academy
                </span>
                <span className="block text-[10px] font-mono text-purple-400">
                  ID: EDU-DPA2026 &bull; Superfast Cloud Portal
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live Demo Active
              </span>
            </div>
          </div>

          {/* ========================================================== */}
          {/* SCENE 0: MORNING ATTENDANCE RUSH                           */}
          {/* ========================================================== */}
          {activeScene === 0 && (
            <div className="relative z-10 my-auto py-2 transition-all duration-500 animate-fade-in">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-widest">
                <Clock size={14} />
                <span>Stage 1 of 4: Morning 8:00 AM Attendance</span>
              </div>

              <h2 className="mt-1 text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                480 Students Arrive. <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">1 Tap Takes Care of Everything.</span>
              </h2>

              <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-xl">
                No registers, no lost paper. Attendance is marked in seconds, and WhatsApp alerts go out automatically to absent parents!
              </p>

              {/* Animated Attendance Stats Grid */}
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 backdrop-blur-sm">
                  <span className="text-[11px] font-semibold text-slate-400">Total Enrolled</span>
                  <p className="mt-1 text-xl sm:text-2xl font-black text-white">480</p>
                  <span className="text-[10px] text-slate-500">All 12 Classes</span>
                </div>

                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 backdrop-blur-sm">
                  <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Present Today
                  </span>
                  <p className="mt-1 text-xl sm:text-2xl font-black text-emerald-400">462</p>
                  <span className="text-[10px] text-emerald-500/80">96.3% Attendance</span>
                </div>

                <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-3.5 backdrop-blur-sm">
                  <span className="text-[11px] font-semibold text-rose-400">Absent</span>
                  <p className="mt-1 text-xl sm:text-2xl font-black text-rose-400">18</p>
                  <span className="text-[10px] text-rose-500/80">Alerts Sent</span>
                </div>

                <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-3.5 backdrop-blur-sm">
                  <span className="text-[11px] font-semibold text-cyan-400">Time Taken</span>
                  <p className="mt-1 text-xl sm:text-2xl font-black text-cyan-400">1.8s</p>
                  <span className="text-[10px] text-cyan-500/80">Zero Paper Used</span>
                </div>
              </div>

              {/* Instant WhatsApp Notification Simulation Banner */}
              <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 to-slate-900 p-3 shadow-lg animate-slide-up">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/20 text-emerald-400">
                    <Send size={14} />
                  </span>
                  <span className="text-xs text-slate-200">
                    <strong>Auto-WhatsApp Alert:</strong> 18 Absent notifications dispatched to parents with 1-click!
                  </span>
                </div>
                <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  Delivered ✓✓
                </span>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* SCENE 1: 3-SECOND SMART FEE COLLECTION                     */}
          {/* ========================================================== */}
          {activeScene === 1 && (
            <div className="relative z-10 my-auto py-2 transition-all duration-500 animate-fade-in">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-widest">
                <Wallet size={14} />
                <span>Stage 2 of 4: 10:30 AM Fee Collection</span>
              </div>

              <h2 className="mt-1 text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                Fee Collection in <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Under 3 Seconds</span> with GST Receipt.
              </h2>

              <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-xl">
                Automatic monthly fee calculation, instant official receipt with QR verification, and instant WhatsApp delivery to the parent!
              </p>

              {/* Split Interactive View: Entry + Live Receipt */}
              <div className="mt-5 grid sm:grid-cols-2 gap-4">
                {/* Left Card: Entry */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-2">
                    Quick Fee Entry
                  </span>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-xl bg-slate-800/80 px-3 py-2 text-xs">
                      <span className="text-slate-400">Student:</span>
                      <strong className="text-white">Aarav Sharma (Class 8-A)</strong>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-slate-800/80 px-3 py-2 text-xs">
                      <span className="text-slate-400">Fee Months:</span>
                      <strong className="text-white">October + November 2026</strong>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-emerald-950/40 border border-emerald-500/20 px-3 py-2 text-xs">
                      <span className="text-emerald-300 font-semibold">Total Amount:</span>
                      <span className="text-base font-black text-emerald-400">₹2,800</span>
                    </div>
                  </div>
                </div>

                {/* Right Card: Instant Generated Receipt */}
                <div className="relative rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 to-emerald-950/30 p-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-xs font-bold text-white">Official Receipt #REC-8942</span>
                    </div>
                    <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      PAID &amp; VERIFIED
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="text-slate-400 text-[11px]">Mode: UPI / QR Code</p>
                      <p className="text-slate-400 text-[11px]">UTR: 629481029381</p>
                    </div>
                    <div className="grid h-12 w-12 place-items-center rounded-xl bg-white p-1 shadow-sm">
                      <QrCode size={40} className="text-slate-950" />
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Receipt dispatched to +91 98765 43210</span>
                    <span className="text-emerald-400 font-bold">1-Click PDF ✓</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* SCENE 2: CBSE MARKSHEETS & SMART ID CARDS                  */}
          {/* ========================================================== */}
          {activeScene === 2 && (
            <div className="relative z-10 my-auto py-2 transition-all duration-500 animate-fade-in">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-widest">
                <GraduationCap size={14} />
                <span>Stage 3 of 4: Exam Results &amp; ID Cards</span>
              </div>

              <h2 className="mt-1 text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                Exam Season? <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Generate 500 Report Cards</span> In 10 Seconds.
              </h2>

              <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-xl">
                CBSE-compliant grades, auto-calculated percentages, ranks, teacher remarks, and professional Student ID cards ready for print!
              </p>

              {/* Marksheet & ID Card Showcase */}
              <div className="mt-5 grid sm:grid-cols-2 gap-4">
                {/* Marksheet Preview Card */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-white">Annual Report Card (CBSE Format)</span>
                    <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                      Rank #1
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Mathematics</span>
                      <strong className="text-cyan-300">98 / 100 (A+)</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Science</span>
                      <strong className="text-cyan-300">95 / 100 (A+)</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">English</span>
                      <strong className="text-cyan-300">92 / 100 (A+)</strong>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Total: <strong>95.0%</strong></span>
                    <span className="text-emerald-400 font-bold">Passed with Distinction</span>
                  </div>
                </div>

                {/* Smart ID Card Preview */}
                <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900 to-cyan-950/30 p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-xl bg-purple-600/30 text-purple-300 font-bold text-sm border border-purple-400/30">
                      PHOTO
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Aarav Sharma</h4>
                      <p className="text-[10px] text-slate-400">Class: 8-A &bull; Roll: 14</p>
                      <p className="text-[10px] text-cyan-400 font-mono">ID: DPA-STU-0014</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-2 text-[11px]">
                    <span className="text-slate-400">Emergency Contact:</span>
                    <span className="text-white font-mono">+91 98765 43210</span>
                  </div>

                  <div className="mt-3 text-center">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-cyan-300">
                      <CheckCircle2 size={12} /> Printable High-Resolution ID Card Ready
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* SCENE 3: DIRECTOR MASTER MOBILE CONTROL                    */}
          {/* ========================================================== */}
          {activeScene === 3 && (
            <div className="relative z-10 my-auto py-2 transition-all duration-500 animate-fade-in">
              <div className="flex items-center gap-2 text-xs font-bold text-yellow-400 uppercase tracking-widest">
                <Smartphone size={14} />
                <span>Stage 4 of 4: Master Phone Control</span>
              </div>

              <h2 className="mt-1 text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                Run Your Entire School <span className="bg-gradient-to-r from-yellow-400 to-amber-300 bg-clip-text text-transparent">Directly From Your Phone</span>.
              </h2>

              <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-xl">
                Anytime, anywhere. No app downloads required — simply log in with your Institute ID and start managing admissions, fees, and staff.
              </p>

              {/* 4 Feature Badges */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 text-center">
                  <span className="text-xl">📱</span>
                  <h4 className="mt-1 text-xs font-bold text-white">Any Device</h4>
                  <p className="text-[10px] text-slate-400">Mobile, Laptop, Tablet</p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 text-center">
                  <span className="text-xl">⚡</span>
                  <h4 className="mt-1 text-xs font-bold text-white">Instant Setup</h4>
                  <p className="text-[10px] text-slate-400">Live in 5 Minutes</p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 text-center">
                  <span className="text-xl">🔒</span>
                  <h4 className="mt-1 text-xs font-bold text-white">100% Secured</h4>
                  <p className="text-[10px] text-slate-400">Daily Cloud Backup</p>
                </div>

                <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-3 text-center">
                  <span className="text-xl">🎁</span>
                  <h4 className="mt-1 text-xs font-bold text-amber-300">15-Day Free Trial</h4>
                  <p className="text-[10px] text-amber-400/80">No Advance Payment</p>
                </div>
              </div>

              {/* Final Callout Banner */}
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between rounded-2xl border border-purple-500/40 bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 p-4 gap-3">
                <div>
                  <span className="text-xs font-extrabold text-white">
                    Ready to digitize your school or coaching institute?
                  </span>
                  <p className="text-[11px] text-purple-300">
                    Get an instant Demo Login ID right now and test it on your personal phone.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-lg hover:from-purple-500 hover:to-indigo-500 transition shrink-0"
                >
                  Try Demo Login Now
                </Link>
              </div>
            </div>
          )}

          {/* Bottom Stage Progress Bar */}
          <div className="relative z-10 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-mono text-purple-400 font-bold">
                0{activeScene + 1} / 04
              </span>
              <span className="hidden sm:inline text-slate-500">&bull;</span>
              <span className="hidden sm:inline text-[11px]">
                {activeScene === 0
                  ? "Morning Attendance"
                  : activeScene === 1
                  ? "Smart Fee Collection"
                  : activeScene === 2
                  ? "Report Cards & ID Cards"
                  : "Master Mobile Control"}
              </span>
            </div>

            {/* Segmented Timeline Dots */}
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3].map((idx) => (
                <button
                  key={idx}
                  onClick={() => goToScene(idx)}
                  className={`h-2 rounded-full transition-all ${
                    activeScene === idx
                      ? "w-8 bg-purple-500"
                      : "w-2 bg-slate-700 hover:bg-slate-600"
                  }`}
                  title={`Go to Stage ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* ============================================================== */}
      {/* BOTTOM CONTROLLER BAR: Hidden in Record Mode                   */}
      {/* ============================================================== */}
      {!recordMode && (
        <footer className="relative z-10 px-4 py-3 sm:px-8 border-t border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Progress Timeline Scrubber */}
          <div className="w-full sm:w-1/3">
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 via-cyan-400 to-emerald-400 transition-all duration-100"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0:00</span>
              <span>10s Video Showcase</span>
              <span>0:16</span>
            </div>
          </div>

          {/* Central Playback Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setElapsed(0);
                setActiveScene(0);
                prevSceneRef.current = 0;
                setIsPlaying(true);
                if (soundEnabled) playSound("click");
              }}
              className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 transition"
              title="Restart from Beginning"
            >
              <RotateCcw size={15} />
            </button>

            <button
              onClick={() => {
                setIsPlaying((p) => !p);
                if (soundEnabled) playSound("click");
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-purple-600/30 hover:bg-purple-500 transition"
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
              <span>{isPlaying ? "Pause Presentation" : "Play Presentation"}</span>
            </button>

            <button
              onClick={startRecordMode}
              className="rounded-xl border border-red-500/40 bg-red-950/30 p-2 text-red-400 hover:bg-red-900/40 transition"
              title="Clean Record Mode (Press R)"
            >
              <Video size={15} />
            </button>
          </div>

          {/* Keyboard Hints */}
          <div className="hidden lg:flex items-center gap-3 text-[11px] text-slate-500">
            <span>
              <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 font-mono text-[10px] text-slate-400">Space</kbd> Play/Pause
            </span>
            <span>
              <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 font-mono text-[10px] text-slate-400">R</kbd> Record Mode
            </span>
            <span>
              <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 font-mono text-[10px] text-slate-400">Esc</kbd> Exit
            </span>
          </div>
        </footer>
      )}
    </div>
  );
}
