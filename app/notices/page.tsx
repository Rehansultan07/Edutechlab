"use client";

import { useEffect, useState } from "react";
import { Plus, Bell, Trash2, X, ArrowLeft, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUserAccess } from "@/lib/auth/permissions";
import AccessDenied from "@/components/auth/AccessDenied";

type N = { id: string; title: string; body: string; published_at: string | null };

export default function Notices() {
  const s = createClient();
  const { loading: authLoading, orgId: org, hasAccess, can, isAdmin } = useUserAccess([
    "notices.manage",
  ]);

  const [rows, setRows] = useState<N[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<N | null>(null);
  const [form, setForm] = useState({ title: "", body: "" });
  const [error, setError] = useState("");

  const canManage = can("notices.manage");

  const load = async () => {
    if (!org) return;
    const { data, error } = await s
      .from("notices")
      .select("id,title,body,published_at")
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
      setError("You do not have permission to publish or edit notices.");
      return;
    }
    setError("");
    if (!form.title.trim() || !form.body.trim()) {
      setError("Title and message are required.");
      return;
    }
    const payload = { title: form.title.trim(), body: form.body.trim() };
    const r = edit
      ? await s.from("notices").update(payload).eq("id", edit.id)
      : await s.from("notices").insert({ ...payload, organization_id: org });

    if (r.error) setError(r.error.message);
    else {
      setOpen(false);
      setEdit(null);
      setForm({ title: "", body: "" });
      load();
    }
  };

  const del = async (id: string) => {
    if (!canManage) {
      setError("You do not have permission to delete notices.");
      return;
    }
    if (!confirm("Delete this notice announcement?")) return;
    const r = await s.from("notices").delete().eq("id", id);
    if (r.error) setError(r.error.message);
    else load();
  };

  const startEdit = (n: N) => {
    setEdit(n);
    setForm({ title: n.title, body: n.body });
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
    return <AccessDenied moduleName="Notices & Announcements" />;
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
          <p className="text-sm text-slate-500">Communication</p>
          <h1 className="mt-1 text-3xl font-bold">Notices</h1>
          <p className="mt-2 text-sm text-slate-500">Create, edit and manage institute announcements.</p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setEdit(null);
              setForm({ title: "", body: "" });
              setOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <Plus size={17} />
            Create notice
          </button>
        )}
      </div>

      {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="mt-7 rounded-2xl border bg-white shadow-sm">
        {rows.map((n) => (
          <div key={n.id} className="flex gap-4 border-b p-5 last:border-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Bell size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-slate-900">{n.title}</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 leading-relaxed">{n.body}</p>
              <p className="mt-2 text-xs text-slate-400">
                {n.published_at ? new Date(n.published_at).toLocaleString("en-IN") : "Draft"}
              </p>
            </div>
            {canManage && (
              <div className="flex gap-3">
                <button
                  onClick={() => startEdit(n)}
                  className="text-slate-600 hover:text-slate-900"
                  title="Edit notice"
                >
                  <Pencil size={17} />
                </button>
                <button
                  onClick={() => del(n.id)}
                  className="text-red-600 hover:text-red-800"
                  title="Delete notice"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            )}
          </div>
        ))}
        {!rows.length && (
          <div className="p-10 text-center text-sm text-slate-500">No notices published yet.</div>
        )}
      </div>

      {open && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex justify-between">
              <h2 className="text-xl font-bold">{edit ? "Edit notice" : "Create notice"}</h2>
              <button onClick={() => setOpen(false)}>
                <X />
              </button>
            </div>
            <div className="mt-5 space-y-3">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Notice title"
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              />
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Write the announcement..."
                rows={5}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              />
            </div>
            <button
              onClick={save}
              className="mt-5 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              {edit ? "Update notice" : "Publish notice"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}