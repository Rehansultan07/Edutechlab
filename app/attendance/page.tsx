"use client";

import FeatureGate from "@/components/FeatureGate";
import { fetchInstitutionFeatures } from "@/lib/features";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  Wallet,
  X,
  Search,
  Users,
  RefreshCw,
  Check,
  Clock,
  Smartphone,
  CheckSquare,
  Square,
  ShieldCheck,
  MessageCircle,
  Send,
  Copy,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUserAccess } from "@/lib/auth/permissions";
import AccessDenied from "@/components/auth/AccessDenied";
import jsQR from "jsqr";
import {
  createWhatsAppUrl,
  formatAbsentAlertMessage,
  formatAttendanceSuccessMessage,
} from "@/lib/whatsapp";

// Web Audio API Sound Synthesizer for self-contained UI effects
function playSound(type: "ding" | "beep" | "warning") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === "ding") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === "warning") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.setValueAtTime(200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else {
      osc.type = "sine";
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    }
  } catch {}
}

type Student = {
  id: string;
  first_name: string;
  last_name: string | null;
  admission_no: string;
  class_id?: string | null;
  photo_url?: string | null;
  phone?: string | null;
  guardian_phone?: string | null;
  father_name?: string | null;
};

type A = { student_id: string; status: string };
type ClassItem = { id: string; name: string };

type QrScanResult = {
  success: boolean;
  error?: string;
  student?: {
    id: string;
    admission_no: string;
    first_name: string;
    last_name: string | null;
    full_name: string;
    class_name: string;
    section_name: string;
    photo_url: string | null;
    phone: string | null;
    father_name: string | null;
  };
  attendance?: {
    status: string;
    date: string;
    time: string;
    already_marked: boolean;
  };
  fee?: {
    has_dues: boolean;
    due_amount: number;
    due_months_count: number;
    status_text: string;
  };
};

type ScanLogItem = {
  id: string;
  studentName: string;
  admissionNo: string;
  className: string;
  time: string;
  hasDues: boolean;
  dueAmount: number;
  alreadyMarked: boolean;
};

