"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Video,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Users,
  Wallet,
  GraduationCap,
  Clock,
  Send,
  Smartphone,
  ShieldCheck,
  QrCode,
  Bell,
  Wifi,
  Battery,
  Lock,
  ChevronRight,
  CreditCard,
  Layers,
} from "lucide-react";

// Web Audio API Sound Synthesizer for self-contained UI effects
function playSound(type: "ding" | "click" | "chime" | "type") {
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
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } else if (type === "type") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(900 + Math.random() * 200, ctx.currentTime);
      gain.gain.setValueAtTime(0.02, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.03);
    } else {
      osc.type = "sine";
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    }
  } catch {}
}

const TOTAL_STAGES = 4;
// Stage 0: Login simulation (2.8s)
// Stage 1: Mobile Dashboard Load & Metrics (3.2s)
// Stage 2: Quick Fee Collection & Dynamic Island expand (3.5s)
// Stage 3: Report Card & Call to action (3.5s)
const STAGE_DURATIONS = [2800, 3200, 3500, 3500];
const TOTAL_CYCLE_TIME = STAGE_DURATIONS.reduce((a, b) => a + b, 0);

export default function MobileReelPresentationPage() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0); // in ms
  const [stage, setStage] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [speed, setSpeed] = useState<1 | 1.25 | 1.5>(1);
  const [recordMode, setRecordMode] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Simulated Typing State for Stage 0
  const [typedId, setTypedId] = useState("");
  const [typedPass, setTypedPass] = useState("");

  const prevStageRef = useRef(0);
  const reqIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const getStageFromElapsed = useCallback((ms: number) => {
    let acc = 0;
    for (let i = 0; i < STAGE_DURATIONS.length; i++) {
      acc += STAGE_DURATIONS[i];
      if (ms < acc) return i;
    }
    return TOTAL_STAGES - 1;
  }, []);

  // Main Loop
  useEffect(() => {
    if (!isPlaying || countdown !== null) {
      lastTimeRef.current = null;
      return;
    }

    const loop = (timestamp: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
      const delta = (timestamp - lastTimeRef.current) * speed;
      lastTimeRef.current = timestamp;

      setElapsed((prev) => {
        const next = (prev + delta) % TOTAL_CYCLE_TIME;
        const currentStage = getStageFromElapsed(next);

        // Manage simulated typing during Stage 0
        if (currentStage === 0) {
          const fullId = "EDU-DELHI2026";
          const stageElapsed = next;
          const idChars = Math.min(
            fullId.length,
            Math.floor((stageElapsed / 1400) * fullId.length)
          );
          setTypedId(fullId.slice(0, idChars));

          if (stageElapsed > 1400) {
            const passLength = Math.min(
              8,
              Math.floor(((stageElapsed - 1400) / 900) * 8)
            );
            setTypedPass("•".repeat(passLength));
          } else {
            setTypedPass("");
          }
        }

        if (currentStage !== prevStageRef.current) {
          if (soundEnabled) {
            playSound(
              currentStage === 1
                ? "ding"
                : currentStage === 2
                ? "chime"
                : "click"
            );
          }
          prevStageRef.current = currentStage;
          setStage(currentStage);
        }

        return next;
      });

      reqIdRef.current = requestAnimationFrame(loop);
    };

    reqIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
    };
  }, [isPlaying, speed, soundEnabled, countdown, getStageFromElapsed]);

  // Jump to specific stage
  const goToStage = (idx: number) => {
    let t = 0;
    for (let i = 0; i < idx; i++) t += STAGE_DURATIONS[i];
    setElapsed(t);
    setStage(idx);
    prevStageRef.current = idx;
    if (soundEnabled) playSound("click");
  };

  // Record Mode with 3s Countdown
  const startRecordMode = () => {
    setCountdown(3);
    setRecordMode(true);
    setIsPlaying(false);
    setElapsed(0);
    setStage(0);
    prevStageRef.current = 0;

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

  // Keyboard Shortcuts: Space, R, Esc
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === "KeyR") {
        setRecordMode((r) => !r);
      } else if (e.code === "Escape") {
        setRecordMode(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const progressPercent = (elapsed / TOTAL_CYCLE_TIME) * 100;

  return (
    <div className="relative min-h-screen bg-slate-950 text-white flex flex-col justify-between overflow-hidden selection:bg-cyan-500">
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-cyan-600/15 blur-[140px] rounded-full" />
        <div className="absolute -bottom-40 right-10 w-[500px] h-[500px] bg-purple-600/15 blur-[140px] rounded-full" />
      </div>

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-md">
          <div className="text-center">
            <span className="text-xs uppercase tracking-widest text-cyan-400 font-bold">
              Starting 9:16 Reel Recording In
            </span>
            <div className="mt-2 text-7xl sm:text-9xl font-black text-white animate-pulse">
              {countdown}
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Start screen recorder now. Capture the vertical phone in full resolution!
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
                  <Smartphone size={14} className="text-cyan-400" />
                  EduTechLab
                </span>
                <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300 border border-cyan-500/30">
                  9:16 Reel Simulator
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Realistic iPhone 16 Pro Vertical Simulation for Reels &amp; Shorts
              </p>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled((s) => !s)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition ${
                soundEnabled
                  ? "border-cyan-500/40 bg-cyan-950/40 text-cyan-300"
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
              title="Clean Record Mode (Hotkey: R)"
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
            Press Esc to Exit Record Mode
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* PHONE VIEWPORT (iPhone 16 Pro Frame)                           */}
      {/* ============================================================== */}
      <main className="relative flex-1 flex items-center justify-center p-3 sm:py-6">
        {/* The Outer Phone Hardware Shell */}
        <div className="relative w-full max-w-[340px] sm:max-w-[360px] aspect-[9/18.5] rounded-[48px] border-[10px] border-slate-800 bg-black p-3.5 shadow-2xl shadow-cyan-950/60 ring-1 ring-slate-700 flex flex-col justify-between overflow-hidden">
          {/* Subtle phone reflection glare */}
          <div className="absolute top-0 right-0 w-32 h-64 bg-gradient-to-bl from-white/10 to-transparent pointer-events-none rounded-tr-[36px]" />

          {/* ========================================================== */}
          {/* TOP STATUS BAR & DYNAMIC ISLAND                            */}
          {/* ========================================================== */}
          <div className="relative z-30 pt-1 pb-2 flex flex-col items-center">
            {/* Dynamic Island Pill */}
            <div
              className={`transition-all duration-300 rounded-full bg-black border border-slate-800 flex items-center justify-between px-3 py-1.5 shadow-md ${
                stage === 2
                  ? "w-[92%] h-11 bg-emerald-950/90 border-emerald-500/50"
                  : "w-28 h-6"
              }`}
            >
              {stage === 2 ? (
                /* Dynamic Island Expanded: WhatsApp Alert */
                <div className="w-full flex items-center justify-between text-[10px] animate-fade-in">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <CheckCircle2 size={13} />
                    <span>WhatsApp Receipt Sent!</span>
                  </div>
                  <span className="text-white font-mono font-bold">₹2,500</span>
                </div>
              ) : (
                /* Normal Island */
                <div className="w-full flex items-center justify-between px-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-900 border border-slate-800" />
                  <span className="h-2 w-2 rounded-full bg-emerald-500/80 animate-pulse" />
                </div>
              )}
            </div>

            {/* Status Bar: Time & Connectivity */}
            <div className="w-full mt-1.5 flex items-center justify-between px-4 text-[11px] font-bold text-slate-300">
              <span>9:41</span>
              <div className="flex items-center gap-1.5 text-slate-400">
                <Wifi size={12} />
                <span className="text-[10px] font-extrabold text-white">5G</span>
                <Battery size={13} className="text-white" />
              </div>
            </div>
          </div>

          {/* ========================================================== */}
          {/* SCREEN CONTENT AREA                                        */}
          {/* ========================================================== */}
          <div className="relative z-20 flex-1 flex flex-col justify-between overflow-hidden rounded-[28px] bg-slate-950 p-3.5 border border-slate-900">
            {/* STAGE 0: LOGIN SCREEN SIMULATION */}
            {stage === 0 && (
              <div className="my-auto space-y-4 animate-fade-in text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-black text-xl shadow-lg shadow-cyan-600/30">
                  E
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-white">EduTechLab Mobile</h3>
                  <p className="text-[10px] text-slate-400">Institute Direct Sign In</p>
                </div>

                <div className="space-y-2.5 text-left text-xs">
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Institute Login ID
                    </label>
                    <div className="mt-1 flex items-center rounded-xl border border-cyan-500/50 bg-slate-900 px-3 py-2 text-cyan-300 font-mono font-bold text-xs shadow-inner">
                      <span>{typedId}</span>
                      <span className="ml-0.5 h-3.5 w-1 bg-cyan-400 animate-pulse" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      Master Password
                    </label>
                    <div className="mt-1 flex items-center rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white font-mono text-xs">
                      <span>{typedPass}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-2.5 text-xs font-bold text-white shadow-md shadow-cyan-600/30 animate-pulse flex items-center justify-center gap-1.5">
                    <Lock size={12} />
                    <span>Signing In...</span>
                  </div>
                </div>
              </div>
            )}

            {/* STAGE 1: MOBILE DASHBOARD LOAD */}
            {stage === 1 && (
              <div className="space-y-3 animate-fade-in">
                {/* Director Header */}
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div>
                    <span className="text-[10px] text-slate-400">Good Morning,</span>
                    <h4 className="text-xs font-black text-white">Director Sahab</h4>
                  </div>
                  <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[9px] font-bold text-cyan-300 border border-cyan-500/30">
                    EDU-DELHI2026
                  </span>
                </div>

                {/* 3 Mobile Metric Cards */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5">
                    <span className="text-[9px] text-slate-400">Total Students</span>
                    <p className="text-base font-black text-white">480</p>
                    <span className="text-[8px] text-emerald-400">12 Classes Live</span>
                  </div>

                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-2.5">
                    <span className="text-[9px] text-emerald-400">Today Fee</span>
                    <p className="text-base font-black text-emerald-400">₹48,500</p>
                    <span className="text-[8px] text-emerald-500/80">32 Transactions</span>
                  </div>
                </div>

                <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-purple-300 font-bold">Attendance Today</span>
                    <p className="text-sm font-black text-white">462 / 480 (96.3%)</p>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                    1-Tap Done
                  </span>
                </div>

                {/* Quick Action Grid */}
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block pt-1">
                  1-Click Actions:
                </span>
                <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                  <div className="rounded-lg bg-slate-900 border border-slate-800 p-2 text-slate-300">
                    <Wallet size={14} className="mx-auto text-emerald-400" />
                    <span className="mt-1 block text-[9px]">Collect Fee</span>
                  </div>
                  <div className="rounded-lg bg-slate-900 border border-slate-800 p-2 text-slate-300">
                    <Users size={14} className="mx-auto text-cyan-400" />
                    <span className="mt-1 block text-[9px]">Attendance</span>
                  </div>
                  <div className="rounded-lg bg-slate-900 border border-slate-800 p-2 text-slate-300">
                    <GraduationCap size={14} className="mx-auto text-purple-400" />
                    <span className="mt-1 block text-[9px]">Marksheets</span>
                  </div>
                </div>
              </div>
            )}

            {/* STAGE 2: LIVE FEE ENTRY ON MOBILE */}
            {stage === 2 && (
              <div className="space-y-2.5 animate-fade-in my-auto">
                <div className="rounded-xl border border-emerald-500/40 bg-gradient-to-b from-slate-900 to-emerald-950/30 p-3 shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                      <CreditCard size={13} className="text-emerald-400" />
                      Instant Fee Collection
                    </span>
                    <span className="text-[9px] font-mono text-emerald-400 font-bold">#REC-9014</span>
                  </div>

                  <div className="mt-2.5 space-y-1.5 text-[11px]">
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Student:</span>
                      <strong className="text-white">Aarav Sharma</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Class &amp; Roll:</span>
                      <span className="text-slate-300 font-mono">Class 8-A &bull; Roll 14</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Fee Months:</span>
                      <span className="text-slate-300">Oct + Nov 2026</span>
                    </div>
                    <div className="flex justify-between py-1 text-emerald-400 font-bold">
                      <span>Total Paid:</span>
                      <span className="text-sm font-black">₹2,500</span>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg bg-emerald-500/20 border border-emerald-500/30 p-2 text-center text-[10px] text-emerald-300 font-bold flex items-center justify-center gap-1">
                    <CheckCircle2 size={12} />
                    <span>Official Receipt &amp; WhatsApp Sent</span>
                  </div>
                </div>
              </div>
            )}

            {/* STAGE 3: EXAM MARKSHEET & CALL TO ACTION */}
            {stage === 3 && (
              <div className="space-y-3 animate-fade-in my-auto text-center">
                <div className="rounded-xl border border-cyan-500/30 bg-slate-900/90 p-3 text-left">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="text-[10px] font-bold text-white">Student Report Card</span>
                    <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[8px] font-bold text-cyan-300">
                      Grade A+
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-slate-300">Aarav Sharma (8-A)</span>
                    <strong className="text-cyan-400">95.0% Passed</strong>
                  </div>
                  <p className="mt-1 text-[9px] text-slate-400">CBSE compliant &bull; 1-Click PDF export</p>
                </div>

                <div className="rounded-2xl border border-purple-500/40 bg-gradient-to-br from-purple-950/60 to-slate-900 p-3">
                  <h4 className="text-xs font-black text-white">
                    Digitize Your School Today
                  </h4>
                  <p className="mt-1 text-[10px] text-purple-200">
                    Get an instant Demo ID &amp; Password for your school right now.
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-3.5 py-1.5 text-[10px] font-bold text-white shadow-md">
                    <span>15-Day Free Trial Live</span>
                    <ChevronRight size={12} />
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Home Indicator Bar */}
            <div className="pt-2 text-center">
              <div className="mx-auto h-1 w-24 rounded-full bg-slate-600" />
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
                className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 transition-all duration-100"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0:00</span>
              <span>Reel (9:16) Format</span>
              <span>0:13</span>
            </div>
          </div>

          {/* Central Playback Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setElapsed(0);
                setStage(0);
                prevStageRef.current = 0;
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
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-cyan-600/30 hover:bg-cyan-500 transition"
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
              <span>{isPlaying ? "Pause Reel" : "Play Reel"}</span>
            </button>

            <button
              onClick={startRecordMode}
              className="rounded-xl border border-red-500/40 bg-red-950/30 p-2 text-red-400 hover:bg-red-900/40 transition"
              title="Clean Record Mode (Press R)"
            >
              <Video size={15} />
            </button>
          </div>

          {/* Stage Navigator */}
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3].map((s) => (
              <button
                key={s}
                onClick={() => goToStage(s)}
                className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
                  stage === s
                    ? "bg-cyan-500 text-slate-950 shadow-sm"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                {s === 0 ? "Login" : s === 1 ? "Dashboard" : s === 2 ? "Fee Entry" : "Report Card"}
              </button>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
}
