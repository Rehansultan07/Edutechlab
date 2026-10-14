"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2, X, Pencil, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUserAccess } from "@/lib/auth/permissions";
import AccessDenied from "@/components/auth/AccessDenied";

type Teacher = { id: string; full_name: string; phone: string | null; email: string | null };

export default function Teachers() {
  const s = createClient();
  const { loading: authLoading, orgId: org, hasAccess, can, isAdmin } = useUserAccess([
    "teachers.view",
    "teachers.manage",
  ]);

  const [rows, setRows] = useState<Teacher[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Teacher | null>(null);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "" });
  const [error, setError] = useState("");

  const canManage = can("teachers.manage");

  const load = async () => {
    if (!org) return;
    const { data, error } = await s
      .from("teachers")
      .select("id,full_name,phone,email")
      .eq("organization_id", org)
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    else setRows(data || []);
  };

  useEffect(() => {
    if (org && hasAccess) {
      load();
    }
  }, [org, hasAccess]);

  const save = async () => {
    if (!canManage) {
      setError("You do not have permission to add or modify teachers.");
      return;
    }
    setError("");
    const payload = {
      organization_id: org,
      full_name: form.full_name.trim(),
      phone: form.phone ? form.phone.trim() : null,
      email: form.email ? form.email.trim().toLowerCase() : null,
    };
    if (!payload.full_name) {
      setError("Teacher name is required.");
      return;
    }

    const r = edit
      ? await s.from("teachers").update(payload).eq("id", edit.id)
      : await s.from("teachers").insert(payload);

    if (r.error) setError(r.error.message);
    else {
      setOpen(false);
      setEdit(null);
      setForm({ full_name: "", phone: "", email: "" });
      load();
    }
  };

  const del = async (id: string) => {
    if (!canManage) {
      setError("You do not have permission to delete teachers.");
      return;
    }
    if (!confirm("Are you sure you want to delete this teacher record?")) return;
    const r = await s.from("teachers").delete().eq("id", id);
    if (r.error) setError(r.error.message);
    else load();
  };

  const data = useMemo(
    () =>
      rows.filter((r) =>
        (r.full_name + " " + (r.phone || "") + " " + (r.email || ""))
          .toLowerCase()
          .includes(q.toLowerCase())
      ),
    [rows, q]
  );

  if (authLoading) {
    return (
      <main className="mx-auto max-w-7xl p-8 text-center text-sm text-slate-500">
        Verifying permissions...
      </main>
    );
  }

  if (!hasAccess) {
    return <AccessDenied moduleName="Teacher Management" />;
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

      <div className="flex justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Staff management</p>
          <h1 className="mt-1 text-3xl font-bold">Teachers</h1>
          <p className="mt-2 text-sm text-slate-500">Live teaching staff records.</p>
        </div>
        {canManage && (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <Plus size={17} />
            Add teacher
          </button>
        )}
      </div>

      <div className="mt-7 flex items-center gap-2 rounded-xl border bg-white px-3 py-2 shadow-sm">
        <Search size={17} className="text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search teachers..."
          className="w-full text-sm outline-none"
        />
      </div>

      {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="mt-5 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3">Teacher</th>
              <th className="px-5 py-3">Phone</th>
              <th className="px-5 py-3">Email</th>
              {canManage && <th className="px-5 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr className="border-t" key={r.id}>
                <td className="px-5 py-4 font-medium">{r.full_name}</td>
                <td className="px-5 py-4 text-slate-600">{r.phone || "—"}</td>
                <td className="px-5 py-4 text-slate-600">{r.email || "—"}</td>
                {canManage && (
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => {
                        setEdit(r);
                        setForm({ full_name: r.full_name, phone: r.phone || "", email: r.email || "" });
                        setOpen(true);
                      }}
                      className="mr-3 text-slate-600 hover:text-slate-900"
                      title="Edit teacher"
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      onClick={() => del(r.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete teacher"
                    >
                      <Trash2 size={17} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!data.length && (
          <div className="p-10 text-center text-sm text-slate-500">
            No teachers found. {canManage ? "Add the first teacher." : ""}
          </div>
        )}
      </div>

      {open && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex justify-between">
              <h2 className="text-xl font-bold">{edit ? "Edit" : "Add"} teacher</h2>
              <button onClick={() => setOpen(false)}>
                <X />
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {[
                ["full_name", "Full name"],
                ["phone", "Phone"],
                ["email", "Email"],
              ].map(([k, l]) => (
                <label key={k} className="block text-sm font-medium">
                  {l}
                  <input
                    value={form[k as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  />
                </label>
              ))}
            </div>
            <button
              onClick={save}
              className="mt-5 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              Save teacher
            </button>
          </div>
        </div>
      )}
    </main>
  );
}