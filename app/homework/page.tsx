"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, BookOpen, Calendar, Search, Users, Trash2, Edit3, X, CheckCircle2, AlertCircle, Copy, Check, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUserAccess } from "@/lib/auth/permissions";
import AccessDenied from "@/components/auth/AccessDenied";

type HomeworkItem = {
  id: string;
  organization_id: string;
  class_id: string;
  class_name: string;
  section_name: string | null;
  subject: string;
  title: string;
  description: string;
  assigned_date: string;
  due_date: string | null;
  teacher_name: string | null;
  created_at: string;
};

type ClassItem = { id: string; name: string };
type TeacherItem = { id: string; full_name: string };

const SUBJECT_COLORS: Record<string, string> = {
  Mathematics: "bg-blue-50 text-blue-700 border-blue-200",
  Science: "bg-emerald-50 text-emerald-700 border-emerald-200",
  English: "bg-purple-50 text-purple-700 border-purple-200",
  Hindi: "bg-amber-50 text-amber-700 border-amber-200",
  Urdu: "bg-teal-50 text-teal-700 border-teal-200",
  "Social Studies": "bg-orange-50 text-orange-700 border-orange-200",
  Computer: "bg-indigo-50 text-indigo-700 border-indigo-200",
  General: "bg-slate-50 text-slate-700 border-slate-200",
};

