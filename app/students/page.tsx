"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2, X, Pencil, ArrowLeft, Upload, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUserAccess } from "@/lib/auth/permissions";
import AccessDenied from "@/components/auth/AccessDenied";

type Student = {
  id: string;
  admission_no: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  class_id?: string | null;
  section_id?: string | null;
  father_name: string | null;
  mother_name: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  aadhaar_number: string | null;
  photo_url: string | null;
  aadhaar_document_url: string | null;
  birth_certificate_url: string | null;
  address: string | null;
  date_of_birth: string | null;
  gender: string | null;
};

type ClassItem = { id: string; name: string };
type SectionItem = { id: string; class_id: string; name: string };

export default function Students() {
  const s = createClient();
  const { loading: authLoading, orgId: org, hasAccess, can, isAdmin } = useUserAccess([
    "students.view",
    "students.manage",
    "admissions.manage",
  ]);

  const [rows, setRows] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<{ photo: File | null; aadhaar: File | null; birth: File | null }>({
    photo: null,
    aadhaar: null,
    birth: null,
  });

  const [form, setForm] = useState({
    admission_no: "",
    first_name: "",
    last_name: "",
    class_id: "",
    section_id: "",
    phone: "",
    email: "",
    status: "active",
    father_name: "",
    mother_name: "",
    guardian_name: "",
    guardian_phone: "",
    aadhaar_number: "",
    photo_url: "",
    aadhaar_document_url: "",
    birth_certificate_url: "",
    address: "",
    date_of_birth: "",
    gender: "",
  });

  const canManage = can("students.manage") || can("admissions.manage");

  const load = async () => {
    if (!org) return;
    const [stRes, clRes, secRes] = await Promise.all([
      s
        .from("students")
        .select(
          "id,admission_no,first_name,last_name,class_id,section_id,phone,email,status,father_name,mother_name,guardian_name,guardian_phone,aadhaar_number,photo_url,aadhaar_document_url,birth_certificate_url,address,date_of_birth,gender"
        )
        .eq("organization_id", org)
        .order("created_at", { ascending: false }),
      s.from("classes").select("id,name").eq("organization_id", org).order("sort_order"),
      s.from("sections").select("id,class_id,name").eq("organization_id", org),
    ]);

    if (stRes.error) setError(stRes.error.message);
    else setRows(stRes.data || []);
    setClasses(clRes.data || []);
    setSections(secRes.data || []);
  };

  useEffect(() => {
    if (org && hasAccess) {
      load();
    }
  }, [org, hasAccess]);

  const classMap = useMemo(() => Object.fromEntries(classes.map((c) => [c.id, c.name])), [classes]);
  const sectionMap = useMemo(() => Object.fromEntries(sections.map((s) => [s.id, s.name])), [sections]);

  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        (r.first_name + " " + (r.last_name || "") + " " + r.admission_no)
          .toLowerCase()
          .includes(q.toLowerCase())
      ),
    [rows, q]
  );

  const reset = () => {
    setForm({
      admission_no: "",
      first_name: "",
      last_name: "",
      class_id: "",
      section_id: "",
      phone: "",
      email: "",
      status: "active",
      father_name: "",
      mother_name: "",
      guardian_name: "",
      guardian_phone: "",
      aadhaar_number: "",
      photo_url: "",
      aadhaar_document_url: "",
      birth_certificate_url: "",
      address: "",
      date_of_birth: "",
      gender: "",
    });
    setFiles({ photo: null, aadhaar: null, birth: null });
    setEditing(null);
    setOpen(false);
    setError("");
  };

  const upload = async (file: File, kind: string) => {
    if (file.size > 5 * 1024 * 1024) throw new Error("Each document must be under 5 MB.");
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${org}/students/${Date.now()}-${kind}.${ext}`;
    const r = await s.storage.from("institution-assets").upload(path, file, {
      upsert: false,
      contentType: file.type,
    });
    if (r.error) throw new Error(r.error.message);
    return path;
  };

  const save = async () => {
    if (!canManage) {
      setError("You do not have permission to add or modify student records.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      let photo = form.photo_url;
      let aadhaar = form.aadhaar_document_url;
      let birth = form.birth_certificate_url;
      if (files.photo) photo = await upload(files.photo, "photo");
      if (files.aadhaar) aadhaar = await upload(files.aadhaar, "aadhaar");
      if (files.birth) birth = await upload(files.birth, "birth-certificate");

      const payload = {
        organization_id: org,
        ...form,
        class_id: form.class_id || null,
        section_id: form.section_id || null,
        last_name: form.last_name || null,
        phone: form.phone || null,
        email: form.email || null,
        father_name: form.father_name || null,
        mother_name: form.mother_name || null,
        guardian_name: form.guardian_name || null,
        guardian_phone: form.guardian_phone || null,
        aadhaar_number: form.aadhaar_number || null,
        photo_url: photo || null,
        aadhaar_document_url: aadhaar || null,
        birth_certificate_url: birth || null,
        address: form.address || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
      };

      const r = editing
        ? await s.from("students").update(payload).eq("id", editing.id)
        : await s.from("students").insert(payload);

      if (r.error) throw new Error(r.error.message);
      reset();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save student");
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: string) => {
    if (!canManage) {
      setError("You do not have permission to delete student records.");
      return;
    }
    if (
      !confirm(
        "WARNING: Deleting this student will remove their profile and unbind linked records. Are you sure you want to proceed?"
      )
    )
      return;

    const { error } = await s.from("students").delete().eq("id", id);
    if (error) setError(error.message);
    else await load();
  };

  const editRow = (r: Student) => {
    setEditing(r);
    setForm({
      admission_no: r.admission_no,
      first_name: r.first_name,
      last_name: r.last_name || "",
      class_id: r.class_id || "",
      section_id: r.section_id || "",
      phone: r.phone || "",
      email: r.email || "",
      status: r.status,
      father_name: r.father_name || "",
      mother_name: r.mother_name || "",
      guardian_name: r.guardian_name || "",
      guardian_phone: r.guardian_phone || "",
      aadhaar_number: r.aadhaar_number || "",
      photo_url: r.photo_url || "",
      aadhaar_document_url: r.aadhaar_document_url || "",
      birth_certificate_url: r.birth_certificate_url || "",
      address: r.address || "",
      date_of_birth: r.date_of_birth || "",
      gender: r.gender || "",
    });
    setFiles({ photo: null, aadhaar: null, birth: null });
    setOpen(true);
  };

  if (authLoading) {
    return (
      <main className="mx-auto max-w-7xl p-8 text-center text-sm text-slate-500">
        Verifying permissions...
      </main>
    );
  }

  if (!hasAccess) {
    return <AccessDenied moduleName="Student Management" />;
  }

  const availableSections = sections.filter((sec) => !form.class_id || sec.class_id === form.class_id);

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
          <p className="text-sm text-slate-500">Administration</p>
          <h1 className="mt-1 text-3xl font-bold">Students</h1>
          <p className="mt-2 text-sm text-slate-500">
            Complete admission records with class, section, parent details and documents.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setEditing(null);
              setFiles({ photo: null, aadhaar: null, birth: null });
              setOpen(true);
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <Plus size={17} />
            Add student
          </button>
        )}
      </div>

      <div className="mt-7 flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 shadow-sm">
        <Search size={18} className="text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or admission number"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="mt-5 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-4 font-semibold text-slate-900">
          Student directory{" "}
          <span className="ml-2 text-xs font-normal text-slate-400">{filtered.length} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-3">Admission</th>
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3">Class</th>
                <th className="px-5 py-3">Parent</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Status</th>
                {canManage && <th className="px-5 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-5 py-4 font-medium">{r.admission_no}</td>
                  <td className="px-5 py-4">
                    {r.first_name} {r.last_name || ""}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {classMap[r.class_id || ""] || "—"}
                    {r.section_id && sectionMap[r.section_id] ? ` (${sectionMap[r.section_id]})` : ""}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {r.father_name || r.mother_name || r.guardian_name || "—"}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{r.phone || "—"}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        r.status === "active"
                          ? "bg-green-50 text-green-700"
                          : r.status === "inactive"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => editRow(r)}
                        className="mr-3 text-slate-600 hover:text-slate-900"
                        title="Edit student"
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        onClick={() => del(r.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete student"
                      >
                        <Trash2 size={17} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="p-10 text-center text-sm text-slate-500">
              No students found. {canManage ? "Add the first student." : ""}
            </div>
          )}
        </div>
      </div>

      {open && canManage && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4">
          <div className="mx-auto my-6 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex justify-between">
              <div>
                <h2 className="text-xl font-bold">{editing ? "Edit" : "Add"} student</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Fill in academic details, contact information, and upload identity documents.
                </p>
              </div>
              <button onClick={reset}>
                <X />
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Admission No. *
                <input
                  required
                  value={form.admission_no}
                  onChange={(e) => setForm({ ...form, admission_no: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  placeholder="e.g. ADM-2026-001"
                />
              </label>
              <label className="text-sm font-medium">
                First Name *
                <input
                  required
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  placeholder="First name"
                />
              </label>
              <label className="text-sm font-medium">
                Last Name
                <input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  placeholder="Last name"
                />
              </label>
              <label className="text-sm font-medium">
                Class
                <select
                  value={form.class_id}
                  onChange={(e) => setForm({ ...form, class_id: e.target.value, section_id: "" })}
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                >
                  <option value="">Select class (optional)</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Section
                <select
                  value={form.section_id}
                  onChange={(e) => setForm({ ...form, section_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                >
                  <option value="">Select section (optional)</option>
                  {availableSections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Date of Birth
                <input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                />
              </label>
              <label className="text-sm font-medium">
                Gender
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Status
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="alumni">Alumni</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Phone
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  placeholder="Student or parent phone"
                />
              </label>
              <label className="text-sm font-medium">
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  placeholder="Email address"
                />
              </label>
              <label className="text-sm font-medium">
                Father Name
                <input
                  value={form.father_name}
                  onChange={(e) => setForm({ ...form, father_name: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                />
              </label>
              <label className="text-sm font-medium">
                Mother Name
                <input
                  value={form.mother_name}
                  onChange={(e) => setForm({ ...form, mother_name: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                />
              </label>
              <label className="text-sm font-medium">
                Guardian Name
                <input
                  value={form.guardian_name}
                  onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                />
              </label>
              <label className="text-sm font-medium">
                Guardian Phone
                <input
                  value={form.guardian_phone}
                  onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                />
              </label>
              <label className="text-sm font-medium">
                Aadhaar Number
                <input
                  value={form.aadhaar_number}
                  onChange={(e) => setForm({ ...form, aadhaar_number: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  placeholder="12-digit Aadhaar number"
                />
              </label>
              <label className="text-sm font-medium sm:col-span-2">
                Full Address
                <textarea
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ["photo", "Student photo"],
                ["aadhaar", "Aadhaar document"],
                ["birth", "Birth certificate"],
              ].map(([k, l]) => (
                <label
                  key={k}
                  className="cursor-pointer rounded-xl border border-dashed p-4 text-sm transition hover:bg-slate-50"
                >
                  <Upload size={18} className="mb-2 text-slate-500" />
                  <span className="font-medium text-slate-800">{l}</span>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {files[k as keyof typeof files]?.name || "Choose file"}
                  </p>
                  <input
                    type="file"
                    accept={k === "photo" ? "image/*" : ".pdf,image/*"}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setFiles({ ...files, [k]: f });
                    }}
                  />
                </label>
              ))}
            </div>

            <button
              disabled={saving}
              onClick={save}
              className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save student"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}