export default function AttendancePage() {
  const s = createClient();
  const { loading: authLoading, orgId: org, hasAccess, can, isAdmin } = useUserAccess([
    "attendance.view",
    "attendance.manage",
  ]);

  const [featureActive, setFeatureActive] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [orgName, setOrgName] = useState("Your Institution");
  const [orgPhone, setOrgPhone] = useState("");
  const [state, setState] = useState<Record<string, string>>({});
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // WhatsApp Absent Notification Modal
  const [showAbsentModal, setShowAbsentModal] = useState(false);
  const [notifiedStudents, setNotifiedStudents] = useState<Set<string>>(new Set());
  const [copiedBroadcast, setCopiedBroadcast] = useState(false);

  // QR GATE SCANNER KIOSK STATE
  const [showScanner, setShowScanner] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user");
  const [cameraError, setCameraError] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeScan, setActiveScan] = useState<QrScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanLogItem[]>([]);
  const [manualCode, setManualCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const lastScannedCodeRef = useRef<string>("");
  const lastScannedTimeRef = useRef<number>(0);
  const autoDismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  const canManage = can("attendance.manage");

  const load = async () => {
    if (!org) return;
    const feat = await fetchInstitutionFeatures(s, org);
    if (feat && feat.attendance === false) {
      setFeatureActive(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setSaved("");

    let studentQuery = s
      .from("students")
      .select("id,first_name,last_name,admission_no,class_id,photo_url,phone,guardian_phone,father_name")
      .eq("organization_id", org)
      .eq("status", "active")
      .order("first_name");

    if (selectedClass) {
      studentQuery = studentQuery.eq("class_id", selectedClass);
    }

    const [stRes, attRes, clRes, orgRes, setRes] = await Promise.all([
      studentQuery,
      s.from("attendance").select("student_id,status").eq("organization_id", org).eq("attendance_date", date),
      s.from("classes").select("id,name").eq("organization_id", org).order("sort_order"),
      s.from("organizations").select("name").eq("id", org).single(),
      s.from("organization_settings").select("phone").eq("organization_id", org).maybeSingle(),
    ]);

    if (stRes.error) setError(stRes.error.message);
    setStudents(stRes.data || []);
    setClasses(clRes.data || []);
    if (orgRes.data?.name) setOrgName(orgRes.data.name);
    if (setRes.data?.phone) setOrgPhone(setRes.data.phone);

    const loadedState: Record<string, string> = {};
    (attRes.data || []).forEach((x: A) => {
      loadedState[x.student_id] = x.status;
    });
    setState(loadedState);
    setLoading(false);
  };

  useEffect(() => {
    if (org && hasAccess) {
      load();
    }
  }, [org, date, selectedClass, hasAccess]);

  // ==============================================================
  // QR CODE SCAN PROCESSOR
  // ==============================================================
  const processQrCode = useCallback(
    async (rawCode: string) => {
      if (!org || isProcessing) return;

      const trimmed = rawCode.trim();
      if (!trimmed) return;

      // Throttle repeat scan of the exact same code within 4 seconds
      const now = Date.now();
      if (
        lastScannedCodeRef.current === trimmed &&
        now - lastScannedTimeRef.current < 4000
      ) {
        return;
      }
      lastScannedCodeRef.current = trimmed;
      lastScannedTimeRef.current = now;

      setIsProcessing(true);
      setCameraError("");

      try {
        const { data: res, error: rpcErr } = await s.rpc("mark_qr_attendance", {
          p_admission_no: trimmed,
          p_organization_id: org,
          p_date: date,
        });

        if (rpcErr) throw rpcErr;

        if (!res || !res.success) {
          if (soundEnabled) playSound("warning");
          setCameraError(res?.error || `Admission No. "${trimmed}" not recognized in this institution.`);
          setIsProcessing(false);
          return;
        }

        // Success!
        if (soundEnabled) playSound("ding");
        setActiveScan(res as QrScanResult);

        // Update local attendance table state
        if (res.student?.id) {
          setState((prev) => ({ ...prev, [res.student.id]: "present" }));
        }

        // Add to recent scan history
        const logItem: ScanLogItem = {
          id: Math.random().toString(),
          studentName: res.student?.full_name || "Student",
          admissionNo: res.student?.admission_no || trimmed,
          className: `${res.student?.class_name || ""} ${res.student?.section_name || ""}`.trim(),
          time: res.attendance?.time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          hasDues: !!res.fee?.has_dues,
          dueAmount: Number(res.fee?.due_amount || 0),
          alreadyMarked: !!res.attendance?.already_marked,
        };
        setScanHistory((prev) => [logItem, ...prev.slice(0, 19)]);

        // Auto-dismiss the active student pop-up after 2.5 seconds to ready camera for next student
        if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = setTimeout(() => {
          setActiveScan(null);
          setIsProcessing(false);
        }, 2500);
      } catch (err: any) {
        if (soundEnabled) playSound("warning");
        setCameraError(err.message || "Failed to record QR attendance.");
        setIsProcessing(false);
      }
    },
    [org, date, soundEnabled, isProcessing, s]
  );

  // ==============================================================
  // CAMERA STREAM & SCANNING LOOP
  // ==============================================================
  useEffect(() => {
    if (!showScanner) {
      if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      return;
    }

    let stream: MediaStream | null = null;
    let isActive = true;

    const startCamera = async () => {
      setCameraError("");
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: cameraFacing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!isActive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          await videoRef.current.play();
          requestAnimationFrame(scanFrame);
        }
      } catch (err: any) {
        setCameraError(
          "Camera permission denied or camera not found. Please allow camera access in browser settings, or use manual entry below."
        );
      }
    };

    const scanFrame = () => {
      if (!isActive || !videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data) {
          processQrCode(code.data);
        }
      }

      scanLoopRef.current = requestAnimationFrame(scanFrame);
    };

    startCamera();

    return () => {
      isActive = false;
      if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [showScanner, cameraFacing, processQrCode]);

  const save = async () => {
    if (!canManage) {
      setError("You do not have permission to mark or update attendance.");
      return;
    }
    setSaving(true);
    setError("");
    setSaved("");

    const batch = students
      .filter((st) => state[st.id])
      .map((st) => ({
        organization_id: org,
        student_id: st.id,
        attendance_date: date,
        status: state[st.id],
      }));

    if (!batch.length) {
      setError("No attendance marks selected.");
      setSaving(false);
      return;
    }

    const r = await s.from("attendance").upsert(batch, { onConflict: "student_id,attendance_date" });
    if (r.error) {
      setError(r.error.message);
    } else {
      setSaved("Attendance saved successfully.");
      await load();
    }
    setSaving(false);
  };

  const del = async () => {
    if (!canManage) {
      setError("You do not have permission to delete attendance.");
      return;
    }
    if (!confirm(`Are you sure you want to delete all marked attendance records for ${date}?`)) return;
    const r = await s.from("attendance").delete().eq("organization_id", org).eq("attendance_date", date);
    if (r.error) setError(r.error.message);
    else {
      setSaved(`Attendance for ${date} has been cleared.`);
      await load();
    }
  };

  const markAll = (status: string) => {
    if (!canManage) return;
    const next = { ...state };
    students.forEach((st) => {
      next[st.id] = status;
    });
    setState(next);
  };

  if (authLoading) {
    return (
      <main className="mx-auto max-w-7xl p-8 text-center text-sm text-slate-500">
        Verifying permissions...
      </main>
    );
  }

  if (!hasAccess) {
    return <AccessDenied moduleName="Attendance" />;
  }

  if (!featureActive) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <FeatureGate featureKey="attendance" />
      </div>
    );
  }

  const presentCount = Object.values(state).filter((v) => v === "present").length;
  const absentCount = Object.values(state).filter((v) => v === "absent").length;

  const classMap = useMemo(() => {
    const m = new Map<string, string>();
    classes.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [classes]);

  const absentStudents = useMemo(() => {
    return students.filter((st) => state[st.id] === "absent");
  }, [students, state]);

  const originUrl =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://edutechlab-9fz4.vercel.app";

  const markAsNotified = (id: string) => {
    setNotifiedStudents((prev) => new Set(prev).add(id));
  };

  const copyAllAbsentBroadcast = () => {
    if (absentStudents.length === 0) return;
    const lines = absentStudents.map((st, i) => {
      const parentPhone = st.guardian_phone || st.phone || "No Phone";
      const cName = st.class_id ? classMap.get(st.class_id) || "Class" : "Class";
      return `${i + 1}. ${st.first_name} ${st.last_name || ""} (${cName}, Roll/Adm: ${st.admission_no}) - Parent: ${parentPhone}`;
    });
    navigator.clipboard.writeText(
      `ABSENT STUDENTS LIST - ${date}\n${orgName}\n\n${lines.join("\n")}`
    );
    setCopiedBroadcast(true);
    setTimeout(() => setCopiedBroadcast(false), 2500);
  };

  return (
    <main className="mx-auto max-w-7xl p-5 sm:p-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <button
            onClick={() => window.history.back()}
            className="mb-2 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            <ArrowLeft size={14} />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Student Attendance
            </h1>
            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700">
              Live Tracker
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
            Mark attendance via QR Smart Card Scanner or manual register.
          </p>
        </div>

        {/* Big Action: Open QR Kiosk Scanner */}
        {canManage && (
          <button
            onClick={() => setShowScanner(true)}
            className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-purple-600/25 hover:from-purple-500 hover:to-cyan-500 transition active:scale-95 group"
          >
            <QrCode size={18} className="text-yellow-300 group-hover:rotate-12 transition" />
            <span>Open Gate QR Scanner Kiosk</span>
          </button>
        )}
      </div>

      {error && <div className="mb-4 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 font-medium">{error}</div>}
      {saved && <div className="mb-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 font-medium">{saved}</div>}

      {/* Attendance Stats Cards */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-400">Total Students</span>
          <p className="mt-1 text-2xl font-black text-slate-900">{students.length}</p>
          <span className="text-[10px] text-slate-500">In Selected Class</span>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
            <CheckCircle2 size={13} /> Present Today
          </span>
          <p className="mt-1 text-2xl font-black text-emerald-700">{presentCount}</p>
          <span className="text-[10px] text-emerald-600">
            {students.length ? Math.round((presentCount / students.length) * 100) : 0}% Attendance Rate
          </span>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-red-700">Absent Today</span>
              {absentCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAbsentModal(true)}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm hover:bg-emerald-700 transition"
                  title="Notify Absent Students Parents on WhatsApp"
                >
                  <MessageCircle size={11} />
                  <span>Notify Parents</span>
                </button>
              )}
            </div>
            <p className="mt-1 text-2xl font-black text-red-700">{absentCount}</p>
          </div>
          <span className="text-[10px] text-red-600">
            {absentCount > 0 ? "1-Click WhatsApp Assistant" : "All Students Present"}
          </span>
        </div>

        <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 shadow-sm">
          <span className="text-xs font-semibold text-purple-700">Date</span>
          <p className="mt-1 text-lg font-black text-purple-900 font-mono">{date}</p>
          <span className="text-[10px] text-purple-600">Active Register Session</span>
        </div>
      </div>

      {/* Main Attendance Table Card */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Filters & Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Attendance Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-semibold outline-none focus:border-purple-600"
              />
            </div>

            {classes.length > 0 && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Filter by Class
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-semibold outline-none focus:border-purple-600"
                >
                  <option value="">All Classes ({students.length})</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManage && students.length > 0 && (
              <>
                <button
                  onClick={() => markAll("present")}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
                >
                  Mark All Present
                </button>
                <button
                  onClick={del}
                  className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                >
                  Clear All Marks
                </button>
              </>
            )}
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="p-16 text-center text-sm text-slate-400">Loading student attendance list...</div>
        ) : students.length ? (
          <div className="divide-y divide-slate-100">
            {students.map((st) => (
              <div
                key={st.id}
                className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50/70 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-purple-100 text-purple-700 font-bold text-xs shrink-0 overflow-hidden">
                    {st.photo_url ? (
                      <img src={st.photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      st.first_name[0]?.toUpperCase()
                    )}
                  </div>
                  <div>
                    <span className="font-bold text-sm text-slate-900 block leading-tight">
                      {st.first_name} {st.last_name || ""}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] font-mono text-slate-400">
                        Adm: <strong className="text-slate-600">{st.admission_no}</strong>
                      </span>
                      {(st.guardian_phone || st.phone) && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                          &bull; 📞 {st.guardian_phone || st.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Toggle Buttons & WhatsApp Action */}
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    {["present", "absent", "late", "leave"].map((x) => (
                      <button
                        key={x}
                        disabled={!canManage}
                        onClick={() => setState({ ...state, [st.id]: x })}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-bold capitalize transition ${
                          state[st.id] === x
                            ? x === "present"
                              ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                              : x === "absent"
                              ? "border-red-600 bg-red-600 text-white shadow-sm"
                              : x === "late"
                              ? "border-amber-600 bg-amber-600 text-white shadow-sm"
                              : "border-slate-800 bg-slate-800 text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                        } ${!canManage ? "cursor-default opacity-80" : ""}`}
                      >
                        {x}
                      </button>
                    ))}
                  </div>

                  {state[st.id] === "absent" && (
                    <a
                      href={createWhatsAppUrl(
                        st.guardian_phone || st.phone,
                        formatAbsentAlertMessage({
                          studentName: `${st.first_name} ${st.last_name || ""}`.trim(),
                          admissionNo: st.admission_no,
                          className: st.class_id ? classMap.get(st.class_id) || "Class" : "Class",
                          schoolName: orgName,
                          date: date,
                          originUrl,
                          studentId: st.id,
                        })
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => markAsNotified(st.id)}
                      className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition shadow-sm ${
                        notifiedStudents.has(st.id)
                          ? "bg-slate-100 text-slate-500 border border-slate-200"
                          : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 shadow-emerald-600/20"
                      }`}
                      title={
                        st.guardian_phone || st.phone
                          ? `Send absent WhatsApp message to parent (${st.guardian_phone || st.phone})`
                          : "No parent phone number registered"
                      }
                    >
                      <MessageCircle size={13} />
                      <span className="hidden sm:inline">
                        {notifiedStudents.has(st.id) ? "Sent ✓" : "WhatsApp"}
                      </span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-16 text-center text-sm text-slate-500">
            {selectedClass ? "No active students in this class." : "No active students found."}
          </div>
        )}

        {canManage && students.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 p-4">
            <span className="text-xs text-slate-500">
              {presentCount} marked present &bull; {absentCount} marked absent
            </span>
            <button
              disabled={saving}
              onClick={save}
              className="rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition disabled:opacity-50"
            >
              {saving ? "Saving Changes..." : "Save Daily Attendance"}
            </button>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL / KIOSK VIEW: QR CODE GATE ATTENDANCE SCANNER            */}
      {/* ============================================================== */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white p-3 sm:p-6 overflow-y-auto">
          {/* Kiosk Top Bar */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                <QrCode size={20} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Gate QR Scanner Kiosk
                  </h3>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Live Scanning
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Students flash their ID card QR code in front of the camera to mark attendance.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSoundEnabled((s) => !s)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition ${
                  soundEnabled
                    ? "border-purple-500/40 bg-purple-950/40 text-purple-300"
                    : "border-slate-800 bg-slate-900 text-slate-500"
                }`}
                title="Audio Chime"
              >
                {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                <span className="hidden sm:inline">{soundEnabled ? "Sound On" : "Muted"}</span>
              </button>

              <button
                onClick={() =>
                  setCameraFacing((f) => (f === "user" ? "environment" : "user"))
                }
                className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                Switch Camera ({cameraFacing === "user" ? "Front" : "Back"})
              </button>

              <button
                onClick={() => {
                  setShowScanner(false);
                  setActiveScan(null);
                  load(); // Reload table with newly marked attendance
                }}
                className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 transition"
                title="Close Kiosk"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Camera Error Alert */}
          {cameraError && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-500/40 bg-red-950/40 p-4 text-xs sm:text-sm text-red-300 font-medium">
              <AlertTriangle size={18} className="shrink-0 text-red-400" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Kiosk Main Split: Camera Target (Left/Center) + Recent Live Scans (Right) */}
          <div className="grid lg:grid-cols-3 gap-6 flex-1">
            {/* Camera Viewport (Col span 2) */}
            <div className="lg:col-span-2 flex flex-col justify-between rounded-3xl border border-slate-800 bg-black/60 p-4 relative overflow-hidden">
              {/* The Video Element */}
              <div className="relative flex-1 flex items-center justify-center min-h-[360px] sm:min-h-[440px] rounded-2xl overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Cyber Targeting Scan Frame */}
                <div className="relative z-10 w-64 h-64 sm:w-80 sm:h-80 border-2 border-purple-500/60 rounded-3xl shadow-2xl flex flex-col justify-between p-4 pointer-events-none">
                  {/* Glowing Laser Scan Bar */}
                  <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_rgba(34,211,238,0.9)] animate-bounce" />

                  {/* Corner Target Markers */}
                  <div className="flex justify-between">
                    <span className="h-6 w-6 border-t-4 border-l-4 border-purple-400 rounded-tl-lg" />
                    <span className="h-6 w-6 border-t-4 border-r-4 border-purple-400 rounded-tr-lg" />
                  </div>
                  <div className="flex justify-between">
                    <span className="h-6 w-6 border-b-4 border-l-4 border-purple-400 rounded-bl-lg" />
                    <span className="h-6 w-6 border-b-4 border-r-4 border-purple-400 rounded-br-lg" />
                  </div>
                </div>

                {/* Subtitle / Scan Hint */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 rounded-full bg-slate-900/80 border border-slate-700 px-4 py-1 text-xs text-slate-300 font-medium backdrop-blur-md">
                  Align Student ID Card QR Code inside the square
                </div>

                {/* ==================================================== */}
                {/* POP-UP OVERLAY: ACTIVE STUDENT SCAN CONFIRMATION    */}
                {/* ==================================================== */}
                {activeScan && activeScan.success && activeScan.student && (
                  <div className="absolute inset-4 z-30 flex items-center justify-center bg-slate-950/95 backdrop-blur-md rounded-2xl p-6 animate-fade-in">
                    <div className="w-full max-w-md text-center space-y-4">
                      {/* Big Animated Green Tick */}
                      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/20 animate-pulse">
                        <CheckCircle2 size={36} />
                      </div>

                      <div>
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                          {activeScan.attendance?.already_marked
                            ? "ALREADY MARKED PRESENT TODAY"
                            : "ATTENDANCE RECORDED: PRESENT"}
                        </div>
                        <h2 className="mt-2 text-2xl font-black text-white">
                          {activeScan.student.full_name}
                        </h2>
                        <p className="text-xs font-mono text-purple-300">
                          Class: {activeScan.student.class_name} {activeScan.student.section_name ? `(${activeScan.student.section_name})` : ""} &bull; Adm No: {activeScan.student.admission_no}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Recorded at {activeScan.attendance?.time} on {date}
                        </p>
                      </div>

                      {/* LIVE FEE STATUS BANNER */}
                      <div
                        className={`rounded-2xl border p-3.5 text-left text-xs ${
                          activeScan.fee?.has_dues
                            ? "border-amber-500/40 bg-amber-950/40 text-amber-200"
                            : "border-emerald-500/40 bg-emerald-950/40 text-emerald-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold flex items-center gap-1.5">
                            <Wallet size={15} />
                            {activeScan.fee?.has_dues ? "Fee Dues Notice" : "Fee Status"}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              activeScan.fee?.has_dues
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-emerald-500/20 text-emerald-300"
                            }`}
                          >
                            {activeScan.fee?.has_dues ? "Pending" : "Cleared ✓"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-semibold">
                          {activeScan.fee?.status_text}
                          {activeScan.fee?.has_dues && activeScan.fee?.due_months_count
                            ? ` (${activeScan.fee.due_months_count} Months Pending)`
                            : ""}
                        </p>
                      </div>

                      {/* Optional WhatsApp Arrival Alert to Parent */}
                      {activeScan.student?.phone && (
                        <a
                          href={createWhatsAppUrl(
                            activeScan.student.phone,
                            formatAttendanceSuccessMessage({
                              studentName: activeScan.student.full_name,
                              admissionNo: activeScan.student.admission_no,
                              className: activeScan.student.class_name,
                              schoolName: orgName,
                              time: activeScan.attendance?.time || new Date().toLocaleTimeString(),
                              date: date,
                              feeNotice: activeScan.fee?.has_dues ? activeScan.fee.status_text : undefined,
                            })
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 w-full rounded-xl bg-emerald-600/90 hover:bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-md transition"
                        >
                          <MessageCircle size={14} />
                          <span>Send Arrival WhatsApp to Parent ({activeScan.student.phone})</span>
                        </a>
                      )}

                      {/* Auto-Next Progress indicator */}
                      <div className="pt-2 text-[10px] text-slate-500">
                        Camera re-arming in 2 seconds for next student...
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Barcode Gun / Manual Admission Input */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Or enter Admission No. (for handheld barcode gun / manual test)..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && manualCode.trim()) {
                      processQrCode(manualCode);
                      setManualCode("");
                    }
                  }}
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (manualCode.trim()) {
                      processQrCode(manualCode);
                      setManualCode("");
                    }
                  }}
                  className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500 transition"
                >
                  Scan Now
                </button>
              </div>
            </div>

            {/* Live Scan Stream & History Sidebar (Col span 1) */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Clock size={14} className="text-cyan-400" />
                    <span>Recent Gate Scans</span>
                  </h4>
                  <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-300">
                    {scanHistory.length} Scanned
                  </span>
                </div>

                {/* Scan List */}
                <div className="mt-3 space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {scanHistory.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      No QR codes scanned yet in this kiosk session.
                    </div>
                  ) : (
                    scanHistory.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-800 bg-slate-950/80 p-2.5 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-white block leading-tight">
                            {item.studentName}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {item.className} &bull; Adm: {item.admissionNo}
                          </span>
                          {item.hasDues && (
                            <span className="mt-0.5 block text-[10px] font-bold text-amber-400">
                              ⚠️ Due: ₹{item.dueAmount}
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                            PRESENT
                          </span>
                          <span className="block text-[10px] text-slate-500 mt-1 font-mono">
                            {item.time}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Bottom Instructions */}
              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500">
                💡 <strong>Kiosk Setup:</strong> Place this tablet or phone on a stand at the school entrance. As students enter, they show their ID card QR code. Attendance and fee status update in real-time.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: WHATSAPP ABSENT NOTIFIER ASSISTANT                       */}
      {/* ============================================================== */}
      {showAbsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-emerald-50/50 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
                  <MessageCircle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    WhatsApp Absent Assistant
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                      {absentStudents.length} Absent
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Notify parents on WhatsApp directly in 1 click &bull; Zero API Fees
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAbsentModal(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Actions & Progress Bar */}
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="text-slate-600 font-medium">
                Notified: <strong className="text-emerald-700">{notifiedStudents.size}</strong> of {absentStudents.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyAllAbsentBroadcast}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-100 transition shadow-sm"
                >
                  {copiedBroadcast ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copiedBroadcast ? "List Copied!" : "Copy Broadcast List"}</span>
                </button>
              </div>
            </div>

            {/* Student List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
              {absentStudents.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  No students are marked absent for {date}.
                </div>
              ) : (
                absentStudents.map((st) => {
                  const targetPhone = st.guardian_phone || st.phone;
                  const cName = st.class_id ? classMap.get(st.class_id) || "Class" : "Class";
                  const isSent = notifiedStudents.has(st.id);
                  const msg = formatAbsentAlertMessage({
                    studentName: `${st.first_name} ${st.last_name || ""}`.trim(),
                    admissionNo: st.admission_no,
                    className: cName,
                    schoolName: orgName,
                    date: date,
                    originUrl,
                    studentId: st.id,
                  });
                  const waUrl = createWhatsAppUrl(targetPhone, msg);

                  return (
                    <div
                      key={st.id}
                      className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition ${
                        isSent
                          ? "bg-emerald-50/40 border-emerald-200"
                          : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-100 text-purple-700 font-bold text-xs shrink-0 overflow-hidden">
                          {st.photo_url ? (
                            <img src={st.photo_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            st.first_name[0]?.toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-slate-900 truncate">
                            {st.first_name} {st.last_name || ""}
                          </h4>
                          <p className="text-xs text-slate-500 font-medium">
                            {cName} &bull; Adm No: {st.admission_no}
                          </p>
                          <p className="text-[11px] font-mono mt-0.5">
                            {targetPhone ? (
                              <span className="text-slate-600 font-semibold">📞 {targetPhone}</span>
                            ) : (
                              <span className="text-red-500 font-semibold">⚠️ No parent phone</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div>
                        {targetPhone ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => markAsNotified(st.id)}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition shadow-sm ${
                              isSent
                                ? "bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200"
                                : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 shadow-emerald-600/25"
                            }`}
                          >
                            <MessageCircle size={14} />
                            <span>{isSent ? "Sent ✓ (Resend)" : "Send WhatsApp"}</span>
                          </a>
                        ) : (
                          <button
                            disabled
                            className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400 cursor-not-allowed"
                          >
                            Missing Phone
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 bg-slate-50/80 px-6 py-3.5 flex items-center justify-between text-xs text-slate-500">
              <span className="hidden sm:inline">
                💡 Automatically opens WhatsApp with child&apos;s absence notice pre-typed.
              </span>
              <button
                type="button"
                onClick={() => setShowAbsentModal(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-bold text-slate-700 hover:bg-slate-100 transition shadow-sm ml-auto"
              >
                Close Assistant
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
