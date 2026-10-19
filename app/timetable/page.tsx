"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Calendar, Clock, BookOpen, Users, Printer, Trash2, Edit3, X, CheckCircle2, AlertCircle, Copy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUserAccess } from "@/lib/auth/permissions";
import AccessDenied from "@/components/auth/AccessDenied";
import FeatureGate from "@/components/FeatureGate";
import { fetchInstitutionFeatures } from "@/lib/features";

type TimetableSlot = {
  id: string;
  organization_id: string;
  class_id: string;
  class_name: string;
  section_name: string | null;
  day_of_week: string;
  period_number: number;
  start_time: string | null;
  end_time: string | null;
  subject: string;
  teacher_name: string | null;
  room_no: string | null;
};

type ClassItem = { id: string; name: string };
type TeacherItem = { id: string; full_name: string };

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DEFAULT_TIMINGS: Record<number, { start: string; end: string }> = {
  1: { start: "09:00 AM", end: "09:45 AM" },
  2: { start: "09:45 AM", end: "10:30 AM" },
  3: { start: "10:30 AM", end: "11:15 AM" },
  4: { start: "11:15 AM", end: "12:00 PM" },
  5: { start: "12:30 PM", end: "01:15 PM" },
  6: { start: "01:15 PM", end: "02:00 PM" },
  7: { start: "02:00 PM", end: "02:40 PM" },
  8: { start: "02:40 PM", end: "03:15 PM" },
};

const SUBJECT_COLORS: Record<string, string> = {
  Mathematics: "bg-blue-50 text-blue-700 border-blue-200",
  Science: "bg-emerald-50 text-emerald-700 border-emerald-200",
  English: "bg-purple-50 text-purple-700 border-purple-200",
  Hindi: "bg-amber-50 text-amber-700 border-amber-200",
  Urdu: "bg-teal-50 text-teal-700 border-teal-200",
  "Social Science": "bg-orange-50 text-orange-700 border-orange-200",
  Computer: "bg-indigo-50 text-indigo-700 border-indigo-200",
  "General Knowledge": "bg-yellow-50 text-yellow-700 border-yellow-200",
  Drawing: "bg-pink-50 text-pink-700 border-pink-200",
  "Physical Education (PT)": "bg-rose-50 text-rose-700 border-rose-200",
};

