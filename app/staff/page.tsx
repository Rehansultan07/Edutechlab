"use client";

import FeatureGate from "@/components/FeatureGate";
import { fetchInstitutionFeatures } from "@/lib/features";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  ShieldCheck,
  Power,
  Trash2,
  X,
  Search,
  Copy,
  Check,
  MessageCircle,
  Eye,
  EyeOff,
  Sparkles,
  Users,
  CheckCircle2,
  AlertCircle,
  Lock,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Send,
  HelpCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AccessDenied from "@/components/auth/AccessDenied";
import {
  ALL_SYSTEM_PERMISSIONS,
  STAFF_ROLE_PRESETS,
  SystemPermissionDefinition,
  RolePreset,
} from "@/lib/auth/permissions";
import {
  createWhatsAppUrl,
  formatStaffCredentialsMessage,
  formatStaffReminderMessage,
} from "@/lib/whatsapp";

type Staff = {
  id: string;
  full_name: string;
  role: string;
  login_id: string | null;
  is_active: boolean;
  phone: string | null;
  created_at?: string;
};

type DbPermission = {
  id: string;
  code: string;
  name: string;
  module: string;
};

const formatRoleName = (r: string) =>
  r
    .split("_")
    .map((x) => (x[0] ? x[0].toUpperCase() + x.slice(1) : ""))
    .join(" ");

