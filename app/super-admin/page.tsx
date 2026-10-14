"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Building2,
  Users,
  GraduationCap,
  Wallet,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  ArrowLeft,
  RefreshCw,
  Power,
  Settings,
  AlertTriangle,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type PlatformStats = {
  total_institutions: number;
  active_institutions: number;
  suspended_institutions: number;
  total_students: number;
  total_teachers: number;
  total_fee_volume: number;
};

type InstitutionItem = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  status: string;
  plan: string;
  created_at: string;
  student_count: number;
  teacher_count: number;
  owner_name: string | null;
  owner_login_id: string | null;
};

export default function SuperAdminPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [institutions, setInstitutions] = useState<InstitutionItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const checkAndLoad = async () => {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      // Check if user is in platform_admins or is owner
      const [{ data: isSuper }, { data: adminRecord }, { data: pRecord }] = await Promise.all([
        supabase.rpc("is_platform_admin"),
        supabase.from("platform_admins").select("role").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      ]);

      const isAllowed = isSuper === true || !!adminRecord || pRecord?.role === "owner";

      if (!isAllowed) {
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      setIsSuperAdmin(true);

      // Load stats and institutions via secure RPCs
      const [statsRes, listRes] = await Promise.all([
        supabase.rpc("get_platform_overview"),
        supabase.rpc("list_institutions_for_platform"),
      ]);

      if (statsRes.error) {
        // Fallback calculation if RPC is not yet executed on backend
        const [orgs, stus, tchs, fees] = await Promise.all([
          supabase.from("organizations").select("id, name, slug, created_at"),
          supabase.from("students").select("id", { count: "exact", head: true }),
          supabase.from("teachers").select("id", { count: "exact", head: true }),
          supabase.from("fee_payments").select("amount"),
        ]);

        const totalFees = (fees.data || []).reduce((sum, f) => sum + Number(f.amount || 0), 0);
        setStats({
          total_institutions: orgs.data?.length || 0,
          active_institutions: orgs.data?.length || 0,
          suspended_institutions: 0,
          total_students: stus.count || 0,
          total_teachers: tchs.count || 0,
          total_fee_volume: totalFees,
        });

        if (orgs.data) {
          setInstitutions(
            orgs.data.map((o) => ({
              id: o.id,
              name: o.name,
              slug: o.slug,
              is_active: true,
              status: "active",
              plan: "standard",
              created_at: o.created_at,
              student_count: 0,
              teacher_count: 0,
              owner_name: null,
              owner_login_id: null,
            }))
          );
        }
      } else {
        setStats(statsRes.data as PlatformStats);
        setInstitutions((listRes.data as InstitutionItem[]) || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load platform administration dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAndLoad();
  }, []);

  const handleToggleStatus = async (inst: InstitutionItem) => {
    const newIsActive = !inst.is_active;
    const newStatus = newIsActive ? "active" : "suspended";
    const actionWord = newIsActive ? "activate" : "suspend";

    if (!confirm(`Are you sure you want to ${actionWord} "${inst.name}"?`)) {
      return;
    }

    setBusyId(inst.id);
    setError("");
    setSuccess("");

    try {
      const { error: err } = await supabase.rpc("update_institution_lifecycle", {
        p_org_id: inst.id,
        p_status: newStatus,
        p_is_active: newIsActive,
      });

      if (err) {
        // Fallback to direct table update if RPC not present
        const { error: fallbackErr } = await supabase
          .from("organizations")
          .update({ is_active: newIsActive, status: newStatus })
          .eq("id", inst.id);
        if (fallbackErr) throw fallbackErr;
      }

      setSuccess(`Institution "${inst.name}" has been ${actionWord}d.`);
      await checkAndLoad();
    } catch (err: any) {
      setError(err.message || `Failed to ${actionWord} institution.`);
    } finally {
      setBusyId(null);
    }
  };

  const filteredInstitutions = institutions.filter((inst) => {
    const q = searchQuery.toLowerCase();
    return (
      inst.name.toLowerCase().includes(q) ||
      inst.slug.toLowerCase().includes(q) ||
      (inst.owner_login_id && inst.owner_login_id.toLowerCase().includes(q)) ||
      (inst.owner_name && inst.owner_name.toLowerCase().includes(q))
    );
  });

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl p-8 text-center text-sm text-slate-500">
        Verifying platform owner credentials...
      </main>
    );
  }

  if (!isSuperAdmin) {
    return (
      <main className="mx-auto max-w-xl p-8 text-center">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8">
          <ShieldAlert size={48} className="mx-auto text-red-500" />
          <h1 className="mt-4 text-2xl font-bold text-red-900">Platform Access Restricted</h1>
          <p className="mt-2 text-sm leading-6 text-red-700">
            This area is restricted to EduTechLab platform super administrators. Your account does
            not have platform owner privileges.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/super-admin/login"
              className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-purple-500"
            >
              Sign In to Super Admin Console
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Return to Institute Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl p-5 sm:p-8">
      {/* Top Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700">
                Super Admin
              </span>
              <p className="text-xs text-slate-400">EduTechLab Platform Management</p>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Platform Overview
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={checkAndLoad}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw size={15} />
            Refresh Data
          </button>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/super-admin/login";
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50"
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Metric Cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-sm font-medium">Institutions</span>
              <Building2 size={18} className="text-purple-600" />
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">{stats.total_institutions}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-emerald-600">{stats.active_institutions} active</span>
              <span>·</span>
              <span className="text-amber-600">{stats.suspended_institutions} suspended</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-sm font-medium">Total Students</span>
              <Users size={18} className="text-blue-600" />
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">{stats.total_students}</p>
            <p className="mt-2 text-xs text-slate-500">Enrolled across all institutions</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-sm font-medium">Teachers & Staff</span>
              <GraduationCap size={18} className="text-indigo-600" />
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">{stats.total_teachers}</p>
            <p className="mt-2 text-xs text-slate-500">Active educators & personnel</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-sm font-medium">Platform Fee Volume</span>
              <Wallet size={18} className="text-emerald-600" />
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {stats.total_fee_volume.toLocaleString("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0,
              })}
            </p>
            <p className="mt-2 text-xs text-slate-500">Recorded fee transactions</p>
          </div>
        </div>
      )}

      {/* Institutions Table */}
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Registered Institutions</h2>
            <p className="text-xs text-slate-500">
              Manage institution status, lifecycle activation, and account health.
            </p>
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, slug or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2 text-xs outline-none focus:border-slate-900 sm:w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Institution</th>
                <th className="px-5 py-3.5">Admin / Login ID</th>
                <th className="px-5 py-3.5">Students</th>
                <th className="px-5 py-3.5">Teachers</th>
                <th className="px-5 py-3.5">Plan</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Registered</th>
                <th className="px-5 py-3.5 text-right">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInstitutions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-sm text-slate-500">
                    No institutions match your search query.
                  </td>
                </tr>
              ) : (
                filteredInstitutions.map((inst) => (
                  <tr key={inst.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">{inst.name}</div>
                      <div className="text-xs text-slate-400 font-mono">/{inst.slug}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-xs font-medium text-slate-800">
                        {inst.owner_name || "—"}
                      </div>
                      <div className="font-mono text-xs text-indigo-600">
                        {inst.owner_login_id || "—"}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-700 font-medium">
                      {inst.student_count}
                    </td>
                    <td className="px-5 py-4 text-slate-700 font-medium">
                      {inst.teacher_count}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase text-slate-600">
                        {inst.plan || "standard"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {inst.is_active && inst.status === "active" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 size={12} />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                          <XCircle size={12} />
                          Suspended
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {new Date(inst.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleToggleStatus(inst)}
                        disabled={busyId === inst.id}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                          inst.is_active
                            ? "border-red-200 text-red-600 hover:bg-red-50"
                            : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                        } disabled:opacity-50`}
                      >
                        <Power size={13} />
                        {busyId === inst.id
                          ? "Updating..."
                          : inst.is_active
                          ? "Suspend"
                          : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