export default function TimetablePage() {
  const supabase = createClient();
  const { loading: authLoading, orgId, hasAccess, can, isAdmin } = useUserAccess(["settings.manage"]);

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [activeDay, setActiveDay] = useState<string>("Monday");
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [featureActive, setFeatureActive] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [form, setForm] = useState({
    period_number: 1,
    start_time: "09:00 AM",
    end_time: "09:45 AM",
    subject: "Mathematics",
    teacher_name: "",
    room_no: "Room 101",
  });

  const canManage = isAdmin || can("settings.manage");

  useEffect(() => {
    if (!orgId || !hasAccess) return;
    (async () => {
      setLoading(true);
      const feat = await fetchInstitutionFeatures(supabase, orgId);
      if (feat && feat.timetable === false) { setFeatureActive(false); setLoading(false); return; }
      const [clRes, tchRes] = await Promise.all([
        supabase.from("classes").select("id,name").eq("organization_id", orgId).order("sort_order"),
        supabase.from("teachers").select("id,full_name").eq("organization_id", orgId),
      ]);

      if (clRes.data && clRes.data.length > 0) {
        setClasses(clRes.data);
        setSelectedClassId(clRes.data[0].id);
      }
      if (tchRes.data) setTeachers(tchRes.data);

      await loadSlots();
    })();
  }, [orgId, hasAccess]);

  const loadSlots = async () => {
    if (!orgId) return;
    try {
      const { data, error } = await supabase
        .from("class_timetables")
        .select("*")
        .eq("organization_id", orgId);

      if (error) {
        // Fallback local storage
        const local = localStorage.getItem(`edutechlab_timetable_${orgId}`);
        if (local) setSlots(JSON.parse(local));
      } else {
        setSlots(data || []);
        localStorage.setItem(`edutechlab_timetable_${orgId}`, JSON.stringify(data || []));
      }
    } catch {
      // Local fallback
      const local = localStorage.getItem(`edutechlab_timetable_${orgId}`);
      if (local) setSlots(JSON.parse(local));
    } finally {
      setLoading(false);
    }
  };

  const selectedClassName = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId)?.name || "Standard";
  }, [classes, selectedClassId]);

  // Slots for selected class & active day
  const daySlots = useMemo(() => {
    return slots
      .filter((s) => s.class_id === selectedClassId && s.day_of_week === activeDay)
      .sort((a, b) => a.period_number - b.period_number);
  }, [slots, selectedClassId, activeDay]);

  const handleOpenAdd = (periodNum: number) => {
    const timing = DEFAULT_TIMINGS[periodNum] || { start: "09:00 AM", end: "09:45 AM" };
    setEditingSlot(null);
    setForm({
      period_number: periodNum,
      start_time: timing.start,
      end_time: timing.end,
      subject: "Mathematics",
      teacher_name: teachers[0]?.full_name || "",
      room_no: "Room 101",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (slot: TimetableSlot) => {
    setEditingSlot(slot);
    setForm({
      period_number: slot.period_number,
      start_time: slot.start_time || "09:00 AM",
      end_time: slot.end_time || "09:45 AM",
      subject: slot.subject,
      teacher_name: slot.teacher_name || "",
      room_no: slot.room_no || "Room 101",
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const slotPayload: TimetableSlot = {
      id: editingSlot ? editingSlot.id : crypto.randomUUID(),
      organization_id: orgId!,
      class_id: selectedClassId,
      class_name: selectedClassName,
      section_name: "All",
      day_of_week: activeDay,
      period_number: Number(form.period_number),
      start_time: form.start_time,
      end_time: form.end_time,
      subject: form.subject.trim(),
      teacher_name: form.teacher_name.trim() || null,
      room_no: form.room_no.trim() || null,
    };

    try {
      if (editingSlot) {
        await supabase
          .from("class_timetables")
          .update(slotPayload)
          .eq("id", editingSlot.id);
        const updated = slots.map((s) => (s.id === editingSlot.id ? slotPayload : s));
        setSlots(updated);
        localStorage.setItem(`edutechlab_timetable_${orgId}`, JSON.stringify(updated));
      } else {
        await supabase.from("class_timetables").insert(slotPayload);
        const updated = [...slots.filter((s) => !(s.class_id === selectedClassId && s.day_of_week === activeDay && s.period_number === slotPayload.period_number)), slotPayload];
        setSlots(updated);
        localStorage.setItem(`edutechlab_timetable_${orgId}`, JSON.stringify(updated));
      }

      setSuccess("Period schedule updated successfully!");
      setModalOpen(false);
    } catch {
      // Local fallback
      const updated = editingSlot
        ? slots.map((s) => (s.id === editingSlot.id ? slotPayload : s))
        : [...slots, slotPayload];
      setSlots(updated);
      localStorage.setItem(`edutechlab_timetable_${orgId}`, JSON.stringify(updated));
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this period from routine?")) return;
    try {
      await supabase.from("class_timetables").delete().eq("id", id);
      const updated = slots.filter((s) => s.id !== id);
      setSlots(updated);
      localStorage.setItem(`edutechlab_timetable_${orgId}`, JSON.stringify(updated));
    } catch {
      const updated = slots.filter((s) => s.id !== id);
      setSlots(updated);
      localStorage.setItem(`edutechlab_timetable_${orgId}`, JSON.stringify(updated));
    }
  };

  if (!featureActive) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <FeatureGate featureKey="timetable" instituteName={"Your School"} />
      </div>
    );
  }

  if (authLoading) {
    return (
      <main className="mx-auto max-w-7xl p-8 text-center text-sm text-slate-500">
        Loading Class Timetable...
      </main>
    );
  }

  if (!hasAccess) {
    return <AccessDenied moduleName="Class Timetable Management" />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 print:bg-white print:p-0">
      {/* SCREEN HEADER */}
      <div className="print:hidden border-b bg-white">
        <div className="mx-auto max-w-7xl px-5 py-4 sm:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <Link
                href="/dashboard"
                className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
              >
                <ArrowLeft size={14} /> Back to Dashboard
              </Link>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                Class Timetable & Period Routine
              </h1>
              <p className="mt-1 text-xs text-slate-500 font-medium">
                Manage subject periods, faculty assignments, classroom numbers, and substitution arrangements.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition active:scale-95"
              >
                <Printer size={15} />
                <span>Print Routine</span>
              </button>
            </div>
          </div>

          {/* Class Selector Bar */}
          <div className="mt-5 flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Select Class:
            </span>
            <div className="flex flex-wrap gap-2">
              {classes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedClassId(c.id)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                    selectedClassId === c.id
                      ? "bg-slate-900 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Days Tabs */}
          <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
            {DAYS.map((day) => (
              <button
                key={day}
                onClick={() => setActiveDay(day)}
                className={`rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition ${
                  activeDay === day
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/25"
                    : "text-slate-600 hover:bg-purple-50 hover:text-purple-700"
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TIMETABLE VIEW / PRINT SHEET */}
      <main className="mx-auto max-w-7xl p-5 sm:p-8 print:p-0 print:max-w-none">
        <div className="mb-4 flex items-center justify-between border-b pb-3 print:pb-2">
          <div>
            <h2 className="text-lg font-black text-slate-900 sm:text-xl uppercase tracking-wide">
              {selectedClassName} — {activeDay} Routine
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              8 Daily Academic Periods with Faculty Allocation
            </p>
          </div>
          <span className="hidden print:inline-block text-xs font-bold text-slate-400">
            EduTechLab Academic Routine
          </span>
        </div>

        {/* Period Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 print:gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((periodNum) => {
            const slot = daySlots.find((s) => s.period_number === periodNum);
            const timing = DEFAULT_TIMINGS[periodNum] || { start: "09:00 AM", end: "09:45 AM" };
            const badgeClass = slot?.subject
              ? SUBJECT_COLORS[slot.subject] || "bg-purple-50 text-purple-700 border-purple-200"
              : "bg-slate-50 text-slate-500 border-slate-200";

            return (
              <div
                key={periodNum}
                className={`relative rounded-2xl border bg-white p-4 shadow-sm transition flex flex-col justify-between print:border-slate-300 print:shadow-none ${
                  slot ? "border-slate-200" : "border-dashed border-slate-300 bg-slate-50/50"
                }`}
                style={{ minHeight: "160px" }}
              >
                <div>
                  <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                    <span className="font-extrabold text-slate-900">
                      Period {periodNum}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
                      <Clock size={11} /> {slot?.start_time || timing.start} - {slot?.end_time || timing.end}
                    </span>
                  </div>

                  {slot ? (
                    <div className="mt-3">
                      <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-extrabold ${badgeClass}`}>
                        {slot.subject}
                      </span>
                      <div className="mt-2.5 space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <Users size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate">{slot.teacher_name || "Unassigned"}</span>
                        </div>
                        {slot.room_no && (
                          <div className="text-[11px] text-slate-400 font-medium">
                            Room: {slot.room_no}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 text-center text-xs text-slate-400 font-medium">
                      Free / Unassigned
                    </div>
                  )}
                </div>

                {/* Card Action footer (screen only) */}
                <div className="print:hidden mt-4 pt-2 border-t border-slate-100 flex items-center justify-between">
                  {slot ? (
                    <>
                      <button
                        onClick={() => handleOpenEdit(slot)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-purple-600 transition"
                      >
                        <Edit3 size={12} /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(slot.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-700 transition"
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleOpenAdd(periodNum)}
                      className="w-full inline-flex items-center justify-center gap-1 rounded-lg bg-slate-100 py-1 text-xs font-bold text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition"
                    >
                      <Plus size={13} /> Assign Subject
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* EDIT / ASSIGN PERIOD MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-purple-50 text-purple-600">
                <Calendar size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingSlot ? "Edit Period" : `Assign Period ${form.period_number}`}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedClassName} • {activeDay}
                </p>
              </div>
            </div>

            <form onSubmit={handleSave} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mathematics, Science, Urdu, English"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assigned Teacher / Faculty
                </label>
                <select
                  value={form.teacher_name}
                  onChange={(e) => setForm({ ...form, teacher_name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:border-purple-600 focus:outline-none"
                >
                  <option value="">Select Registered Teacher</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.full_name}>
                      {t.full_name}
                    </option>
                  ))}
                  <option value="Guest Faculty">Guest Faculty</option>
                  <option value="Self Study">Self Study / Library</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="text"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-purple-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="text"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-purple-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Classroom / Hall Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. Room 102, Science Lab"
                  value={form.room_no}
                  onChange={(e) => setForm({ ...form, room_no: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-purple-600/25 hover:bg-purple-700 transition disabled:opacity-50"
                >
                  {saving ? "Saving Routine..." : "Save Period"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
