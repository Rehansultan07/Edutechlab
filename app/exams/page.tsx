"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, X, ArrowLeft, ClipboardList, Save, Minus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUserAccess } from "@/lib/auth/permissions";
import AccessDenied from "@/components/auth/AccessDenied";

type Exam = { id: string; name: string; exam_date: string | null };
type Subject = { subject: string; max_marks: string; pass_percentage: string };
type Student = { id: string; first_name: string; last_name: string | null; admission_no: string };
type Row = {
  subject: string;
  marks: string;
  max_marks: number;
  pass_percentage: number;
  status: "marked" | "absent" | "fail" | "pass";
};

export default function Exams() {
  const supabase = createClient();
  const { loading: authLoading, orgId: org, hasAccess, can, isAdmin } = useUserAccess([
    "exams.view",
    "exams.manage",
    "results.manage",
  ]);

  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Record<string, Subject[]>>({});
  const [selected, setSelected] = useState<Exam | null>(null);
  const [rows, setRows] = useState<Record<string, Row[]>>({});
  const [modal, setModal] = useState<"exam" | "result" | null>(null);
  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [newSubjects, setNewSubjects] = useState<Subject[]>([
    { subject: "", max_marks: "100", pass_percentage: "30" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [resultSaved, setResultSaved] = useState(false);
  const [editing, setEditing] = useState(false);

  const canManageExams = can("exams.manage");
  const canManageResults = can("results.manage");

  const load = async () => {
    if (!org) return;
    const [er, sr, subr] = await Promise.all([
      supabase
        .from("exams")
        .select("id,name,exam_date")
        .eq("organization_id", org)
        .order("exam_date", { ascending: false }),
      supabase
        .from("students")
        .select("id,first_name,last_name,admission_no")
        .eq("organization_id", org)
        .eq("status", "active")
        .order("first_name"),
      supabase
        .from("exam_subjects")
        .select("exam_id,subject,max_marks,pass_percentage,sort_order")
        .eq("organization_id", org)
        .order("sort_order"),
    ]);

    setExams(er.data || []);
    setStudents(sr.data || []);
    const g: Record<string, Subject[]> = {};
    (subr.data || []).forEach((x: any) => {
      (g[x.exam_id] ||= []).push({
        subject: x.subject,
        max_marks: String(x.max_marks),
        pass_percentage: String(x.pass_percentage),
      });
    });
    setSubjects(g);
  };

  useEffect(() => {
    if (org && hasAccess) {
      load();
    }
  }, [org, hasAccess]);

  const createExam = async () => {
    if (!canManageExams) {
      setError("You do not have permission to create examinations.");
      return;
    }
    if (!examName.trim() || !examDate) return setError("Exam name and date are required.");
    const clean = newSubjects.filter((x) => x.subject.trim());
    if (!clean.length) return setError("Add at least one subject.");
    setSaving(true);
    setError("");

    try {
      const { data: e, error: ee } = await supabase
        .from("exams")
        .insert({ organization_id: org, name: examName.trim(), exam_date: examDate })
        .select("id,name,exam_date")
        .single();
      if (ee) throw ee;

      const { error: se } = await supabase.from("exam_subjects").insert(
        clean.map((x, i) => ({
          organization_id: org,
          exam_id: e.id,
          subject: x.subject.trim(),
          max_marks: Number(x.max_marks || 100),
          pass_percentage: Number(x.pass_percentage || 30),
          sort_order: i,
        }))
      );
      if (se) throw se;

      setModal(null);
      setExamName("");
      setExamDate("");
      setNewSubjects([{ subject: "", max_marks: "100", pass_percentage: "30" }]);
      await load();
    } catch (e: any) {
      setError(e.message || "Could not create exam.");
    } finally {
      setSaving(false);
    }
  };

  const startResult = async (exam: Exam) => {
    setSelected(exam);
    setModal(null);
    setError("");
    setEditing(false);
    setResultSaved(false);
    const ss = subjects[exam.id] || [];
    const { data } = await supabase
      .from("exam_marks")
      .select("student_id,subject,marks,max_marks,pass_percentage,status")
      .eq("organization_id", org)
      .eq("exam_id", exam.id);

    const map = new Map((data || []).map((x: any) => [x.student_id + "|" + x.subject, x]));
    setResultSaved((data || []).length > 0);
    const next: Record<string, Row[]> = {};
    students.forEach((st) => {
      next[st.id] = ss.map((s) => {
        const old: any = map.get(st.id + "|" + s.subject);
        return {
          subject: s.subject,
          marks: old?.marks == null ? "" : String(old.marks),
          max_marks: Number(s.max_marks),
          pass_percentage: Number(s.pass_percentage),
          status:
            old?.status === "absent" || old?.status === "fail" || old?.status === "pass"
              ? old.status
              : "marked",
        };
      });
    });
    setRows(next);
  };

  const updateRow = (sid: string, i: number, patch: Partial<Row>) => {
    if (!canManageResults) return;
    if (resultSaved && !editing) return;
    setRows((prev) => {
      const a = [...(prev[sid] || [])];
      a[i] = { ...a[i], ...patch };
      if (patch.marks !== undefined && patch.marks !== "") a[i].status = "marked";
      return { ...prev, [sid]: a };
    });
  };

  const saveResults = async () => {
    if (!canManageResults) {
      setError("You do not have permission to modify results.");
      return;
    }
    if (!selected) return;
    setSaving(true);
    setError("");

    try {
      for (const st of students) {
        const payload = (rows[st.id] || []).map((r) => ({
          organization_id: org,
          exam_id: selected.id,
          student_id: st.id,
          subject: r.subject,
          marks: r.marks === "" ? null : Number(r.marks),
          max_marks: r.max_marks,
          pass_percentage: r.pass_percentage,
          status: r.marks === "" ? r.status : "marked",
        }));
        if (payload.length) {
          const { error } = await supabase
            .from("exam_marks")
            .upsert(payload, { onConflict: "exam_id,student_id,subject" });
          if (error) throw error;
        }
      }
      setResultSaved(true);
      setEditing(false);
    } catch (e: any) {
      setError(e.message || "Could not save results.");
    } finally {
      setSaving(false);
    }
  };

  const deleteExam = async (id: string) => {
    if (!canManageExams) {
      setError("You do not have permission to delete exams.");
      return;
    }
    if (!confirm("Delete this exam and all results? This cannot be undone.")) return;
    const { error } = await supabase.from("exams").delete().eq("id", id);
    if (error) setError(error.message);
    else {
      setSelected(null);
      await load();
    }
  };

  if (authLoading) {
    return (
      <main className="mx-auto max-w-7xl p-8 text-center text-sm text-slate-500">
        Verifying permissions...
      </main>
    );
  }

  if (!hasAccess) {
    return <AccessDenied moduleName="Examinations & Results" />;
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

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-slate-500">Academic assessment</p>
          <h1 className="mt-1 text-3xl font-bold">Exams & Results</h1>
          <p className="mt-2 text-sm text-slate-500">
            Set the exam once, then create student results from that exam.
          </p>
        </div>
        <div className="flex gap-2">
          {canManageExams && (
            <button
              onClick={() => {
                setError("");
                setModal("exam");
              }}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              <Plus size={17} />
              Create Exam
            </button>
          )}
          {canManageResults && (
            <button
              onClick={() => {
                setError("");
                setModal("result");
              }}
              className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <ClipboardList size={17} />
              Create Result
            </button>
          )}
        </div>
      </div>

      {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="mt-7 rounded-2xl border bg-white shadow-sm">
        {exams.map((e) => (
          <div
            key={e.id}
            className="flex flex-col gap-3 border-b p-5 last:border-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h2 className="font-semibold text-slate-900">{e.name}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {e.exam_date} • {(subjects[e.id] || []).map((s) => s.subject).join(", ")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => startResult(e)}
                className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {resultSaved && selected?.id === e.id ? "View/Edit Result" : "View/Record Result"}
              </button>
              <button
                onClick={() => window.open(`/exams/${e.id}/marksheets`, "_blank")}
                className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Print All Marksheets
              </button>
              {canManageExams && (
                <button
                  onClick={() => deleteExam(e.id)}
                  className="rounded-xl border border-red-200 px-3 py-2 text-red-600 hover:bg-red-50"
                  title="Delete exam"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
        {!exams.length && (
          <div className="p-10 text-center text-sm text-slate-500">No exams created yet.</div>
        )}
      </div>

      {selected && (
        <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Examination Assessment
              </p>
              <h2 className="mt-1 text-xl font-bold">{selected.name}</h2>
              <p className="text-sm text-slate-500">
                {selected.exam_date} • {(subjects[selected.id] || []).map((s) => s.subject).join(" • ")}
              </p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="rounded-xl border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Close
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {students.map((st) => {
              const rs = rows[st.id] || [];
              const fail = rs.some((r) =>
                r.marks === ""
                  ? r.status === "fail" || r.status === "absent"
                  : Number(r.marks) < (r.max_marks * r.pass_percentage) / 100
              );
              return (
                <div key={st.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {st.first_name} {st.last_name || ""}
                      </div>
                      <div className="font-mono text-xs text-slate-400">{st.admission_no}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          "text-sm font-bold " + (fail ? "text-red-700" : "text-emerald-700")
                        }
                      >
                        {fail ? "FAIL" : "PASS"}
                      </span>
                      <button
                        onClick={() => window.open(`/exams/${selected.id}/${st.id}`, "_blank")}
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        View Marksheet
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-xl border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left">
                          <th className="p-3">Subject</th>
                          <th className="p-3">Maximum</th>
                          <th className="p-3">Obtained Marks</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rs.map((r, i) => {
                          const below =
                            r.marks !== "" &&
                            Number(r.marks) < (r.max_marks * r.pass_percentage) / 100;
                          return (
                            <tr key={r.subject} className="border-t">
                              <td className="p-3 font-semibold">{r.subject}</td>
                              <td className="p-3">
                                {r.max_marks}
                                <span className="ml-1 text-[10px] text-slate-400">
                                  pass {r.pass_percentage}%
                                </span>
                              </td>
                              <td className="p-3">
                                <input
                                  readOnly={!canManageResults || (resultSaved && !editing)}
                                  disabled={!canManageResults || (resultSaved && !editing)}
                                  type="number"
                                  min="0"
                                  max={r.max_marks}
                                  value={r.marks}
                                  onChange={(e) => updateRow(st.id, i, { marks: e.target.value })}
                                  className={
                                    "w-full rounded-lg border px-3 py-2 text-sm " +
                                    (resultSaved && !editing
                                      ? "bg-slate-50 text-slate-500"
                                      : "bg-white")
                                  }
                                  placeholder="Enter marks"
                                />
                              </td>
                              <td className="p-3">
                                {r.marks === "" ? (
                                  <select
                                    disabled={!canManageResults || (resultSaved && !editing)}
                                    value={r.status === "marked" ? "absent" : r.status}
                                    onChange={(e) =>
                                      updateRow(st.id, i, { status: e.target.value as Row["status"] })
                                    }
                                    className="rounded-lg border px-3 py-2 text-sm"
                                  >
                                    <option value="absent">Absent</option>
                                    <option value="fail">Fail</option>
                                    <option value="pass">Pass</option>
                                  </select>
                                ) : (
                                  <span
                                    className={
                                      "text-xs font-semibold " +
                                      (below ? "text-red-700" : "text-emerald-700")
                                    }
                                  >
                                    {below ? `FAIL — below ${r.pass_percentage}%` : "PASS"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          {canManageResults && (
            <div className="mt-5">
              {resultSaved && !editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-xl border bg-white px-5 py-3 text-sm font-semibold hover:bg-slate-50"
                >
                  Edit Results
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    disabled={saving}
                    onClick={saveResults}
                    className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Save size={16} />
                    {saving ? "Saving…" : resultSaved ? "Save Changes" : "Save All Results"}
                  </button>
                  {resultSaved && editing && !saving && (
                    <button
                      onClick={() => startResult(selected)}
                      className="rounded-xl border bg-white px-5 py-3 text-sm font-semibold hover:bg-slate-50"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {modal === "exam" && canManageExams && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex justify-between">
              <div>
                <h2 className="text-xl font-bold">Create Exam</h2>
                <p className="text-sm text-slate-500">
                  Enter exam name, date, subjects, maximum marks and pass percentage.
                </p>
              </div>
              <button onClick={() => setModal(null)}>
                <X />
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <input
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="Exam name"
                className="rounded-xl border px-3 py-2.5 text-sm"
              />
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="rounded-xl border px-3 py-2.5 text-sm"
              />
            </div>
            <div className="mt-6 flex justify-between">
              <h3 className="font-semibold text-slate-900">Subjects</h3>
              <button
                onClick={() =>
                  setNewSubjects([
                    ...newSubjects,
                    { subject: "", max_marks: "100", pass_percentage: "30" },
                  ])
                }
                className="rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-slate-50"
              >
                + Add Subject
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {newSubjects.map((r, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_110px_110px_40px]">
                  <input
                    value={r.subject}
                    onChange={(e) => {
                      const a = [...newSubjects];
                      a[i] = { ...a[i], subject: e.target.value };
                      setNewSubjects(a);
                    }}
                    placeholder="Subject"
                    className="rounded-lg border px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    value={r.max_marks}
                    onChange={(e) => {
                      const a = [...newSubjects];
                      a[i] = { ...a[i], max_marks: e.target.value };
                      setNewSubjects(a);
                    }}
                    placeholder="Max marks"
                    className="rounded-lg border px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    value={r.pass_percentage}
                    onChange={(e) => {
                      const a = [...newSubjects];
                      a[i] = { ...a[i], pass_percentage: e.target.value };
                      setNewSubjects(a);
                    }}
                    placeholder="Pass %"
                    className="rounded-lg border px-3 py-2 text-sm"
                  />
                  <button
                    disabled={newSubjects.length === 1}
                    onClick={() => setNewSubjects(newSubjects.filter((_, j) => j !== i))}
                    className="rounded-lg border hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Minus size={16} className="mx-auto" />
                  </button>
                </div>
              ))}
            </div>
            <button
              disabled={saving}
              onClick={createExam}
              className="mt-6 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create Exam"}
            </button>
          </div>
        </div>
      )}

      {modal === "result" && canManageResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex justify-between">
              <div>
                <h2 className="text-xl font-bold">Create Result</h2>
                <p className="text-sm text-slate-500">
                  Select the exam. Its date and subjects load automatically.
                </p>
              </div>
              <button onClick={() => setModal(null)}>
                <X />
              </button>
            </div>
            <div className="mt-5 space-y-2">
              {exams.map((e) => (
                <button
                  key={e.id}
                  onClick={() => startResult(e)}
                  className="flex w-full items-center justify-between rounded-xl border p-4 text-left transition hover:bg-slate-50"
                >
                  <span>
                    <span className="block font-semibold">{e.name}</span>
                    <span className="text-xs text-slate-500">
                      {e.exam_date} • {(subjects[e.id] || []).length} subjects
                    </span>
                  </span>
                  <ClipboardList size={18} className="text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}