export default function StaffPage() {
  const supabase = createClient();
  const [featureActive, setFeatureActive] = useState(true);
  const [orgId, setOrgId] = useState("");
  const [orgName, setOrgName] = useState("Your Institution");
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [dbPerms, setDbPerms] = useState<DbPermission[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");

  // Create Staff Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    role: "Teacher",
    preset: "teacher",
  });
  const [createPermIds, setCreatePermIds] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  // Success Created Modal
  const [createdResult, setCreatedResult] = useState<{
    staffName: string;
    role: string;
    loginId: string;
    email: string;
    password: string;
    phone: string;
    assignedCount: number;
  } | null>(null);

  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [isDenied, setIsDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load staff & permissions
  const loadData = async () => {
    setError("");
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: p, error: pe } = await supabase
      .from("profiles")
      .select("organization_id, role, organizations(name)")
      .eq("id", user.id)
      .single();

    if (pe || !p) {
      setError("Could not load staff workspace.");
      setLoading(false);
      return;
    }

    if (!["owner", "admin"].includes(p.role)) {
      setIsDenied(true);
      setLoading(false);
      return;
    }

    setOrgId(p.organization_id);
    if ((p as any).organizations?.name) {
      setOrgName((p as any).organizations.name);
    }

    const feat = await fetchInstitutionFeatures(supabase, p.organization_id);
    if (feat && feat.staff === false) {
      setFeatureActive(false);
      setLoading(false);
      return;
    }

    // Try RPC to sync/fetch all permissions, fallback to direct select
    let permissionsData: DbPermission[] = [];
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("sync_system_permissions");
      if (!rpcErr && rpcData && rpcData.length > 0) {
        permissionsData = rpcData;
      }
    } catch {}

    if (permissionsData.length === 0) {
      const { data: directData } = await supabase
        .from("permissions")
        .select("id,code,name,module")
        .order("module")
        .order("name");
      permissionsData = directData || [];
    }

    setDbPerms(permissionsData);

    const { data: staffData, error: staffErr } = await supabase
      .from("profiles")
      .select("id,full_name,role,login_id,is_active,phone,created_at")
      .eq("organization_id", p.organization_id)
      .order("created_at", { ascending: false });

    if (staffErr) {
      setError(staffErr.message);
    } else {
      setStaffList(staffData || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map code to DbPermission
  const codeToDbPerm = useMemo(() => {
    const map = new Map<string, DbPermission>();
    for (const p of dbPerms) {
      map.set(p.code, p);
    }
    return map;
  }, [dbPerms]);

  // Grouped Permissions by Module
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, { definition: SystemPermissionDefinition; db?: DbPermission }[]> = {};

    ALL_SYSTEM_PERMISSIONS.forEach((item) => {
      const db = codeToDbPerm.get(item.code);
      if (!groups[item.module]) groups[item.module] = [];
      groups[item.module].push({ definition: item, db });
    });

    return groups;
  }, [codeToDbPerm]);

  // When opening Create Modal, pre-populate default password & teacher preset
  const handleOpenCreateModal = () => {
    const defaultPassword = `EduStaff@${Math.floor(1000 + Math.random() * 9000)}`;
    const teacherPreset = STAFF_ROLE_PRESETS.find((p) => p.id === "teacher");
    const initialPermIds: string[] = [];

    if (teacherPreset) {
      teacherPreset.permissions.forEach((code) => {
        const dbPerm = codeToDbPerm.get(code);
        if (dbPerm) initialPermIds.push(dbPerm.id);
      });
    }

    setCreateForm({
      fullName: "",
      email: "",
      phone: "",
      password: defaultPassword,
      role: "Teacher",
      preset: "teacher",
    });
    setCreatePermIds(initialPermIds);
    setCreateOpen(true);
    setError("");
  };

  // Change preset in Create Modal
  const handleApplyCreatePreset = (presetId: string) => {
    const preset = STAFF_ROLE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const ids: string[] = [];
    preset.permissions.forEach((code) => {
      const dbPerm = codeToDbPerm.get(code);
      if (dbPerm) ids.push(dbPerm.id);
    });

    setCreatePermIds(ids);
    setCreateForm((prev) => ({
      ...prev,
      role: preset.roleTitle,
      preset: presetId,
    }));
  };

  // Toggle permission in Create Modal
  const toggleCreatePerm = (permId: string) => {
    setCreatePermIds((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  // Submit Create Staff
  const handleCreateStaff = async () => {
    if (!createForm.fullName.trim() || !createForm.email.trim() || createForm.password.length < 8) {
      setError("Please fill in full name, valid email, and a password of at least 8 characters.");
      return;
    }

    setBusy(true);
    setError("");
    setSaved("");

    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("create-staff", {
        body: {
          fullName: createForm.fullName.trim(),
          email: createForm.email.trim().toLowerCase(),
          password: createForm.password,
          role: createForm.role.trim() || "teacher",
        },
      });

      if (invokeErr) {
        let msg = invokeErr.message || "Could not create staff account.";
        try {
          const body = await invokeErr.context?.json();
          if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }

      if (!data?.staffId) {
        throw new Error(data?.error || "Could not create staff account.");
      }

      const newStaffId = data.staffId;
      const newLoginId = data.loginId || "STAFF-ID";

      // 1. Save Phone Number if provided
      if (createForm.phone.trim()) {
        await supabase
          .from("profiles")
          .update({ phone: createForm.phone.trim() })
          .eq("id", newStaffId);
      }

      // 2. Assign Permissions immediately if any were selected
      if (createPermIds.length > 0) {
        await supabase.rpc("set_staff_permissions", {
          p_staff_id: newStaffId,
          p_permission_ids: createPermIds,
        });
      }

      // 3. Open Success Modal with complete credentials & WhatsApp button
      setCreatedResult({
        staffName: createForm.fullName.trim(),
        role: createForm.role.trim() || "Teacher",
        loginId: newLoginId,
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
        phone: createForm.phone.trim(),
        assignedCount: createPermIds.length,
      });

      setCreateOpen(false);
      await loadData();
    } catch (e: any) {
      setError(e.message || "Failed to create staff account.");
    } finally {
      setBusy(false);
    }
  };

  // Open Manage Permissions for Existing Staff
  const handleOpenPermissions = async (staff: Staff) => {
    setSelectedStaff(staff);
    setSelectedPresetId(null);
    setSaved("");
    setError("");

    try {
      const { data, error: e } = await supabase
        .from("staff_permissions")
        .select("permission_id")
        .eq("organization_id", orgId)
        .eq("staff_id", staff.id)
        .eq("enabled", true);

      if (e) throw e;
      setSelectedPermIds((data || []).map((x) => x.permission_id));
    } catch (err: any) {
      setError(err.message || "Could not load staff permissions.");
    }
  };

  // Apply Preset in Manage Modal
  const handleApplyPreset = (preset: RolePreset) => {
    setSelectedPresetId(preset.id);
    const ids: string[] = [];
    preset.permissions.forEach((code) => {
      const dbPerm = codeToDbPerm.get(code);
      if (dbPerm) ids.push(dbPerm.id);
    });
    setSelectedPermIds(ids);
  };

  // Toggle single permission in Manage Modal
  const handleTogglePerm = (permId: string) => {
    setSelectedPresetId(null);
    setSelectedPermIds((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  // Select All / Clear All
  const handleSelectAllPerms = () => {
    setSelectedPresetId(null);
    setSelectedPermIds(dbPerms.map((p) => p.id));
  };

  const handleClearAllPerms = () => {
    setSelectedPresetId(null);
    setSelectedPermIds([]);
  };

  // Save Permissions
  const handleSavePermissions = async () => {
    if (!selectedStaff) return;
    setBusy(true);
    setError("");

    try {
      const res = await supabase.rpc("set_staff_permissions", {
        p_staff_id: selectedStaff.id,
        p_permission_ids: selectedPermIds,
      });

      if (res.error) throw res.error;

      setSaved(`Permissions saved for ${selectedStaff.full_name} (${selectedPermIds.length} features enabled).`);
      setTimeout(() => setSaved(""), 5000);
      setSelectedStaff(null);
    } catch (e: any) {
      setError(e.message || "Could not save permissions.");
    } finally {
      setBusy(false);
    }
  };

  // Toggle Active / Disable Staff Login
  const handleToggleActive = async (staff: Staff) => {
    if (["owner", "admin"].includes(staff.role.toLowerCase())) return;

    try {
      const res = await supabase
        .from("profiles")
        .update({ is_active: !staff.is_active })
        .eq("id", staff.id);

      if (res.error) throw res.error;
      await loadData();
    } catch (e: any) {
      setError(e.message || "Could not update status.");
    }
  };

  // Delete Staff Account
  const handleDeleteStaff = async (staff: Staff) => {
    if (["owner", "admin"].includes(staff.role.toLowerCase())) return;

    const confirmed = confirm(
      `Are you sure you want to permanently delete ${staff.full_name}'s staff account? This will revoke login access and remove all permissions.`
    );
    if (!confirmed) return;

    setBusy(true);
    setError("");
    setSaved("");

    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("delete-staff", {
        body: { staffId: staff.id },
      });

      if (invokeErr) {
        let msg = invokeErr.message || "Could not delete staff account.";
        try {
          const body = await invokeErr.context?.json();
          if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }

      if (!data?.success) {
        throw new Error(data?.error || "Could not delete staff account.");
      }

      setSaved(`Staff account deleted: ${staff.full_name}.`);
      if (selectedStaff?.id === staff.id) setSelectedStaff(null);
      await loadData();
    } catch (e: any) {
      setError(e.message || "Could not delete staff account.");
    } finally {
      setBusy(false);
    }
  };

  // Copy Login Credentials
  const handleCopyCredentials = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Filtered Staff List
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const matchesSearch =
        s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.login_id && s.login_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.phone && s.phone.includes(searchQuery)) ||
        s.role.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole =
        filterRole === "all" ||
        (filterRole === "active" && s.is_active) ||
        (filterRole === "disabled" && !s.is_active) ||
        s.role.toLowerCase() === filterRole.toLowerCase();

      return matchesSearch && matchesRole;
    });
  }, [staffList, searchQuery, filterRole]);

  // Overall Stats
  const activeCount = staffList.filter((s) => s.is_active).length;
  const disabledCount = staffList.filter((s) => !s.is_active).length;

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center p-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-xs font-semibold text-slate-500">Loading Staff & Permissions Workspace...</p>
        </div>
      </main>
    );
  }

  if (!featureActive) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-6">
        <FeatureGate featureKey="staff" />
      </div>
    );
  }

  if (isDenied) {
    return <AccessDenied moduleName="Staff & Permissions" />;
  }

  return (
    <div className="relative min-h-screen bg-[#f8fafc] text-slate-800">
      {/* Soft Ambient Mesh Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-indigo-200/35 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-[380px] w-[380px] rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute -bottom-32 left-1/2 h-[400px] w-[400px] rounded-full bg-emerald-200/25 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-7xl p-5 sm:p-8">
        {/* Navigation & Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs backdrop-blur hover:bg-slate-50"
            >
              <ArrowLeft size={15} /> Dashboard
            </Link>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">School Administration</p>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Staff & Permissions</h1>
            </div>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800"
          >
            <Plus size={16} /> Add New Staff
          </button>
        </div>

        {error && (
          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {saved && (
          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{saved}</span>
          </div>
        )}

        {/* Top Stat KPI Bar */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-xs backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Total Staff Accounts</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Users size={16} />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900">{staffList.length}</p>
            <p className="mt-1 text-[11px] text-slate-400">Registered institute personnel</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-xs backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Active Logins</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Power size={16} />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-700">{activeCount}</p>
            <p className="mt-1 text-[11px] text-slate-400">Can log in with credentials</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-xs backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Disabled Logins</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <Lock size={16} />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-rose-600">{disabledCount}</p>
            <p className="mt-1 text-[11px] text-slate-400">Login blocked by administrator</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-xs backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Available Modules</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                <ShieldCheck size={16} />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900">{ALL_SYSTEM_PERMISSIONS.length}</p>
            <p className="mt-1 text-[11px] text-slate-400">Granular permission controls</p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-xs backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff by name, login ID, role, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white/90 py-2.5 pl-9 pr-3 text-xs placeholder-slate-400 focus:border-indigo-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-hidden"
            >
              <option value="all">All Roles & Status</option>
              <option value="active">Active Only</option>
              <option value="disabled">Disabled Only</option>
              <option value="teacher">Teachers</option>
              <option value="accountant">Accountants</option>
              <option value="admin">Administrators</option>
            </select>
          </div>
        </div>

        {/* Staff Table */}
        <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-xs backdrop-blur-xl">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-bold text-slate-900">Registered Staff Accounts ({filteredStaff.length})</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Role is only a title / designation. <b>Admin grants exact permission checkboxes for each individual person.</b>
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Staff Member</th>
                  <th className="px-5 py-3.5">Role / Designation</th>
                  <th className="px-5 py-3.5">Login ID</th>
                  <th className="px-5 py-3.5">Phone / WhatsApp</th>
                  <th className="px-5 py-3.5">Account Status</th>
                  <th className="px-5 py-3.5 text-right">Access & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No staff accounts found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((staff) => {
                    const isAdmin = ["owner", "admin"].includes(staff.role.toLowerCase());
                    return (
                      <tr key={staff.id} className="transition hover:bg-slate-50/70">
                        {/* Name & Avatar */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 font-bold text-white shadow-2xs">
                              {(staff.full_name || "S").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{staff.full_name}</p>
                              <span className="text-[11px] text-slate-400">
                                {isAdmin ? "Institute Administrator" : "Staff Member"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="px-5 py-4">
                          <span
                            className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                              isAdmin
                                ? "border-purple-200 bg-purple-50 text-purple-700"
                                : "border-slate-200 bg-slate-50 text-slate-700"
                            }`}
                          >
                            {formatRoleName(staff.role)}
                          </span>
                        </td>

                        {/* Login ID */}
                        <td className="px-5 py-4 font-mono font-bold text-indigo-700">
                          {staff.login_id ? (
                            <span
                              onClick={() => handleCopyCredentials(staff.login_id!)}
                              title="Click to copy Login ID"
                              className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-indigo-200/80 bg-indigo-50/60 px-2 py-1 transition hover:bg-indigo-100"
                            >
                              {staff.login_id}
                              <Copy size={11} className="text-indigo-400" />
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Phone / WhatsApp */}
                        <td className="px-5 py-4">
                          {staff.phone ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-600">{staff.phone}</span>
                              <a
                                href={createWhatsAppUrl(
                                  staff.phone,
                                  formatStaffReminderMessage({
                                    institutionName: orgName,
                                    staffName: staff.full_name,
                                    loginId: staff.login_id,
                                    roleTitle: formatRoleName(staff.role),
                                  })
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Send credentials via WhatsApp"
                                className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition"
                              >
                                <MessageCircle size={13} />
                              </a>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              staff.is_active
                                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border border-rose-200 bg-rose-50 text-rose-700"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                staff.is_active ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                              }`}
                            />
                            {staff.is_active ? "Active" : "Disabled"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Manage Permissions */}
                            <button
                              onClick={() => handleOpenPermissions(staff)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                            >
                              <ShieldCheck size={13} className="text-indigo-600" />
                              Permissions
                            </button>

                            {/* Enable / Disable */}
                            <button
                              disabled={isAdmin}
                              onClick={() => handleToggleActive(staff)}
                              title={staff.is_active ? "Disable account" : "Enable account"}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold shadow-2xs transition disabled:opacity-30 ${
                                staff.is_active
                                  ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                            >
                              <Power size={13} />
                              {staff.is_active ? "Disable" : "Enable"}
                            </button>

                            {/* Delete */}
                            <button
                              disabled={isAdmin || busy}
                              onClick={() => handleDeleteStaff(staff)}
                              title="Delete staff account permanently"
                              className="inline-flex items-center rounded-lg border border-red-200 bg-white p-1.5 text-[11px] font-bold text-red-600 shadow-2xs hover:bg-red-50 transition disabled:opacity-30"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* MODAL 1: ADD NEW STAFF (WITH PRESET & DIRECT PERMISSIONS) */}
        {/* ========================================================================= */}
        {createOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-xs">
            <div className="relative my-8 w-full max-w-2xl rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <Plus size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Add New Staff Member</h2>
                    <p className="text-xs text-slate-500">Create login account and assign initial permissions.</p>
                  </div>
                </div>
                <button
                  onClick={() => setCreateOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-5 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                {/* Basic Details Grid */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Sharma"
                      value={createForm.fullName}
                      onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      placeholder="ramesh@gmail.com"
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Phone / WhatsApp Number
                    </label>
                    <input
                      type="text"
                      placeholder="10 digit mobile (optional)"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Password (min 8 chars) *
                    </label>
                    <div className="relative mt-1">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={createForm.password}
                        onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono pr-9 focus:border-indigo-500 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Role / Designation */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Role / Designation Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Teacher, Accountant, Office Clerk, Vice Principal"
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-hidden"
                  />
                </div>

                {/* Quick 1-Click Role Presets */}
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      1-Click Role Presets
                    </span>
                    <span className="text-[11px] font-semibold text-indigo-700">
                      {createPermIds.length} features selected
                    </span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {STAFF_ROLE_PRESETS.map((preset) => {
                      const isSelected = createForm.preset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleApplyCreatePreset(preset.id)}
                          className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-600 text-white shadow-2xs"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {preset.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Checkbox Grid for Fine Tuning */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Fine-Tune Assigned Permissions
                  </label>
                  <div className="mt-2 space-y-3">
                    {Object.entries(groupedPermissions).map(([moduleName, items]) => (
                      <div key={moduleName} className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-bold text-slate-900">{moduleName}</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {items.map(({ definition, db }) => {
                            if (!db) return null;
                            const isChecked = createPermIds.includes(db.id);
                            return (
                              <label
                                key={definition.code}
                                className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2 text-xs transition ${
                                  isChecked
                                    ? "border-indigo-200 bg-indigo-50/50 text-indigo-950 font-semibold"
                                    : "border-slate-100 hover:bg-slate-50 text-slate-600"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleCreatePerm(db.id)}
                                  className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <div>
                                  <span className="block leading-tight">{definition.name}</span>
                                  <span className="block text-[10px] text-slate-400 font-normal">
                                    {definition.description}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCreateStaff}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
                >
                  {busy ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                  {busy ? "Creating Account..." : "Create Staff & Save Permissions"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 2: SUCCESS CREDENTIALS & 1-CLICK WHATSAPP SHARE */}
        {/* ========================================================================= */}
        {createdResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="relative my-8 w-full max-w-lg rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Staff Account Created!</h2>
                    <p className="text-xs text-slate-500">Login credentials & permissions are ready.</p>
                  </div>
                </div>
                <button
                  onClick={() => setCreatedResult(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Credentials Highlight Card */}
              <div className="mt-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-violet-50/50 p-4">
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Staff Name:</span>
                    <span className="font-bold text-slate-900">{createdResult.staffName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Role / Title:</span>
                    <span className="font-semibold text-indigo-700">{createdResult.role}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-indigo-100/80 pt-2">
                    <span className="text-slate-600 font-semibold">Staff Login ID:</span>
                    <span className="font-mono text-sm font-black text-indigo-700">
                      {createdResult.loginId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-semibold">Password:</span>
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {createdResult.password}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-indigo-100/80 pt-2">
                    <span className="text-slate-500">Permissions Active:</span>
                    <span className="font-bold text-emerald-700">
                      {createdResult.assignedCount} features enabled
                    </span>
                  </div>
                </div>
              </div>

              {/* Preformatted WhatsApp Message Body */}
              {(() => {
                const shareText = formatStaffCredentialsMessage({
                  institutionName: orgName,
                  staffName: createdResult.staffName,
                  roleTitle: createdResult.role,
                  loginId: createdResult.loginId,
                  password: createdResult.password,
                  email: createdResult.email,
                  assignedCount: createdResult.assignedCount,
                });

                return (
                  <div className="mt-5 space-y-2.5">
                    {createdResult.phone ? (
                      <a
                        href={createWhatsAppUrl(createdResult.phone, shareText)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700"
                      >
                        <MessageCircle size={16} /> Send Credentials to WhatsApp ({createdResult.phone})
                      </a>
                    ) : null}

                    <button
                      onClick={() => handleCopyCredentials(shareText)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-800 shadow-2xs transition hover:bg-slate-50"
                    >
                      {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                      {copied ? "Copied to Clipboard!" : "Copy Full Login Message"}
                    </button>
                  </div>
                );
              })()}

              <div className="mt-4 text-center">
                <button
                  onClick={() => setCreatedResult(null)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Done & Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 3: MANAGE PERMISSIONS FOR EXISTING STAFF */}
        {/* ========================================================================= */}
        {selectedStaff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-xs">
            <div className="relative my-8 w-full max-w-4xl rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Manage Permissions: {selectedStaff.full_name}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Role: <strong className="text-slate-800">{formatRoleName(selectedStaff.role)}</strong> ·
                      Login ID: <span className="font-mono text-indigo-700">{selectedStaff.login_id || "—"}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStaff(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              {/* 1-Click Presets & Quick Select Bar */}
              <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      1-Click Preset Roles
                    </span>
                    <p className="text-[11px] text-slate-400">Instantly apply a standard bundle of permissions</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllPerms}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllPerms}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {STAFF_ROLE_PRESETS.map((preset) => {
                    const isSelected = selectedPresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-600 text-white shadow-2xs"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {preset.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Permissions Checkbox Grid Grouped by Module */}
              <div className="mt-5 space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                {Object.entries(groupedPermissions).map(([moduleName, items]) => (
                  <div key={moduleName} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        {moduleName}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {items.filter((x) => x.db && selectedPermIds.includes(x.db.id)).length} of {items.length} enabled
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                      {items.map(({ definition, db }) => {
                        if (!db) return null;
                        const isChecked = selectedPermIds.includes(db.id);
                        return (
                          <label
                            key={definition.code}
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs transition ${
                              isChecked
                                ? "border-indigo-300 bg-indigo-50/60 text-indigo-950 font-semibold shadow-2xs"
                                : "border-slate-100 hover:bg-slate-50 text-slate-600"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleTogglePerm(db.id)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div className="leading-snug">
                              <span className="block font-bold text-slate-900">{definition.name}</span>
                              <span className="block text-[11px] text-slate-500 font-normal">
                                {definition.description}
                              </span>
                              <span className="mt-1 block font-mono text-[10px] text-slate-400">
                                {definition.code}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer with Counter & Save Button */}
              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-xs font-semibold text-slate-500">
                  Total Active: <strong className="text-indigo-700">{selectedPermIds.length}</strong> permissions
                </span>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedStaff(null)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleSavePermissions}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50"
                  >
                    {busy ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                    {busy ? "Saving Permissions..." : "Save Permissions"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