export default function HomeworkPage() {
  const supabase = createClient();
  const { loading: authLoading, orgId, hasAccess, can, isAdmin } = useUserAccess(["students.view"]);

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [orgName, setOrgName] = useState("Your Institution");
  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");

  // Modal State
  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    class_id: "",
    subject: "Mathematics",
    title: "",
    description: "",
    due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), // Tomorrow
    teacher_name: "",
  });

  const canManage = isAdmin || can("students.manage");

  useEffect(() => {
    if (!orgId || !hasAccess) return;
    (async () => {
      setLoading(true);
      const [clRes, tchRes, orgRes] = await Promise.all([
        supabase.from("classes").select("id,name").eq("organization_id", orgId).order("sort_order"),
        supabase.from("teachers").select("id,full_name").eq("organization_id", orgId),
        supabase.from("organizations").select("name").eq("id", orgId).single(),
      ]);

      if (clRes.data && clRes.data.length > 0) {
        setClasses(clRes.data);
        setForm((prev) => ({ ...prev, class_id: clRes.data[0].id }));
      }
      if (tchRes.data) {
        setTeachers(tchRes.data);
        if (tchRes.data.length > 0) {
          setForm((prev) => ({ ...prev, teacher_name: tchRes.data[0].full_name }));
        }
      }
      if (orgRes.data?.name) setOrgName(orgRes.data.name);

      await loadHomework();
    })();
  }, [orgId, hasAccess]);

  const loadHomework = async () => {
    if (!orgId) return;
    try {
      const { data, error } = await supabase
        .from("class_homework")
        .select("*")
        .eq("organization_id", orgId)
        .order("assigned_date", { ascending: false });

      if (error) {
        // Fallback local storage
        const local = localStorage.getItem(`edutechlab_homework_${orgId}`);
        if (local) setHomeworkList(JSON.parse(local));
      } else {
        setHomeworkList(data || []);
        localStorage.setItem(`edutechlab_homework_${orgId}`, JSON.stringify(data || []));
      }
    } catch {
      const local = localStorage.getItem(`edutechlab_homework_${orgId}`);
      if (local) setHomeworkList(JSON.parse(local));
    } finally {
      setLoading(false);
    }
  };

  const classMap = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c.name])), [classes]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.class_id) {
      setError("Please fill all required fields.");
      return;
    }

    setSaving(true);
    setError("");

    const className = classMap[form.class_id] || "Standard";
    const payload: HomeworkItem = {
      id: crypto.randomUUID(),
      organization_id: orgId!,
      class_id: form.class_id,
      class_name: className,
      section_name: "All",
      subject: form.subject.trim(),
      title: form.title.trim(),
      description: form.description.trim(),
      assigned_date: selectedDate,
      due_date: form.due_date || null,
      teacher_name: form.teacher_name.trim() || null,
      created_at: new Date().toISOString(),
    };

    try {
      const { error: insErr } = await supabase.from("class_homework").insert(payload);
      if (insErr) {
        const updated = [payload, ...homeworkList];
        setHomeworkList(updated);
        localStorage.setItem(`edutechlab_homework_${orgId}`, JSON.stringify(updated));
      } else {
        setHomeworkList((prev) => [payload, ...prev]);
        localStorage.setItem(`edutechlab_homework_${orgId}`, JSON.stringify([payload, ...homeworkList]));
      }

      setSuccess("Homework assigned and broadcasted!");
      setOpenModal(false);
      setForm((prev) => ({
        ...prev,
        title: "",
        description: "",
      }));
    } catch {
      const updated = [payload, ...homeworkList];
      setHomeworkList(updated);
      localStorage.setItem(`edutechlab_homework_${orgId}`, JSON.stringify(updated));
      setOpenModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this homework entry?")) return;
    try {
      await supabase.from("class_homework").delete().eq("id", id);
      const updated = homeworkList.filter((x) => x.id !== id);
      setHomeworkList(updated);
      localStorage.setItem(`edutechlab_homework_${orgId}`, JSON.stringify(updated));
    } catch {
      const updated = homeworkList.filter((x) => x.id !== id);
      setHomeworkList(updated);
      localStorage.setItem(`edutechlab_homework_${orgId}`, JSON.stringify(updated));
    }
  };

  const copyForWhatsApp = (hw: HomeworkItem) => {
    const text = `📚 *${orgName} — Daily Homework*\n*Class:* ${hw.class_name}\n*Subject:* ${hw.subject}\n*Topic:* ${hw.title}\n*Task / Questions:* ${hw.description}\n*Due Date:* ${hw.due_date || "Next Class"}\n*Teacher:* ${hw.teacher_name || "Faculty"}\n\n_Please ensure student completes homework in time._`;
    navigator.clipboard.writeText(text);
    setCopiedId(hw.id);
    setTimeout(() => setCopiedId(null), 3000);
  };

  // Filtered Homework
  const filteredList = useMemo(() => {
    return homeworkList.filter((item) => {
      const matchClass = selectedClassId === "all" || item.class_id === selectedClassId;
      const matchDate = !selectedDate || item.assigned_date === selectedDate;
      const searchTarget = `${item.title} ${item.description} ${item.subject}`.toLowerCase();
      const matchSearch = !search || searchTarget.includes(search.toLowerCase());
      return matchClass && matchDate && matchSearch;
    });
  }, [homeworkList, selectedClassId, selectedDate, search]);

  if (authLoading) {
    return (
      <main className="mx-auto max-w-7xl p-8 text-center text-sm text-slate-500">
        Loading Homework Diary...
      </main>
    );
  }

  if (!hasAccess) {
    return <AccessDenied moduleName="Daily Homework Diary" />;
  }

  return (
    <main className="mx-auto max-w-7xl p-5 sm:p-8">
      {/* Top Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Link
            href="/dashboard"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Daily Homework & Class Diary
          </h1>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            Broadcast daily assignments, reading tasks, and classwork directly to students and parents.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => {
              setError("");
              setSuccess("");
              setOpenModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-600/25 hover:bg-purple-700 transition active:scale-95"
          >
            <Plus size={16} />
            <span>Post New Homework</span>
          </button>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          {/* Class Filter */}
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-purple-600 focus:outline-none"
          >
            <option value="all">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Date Picker */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-purple-600 focus:outline-none"
          />

          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search topic or assignment details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-purple-600 focus:outline-none"
            />
          </div>
        </div>

        <span className="text-xs font-bold text-slate-400 whitespace-nowrap">
          {filteredList.length} assignments
        </span>
      </div>

      {/* Homework Cards Grid */}
      <div className="mt-6">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">Loading homework diary...</div>
        ) : filteredList.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <BookOpen size={32} className="mx-auto text-slate-300" />
            <h4 className="mt-3 text-sm font-bold text-slate-800">No homework posted for this date</h4>
            <p className="mt-1 text-xs text-slate-500">
              Teachers can click "Post New Homework" above to record classwork and homework.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredList.map((hw) => {
              const badgeClass = SUBJECT_COLORS[hw.subject] || "bg-purple-50 text-purple-700 border-purple-200";
              const isCopied = copiedId === hw.id;

              return (
                <div
                  key={hw.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md flex flex-col justify-between"
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-center justify-between">
                      <span className={`rounded-md border px-2.5 py-0.5 text-xs font-bold ${badgeClass}`}>
                        {hw.subject}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        {hw.class_name}
                      </span>
                    </div>

                    <h3 className="mt-3 text-base font-bold text-slate-900 leading-snug">
                      {hw.title}
                    </h3>

                    <p className="mt-2 text-xs text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
                      {hw.description}
                    </p>
                  </div>

                  {/* Card Meta & Action Footer */}
                  <div className="mt-5 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3 font-medium">
                      <span>Due: <strong className="text-slate-700">{hw.due_date || "Next Class"}</strong></span>
                      <span>By: <strong className="text-slate-700">{hw.teacher_name || "Faculty"}</strong></span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => copyForWhatsApp(hw)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                          isCopied
                            ? "bg-emerald-600 text-white"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                        }`}
                        title="Copy text formatted for WhatsApp groups"
                      >
                        {isCopied ? <Check size={13} /> : <Copy size={13} />}
                        <span>{isCopied ? "Copied!" : "WhatsApp Copy"}</span>
                      </button>

                      {canManage && (
                        <button
                          onClick={() => handleDelete(hw.id)}
                          className="rounded-xl p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                          title="Delete Homework"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* POST HOMEWORK MODAL */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setOpenModal(false)}
              className="absolute right-4 top-4 rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-purple-50 text-purple-600">
                <BookOpen size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Post Class Homework</h3>
                <p className="text-xs text-slate-500">Assign reading, tasks, or exercise to students.</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Class *
                  </label>
                  <select
                    value={form.class_id}
                    onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 focus:border-purple-600 focus:outline-none"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Subject *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mathematics, Science"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-800 focus:border-purple-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Topic / Headline *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chapter 4: Fractions - Exercise 4.2"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Detailed Homework Tasks / Instructions *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Write question numbers, page numbers, or instructions for students to complete at home..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs font-medium text-slate-800 focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-purple-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned By (Teacher)
                  </label>
                  <select
                    value={form.teacher_name}
                    onChange={(e) => setForm({ ...form, teacher_name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-purple-600 focus:outline-none"
                  >
                    <option value="">Select Teacher</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.full_name}>
                        {t.full_name}
                      </option>
                    ))}
                    <option value="Subject Faculty">Subject Faculty</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setOpenModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-purple-600/25 hover:bg-purple-700 transition disabled:opacity-50"
                >
                  {saving ? "Posting..." : "Post Homework"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
