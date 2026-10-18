"use client";

import { useEffect, useState, FormEvent, ChangeEvent } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
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
  CreditCard,
  FileCheck,
  Trash2,
  Edit,
  ExternalLink,
  Upload,
  Check,
  X,
  QrCode,
  Eye,
  Calendar,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import InstallButton from "@/components/pwa/InstallButton";

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
  subscription?: {
    student_limit: number;
    status: string;
    is_trial: boolean;
    current_period_ends_at: string;
  } | null;
};

type PaymentRequest = {
  id: string;
  organization_id: string;
  organization_name?: string;
  student_limit: number;
  amount: number;
  utr_number: string;
  screenshot_url: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
};

type PlatformPricing = {
  base_price: number;
  base_students: number;
  extra_student_rate: number;
  default_trial_days: number;
  upi_id: string;
  upi_name: string;
  upi_qr_url: string | null;
  contact_phone: string;
  contact_email: string;
};

const MASTER_ACCESS_CODE = "Edutechlab@#78692";

export default function SuperAdminPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [institutions, setInstitutions] = useState<InstitutionItem[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [pricing, setPricing] = useState<PlatformPricing>({
    base_price: 149,
    base_students: 20,
    extra_student_rate: 7,
    default_trial_days: 0,
    upi_id: "edutechlab@upi",
    upi_name: "EduTechLab Platform",
    upi_qr_url: null,
    contact_phone: "+91 98765 43210",
    contact_email: "edutechlab@gmail.com",
  });

  const [activeTab, setActiveTab] = useState<"institutions" | "requests" | "pricing">("institutions");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Modals state: Quota override
  const [editingInst, setEditingInst] = useState<InstitutionItem | null>(null);
  const [editLimit, setEditLimit] = useState<number>(20);
  const [extendDays, setExtendDays] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<string>("active");

  // Modals state: Free trial grant
  const [grantingTrialInst, setGrantingTrialInst] = useState<InstitutionItem | null>(null);
  const [trialDaysInput, setTrialDaysInput] = useState<number>(15);
  const [trialLimitInput, setTrialLimitInput] = useState<number>(20);
  const [isGrantingTrial, setIsGrantingTrial] = useState(false);

  // Modals state: Delete
  const [deletingInst, setDeletingInst] = useState<InstitutionItem | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Modals state: Payment reject
  const [rejectingPay, setRejectingPay] = useState<PaymentRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [viewScreenshotUrl, setViewScreenshotUrl] = useState<string | null>(null);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);

  const checkAndLoad = async () => {
    try {
      setLoading(true);
      setError("");

      // Master Gatekeeper Check: Access only allowed if gate was unlocked
      let gateUnlocked = false;
      try {
        gateUnlocked =
          localStorage.getItem("edutechlab_master_gate_unlocked") === "true" ||
          sessionStorage.getItem("edutechlab_master_gate_unlocked") === "true" ||
          document.cookie.includes("edutechlab_master_gate_unlocked=true");
      } catch {
        gateUnlocked = false;
      }

      if (!gateUnlocked) {
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      // Check if user is in platform_admins or is owner
      const [{ data: isSuper }, { data: adminRecord }] = await Promise.all([
        supabase.rpc("is_platform_admin"),
        supabase.from("platform_admins").select("role").eq("user_id", user.id).maybeSingle(),
      ]);

      const isKnownSuperEmail =
        !!user.email &&
        ([
          "edutechlab@gmail.com",
          "edutechlabb@gmail.com",
          "rehanedutechlab@gmail.com",
          "admin@edutechlab.com",
        ].includes(user.email.toLowerCase()) ||
          user.email.toLowerCase().includes("edutechlab"));

      const isAllowed = isSuper === true || !!adminRecord || isKnownSuperEmail;

      if (!isAllowed) {
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      setIsSuperAdmin(true);

      // Load Stats, Institutions, Subscriptions, Payments & Pricing
      const [statsRes, listRes, subsRes, paysRes, settingsRes] = await Promise.all([
        supabase.rpc("get_platform_overview"),
        supabase.rpc("list_institutions_for_platform"),
        supabase.from("institution_subscriptions").select("*"),
        supabase
          .from("subscription_payments")
          .select("*, organizations(name)")
          .order("created_at", { ascending: false }),
        supabase.from("platform_settings").select("*").eq("id", "global").maybeSingle(),
      ]);

      if (statsRes.data) {
        setStats(statsRes.data as PlatformStats);
      }

      const subMap = new Map((subsRes.data || []).map((s: any) => [s.organization_id, s]));

      if (listRes.data) {
        const enrichedInsts = (listRes.data as InstitutionItem[]).map((inst) => {
          const sub = subMap.get(inst.id);
          return {
            ...inst,
            subscription: sub
              ? {
                  student_limit: sub.student_limit,
                  status: sub.status,
                  is_trial: sub.is_trial,
                  current_period_ends_at: sub.current_period_ends_at,
                }
              : null,
          };
        });
        setInstitutions(enrichedInsts);
      }

      if (paysRes.data) {
        setPaymentRequests(
          paysRes.data.map((p: any) => ({
            ...p,
            organization_name: p.organizations?.name || "Unknown School",
          }))
        );
      }

      if (settingsRes.data) {
        setPricing({
          base_price: Number(settingsRes.data.base_price || 149),
          base_students: Number(settingsRes.data.base_students || 20),
          extra_student_rate: Number(settingsRes.data.extra_student_rate || 7),
          default_trial_days: Number(settingsRes.data.default_trial_days || 15),
          upi_id: settingsRes.data.upi_id || "edutechlab@upi",
          upi_name: settingsRes.data.upi_name || "EduTechLab Platform",
          upi_qr_url: settingsRes.data.upi_qr_url || null,
          contact_phone: settingsRes.data.contact_phone || "+91 98765 43210",
          contact_email: settingsRes.data.contact_email || "edutechlab@gmail.com",
        });
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

  // Suspend / Activate Institution
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
        p_master_code: MASTER_ACCESS_CODE,
      });

      if (err) throw err;
      setSuccess(`Institution "${inst.name}" has been ${actionWord}d.`);
      await checkAndLoad();
    } catch (err: any) {
      setError(err.message || `Failed to ${actionWord} institution.`);
    } finally {
      setBusyId(null);
    }
  };

  // Open Quota Edit Modal
  const openEditQuotaModal = (inst: InstitutionItem) => {
    setEditingInst(inst);
    setEditLimit(inst.subscription?.student_limit || 20);
    setEditStatus(inst.subscription?.status || "active");
    setExtendDays(0);
  };

  // Open Grant Trial Modal
  const openGrantTrialModal = (inst: InstitutionItem) => {
    setGrantingTrialInst(inst);
    setTrialDaysInput(15);
    setTrialLimitInput(inst.subscription?.student_limit || 20);
  };

  // Save Free Trial Grant / Revoke
  const handleGrantFreeTrial = async (daysToGrant: number) => {
    if (!grantingTrialInst) return;

    setIsGrantingTrial(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: err } = await supabase.rpc("admin_grant_free_trial", {
        p_org_id: grantingTrialInst.id,
        p_trial_days: daysToGrant,
        p_student_limit: trialLimitInput,
        p_master_code: MASTER_ACCESS_CODE,
      });

      if (err) throw err;
      setSuccess(
        data?.message ||
          (daysToGrant > 0
            ? `Free trial granted for ${daysToGrant} days to "${grantingTrialInst.name}".`
            : `Free trial revoked for "${grantingTrialInst.name}".`)
      );
      setGrantingTrialInst(null);
      await checkAndLoad();
    } catch (err: any) {
      setError(err.message || "Failed to update free trial.");
    } finally {
      setIsGrantingTrial(false);
    }
  };

  // Save Quota Override
  const handleSaveQuotaOverride = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingInst) return;

    setBusyId(editingInst.id);
    setError("");
    setSuccess("");

    try {
      const { data, error: err } = await supabase.rpc("update_institution_subscription_quota", {
        p_org_id: editingInst.id,
        p_student_limit: editLimit,
        p_status: editStatus,
        p_extend_days: extendDays > 0 ? extendDays : null,
        p_master_code: MASTER_ACCESS_CODE,
      });

      if (err) throw err;
      setSuccess(`Subscription quota for "${editingInst.name}" updated successfully.`);
      setEditingInst(null);
      await checkAndLoad();
    } catch (err: any) {
      setError(err.message || "Failed to update subscription quota.");
    } finally {
      setBusyId(null);
    }
  };

  // Permanent Delete Institution
  const handlePermanentDelete = async () => {
    if (!deletingInst) return;
    if (deleteConfirmText.trim().toLowerCase() !== deletingInst.name.trim().toLowerCase()) {
      setError(`Confirmation name does not match "${deletingInst.name}". Deletion aborted.`);
      return;
    }

    setIsDeleting(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: err } = await supabase.rpc("delete_institution_permanently", {
        p_org_id: deletingInst.id,
        p_master_code: MASTER_ACCESS_CODE,
      });

      if (err) throw err;
      setSuccess(data?.message || `Institution "${deletingInst.name}" permanently deleted.`);
      setDeletingInst(null);
      setDeleteConfirmText("");
      await checkAndLoad();
    } catch (err: any) {
      setError(err.message || "Failed to permanently delete institution.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Approve Payment Request
  const handleApprovePayment = async (pay: PaymentRequest) => {
    if (!confirm(`Approve payment of ₹${pay.amount} for ${pay.organization_name} (UTR: ${pay.utr_number})?`)) {
      return;
    }

    setBusyId(pay.id);
    setError("");
    setSuccess("");

    try {
      const { data, error: err } = await supabase.rpc("approve_subscription_payment", {
        p_payment_id: pay.id,
        p_duration_days: 30,
        p_master_code: MASTER_ACCESS_CODE,
      });

      if (err) throw err;
      setSuccess(`Payment for ${pay.organization_name} approved! Subscription activated for 30 days.`);
      await checkAndLoad();
    } catch (err: any) {
      setError(err.message || "Failed to approve payment.");
    } finally {
      setBusyId(null);
    }
  };

  // Reject Payment Request
  const handleRejectPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!rejectingPay) return;

    setBusyId(rejectingPay.id);
    setError("");
    setSuccess("");

    try {
      const { data, error: err } = await supabase.rpc("reject_subscription_payment", {
        p_payment_id: rejectingPay.id,
        p_reason: rejectReason.trim() || "Payment could not be verified with UTR. Please re-submit.",
        p_master_code: MASTER_ACCESS_CODE,
      });

      if (err) throw err;
      setSuccess(`Payment request for ${rejectingPay.organization_name} has been rejected.`);
      setRejectingPay(null);
      setRejectReason("");
      await checkAndLoad();
    } catch (err: any) {
      setError(err.message || "Failed to reject payment.");
    } finally {
      setBusyId(null);
    }
  };

  // Upload UPI QR Code Image
  const handleUploadQrCode = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    setUploadingQr(true);
    setError("");
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `platform/upi_qr_code_${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("platform-assets")
        .upload(path, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage
        .from("platform-assets")
        .getPublicUrl(path);

      const qrUrl = publicUrlData.publicUrl;
      setPricing((prev) => ({ ...prev, upi_qr_url: qrUrl }));

      // Update in DB via safe RPC
      await supabase.rpc("admin_save_platform_settings", {
        p_base_price: pricing.base_price,
        p_base_students: pricing.base_students,
        p_extra_student_rate: pricing.extra_student_rate,
        p_default_trial_days: pricing.default_trial_days,
        p_upi_id: pricing.upi_id.trim(),
        p_upi_name: pricing.upi_name.trim(),
        p_contact_phone: pricing.contact_phone.trim(),
        p_contact_email: pricing.contact_email.trim(),
        p_upi_qr_url: qrUrl,
        p_master_code: MASTER_ACCESS_CODE,
      });

      setSuccess("Platform UPI QR Code uploaded and updated successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to upload UPI QR Code.");
    } finally {
      setUploadingQr(false);
    }
  };

  // Save Pricing Settings
  const handleSavePricing = async (e: FormEvent) => {
    e.preventDefault();
    setSavingPricing(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: err } = await supabase.rpc("admin_save_platform_settings", {
        p_base_price: pricing.base_price,
        p_base_students: pricing.base_students,
        p_extra_student_rate: pricing.extra_student_rate,
        p_default_trial_days: pricing.default_trial_days,
        p_upi_id: pricing.upi_id.trim(),
        p_upi_name: pricing.upi_name.trim(),
        p_contact_phone: pricing.contact_phone.trim(),
        p_contact_email: pricing.contact_email.trim(),
        p_upi_qr_url: pricing.upi_qr_url,
        p_master_code: MASTER_ACCESS_CODE,
      });

      if (err) throw err;
      setSuccess("Platform pricing and UPI configurations saved successfully.");
    } catch (err: any) {
      setError(err.message || "Failed to save platform settings.");
    } finally {
      setSavingPricing(false);
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

  const pendingRequestsCount = paymentRequests.filter((p) => p.status === "pending").length;

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl p-8 text-center text-sm text-slate-500">
        Verifying platform owner credentials...
      </main>
    );
  }

  if (!isSuperAdmin) {
    notFound();
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
          <InstallButton />
              <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700">
                Super Admin
              </span>
              <p className="text-xs text-slate-400">EduTechLab Platform Management</p>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Platform Master Console
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
              try {
                localStorage.removeItem("edutechlab_master_gate_unlocked");
                sessionStorage.removeItem("edutechlab_master_gate_unlocked");
                document.cookie = "edutechlab_master_gate_unlocked=; path=/; max-age=0";
              } catch {}
              await supabase.auth.signOut();
              window.location.href = "/";
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
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Platform Metric Cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-sm font-medium">Total Institutions</span>
              <Building2 size={18} className="text-purple-600" />
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">{stats.total_institutions}</p>
            <div className="mt-2 flex items-center gap-3 text-xs">
              <span className="font-semibold text-emerald-600">
                {stats.active_institutions} active
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">{stats.suspended_institutions} suspended</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-sm font-medium">Platform Students</span>
              <Users size={18} className="text-blue-600" />
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">{stats.total_students}</p>
            <p className="mt-2 text-xs text-slate-500">Enrolled across all tenants</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-sm font-medium">Pending Approvals</span>
              <Clock size={18} className="text-amber-600" />
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">{pendingRequestsCount}</p>
            <p className="mt-2 text-xs text-slate-500">Subscription payment requests</p>
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

      {/* Tabs Navigation */}
      <div className="mt-8 flex border-b border-slate-200 text-sm font-bold">
        <button
          onClick={() => setActiveTab("institutions")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 transition ${
            activeTab === "institutions"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Building2 size={16} />
          Registered Institutions ({institutions.length})
        </button>

        <button
          onClick={() => setActiveTab("requests")}
          className={`relative flex items-center gap-2 border-b-2 px-5 py-3 transition ${
            activeTab === "requests"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FileCheck size={16} />
          Subscription Approvals
          {pendingRequestsCount > 0 && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
              {pendingRequestsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("pricing")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 transition ${
            activeTab === "pricing"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Settings size={16} />
          Pricing & UPI QR Settings
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: INSTITUTIONS MANAGEMENT & LIFECYCLE                     */}
      {/* ============================================================== */}
      {activeTab === "institutions" && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Registered Institutions</h2>
              <p className="text-xs text-slate-500">
                Manage student capacity quotas, mid-month overrides, status suspension, and permanent deletion.
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
                  <th className="px-5 py-3.5">Student Quota</th>
                  <th className="px-5 py-3.5">Plan / Status</th>
                  <th className="px-5 py-3.5">Valid Until</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInstitutions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-sm text-slate-500">
                      No institutions match your search query.
                    </td>
                  </tr>
                ) : (
                  filteredInstitutions.map((inst) => {
                    const sub = inst.subscription;
                    const isExpired = sub?.current_period_ends_at && new Date(sub.current_period_ends_at) < new Date();
                    return (
                      <tr key={inst.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">{inst.name}</div>
                          <div className="text-xs text-slate-400 font-mono">/{inst.slug}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-xs font-medium text-slate-800">
                            {inst.owner_name || "—"}
                          </div>
                          <div className="font-mono text-xs text-purple-600 font-bold">
                            {inst.owner_login_id || "—"}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">
                              {inst.student_count}
                            </span>
                            <span className="text-xs text-slate-400">
                              / {sub?.student_limit || 20} max
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full bg-purple-600 rounded-full"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.round((inst.student_count / (sub?.student_limit || 20)) * 100)
                                )}%`,
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {sub?.is_trial ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">
                              <Sparkles size={11} /> Trial ({Math.max(0, Math.ceil((new Date(sub.current_period_ends_at).getTime() - Date.now()) / 86400000))}d left)
                            </span>
                          ) : isExpired ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                              No Active Plan
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                              Standard Active
                            </span>
                          )}
                          <div className="mt-1">
                            {inst.is_active ? (
                              <span className="text-[11px] text-emerald-600 font-medium">● Operational</span>
                            ) : (
                              <span className="text-[11px] text-red-600 font-medium">● Suspended</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500">
                          {sub?.current_period_ends_at
                            ? new Date(sub.current_period_ends_at).toLocaleDateString("en-IN")
                            : "—"}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Grant / Manage Free Trial Button */}
                            <button
                              onClick={() => openGrantTrialModal(inst)}
                              className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100"
                              title="Grant custom free trial days to this school"
                            >
                              <Sparkles size={12} />
                              Grant Trial
                            </button>

                            {/* Edit Quota / Plan Button */}
                            <button
                              onClick={() => openEditQuotaModal(inst)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              title="Override student capacity or extend subscription"
                            >
                              <Edit size={12} />
                              Edit Quota
                            </button>

                            {/* Suspend / Activate Toggle */}
                            <button
                              onClick={() => handleToggleStatus(inst)}
                              disabled={busyId === inst.id}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                                inst.is_active
                                  ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                                  : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              } disabled:opacity-50`}
                            >
                              <Power size={12} />
                              {inst.is_active ? "Suspend" : "Activate"}
                            </button>

                            {/* Permanent Delete Button */}
                            <button
                              onClick={() => {
                                setDeletingInst(inst);
                                setDeleteConfirmText("");
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                              title="Permanently delete institution and all records"
                            >
                              <Trash2 size={12} />
                              Delete
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
      )}

      {/* ============================================================== */}
      {/* TAB 2: SUBSCRIPTION APPROVALS QUEUE                            */}
      {/* ============================================================== */}
      {activeTab === "requests" && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-lg font-bold text-slate-900">Subscription Payment Verifications</h2>
            <p className="text-xs text-slate-500">
              Review UPI transaction references (UTR) and payment screenshots. Approve to activate monthly access.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">School</th>
                  <th className="px-5 py-3.5">Capacity Requested</th>
                  <th className="px-5 py-3.5">Amount Paid</th>
                  <th className="px-5 py-3.5">UTR / Reference</th>
                  <th className="px-5 py-3.5">Proof Screenshot</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Submitted On</th>
                  <th className="px-5 py-3.5 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paymentRequests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-sm text-slate-500">
                      No subscription payment requests submitted yet.
                    </td>
                  </tr>
                ) : (
                  paymentRequests.map((pay) => (
                    <tr key={pay.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {pay.organization_name}
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-bold text-slate-900">{pay.student_limit}</span>{" "}
                        <span className="text-xs text-slate-400">students</span>
                      </td>
                      <td className="px-5 py-4 font-extrabold text-purple-700">
                        ₹{pay.amount}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs font-bold text-slate-800">
                        {pay.utr_number}
                      </td>
                      <td className="px-5 py-4">
                        {pay.screenshot_url ? (
                          <button
                            type="button"
                            onClick={() => setViewScreenshotUrl(pay.screenshot_url)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-purple-600 hover:bg-purple-50"
                          >
                            <Eye size={12} /> View Proof
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">No screenshot</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {pay.status === "approved" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 size={12} /> Approved
                          </span>
                        ) : pay.status === "rejected" ? (
                          <div>
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                              <XCircle size={12} /> Rejected
                            </span>
                            {pay.rejection_reason && (
                              <p className="mt-1 text-[11px] text-red-600 max-w-xs">
                                {pay.rejection_reason}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                            <Clock size={12} /> Pending Review
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {new Date(pay.created_at).toLocaleString("en-IN")}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {pay.status === "pending" ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApprovePayment(pay)}
                              disabled={busyId === pay.id}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
                            >
                              <Check size={13} /> Approve
                            </button>
                            <button
                              onClick={() => {
                                setRejectingPay(pay);
                                setRejectReason("");
                              }}
                              disabled={busyId === pay.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              <X size={13} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Processed</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* TAB 3: PLATFORM PRICING & UPI CONFIGURATION                    */}
      {/* ============================================================== */}
      {activeTab === "pricing" && (
        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Pricing Rule Config */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-purple-600 p-2 text-white">
                <CreditCard size={18} />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Per-Student Pricing Formula</h2>
                <p className="text-xs text-slate-500">
                  Configure default base tier and per-student incremental rates.
                </p>
              </div>
            </div>

            <form onSubmit={handleSavePricing} className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Base Plan Price (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={pricing.base_price}
                    onChange={(e) =>
                      setPricing({ ...pricing, base_price: Number(e.target.value) || 0 })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-purple-500"
                  />
                  <span className="text-[11px] text-slate-400">Default: ₹149</span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Base Student Limit
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={pricing.base_students}
                    onChange={(e) =>
                      setPricing({ ...pricing, base_students: Number(e.target.value) || 1 })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-purple-500"
                  />
                  <span className="text-[11px] text-slate-400">Default: 20 students</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Extra Student Rate (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={pricing.extra_student_rate}
                    onChange={(e) =>
                      setPricing({ ...pricing, extra_student_rate: Number(e.target.value) || 0 })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-purple-500"
                  />
                  <span className="text-[11px] text-slate-400">Default: ₹7 / extra student</span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Default Auto-Trial on Signup (Days)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={pricing.default_trial_days}
                    onChange={(e) =>
                      setPricing({ ...pricing, default_trial_days: Number(e.target.value) || 0 })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-purple-500"
                  />
                  <span className="text-[11px] text-slate-400">
                    Set 0 for NO auto trial (Admin grants trial manually to each school)
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Official Support Contact Phone
                  </label>
                  <input
                    type="text"
                    value={pricing.contact_phone}
                    onChange={(e) => setPricing({ ...pricing, contact_phone: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Official Support Contact Email
                  </label>
                  <input
                    type="email"
                    value={pricing.contact_email}
                    onChange={(e) => setPricing({ ...pricing, contact_email: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingPricing}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-sm font-bold text-white shadow-sm hover:bg-purple-500 disabled:opacity-50"
              >
                {savingPricing ? "Saving Settings..." : "Save Pricing Configuration"}
              </button>
            </form>
          </div>

          {/* UPI ID & QR Code Upload */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-emerald-600 p-2 text-white">
                <QrCode size={18} />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Platform UPI & QR Code</h2>
                <p className="text-xs text-slate-500">
                  Set the receiving UPI address and upload your official QR code.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  UPI ID (VPA)
                </label>
                <input
                  type="text"
                  value={pricing.upi_id}
                  onChange={(e) => setPricing({ ...pricing, upi_id: e.target.value })}
                  placeholder="e.g. edutechlab@upi"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  UPI Payee Name
                </label>
                <input
                  type="text"
                  value={pricing.upi_name}
                  onChange={(e) => setPricing({ ...pricing, upi_name: e.target.value })}
                  placeholder="e.g. EduTechLab Platform"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Custom UPI QR Code Image
                </label>
                <div className="mt-2 flex items-center gap-4">
                  {pricing.upi_qr_url ? (
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1">
                      <img
                        src={pricing.upi_qr_url}
                        alt="Current UPI QR Code"
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="grid h-24 w-24 shrink-0 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                      <QrCode size={28} />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50">
                      <Upload size={14} />
                      {uploadingQr ? "Uploading..." : "Upload New QR Image"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleUploadQrCode}
                        disabled={uploadingQr}
                      />
                    </label>
                    <p className="text-[11px] text-slate-400">
                      If left unuploaded, dynamic QR code with exact amount will be generated automatically.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: EDIT QUOTA / EXTEND PLAN (SUPER ADMIN OVERRIDE)       */}
      {/* ============================================================== */}
      {editingInst && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Override Subscription Quota</h3>
                <p className="text-xs text-slate-500 font-medium">{editingInst.name}</p>
              </div>
              <button
                onClick={() => setEditingInst(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveQuotaOverride} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Student Enrollment Limit
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={editLimit}
                  onChange={(e) => setEditLimit(Number(e.target.value) || 1)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-purple-500"
                />
                <span className="text-[11px] text-slate-400">
                  Current enrolled students: {editingInst.student_count}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Subscription Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-purple-500"
                >
                  <option value="active">Active (Standard)</option>
                  <option value="trial">Free Trial</option>
                  <option value="expired">Expired</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Extend Validity Period
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={extendDays}
                    onChange={(e) => setExtendDays(Number(e.target.value) || 0)}
                    placeholder="0"
                    className="w-28 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-purple-500"
                  />
                  <span className="text-xs text-slate-500">additional days</span>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setEditingInst(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyId === editingInst.id}
                  className="rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-purple-500 disabled:opacity-50"
                >
                  {busyId === editingInst.id ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1.5: GRANT / MANAGE FREE TRIAL (CUSTOM DAYS BY ADMIN)    */}
      {/* ============================================================== */}
      {grantingTrialInst && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-purple-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <span className="rounded-xl bg-purple-100 p-2 text-purple-700">
                  <Sparkles size={18} />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Grant Free Trial</h3>
                  <p className="text-xs text-slate-500 font-medium">{grantingTrialInst.name}</p>
                </div>
              </div>
              <button
                onClick={() => setGrantingTrialInst(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {/* Current Status Pill */}
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 border border-slate-100">
                Current status:{" "}
                <strong className="text-slate-900">
                  {grantingTrialInst.subscription?.is_trial
                    ? `Active Trial (Valid until ${new Date(
                        grantingTrialInst.subscription.current_period_ends_at
                      ).toLocaleDateString("en-IN")})`
                    : grantingTrialInst.subscription?.status === "active"
                    ? "Standard Paid Subscription"
                    : "No Active Subscription"}
                </strong>
              </div>

              {/* Quick Preset Days */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Select Trial Duration (Days)
                </label>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {[7, 15, 30, 45].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setTrialDaysInput(d)}
                      className={`rounded-xl py-2 text-xs font-bold transition border ${
                        trialDaysInput === d
                          ? "border-purple-600 bg-purple-600 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {d} Days
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Days Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Or Custom Trial Days
                </label>
                <input
                  type="number"
                  min={1}
                  value={trialDaysInput}
                  onChange={(e) => setTrialDaysInput(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-purple-500"
                  placeholder="Enter number of days"
                />
              </div>

              {/* Student Limit Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Student Capacity Limit During Trial
                </label>
                <input
                  type="number"
                  min={1}
                  value={trialLimitInput}
                  onChange={(e) => setTrialLimitInput(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-purple-500"
                  placeholder="e.g. 20 students"
                />
                <span className="text-[11px] text-slate-400">
                  School can add students up to this limit during free trial.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-col gap-2 pt-4 border-t sm:flex-row sm:justify-between sm:items-center">
                {grantingTrialInst.subscription?.is_trial ? (
                  <button
                    type="button"
                    disabled={isGrantingTrial}
                    onClick={() => handleGrantFreeTrial(0)}
                    className="rounded-xl border border-red-200 px-3.5 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Revoke / End Trial
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGrantingTrialInst(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isGrantingTrial}
                    onClick={() => handleGrantFreeTrial(trialDaysInput)}
                    className="rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-purple-500 disabled:opacity-50"
                  >
                    {isGrantingTrial
                      ? "Granting..."
                      : `Activate ${trialDaysInput}-Day Free Trial`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: PERMANENTLY DELETE INSTITUTION                        */}
      {/* ============================================================== */}
      {deletingInst && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-red-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600">
              <span className="rounded-xl bg-red-100 p-2.5">
                <Trash2 size={22} />
              </span>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Permanently Delete School?</h3>
                <p className="text-xs text-red-600 font-semibold">Irreversible Platform Operation</p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-600">
              This will completely and permanently purge <strong>"{deletingInst.name}"</strong>, including all
              students ({deletingInst.student_count}), classes, attendance records, fee payments, marksheets,
              notices, and the administrator account from Supabase.
            </p>

            <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">
              To confirm deletion, type <strong>{deletingInst.name}</strong> below:
            </div>

            <input
              type="text"
              autoFocus
              placeholder={`Type "${deletingInst.name}"`}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="mt-3 w-full rounded-xl border border-red-300 px-3.5 py-2.5 text-sm outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 font-medium"
            />

            <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => setDeletingInst(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePermanentDelete}
                disabled={
                  isDeleting ||
                  deleteConfirmText.trim().toLowerCase() !== deletingInst.name.trim().toLowerCase()
                }
                className="rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-red-500 disabled:opacity-40"
              >
                {isDeleting ? "Purging School..." : "Permanently Delete School"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: REJECT PAYMENT REQUEST WITH REASON                    */}
      {/* ============================================================== */}
      {rejectingPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <h3 className="text-base font-bold text-slate-900">
                Reject Payment Request
              </h3>
              <button
                onClick={() => setRejectingPay(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRejectPayment} className="mt-4 space-y-4">
              <p className="text-xs text-slate-500">
                School: <strong>{rejectingPay.organization_name}</strong> • UTR:{" "}
                <span className="font-mono">{rejectingPay.utr_number}</span>
              </p>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Reason for Rejection
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. UTR number not found in bank statement, or payment amount mismatch."
                  className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-xs outline-none focus:border-red-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setRejectingPay(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busyId === rejectingPay.id}
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {busyId === rejectingPay.id ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: FULLSCREEN SCREENSHOT PREVIEW                         */}
      {/* ============================================================== */}
      {viewScreenshotUrl && (
        <div
          onClick={() => setViewScreenshotUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        >
          <div className="relative max-h-[90vh] max-w-2xl overflow-hidden rounded-2xl bg-white p-2">
            <button
              onClick={() => setViewScreenshotUrl(null)}
              className="absolute right-3 top-3 rounded-full bg-black/60 p-1.5 text-white hover:bg-black"
            >
              <X size={18} />
            </button>
            <img
              src={viewScreenshotUrl}
              alt="Payment Slip Proof"
              className="max-h-[85vh] w-auto rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </main>
  );
}
