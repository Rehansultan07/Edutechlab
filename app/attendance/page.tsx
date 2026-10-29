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
  Calendar,
  CheckCheck,
  Loader2,
  AlertCircle,
  UserCheck,
  UserX,
  ChevronDown,
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

// Helper to get local date as YYYY-MM-DD (immune to UTC midnight shifts)
function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
  roll_no?: string | null;
};

type A = { student_id: string; status: string; note?: string | null };
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

type ToastState = {
  type: "success" | "error" | "info";
  message: string;
};

export default function AttendancePage() {
  const s = createClient();
  const { loading: authLoading, orgId: org, hasAccess, can } = useUserAccess([
    "attendance.view",
    "attendance.manage",
  ]);

  const [featureActive, setFeatureActive] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [orgName, setOrgName] = useState("Your Institution");
  const [orgPhone, setOrgPhone] = useState("");

  // Attendance states
  const [state, setState] = useState<Record<string, string>>({});
  const [date, setDate] = useState(() => getLocalDateString());
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingBatch, setSavingBatch] = useState(false);

  // Auto-Save Status Tracking
  const [savingStudents, setSavingStudents] = useState<Set<string>>(new Set());
  const [savedStudents, setSavedStudents] = useState<Set<string>>(new Set());
  const [globalAutoSaveStatus, setGlobalAutoSaveStatus] = useState<"synced" | "saving" | "unsaved">("synced");
  const [toast, setToast] = useState<ToastState | null>(null);

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
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const canManage = can("attendance.manage");

  // Show dynamic toast helper
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  // Load attendance data
  const load = useCallback(async () => {
    if (!org) return;
    const feat = await fetchInstitutionFeatures(s, org);
    if (feat && feat.attendance === false) {
      setFeatureActive(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");

    try {
      let studentQuery = s
        .from("students")
        .select("id,first_name,last_name,admission_no,class_id,photo_url,phone,guardian_phone,father_name,roll_no")
        .eq("organization_id", org)
        .eq("status", "active")
        .order("first_name");

      if (selectedClass) {
        studentQuery = studentQuery.eq("class_id", selectedClass);
      }

      const [stRes, attRes, clRes, orgRes, setRes] = await Promise.all([
        studentQuery,
        s
          .from("attendance")
          .select("student_id,status,note")
          .eq("organization_id", org)
          .eq("attendance_date", date),
        s
          .from("classes")
          .select("id,name")
          .eq("organization_id", org)
          .order("sort_order"),
        s.from("organizations").select("name").eq("id", org).single(),
        s.from("organization_settings").select("phone").eq("organization_id", org).maybeSingle(),
      ]);

      if (stRes.error) {
        setError(stRes.error.message);
      }
      if (attRes.error) {
        console.warn("Attendance load error:", attRes.error.message);
      }

      setStudents(stRes.data || []);
      setClasses(clRes.data || []);
      if (orgRes.data?.name) setOrgName(orgRes.data.name);
      if (setRes.data?.phone) setOrgPhone(setRes.data.phone);

      const loadedState: Record<string, string> = {};
      (attRes.data || []).forEach((x: A) => {
        loadedState[x.student_id] = x.status;
      });
      setState(loadedState);
      setGlobalAutoSaveStatus("synced");
    } catch (err: any) {
      setError(err?.message || "Failed to load attendance records.");
    } finally {
      setLoading(false);
    }
  }, [s, org, date, selectedClass]);

  useEffect(() => {
    if (org && hasAccess) {
      load();
    }
  }, [org, date, selectedClass, hasAccess, load]);

  // ==============================================================
  // REAL-TIME AUTO-SAVE FOR SINGLE STUDENT RECORD
  // ==============================================================
  const markSingleAttendance = async (studentId: string, newStatus: string) => {
    if (!canManage) {
      showToast("You do not have permission to mark attendance.", "error");
      return;
    }

    // Toggle off if already active
    const finalStatus = state[studentId] === newStatus ? "" : newStatus;

    // 1. Optimistic Local State Update
    const previousStatus = state[studentId];
    setState((prev) => {
      const updated = { ...prev };
      if (!finalStatus) {
        delete updated[studentId];
      } else {
        updated[studentId] = finalStatus;
      }
      return updated;
    });

    setSavingStudents((prev) => new Set(prev).add(studentId));
    setGlobalAutoSaveStatus("saving");

    try {
      if (!finalStatus) {
        // Deleted / Untoggled mark
        const { error: delErr } = await s
          .from("attendance")
          .delete()
          .eq("organization_id", org)
          .eq("student_id", studentId)
          .eq("attendance_date", date);

        if (delErr) throw delErr;
      } else {
        // Try RPC first for security definer guarantee
        let success = false;
        try {
          const { data: rpcData, error: rpcErr } = await s.rpc("mark_student_attendance", {
            p_student_id: studentId,
            p_org_id: org,
            p_date: date,
            p_status: finalStatus,
          });

          if (!rpcErr && rpcData?.success) {
            success = true;
          }
        } catch {
          // Fall back to direct upsert
        }

        if (!success) {
          // Direct upsert fallback
          const { error: upsertErr } = await s.from("attendance").upsert(
            {
              organization_id: org,
              student_id: studentId,
              attendance_date: date,
              status: finalStatus,
              note: `Marked at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
            },
            { onConflict: "student_id,attendance_date" }
          );

          if (upsertErr) throw upsertErr;
        }
      }

      // Mark as saved
      setSavedStudents((prev) => new Set(prev).add(studentId));
      setTimeout(() => {
        setSavedStudents((prev) => {
          const next = new Set(prev);
          next.delete(studentId);
          return next;
        });
      }, 2000);

      setGlobalAutoSaveStatus("synced");
    } catch (err: any) {
      // Revert optimistic update on failure
      setState((prev) => ({
        ...prev,
        [studentId]: previousStatus,
      }));
      showToast(`Could not save attendance: ${err?.message || "Network issue"}`, "error");
      setGlobalAutoSaveStatus("unsaved");
    } finally {
      setSavingStudents((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
    }
  };

  // ==============================================================
  // BATCH SAVE & "MARK ALL PRESENT"
  // ==============================================================
  const markAll = async (status: string) => {
    if (!canManage) {
      showToast("You do not have permission to mark attendance.", "error");
      return;
    }

    if (students.length === 0) return;

    setSavingBatch(true);
    setGlobalAutoSaveStatus("saving");

    // 1. Optimistic Update
    const nextState = { ...state };
    students.forEach((st) => {
      nextState[st.id] = status;
    });
    setState(nextState);

    const batchRecords = students.map((st) => ({
      student_id: st.id,
      status: status,
      note: `Bulk marked as ${status}`,
    }));

    try {
      let rpcSuccess = false;
      try {
        const { data: rpcRes, error: rpcErr } = await s.rpc("save_batch_attendance", {
          p_records: batchRecords,
          p_org_id: org,
          p_date: date,
        });

        if (!rpcErr && rpcRes?.success) {
          rpcSuccess = true;
        }
      } catch {
        // Fall back to direct upsert
      }

      if (!rpcSuccess) {
        const upsertBatch = students.map((st) => ({
          organization_id: org,
          student_id: st.id,
          attendance_date: date,
          status: status,
          note: `Bulk marked as ${status}`,
        }));

        const { error: batchErr } = await s
          .from("attendance")
          .upsert(upsertBatch, { onConflict: "student_id,attendance_date" });

        if (batchErr) throw batchErr;
      }

      setGlobalAutoSaveStatus("synced");
      showToast(`✓ Marked all ${students.length} students as ${status.toUpperCase()} and saved!`, "success");
    } catch (err: any) {
      showToast(`Failed to batch save: ${err?.message || "Unknown error"}`, "error");
      setGlobalAutoSaveStatus("unsaved");
    } finally {
      setSavingBatch(false);
    }
  };

  // Manual "Save All" Trigger
  const saveAllManual = async () => {
    if (!canManage) {
      showToast("You do not have permission to mark attendance.", "error");
      return;
    }

    const markedStudents = students.filter((st) => state[st.id]);
    if (markedStudents.length === 0) {
      showToast("No attendance marks selected to save.", "info");
      return;
    }

    setSavingBatch(true);
    setGlobalAutoSaveStatus("saving");

    const batch = markedStudents.map((st) => ({
      organization_id: org,
      student_id: st.id,
      attendance_date: date,
      status: state[st.id],
      note: "Manual register save",
    }));

    try {
      const { error: upsertErr } = await s
        .from("attendance")
        .upsert(batch, { onConflict: "student_id,attendance_date" });

      if (upsertErr) throw upsertErr;

      setGlobalAutoSaveStatus("synced");
      showToast(`✓ Saved attendance for ${batch.length} students!`, "success");
    } catch (err: any) {
      showToast(`Save error: ${err?.message || "Please check network"}`, "error");
      setGlobalAutoSaveStatus("unsaved");
    } finally {
      setSavingBatch(false);
    }
  };

  // Clear All Marks for this date
  const clearAllMarks = async () => {
    if (!canManage) {
      showToast("You do not have permission to clear attendance.", "error");
      return;
    }

    if (!confirm(`Are you sure you want to clear all marked attendance records for ${date}?`)) return;

    setSavingBatch(true);
    try {
      let query = s.from("attendance").delete().eq("organization_id", org).eq("attendance_date", date);

      if (selectedClass) {
        // If filtered by class, delete only for students in this class
        const studentIds = students.map((s) => s.id);
        if (studentIds.length > 0) {
          query = query.in("student_id", studentIds);
        }
      }

      const { error: delErr } = await query;
      if (delErr) throw delErr;

      // Update local state
      setState((prev) => {
        const next = { ...prev };
        students.forEach((st) => {
          delete next[st.id];
        });
        return next;
      });

      setGlobalAutoSaveStatus("synced");
      showToast(`Attendance for ${date} has been cleared.`, "info");
    } catch (err: any) {
      showToast(`Failed to clear: ${err?.message}`, "error");
    } finally {
      setSavingBatch(false);
    }
  };

  // ==============================================================
  // QR CODE SCAN PROCESSOR (KIOSK & HANDHELD GUN)
  // ==============================================================
  const processQrCode = useCallback(
    async (rawCode: string) => {
      if (!org || isProcessing) return;

      let trimmed = rawCode.trim();
      if (!trimmed) return;

      // Extract admission number if URL was scanned
      try {
        if (trimmed.includes("id=")) {
          const match = trimmed.match(/[?&]id=([^&#]+)/i);
          if (match && match[1]) {
            trimmed = decodeURIComponent(match[1]).trim();
          }
        } else if (trimmed.startsWith("EDUID:")) {
          trimmed = trimmed.replace(/^EDUID:/i, "").trim();
        }
      } catch {}

      // Throttle repeat scan of the exact same code within 3.5 seconds
      const now = Date.now();
      if (
        lastScannedCodeRef.current === trimmed &&
        now - lastScannedTimeRef.current < 3500
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

        // Synchronize local attendance table state in real time!
        if (res.student?.id) {
          setState((prev) => ({ ...prev, [res.student.id]: "present" }));
          setSavedStudents((prev) => new Set(prev).add(res.student.id));
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

  // Derived filtered students
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter(
      (st) =>
        st.first_name.toLowerCase().includes(q) ||
        (st.last_name && st.last_name.toLowerCase().includes(q)) ||
        st.admission_no.toLowerCase().includes(q) ||
        (st.roll_no && st.roll_no.toLowerCase().includes(q)) ||
        (st.father_name && st.father_name.toLowerCase().includes(q))
    );
  }, [students, searchQuery]);

  // Derived statistics
  const presentCount = Object.values(state).filter((v) => v === "present").length;
  const absentCount = Object.values(state).filter((v) => v === "absent").length;
  const lateCount = Object.values(state).filter((v) => v === "late").length;
  const leaveCount = Object.values(state).filter((v) => v === "leave").length;
  const markedCount = Object.keys(state).length;

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
      `📢 ABSENT STUDENTS LIST - ${date}\n🏫 ${orgName}\n\n${lines.join("\n")}\n\nNote: Parents have been notified.`
    );
    setCopiedBroadcast(true);
    setTimeout(() => setCopiedBroadcast(false), 2500);
  };

  if (authLoading) {
    return (
      <main className="mx-auto max-w-7xl p-8 text-center text-sm text-slate-500">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="animate-spin text-purple-600" size={20} />
          <span>Verifying attendance permissions...</span>
        </div>
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

  const todayStr = getLocalDateString();
  const isToday = date === todayStr;

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-7 space-y-6">
      {/* Toast Notification Banner */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 rounded-2xl px-4 py-3 shadow-xl backdrop-blur-md transition-all animate-bounce border ${
            toast.type === "success"
              ? "bg-emerald-900/90 text-white border-emerald-500/40"
              : toast.type === "error"
              ? "bg-red-900/90 text-white border-red-500/40"
              : "bg-slate-900/90 text-white border-slate-700"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          ) : toast.type === "error" ? (
            <AlertCircle size={18} className="text-red-400 shrink-0" />
          ) : (
            <Clock size={18} className="text-cyan-400 shrink-0" />
          )}
          <span className="text-xs sm:text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <button
            onClick={() => window.history.back()}
            className="mb-2 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition shadow-xs"
          >
            <ArrowLeft size={14} />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Student Attendance
            </h1>
            <span className="rounded-full bg-purple-100/90 border border-purple-200 px-3 py-0.5 text-xs font-bold text-purple-700 shadow-xs">
              ⚡ Real-time Auto-Save
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
            Tapping any mark instantly saves to the database. Supports Smart QR ID card scanning and WhatsApp alerts.
          </p>
        </div>

        {/* QR Scanner Trigger Button */}
        {canManage && (
          <button
            onClick={() => setShowScanner(true)}
            className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-purple-600/20 hover:from-purple-500 hover:to-cyan-500 transition active:scale-95 group"
          >
            <QrCode size={18} className="text-yellow-300 group-hover:rotate-12 transition" />
            <span>Open Gate QR Scanner Kiosk</span>
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50/90 border border-red-200 p-4 text-xs sm:text-sm text-red-700 font-medium flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Cards (Glassmorphism Glow) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Students</span>
            <Users size={16} className="text-slate-400" />
          </div>
          <p className="mt-1 text-2xl font-black text-slate-900">{students.length}</p>
          <span className="text-[11px] text-slate-500">
            {markedCount} / {students.length} Marked
          </span>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
              <CheckCircle2 size={14} className="text-emerald-600" /> Present
            </span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              {students.length ? Math.round((presentCount / students.length) * 100) : 0}%
            </span>
          </div>
          <p className="mt-1 text-2xl font-black text-emerald-700">{presentCount}</p>
          <span className="text-[11px] text-emerald-600">Students Attending</span>
        </div>

        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/60 backdrop-blur-md p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-800 flex items-center gap-1">
                <UserX size={14} className="text-rose-600" /> Absent
              </span>
              {absentCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAbsentModal(true)}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                  title="Notify Absent Students Parents on WhatsApp"
                >
                  <MessageCircle size={11} />
                  <span>WhatsApp</span>
                </button>
              )}
            </div>
            <p className="mt-1 text-2xl font-black text-rose-700">{absentCount}</p>
          </div>
          <span className="text-[11px] text-rose-600 font-medium">
            {absentCount > 0 ? "1-Click WhatsApp Ready" : "Zero Absentees"}
          </span>
        </div>

        <div className="rounded-2xl border border-purple-200/80 bg-purple-50/60 backdrop-blur-md p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-800 flex items-center gap-1">
              <Calendar size={14} className="text-purple-600" /> Register Date
            </span>
            {isToday && (
              <span className="rounded-full bg-purple-200/70 px-2 py-0.2 text-[10px] font-bold text-purple-800">
                Today
              </span>
            )}
          </div>
          <p className="mt-1 text-xl font-black text-purple-900 font-mono tracking-tight">{date}</p>
          <div className="mt-1 flex items-center gap-1">
            <span
              className={`h-2 w-2 rounded-full ${
                globalAutoSaveStatus === "saving"
                  ? "bg-amber-500 animate-ping"
                  : globalAutoSaveStatus === "synced"
                  ? "bg-emerald-500"
                  : "bg-red-500"
              }`}
            />
            <span className="text-[10px] font-bold text-purple-700 capitalize">
              {globalAutoSaveStatus === "saving"
                ? "Auto-saving..."
                : globalAutoSaveStatus === "synced"
                ? "Auto-saved to Cloud"
                : "Unsaved changes"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Attendance Card */}
      <div className="rounded-3xl border border-slate-200 bg-white/95 backdrop-blur-md shadow-sm overflow-hidden">
        {/* Filters & Control Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/70 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Picker + Quick Today Shortcut */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Attendance Date
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-semibold outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/10"
                />
                {!isToday && (
                  <button
                    onClick={() => setDate(todayStr)}
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                  >
                    Today
                  </button>
                )}
              </div>
            </div>

            {/* Class Dropdown Filter */}
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

            {/* Student Search Box */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Search Student
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Name, Adm No, Roll..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 sm:w-60 rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs sm:text-sm font-medium outline-none focus:border-purple-600"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons: Mark All Present, Clear */}
          <div className="flex flex-wrap items-center gap-2">
            {canManage && students.length > 0 && (
              <>
                <button
                  disabled={savingBatch}
                  onClick={() => markAll("present")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition active:scale-95 disabled:opacity-50 shadow-xs"
                >
                  <UserCheck size={14} className="text-emerald-600" />
                  <span>{savingBatch ? "Saving All..." : "Mark All Present"}</span>
                </button>

                <button
                  disabled={savingBatch}
                  onClick={clearAllMarks}
                  className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition active:scale-95 disabled:opacity-50"
                  title="Clear all marked attendance records for this date"
                >
                  Clear All Marks
                </button>
              </>
            )}
          </div>
        </div>

        {/* Live Status Sticky Bar */}
        <div className="px-5 py-2.5 bg-slate-100/60 border-b border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-600">
              Showing {filteredStudents.length} of {students.length} students
            </span>
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                {presentCount} P
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                {absentCount} A
              </span>
              {lateCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  {lateCount} L
                </span>
              )}
              {leaveCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-800">
                  {leaveCount} LV
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {globalAutoSaveStatus === "saving" ? (
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                <Loader2 size={13} className="animate-spin" /> Saving changes...
              </span>
            ) : globalAutoSaveStatus === "synced" ? (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                <CheckCheck size={14} /> Auto-Saved
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-bold text-rose-600">
                <AlertCircle size={13} /> Unsaved changes
              </span>
            )}

            {canManage && (
              <button
                onClick={saveAllManual}
                disabled={savingBatch}
                className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1 text-[11px] font-bold text-white hover:bg-slate-800 transition disabled:opacity-50 shadow-xs"
              >
                <span>Save All Now</span>
              </button>
            )}
          </div>
        </div>

        {/* Student List Table */}
        {loading ? (
          <div className="p-16 text-center text-sm text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="animate-spin text-purple-600" size={24} />
            <span>Loading student register...</span>
          </div>
        ) : filteredStudents.length ? (
          <div className="divide-y divide-slate-100">
            {filteredStudents.map((st) => {
              const currentStatus = state[st.id] || "";
              const isSavingThis = savingStudents.has(st.id);
              const isSavedThis = savedStudents.has(st.id);
              const cName = st.class_id ? classMap.get(st.class_id) || "Class" : "Class";

              return (
                <div
                  key={st.id}
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-3.5 transition ${
                    currentStatus === "present"
                      ? "bg-emerald-50/25 hover:bg-emerald-50/40"
                      : currentStatus === "absent"
                      ? "bg-rose-50/25 hover:bg-rose-50/40"
                      : "hover:bg-slate-50/70"
                  }`}
                >
                  {/* Left: Avatar & Info */}
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 text-purple-800 font-bold text-sm shrink-0 overflow-hidden shadow-xs border border-purple-200/50">
                      {st.photo_url ? (
                        <img src={st.photo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        st.first_name[0]?.toUpperCase()
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 leading-tight">
                          {st.first_name} {st.last_name || ""}
                        </span>
                        {isSavedThis && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 animate-fade-in">
                            <Check size={10} /> Saved
                          </span>
                        )}
                        {isSavingThis && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600">
                            <Loader2 size={10} className="animate-spin" /> Saving
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          Adm: <strong className="text-slate-800">{st.admission_no}</strong>
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {cName}
                        </span>
                        {st.roll_no && (
                          <span className="text-[11px] text-slate-400 font-mono">
                            Roll: #{st.roll_no}
                          </span>
                        )}
                        {(st.guardian_phone || st.phone) && (
                          <span className="text-[10px] text-slate-400">
                            📞 {st.guardian_phone || st.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: 4 Fast Status Toggle Buttons + WhatsApp Notification Button */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-2xl border border-slate-200">
                      {[
                        { key: "present", label: "Present", color: "emerald" },
                        { key: "absent", label: "Absent", color: "rose" },
                        { key: "late", label: "Late", color: "amber" },
                        { key: "leave", label: "Leave", color: "slate" },
                      ].map(({ key, label, color }) => {
                        const active = currentStatus === key;

                        return (
                          <button
                            key={key}
                            type="button"
                            disabled={!canManage || isSavingThis}
                            onClick={() => markSingleAttendance(st.id, key)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                              active
                                ? color === "emerald"
                                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-600/20"
                                  : color === "rose"
                                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-600/20"
                                  : color === "amber"
                                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-2 ring-amber-600/20"
                                  : "bg-slate-800 text-white shadow-md shadow-slate-800/30 ring-2 ring-slate-800/20"
                                : "text-slate-600 hover:text-slate-900 hover:bg-white"
                            } ${!canManage ? "cursor-default opacity-70" : ""}`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Absent WhatsApp Alert Button */}
                    {currentStatus === "absent" && (
                      <a
                        href={createWhatsAppUrl(
                          st.guardian_phone || st.phone,
                          formatAbsentAlertMessage({
                            studentName: `${st.first_name} ${st.last_name || ""}`.trim(),
                            admissionNo: st.admission_no,
                            className: cName,
                            schoolName: orgName,
                            date: date,
                            originUrl,
                            studentId: st.id,
                          })
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => markAsNotified(st.id)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-xs ${
                          notifiedStudents.has(st.id)
                            ? "bg-slate-100 text-slate-500 border border-slate-200"
                            : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 shadow-emerald-600/25"
                        }`}
                        title={
                          st.guardian_phone || st.phone
                            ? `Send absent WhatsApp message to parent (${st.guardian_phone || st.phone})`
                            : "No parent phone number registered"
                        }
                      >
                        <MessageCircle size={14} />
                        <span className="hidden md:inline">
                          {notifiedStudents.has(st.id) ? "Sent ✓" : "WhatsApp"}
                        </span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-16 text-center text-sm text-slate-500">
            {searchQuery
              ? `No student matching "${searchQuery}".`
              : selectedClass
              ? "No active students in this class."
              : "No active students found."}
          </div>
        )}

        {/* Bottom Bar */}
        {canManage && students.length > 0 && (
          <div className="flex flex-wrap items-center justify-between border-t border-slate-100 bg-slate-50/70 p-4">
            <span className="text-xs text-slate-500 font-medium">
              ⚡ Attendance is continuously auto-saved. You can safely close or navigate at any time.
            </span>
            <button
              disabled={savingBatch}
              onClick={saveAllManual}
              className="rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition disabled:opacity-50 active:scale-95"
            >
              {savingBatch ? "Saving..." : "Save Daily Attendance"}
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

          {/* Kiosk Main Split: Camera Viewport + Recent Live Scans */}
          <div className="grid lg:grid-cols-3 gap-6 flex-1">
            {/* Camera Viewport (Col span 2) */}
            <div className="lg:col-span-2 flex flex-col justify-between rounded-3xl border border-slate-800 bg-black/60 p-4 relative overflow-hidden">
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

                {/* Active Student Scan Confirmation Pop-Up */}
                {activeScan && activeScan.success && activeScan.student && (
                  <div className="absolute inset-4 z-30 flex items-center justify-center bg-slate-950/95 backdrop-blur-md rounded-2xl p-6 animate-fade-in">
                    <div className="w-full max-w-md text-center space-y-4">
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

                      {/* Fee Dues Notice Banner */}
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
                  placeholder="Or enter Admission No. (for handheld barcode gun / manual entry)..."
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

            {/* Live Scan Stream & History Sidebar */}
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
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
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
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-100 transition shadow-xs"
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
                          : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
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
                              <span className="text-rose-500 font-semibold">⚠️ No parent phone</span>
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
                            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition shadow-xs ${
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
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-bold text-slate-700 hover:bg-slate-100 transition shadow-xs ml-auto"
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
