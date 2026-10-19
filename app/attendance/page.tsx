"use client";

import FeatureGate from "@/components/FeatureGate";
import { fetchInstitutionFeatures } from "@/lib/features";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUserAccess } from "@/lib/auth/permissions";
import AccessDenied from "@/components/auth/AccessDenied";

type Student = {
  id: string;
  first_name: string;
  last_name: string | null;
  admission_no: string;
  class_id?: string | null;
};

type A = { student_id: string; status: string };
type ClassItem = { id: string; name: string };

// FeatureGate state flag
export default function Attendance() {
  const s = createClient();
  const { loading: authLoading, orgId: org, hasAccess, can, isAdmin } = useUserAccess([
    "attendance.view",
    "attendance.manage",
  ]);

  const [featureActive, setFeatureActive] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [state, setState] = useState<Record<string, string>>({});
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canManage = can("attendance.manage");

  const load = async () => {
    if (!org) return;
    const feat = await fetchInstitutionFeatures(s, org);
    if (feat && feat.attendance === false) { setFeatureActive(false); setLoading(false); return; }
    setLoading(true);
    setSaved("");

    let studentQuery = s
      .from("students")
      .select("id,first_name,last_name,admission_no,class_id")
      .eq("organization_id", org)
      .eq("status", "active")
      .order("first_name");

    if (selectedClass) {
      studentQuery = studentQuery.eq("class_id", selectedClass);
    }

    const [stRes, attRes, clRes] = await Promise.all([
      studentQuery,
      s.from("attendance").select("student_id,status").eq("organization_id", org).eq("attendance_date", date),
      s.from("classes").select("id,name").eq("organization_id", org).order("sort_order"),
    ]);

    if (stRes.error) setError(stRes.error.message);
    setStudents(stRes.data || []);
    setClasses(clRes.data || []);

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

    // Atomic batch upsert
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

  return (
    <main className="mx-auto max-w-7xl p-5 sm:p-8">
      <button
        onClick={() => window.history.back()}
        className="mb-5 inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <p className="text-sm text-slate-500">Daily records</p>
      <h1 className="mt-1 text-3xl font-bold">Attendance</h1>
      <p className="mt-2 text-sm text-slate-500">Mark and review student attendance by class and date.</p>

      {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {saved && <div className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">{saved}</div>}

      <div className="mt-7 rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm outline-none"
            />
            {classes.length > 0 && (
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="rounded-xl border px-3 py-2 text-sm outline-none"
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              {students.length} students
            </span>
            {canManage && students.length > 0 && (
              <>
                <button
                  onClick={() => markAll("present")}
                  className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                >
                  Mark all present
                </button>
                <button
                  onClick={del}
                  className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  Clear day
                </button>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading attendance...</div>
        ) : students.length ? (
          <div className="divide-y">
            {students.map((st) => (
              <div key={st.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <span className="font-medium text-slate-900">
                  {st.first_name} {st.last_name || ""}
                  <small className="ml-2 font-mono text-xs text-slate-400">{st.admission_no}</small>
                </span>
                <div className="flex gap-1.5 sm:gap-2">
                  {["present", "absent", "late", "leave"].map((x) => (
                    <button
                      key={x}
                      disabled={!canManage}
                      onClick={() => setState({ ...state, [st.id]: x })}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition ${
                        state[st.id] === x
                          ? x === "present"
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : x === "absent"
                            ? "border-red-600 bg-red-600 text-white"
                            : "border-slate-900 bg-slate-900 text-white"
                          : "bg-white text-slate-600 hover:bg-slate-50"
                      } ${!canManage ? "cursor-default opacity-80" : ""}`}
                    >
                      {x}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center text-sm text-slate-500">
            {selectedClass ? "No active students in this class." : "Add students first."}
          </div>
        )}

        {canManage && students.length > 0 && (
          <div className="flex justify-end border-t p-4">
            <button
              disabled={saving}
              onClick={save}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save attendance"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}