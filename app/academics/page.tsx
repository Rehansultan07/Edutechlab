"use client";

import FeatureGate from "@/components/FeatureGate";
import { fetchInstitutionFeatures } from "@/lib/features";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  BookOpen,
  Calendar,
  Layers,
  Users,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUserAccess } from "@/lib/auth/permissions";
import AccessDenied from "@/components/auth/AccessDenied";

type AcademicSession = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  is_current: boolean;
};

type ClassItem = {
  id: string;
  name: string;
  sort_order: number;
};

type SectionItem = {
  id: string;
  class_id: string;
  name: string;
};

type StudentCount = {
  class_id: string | null;
  section_id: string | null;
};

// FeatureGate state flag
export default function AcademicsPage() {
  const supabase = createClient();
  const { loading: authLoading, orgId, hasAccess, can, isAdmin } = useUserAccess([
    "settings.manage",
    "students.manage",
  ]);

  const [featureActive, setFeatureActive] = useState(true);
  const [activeTab, setActiveTab] = useState<"classes" | "sessions">("classes");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [students, setStudents] = useState<StudentCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  // Modal states
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [className, setClassName] = useState("");
  const [classSortOrder, setClassSortOrder] = useState(0);

  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [targetClassForSection, setTargetClassForSection] = useState<ClassItem | null>(null);
  const [sectionName, setSectionName] = useState("");

  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<AcademicSession | null>(null);
  const [sessionForm, setSessionForm] = useState({
    name: "",
    starts_on: "",
    ends_on: "",
    is_current: false,
  });

  const canManage = can("settings.manage") || can("students.manage");

  const loadData = async () => {
    if (!orgId) return;
    const feat = await fetchInstitutionFeatures(supabase, orgId);
    if (feat && feat.academics === false) { setFeatureActive(false); setLoading(false); return; }
    try {
      setLoading(true);
      setError("");

      const [clsRes, secRes, sesRes, stuRes] = await Promise.all([
        supabase
          .from("classes")
          .select("id, name, sort_order")
          .eq("organization_id", orgId)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("sections")
          .select("id, class_id, name")
          .eq("organization_id", orgId)
          .order("name", { ascending: true }),
        supabase
          .from("academic_sessions")
          .select("id, name, starts_on, ends_on, is_current")
          .eq("organization_id", orgId)
          .order("starts_on", { ascending: false }),
        supabase
          .from("students")
          .select("class_id, section_id")
          .eq("organization_id", orgId)
          .eq("status", "active"),
      ]);

      if (clsRes.error) throw clsRes.error;
      if (secRes.error) throw secRes.error;
      if (sesRes.error) throw sesRes.error;

      setClasses(clsRes.data || []);
      setSections(secRes.data || []);
      setSessions(sesRes.data || []);
      setStudents(stuRes.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load academic data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orgId) {
      loadData();
    }
  }, [orgId]);

  // Compute student counts per class and per section
  const studentCountByClass = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of students) {
      if (s.class_id) {
        counts[s.class_id] = (counts[s.class_id] || 0) + 1;
      }
    }
    return counts;
  }, [students]);

  const studentCountBySection = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of students) {
      if (s.section_id) {
        counts[s.section_id] = (counts[s.section_id] || 0) + 1;
      }
    }
    return counts;
  }, [students]);

  // ---------------- Classes Handlers ----------------
  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) return;
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      if (editingClass) {
        const { error: err } = await supabase
          .from("classes")
          .update({
            name: className.trim(),
            sort_order: Number(classSortOrder) || 0,
          })
          .eq("id", editingClass.id)
          .eq("organization_id", orgId);
        if (err) throw err;
        setSuccess(`Class "${className.trim()}" updated successfully.`);
      } else {
        const { error: err } = await supabase.from("classes").insert({
          organization_id: orgId,
          name: className.trim(),
          sort_order: Number(classSortOrder) || 0,
        });
        if (err) throw err;
        setSuccess(`Class "${className.trim()}" created successfully.`);
      }

      setClassModalOpen(false);
      setEditingClass(null);
      setClassName("");
      setClassSortOrder(0);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Could not save class.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteClass = async (cls: ClassItem) => {
    const count = studentCountByClass[cls.id] || 0;
    if (count > 0) {
      setError(
        `Cannot delete "${cls.name}" because ${count} active student(s) are enrolled in this class. Reassign the students to another class first.`
      );
      return;
    }

    if (!confirm(`Are you sure you want to delete class "${cls.name}" and all its sections?`)) {
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { error: err } = await supabase
        .from("classes")
        .delete()
        .eq("id", cls.id)
        .eq("organization_id", orgId);
      if (err) throw err;
      setSuccess(`Class "${cls.name}" deleted.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete class.");
    } finally {
      setBusy(false);
    }
  };

  // ---------------- Section Handlers ----------------
  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetClassForSection || !sectionName.trim()) return;
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const { error: err } = await supabase.from("sections").insert({
        organization_id: orgId,
        class_id: targetClassForSection.id,
        name: sectionName.trim(),
      });
      if (err) throw err;
      setSuccess(
        `Section "${sectionName.trim()}" added to ${targetClassForSection.name}.`
      );
      setSectionModalOpen(false);
      setTargetClassForSection(null);
      setSectionName("");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Could not add section.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSection = async (sec: SectionItem) => {
    const count = studentCountBySection[sec.id] || 0;
    if (count > 0) {
      setError(
        `Cannot delete section "${sec.name}" because ${count} student(s) are assigned to it.`
      );
      return;
    }

    if (!confirm(`Are you sure you want to delete section "${sec.name}"?`)) return;

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { error: err } = await supabase
        .from("sections")
        .delete()
        .eq("id", sec.id)
        .eq("organization_id", orgId);
      if (err) throw err;
      setSuccess(`Section "${sec.name}" deleted.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete section.");
    } finally {
      setBusy(false);
    }
  };

  // ---------------- Academic Sessions Handlers ----------------
  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionForm.name.trim() || !sessionForm.starts_on || !sessionForm.ends_on) {
      setError("Please fill in session name, start date, and end date.");
      return;
    }

    if (sessionForm.starts_on >= sessionForm.ends_on) {
      setError("Session start date must be before end date.");
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      // If marking as current, reset other sessions first
      if (sessionForm.is_current) {
        await supabase
          .from("academic_sessions")
          .update({ is_current: false })
          .eq("organization_id", orgId);
      }

      if (editingSession) {
        const { error: err } = await supabase
          .from("academic_sessions")
          .update({
            name: sessionForm.name.trim(),
            starts_on: sessionForm.starts_on,
            ends_on: sessionForm.ends_on,
            is_current: sessionForm.is_current,
          })
          .eq("id", editingSession.id)
          .eq("organization_id", orgId);
        if (err) throw err;
        setSuccess(`Academic session "${sessionForm.name}" updated.`);
      } else {
        const { error: err } = await supabase.from("academic_sessions").insert({
          organization_id: orgId,
          name: sessionForm.name.trim(),
          starts_on: sessionForm.starts_on,
          ends_on: sessionForm.ends_on,
          is_current: sessionForm.is_current,
        });
        if (err) throw err;
        setSuccess(`Academic session "${sessionForm.name}" created.`);
      }

      setSessionModalOpen(false);
      setEditingSession(null);
      setSessionForm({ name: "", starts_on: "", ends_on: "", is_current: false });
      await loadData();
    } catch (err: any) {
      setError(err.message || "Could not save academic session.");
    } finally {
      setBusy(false);
    }
  };

  const handleSetCurrentSession = async (ses: AcademicSession) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      // Step 1: Set all to false
      await supabase
        .from("academic_sessions")
        .update({ is_current: false })
        .eq("organization_id", orgId);

      // Step 2: Set target to true
      const { error: err } = await supabase
        .from("academic_sessions")
        .update({ is_current: true })
        .eq("id", ses.id)
        .eq("organization_id", orgId);

      if (err) throw err;
      setSuccess(`"${ses.name}" is now the active academic session.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to set active session.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSession = async (ses: AcademicSession) => {
    if (ses.is_current) {
      setError("Cannot delete the active academic session. Set another session as current first.");
      return;
    }

    if (!confirm(`Are you sure you want to delete session "${ses.name}"?`)) return;

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { error: err } = await supabase
        .from("academic_sessions")
        .delete()
        .eq("id", ses.id)
        .eq("organization_id", orgId);
      if (err) throw err;
      setSuccess(`Session "${ses.name}" deleted.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete session.");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <main className="mx-auto max-w-7xl p-8 text-center text-sm text-slate-500">
        Checking permissions...
      </main>
    );
  }

  if (!hasAccess) {
    return <AccessDenied moduleName="Academic Structure" />;
  }

  if (!featureActive) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <FeatureGate featureKey="academics" />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl p-5 sm:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Academic Management
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Classes & Sessions
            </h1>
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            {activeTab === "classes" ? (
              <button
                onClick={() => {
                  setEditingClass(null);
                  setClassName("");
                  setClassSortOrder(classes.length + 1);
                  setClassModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                <Plus size={16} />
                Add Class
              </button>
            ) : (
              <button
                onClick={() => {
                  setEditingSession(null);
                  setSessionForm({
                    name: "",
                    starts_on: "",
                    ends_on: "",
                    is_current: sessions.length === 0,
                  });
                  setSessionModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                <Plus size={16} />
                Add Session
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("classes")}
          className={`inline-flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === "classes"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Layers size={17} />
          Classes & Sections ({classes.length})
        </button>
        <button
          onClick={() => setActiveTab("sessions")}
          className={`inline-flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === "sessions"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Calendar size={17} />
          Academic Sessions ({sessions.length})
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* TAB 1: Classes & Sections */}
      {activeTab === "classes" && (
        <div className="space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
              Loading classes and sections...
            </div>
          ) : classes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <Layers size={36} className="mx-auto text-slate-300" />
              <h3 className="mt-3 text-base font-semibold text-slate-900">No classes configured</h3>
              <p className="mt-1 text-sm text-slate-500">
                Create classes (e.g. Nursery, Class 1, Class 10, Hifz) so you can organize students and mark attendance.
              </p>
              {canManage && (
                <button
                  onClick={() => {
                    setEditingClass(null);
                    setClassName("");
                    setClassSortOrder(1);
                    setClassModalOpen(true);
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  <Plus size={16} />
                  Add First Class
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {classes.map((cls) => {
                const classSections = sections.filter((s) => s.class_id === cls.id);
                const count = studentCountByClass[cls.id] || 0;

                return (
                  <div
                    key={cls.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{cls.name}</h3>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            <Users size={12} />
                            {count} {count === 1 ? "student" : "students"}
                          </span>
                        </div>

                        {canManage && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingClass(cls);
                                setClassName(cls.name);
                                setClassSortOrder(cls.sort_order);
                                setClassModalOpen(true);
                              }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              title="Edit Class"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteClass(cls)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              title="Delete Class"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Sections List */}
                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
                          <span>SECTIONS</span>
                          {canManage && (
                            <button
                              onClick={() => {
                                setTargetClassForSection(cls);
                                setSectionName("");
                                setSectionModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 text-[#6657e8] hover:underline"
                            >
                              <Plus size={13} />
                              Add Section
                            </button>
                          )}
                        </div>

                        {classSections.length === 0 ? (
                          <p className="text-xs italic text-slate-400">No sections added yet (e.g. A, B)</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {classSections.map((sec) => {
                              const secCount = studentCountBySection[sec.id] || 0;
                              return (
                                <span
                                  key={sec.id}
                                  className="group inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                                >
                                  <span>
                                    Section {sec.name}{" "}
                                    <span className="text-[11px] text-slate-400">({secCount})</span>
                                  </span>
                                  {canManage && (
                                    <button
                                      onClick={() => handleDeleteSection(sec)}
                                      className="text-slate-300 opacity-60 transition hover:text-red-600 group-hover:opacity-100"
                                      title="Delete section"
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                      Sort order: {cls.sort_order}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Academic Sessions */}
      {activeTab === "sessions" && (
        <div className="space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
              Loading academic sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <Calendar size={36} className="mx-auto text-slate-300" />
              <h3 className="mt-3 text-base font-semibold text-slate-900">No academic sessions</h3>
              <p className="mt-1 text-sm text-slate-500">
                Create your active academic year (e.g. 2025-2026) to manage admissions and exam periods.
              </p>
              {canManage && (
                <button
                  onClick={() => {
                    setEditingSession(null);
                    setSessionForm({
                      name: "",
                      starts_on: "",
                      ends_on: "",
                      is_current: true,
                    });
                    setSessionModalOpen(true);
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  <Plus size={16} />
                  Add First Session
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Session Name</th>
                      <th className="px-5 py-3.5">Starts On</th>
                      <th className="px-5 py-3.5">Ends On</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sessions.map((ses) => (
                      <tr key={ses.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-4 font-semibold text-slate-900">
                          {ses.name}
                        </td>
                        <td className="px-5 py-4 text-slate-600">{ses.starts_on}</td>
                        <td className="px-5 py-4 text-slate-600">{ses.ends_on}</td>
                        <td className="px-5 py-4">
                          {ses.is_current ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 size={13} />
                              Current Active
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            {canManage && !ses.is_current && (
                              <button
                                onClick={() => handleSetCurrentSession(ses)}
                                disabled={busy}
                                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Set Active
                              </button>
                            )}
                            {canManage && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingSession(ses);
                                    setSessionForm({
                                      name: ses.name,
                                      starts_on: ses.starts_on,
                                      ends_on: ses.ends_on,
                                      is_current: ses.is_current,
                                    });
                                    setSessionModalOpen(true);
                                  }}
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                  title="Edit"
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  onClick={() => handleDeleteSession(ses)}
                                  disabled={ses.is_current || busy}
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                                  title={ses.is_current ? "Cannot delete active session" : "Delete"}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Class Modal */}
      {classModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {editingClass ? "Edit Class" : "Add New Class"}
              </h2>
              <button
                onClick={() => setClassModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveClass} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500">
                  Class Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Class 1, Class 10, Nursery, Hifz"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500">
                  Sort Order (Position)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={classSortOrder}
                  onChange={(e) => setClassSortOrder(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Lower numbers appear first in lists and marksheets.
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setClassModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {busy ? "Saving..." : editingClass ? "Update Class" : "Create Class"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Section Modal */}
      {sectionModalOpen && targetClassForSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                Add Section to {targetClassForSection.name}
              </h2>
              <button
                onClick={() => setSectionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveSection} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500">
                  Section Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. A, B, Boys, Girls, Morning"
                  value={sectionName}
                  onChange={(e) => setSectionName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSectionModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {busy ? "Adding..." : "Add Section"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Session Modal */}
      {sessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {editingSession ? "Edit Academic Session" : "Add Academic Session"}
              </h2>
              <button
                onClick={() => setSessionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveSession} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500">
                  Session Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2025-2026 or 1446-1447 H"
                  value={sessionForm.name}
                  onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500">
                    Starts On
                  </label>
                  <input
                    type="date"
                    required
                    value={sessionForm.starts_on}
                    onChange={(e) => setSessionForm({ ...sessionForm, starts_on: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500">
                    Ends On
                  </label>
                  <input
                    type="date"
                    required
                    value={sessionForm.ends_on}
                    onChange={(e) => setSessionForm({ ...sessionForm, ends_on: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 pt-2">
                <input
                  type="checkbox"
                  checked={sessionForm.is_current}
                  onChange={(e) => setSessionForm({ ...sessionForm, is_current: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span className="text-sm font-medium text-slate-700">
                  Set as current active session
                </span>
              </label>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSessionModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {busy ? "Saving..." : editingSession ? "Update Session" : "Create Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
