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
  Sliders,
  ToggleLeft,
  ToggleRight,
  Layers,
  Lock,
  Unlock,
  CheckSquare,
  Square,
  Copy,
  Plus,
  Send,
  Smartphone,
  KeyRound,
} from "lucide-react";
import {
  PLATFORM_FEATURES,
  FeatureKey,
  EnabledFeaturesMap,
  getDefaultFeaturesMap,
  parseFeatures,
  PRESET_BUNDLES,
} from "@/lib/features";
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
  enabled_features?: EnabledFeaturesMap;
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

  const [activeTab, setActiveTab] = useState<"institutions" | "requests" | "pricing" | "features">("institutions");
  // Feature Controller State
  const [managingFeaturesInst, setManagingFeaturesInst] = useState<InstitutionItem | null>(null);
  const [currentFeatures, setCurrentFeatures] = useState<EnabledFeaturesMap>(getDefaultFeaturesMap());
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [featureMatrixSearch, setFeatureMatrixSearch] = useState("");
  const [selectedFeatureFilter, setSelectedFeatureFilter] = useState<string>("all");
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

  // Modals state: Quick Demo Account Creator
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoForm, setDemoForm] = useState({
    name: "",
    type: "school" as "school" | "madrasa" | "coaching" | "other",
    directorName: "",
    phone: "",
    email: "",
    password: "",
    trialDays: 15,
    studentLimit: 100,
  });
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState("");
  const [demoSuccess, setDemoSuccess] = useState<{
    loginId: string;
    password: string;
    instituteName: string;
    adminName: string;
    adminEmail: string;
    trialDays: number;
    studentLimit: number;
    portalUrl: string;
  } | null>(null);
  const [demoCopied, setDemoCopied] = useState(false);

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

      // Load Stats, Institutions, Subscriptions, Payments & Pricing & Features
      const [statsRes, listRes, subsRes, paysRes, settingsRes, orgsFeatRes] = await Promise.all([
        supabase.rpc("get_platform_overview"),
        supabase.rpc("list_institutions_for_platform"),
        supabase.from("institution_subscriptions").select("*"),
        supabase
          .from("subscription_payments")
          .select("*, organizations(name)")
          .order("created_at", { ascending: false }),
        supabase.from("platform_settings").select("*").eq("id", "global").maybeSingle(),
        supabase.from("organizations").select("id, enabled_features"),
      ]);

      if (statsRes.data) {
        setStats(statsRes.data as PlatformStats);
      }

      const subMap = new Map((subsRes.data || []).map((s: any) => [s.organization_id, s]));
      const featMap = new Map((orgsFeatRes.data || []).map((o: any) => [o.id, o.enabled_features]));

      if (listRes.data) {
        const enrichedInsts = (listRes.data as InstitutionItem[]).map((inst) => {
          const sub = subMap.get(inst.id);
          let rawFeat = featMap.get(inst.id);
          if (!rawFeat && typeof window !== "undefined") {
            try {
              const local = localStorage.getItem(`edutechlab_features_${inst.id}`);
              if (local) rawFeat = JSON.parse(local);
            } catch {}
          }
          const parsedFeat = parseFeatures(rawFeat);

          return {
            ...inst,
            enabled_features: parsedFeat,
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

  // Open Feature Allocation Modal
  const openManageFeaturesModal = (inst: InstitutionItem) => {
    setManagingFeaturesInst(inst);
    const initialFeat = inst.enabled_features || getDefaultFeaturesMap();
    setCurrentFeatures({ ...initialFeat });
  };

  const handleToggleSingleFeature = (key: FeatureKey) => {
    setCurrentFeatures((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleApplyPreset = (bundleKey: keyof typeof PRESET_BUNDLES) => {
    const bundle = PRESET_BUNDLES[bundleKey];
    if (bundle) {
      setCurrentFeatures({ ...bundle.features });
    }
  };

  const handleToggleAllFeatures = (val: boolean) => {
    const next: Partial<EnabledFeaturesMap> = {};
    PLATFORM_FEATURES.forEach((f) => {
      next[f.key] = val;
    });
    setCurrentFeatures(next as EnabledFeaturesMap);
  };

  const handleSaveFeatures = async () => {
    if (!managingFeaturesInst) return;
    setSavingFeatures(true);
    setError("");
    setSuccess("");

    try {
      // 1. Try RPC
      const { error: rpcErr } = await supabase.rpc("update_institution_features", {
        p_org_id: managingFeaturesInst.id,
        p_features: currentFeatures,
        p_master_code: MASTER_ACCESS_CODE,
      });

      // 2. Direct table update fallback
      if (rpcErr) {
        await supabase
          .from("organizations")
          .update({ enabled_features: currentFeatures })
          .eq("id", managingFeaturesInst.id);
      }

      // 3. Sync to local storage
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            `edutechlab_features_${managingFeaturesInst.id}`,
            JSON.stringify(currentFeatures)
          );
        } catch {}
      }

      // 4. Update memory state
      setInstitutions((prev) =>
        prev.map((inst) =>
          inst.id === managingFeaturesInst.id
            ? { ...inst, enabled_features: { ...currentFeatures } }
            : inst
        )
      );

      const activeCount = Object.values(currentFeatures).filter(Boolean).length;
      setSuccess(
        `Features for "${managingFeaturesInst.name}" updated successfully! (${activeCount}/13 modules active)`
      );
      setManagingFeaturesInst(null);
    } catch (err: any) {
      setError(err.message || "Failed to update institution features.");
    } finally {
      setSavingFeatures(false);
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

    const orgId = deletingInst.id;
    const orgName = deletingInst.name;
    setIsDeleting(true);
    setError("");
    setSuccess("");

    try {
      let rpcWorked = false;
      let rpcMsg = "";
      try {
        const { data, error: err } = await supabase.rpc("delete_institution_permanently", {
          p_org_id: orgId,
          p_master_code: MASTER_ACCESS_CODE,
        });
        if (!err && data?.success) {
          rpcWorked = true;
          rpcMsg = data.message;
        }
      } catch {}

      if (!rpcWorked) {
        // Direct cascade deletion fallback
        await Promise.allSettled([
          supabase.from("student_certificates").delete().eq("organization_id", orgId),
          supabase.from("class_timetables").delete().eq("organization_id", orgId),
          supabase.from("class_homework").delete().eq("organization_id", orgId),
          supabase.from("school_expenses").delete().eq("organization_id", orgId),
          supabase.from("exam_marks").delete().eq("organization_id", orgId),
          supabase.from("exams").delete().eq("organization_id", orgId),
          supabase.from("attendance").delete().eq("organization_id", orgId),
          supabase.from("fee_payments").delete().eq("organization_id", orgId),
          supabase.from("student_fee_months").delete().eq("organization_id", orgId),
          supabase.from("student_fee_plans").delete().eq("organization_id", orgId),
          supabase.from("notices").delete().eq("organization_id", orgId),
          supabase.from("staff_permissions").delete().eq("organization_id", orgId),
          supabase.from("students").delete().eq("organization_id", orgId),
          supabase.from("teachers").delete().eq("organization_id", orgId),
          supabase.from("sections").delete().eq("organization_id", orgId),
          supabase.from("classes").delete().eq("organization_id", orgId),
          supabase.from("academic_sessions").delete().eq("organization_id", orgId),
          supabase.from("organization_settings").delete().eq("organization_id", orgId),
          supabase.from("subscription_payments").delete().eq("organization_id", orgId),
          supabase.from("institution_subscriptions").delete().eq("organization_id", orgId),
          supabase.from("profiles").delete().eq("organization_id", orgId),
        ]);
        await supabase.from("organizations").delete().eq("id", orgId);
      }

      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(`edutechlab_features_${orgId}`);
          localStorage.removeItem(`edutechlab_expenses_${orgId}`);
        } catch {}
      }

      // Remove immediately from memory state
      setInstitutions((prev) => prev.filter((i) => i.id !== orgId));
      setSuccess(rpcMsg || `Institution "${orgName}" permanently deleted.`);
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

  // Open Create Demo School Modal
  const openCreateDemo = () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setDemoForm({
      name: "",
      type: "school",
      directorName: "",
      phone: "",
      email: "",
      password: `Demo@${randomSuffix}`,
      trialDays: 15,
      studentLimit: 100,
    });
    setDemoError("");
    setDemoSuccess(null);
    setDemoCopied(false);
    setShowDemoModal(true);
  };

  // Submit Handler for Demo School Account Creation
  const handleCreateDemoAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!demoForm.name.trim()) {
      setDemoError("Please enter the school / institute name.");
      return;
    }
    if (!demoForm.password.trim() || demoForm.password.trim().length < 8) {
      setDemoError("Password must be at least 8 characters long.");
      return;
    }

    setDemoLoading(true);
    setDemoError("");

    try {
      const cleanSlug =
        demoForm.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 10) || "demo";
      const randomTag = Math.floor(1000 + Math.random() * 9000);
      const generatedEmail = `${cleanSlug}_${randomTag}@edutechlab.demo`;
      const finalEmail = demoForm.email.trim().toLowerCase() || generatedEmail;

      const { data, error: fnError } = await supabase.functions.invoke("register-institute", {
        body: {
          instituteName: demoForm.name.trim(),
          instituteType: demoForm.type,
          adminName: demoForm.directorName.trim() || "Institute Director",
          adminEmail: finalEmail,
          password: demoForm.password.trim(),
          phone: demoForm.phone.trim() || undefined,
        },
      });

      if (fnError || data?.error) {
        throw new Error(fnError?.message || data?.error || "Failed to create demo account.");
      }

      const loginId = data?.loginId;
      if (!loginId) {
        throw new Error("Institute registered but no login ID was returned.");
      }

      // Automatically assign the free trial days & student capacity in subscription
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("login_id", loginId)
          .maybeSingle();

        if (profile?.organization_id) {
          await supabase.rpc("admin_grant_free_trial", {
            p_org_id: profile.organization_id,
            p_trial_days: Number(demoForm.trialDays) || 15,
            p_student_limit: Number(demoForm.studentLimit) || 100,
            p_master_code: MASTER_ACCESS_CODE,
          });
        }
      } catch (trialErr) {
        console.warn("Could not adjust trial quota:", trialErr);
      }

      const origin =
        typeof window !== "undefined" && window.location.origin
          ? window.location.origin
          : "https://edutechlab.vercel.app";
      const portalUrl = `${origin}/login`;

      setDemoSuccess({
        loginId,
        password: demoForm.password.trim(),
        instituteName: data?.instituteName || demoForm.name.trim(),
        adminName: data?.adminName || demoForm.directorName.trim() || "Institute Director",
        adminEmail: finalEmail,
        trialDays: Number(demoForm.trialDays) || 15,
        studentLimit: Number(demoForm.studentLimit) || 100,
        portalUrl,
      });

      setSuccess(`Demo account "${demoForm.name.trim()}" created successfully with Login ID: ${loginId}!`);
      await checkAndLoad();
    } catch (err: any) {
      setDemoError(err.message || "Failed to create demo account.");
    } finally {
      setDemoLoading(false);
    }
  };

  // Copy WhatsApp Shareable Invitation
  const handleCopyWhatsAppText = () => {
    if (!demoSuccess) return;
    const text = `🌟 *EduTechLab School Management Software - Demo Login* 🌟

Namaste *${demoSuccess.adminName}* ji,
Here are your exclusive login details for *${demoSuccess.instituteName}*:

🔗 *Login Portal:* ${demoSuccess.portalUrl}
🆔 *Institute Login ID:* ${demoSuccess.loginId}
🔑 *Password:* ${demoSuccess.password}
⏳ *Free Trial Period:* ${demoSuccess.trialDays} Days (Full Access)
👥 *Student Capacity:* Up to ${demoSuccess.studentLimit} Students

📱 *How to access from Mobile or Laptop:*
1. Open the login link above in Chrome or Safari.
2. Enter your Institute Login ID and Password.
3. Instantly manage Admissions, Attendance, Fee Collection, Marksheets, and Time Tables!

For any assistance or setup guidance, we are just a message away! 🚀`;

    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setDemoCopied(true);
      setTimeout(() => setDemoCopied(false), 3000);
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openCreateDemo}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:from-purple-500 hover:to-indigo-500 active:scale-95 transition"
          >
            <Plus size={16} />
            Create Demo / School Account
          </button>
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

        <button
          onClick={() => setActiveTab("features")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 transition ${
            activeTab === "features"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Sliders size={16} />
          Feature Controller & Matrix
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
                            {/* Feature Allocation Controller Button */}
                            <button
                              onClick={() => openManageFeaturesModal(inst)}
                              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 shadow-sm"
                              title="Configure and allocate active features for this school"
                            >
                              <Sliders size={12} />
                              Features ({Object.values(inst.enabled_features || getDefaultFeaturesMap()).filter(Boolean).length}/13)
                            </button>

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
      {/* TAB 4: FEATURE ALLOCATION CONTROLLER & MATRIX                  */}
      {/* ============================================================== */}
      {activeTab === "features" && (
        <section className="mt-6 space-y-6">
          {/* Top Info Banner */}
          <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
                  <Sliders size={13} /> Super Admin Feature Controller
                </div>
                <h2 className="mt-2 text-xl font-extrabold text-slate-900">
                  School Modules & Features Allocation Matrix
                </h2>
                <p className="mt-1 text-xs text-slate-600 max-w-2xl leading-relaxed">
                  Decide exactly which tools each school gets access to. Disabled modules are automatically hidden from the school admin navigation and restricted if accessed directly.
                </p>
              </div>

              {/* Quick stats */}
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-white/60 bg-white/80 px-4 py-2 text-center backdrop-blur shadow-sm">
                  <span className="block text-xl font-extrabold text-indigo-700">{institutions.length}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Schools</span>
                </div>
                <div className="rounded-xl border border-white/60 bg-white/80 px-4 py-2 text-center backdrop-blur shadow-sm">
                  <span className="block text-xl font-extrabold text-emerald-600">
                    {institutions.filter(i => Object.values(i.enabled_features || getDefaultFeaturesMap()).filter(Boolean).length === 13).length}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Full Enterprise (13/13)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Matrix Table Section */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Schools Feature Deployment Status</h3>
                <p className="text-xs text-slate-500">Click &quot;Configure&quot; on any school row to toggle individual modules.</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter schools..."
                    value={featureMatrixSearch}
                    onChange={(e) => setFeatureMatrixSearch(e.target.value)}
                    className="rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-indigo-600 w-44 sm:w-56"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3.5 whitespace-nowrap sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      Institution Name
                    </th>
                    <th className="px-3 py-3.5 whitespace-nowrap text-center">Active Features</th>
                    <th className="px-3 py-3.5 whitespace-nowrap text-center" title="Student Directory & Admission">Students</th>
                    <th className="px-3 py-3.5 whitespace-nowrap text-center" title="Printable ID Cards">ID Cards</th>
                    <th className="px-3 py-3.5 whitespace-nowrap text-center" title="TC, Character & Bonafide">Certificates</th>
                    <th className="px-3 py-3.5 whitespace-nowrap text-center" title="Academics, Classes & Sections">Academics</th>
                    <th className="px-3 py-3.5 whitespace-nowrap text-center" title="Class Timetable Routine">Timetable</th>
                    <th className="px-3 py-3.5 whitespace-nowrap text-center" title="Daily Homework Diary">Homework</th>
                    <th className="px-3 py-3.5 whitespace-nowrap text-center" title="Teacher Directory">Teachers</th>
                    <th className="px-3 py-3.5 whitespace-nowrap text-center" title="Daily Attendance Tracker">Attendance</th>
                    <th className="px-3 py-3.5 whitespace-nowrap text-center" title="Fees Collection & Invoices">Fees</th>
                    <th className="px-3 py-3.5 whitespace-nowrap text-center" title="Expenses & Kharcha Tracker">Expenses</th>
                    <th className="px-3 py-3.5 whitespace-nowrap text-center" title="Exams & Report Cards">Exams</th>
                    <th className="px-3 py-3.5 whitespace-nowrap text-center" title="Digital Noticeboard">Notices</th>
                    <th className="px-3 py-3.5 whitespace-nowrap text-center" title="Staff Role Permissions">Staff</th>
                    <th className="px-4 py-3.5 whitespace-nowrap text-right sticky right-0 bg-slate-50 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {institutions
                    .filter(i => !featureMatrixSearch || i.name.toLowerCase().includes(featureMatrixSearch.toLowerCase()) || i.slug.toLowerCase().includes(featureMatrixSearch.toLowerCase()))
                    .map((inst) => {
                      const feat = inst.enabled_features || getDefaultFeaturesMap();
                      const activeCount = Object.values(feat).filter(Boolean).length;
                      return (
                        <tr key={inst.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            <div className="flex flex-col">
                              <span>{inst.name}</span>
                              <span className="text-[10px] font-mono text-slate-400 font-normal">/{inst.slug}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              activeCount === 13 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-purple-50 text-purple-700 border border-purple-200"
                            }`}>
                              {activeCount} / 13
                            </span>
                          </td>
                          {(["students","id_cards","certificates","academics","timetable","homework","teachers","attendance","fees","expenses","exams","notices","staff"] as FeatureKey[]).map((k) => {
                            const isEn = feat[k] !== false;
                            return (
                              <td key={k} className="px-3 py-3 text-center whitespace-nowrap">
                                <span className={`inline-grid h-6 w-6 place-items-center rounded-lg text-xs font-bold ${
                                  isEn ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-400 opacity-60"
                                }`}>
                                  {isEn ? "✓" : "—"}
                                </span>
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-right whitespace-nowrap sticky right-0 bg-white z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            <button
                              onClick={() => openManageFeaturesModal(inst)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-sm hover:bg-indigo-100 transition"
                            >
                              <Sliders size={12} />
                              Configure
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
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

      {/* ============================================================== */}
      {/* MODAL 5: FEATURE ALLOCATION CONTROLLER MODAL                   */}
      {/* ============================================================== */}
      {managingFeaturesInst && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl border border-indigo-200 bg-white p-6 shadow-2xl my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-100 text-indigo-700 shadow-sm">
                  <Sliders size={20} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">Feature Allocation Controller</h3>
                    <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-extrabold text-indigo-800 uppercase tracking-wider">
                      {Object.values(currentFeatures).filter(Boolean).length} / 13 Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Configure accessible features for <strong>{managingFeaturesInst.name}</strong> ({managingFeaturesInst.slug})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManagingFeaturesInst(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Preset Bundles */}
            <div className="mt-4 pt-1 shrink-0">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                1-Click Quick Preset Bundles:
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyPreset("all")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition shadow-sm"
                >
                  <Sparkles size={13} />
                  Full Enterprise (13/13)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset("academic_standard")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-800 hover:bg-indigo-100 transition shadow-sm"
                >
                  Standard School (9/13)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset("basic_lite")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition shadow-sm"
                >
                  Basic Lite (5/13)
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleAllFeatures(true)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleAllFeatures(false)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Scrollable Features List */}
            <div className="mt-4 overflow-y-auto pr-1 space-y-4 flex-1">
              {(["Core Operations", "Academics & Routine", "Administration & Security", "Finance & Accounts"] as const).map((cat) => {
                const catFeatures = PLATFORM_FEATURES.filter((f) => f.category === cat);
                return (
                  <div key={cat} className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2.5 block">
                      {cat}
                    </span>
                    <div className="space-y-2">
                      {catFeatures.map((feat) => {
                        const isEnabled = currentFeatures[feat.key] !== false;
                        return (
                          <div
                            key={feat.key}
                            onClick={() => handleToggleSingleFeature(feat.key)}
                            className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition ${
                              isEnabled
                                ? "border-emerald-200 bg-white shadow-sm"
                                : "border-slate-200 bg-slate-100/60 opacity-60"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`mt-0.5 grid h-7 w-7 place-items-center rounded-lg text-xs font-bold ${
                                isEnabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-500"
                              }`}>
                                {isEnabled ? "✓" : "✕"}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-900">{feat.name}</span>
                                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
                                    {feat.path}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[11px] text-slate-500 max-w-md">{feat.description}</p>
                              </div>
                            </div>

                            {/* Toggle Switch */}
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                isEnabled ? "text-emerald-700" : "text-slate-400"
                              }`}>
                                {isEnabled ? "Active" : "Locked"}
                              </span>
                              <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                isEnabled ? "bg-emerald-600" : "bg-slate-300"
                              }`}>
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  isEnabled ? "translate-x-6" : "translate-x-1"
                                }`} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="mt-4 pt-4 border-t flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">
                Changes take effect instantly on school login.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setManagingFeaturesInst(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingFeatures}
                  onClick={handleSaveFeatures}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 transition disabled:opacity-50"
                >
                  {savingFeatures ? "Saving Features..." : "Save Feature Allocation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 6: CREATE DEMO / SCHOOL ACCOUNT MODAL                    */}
      {/* ============================================================== */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl rounded-3xl border border-purple-200 bg-white p-6 shadow-2xl my-8">
            {!demoSuccess ? (
              <>
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-purple-100 text-purple-700 shadow-sm">
                      <Sparkles size={20} />
                    </span>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        Create Instant School Demo Account
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Instantly creates an active ID &amp; password to demo on client&apos;s phone.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDemoModal(false)}
                    className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
                  >
                    <X size={18} />
                  </button>
                </div>

                {demoError && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-medium">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>{demoError}</span>
                  </div>
                )}

                <form onSubmit={handleCreateDemoAccount} className="mt-4 space-y-4">
                  {/* Row 1: School Name & Type */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        School / Institute Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={demoForm.name}
                        onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })}
                        placeholder="e.g. Modern Public School"
                        className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Institute Type
                      </label>
                      <select
                        value={demoForm.type}
                        onChange={(e) =>
                          setDemoForm({
                            ...demoForm,
                            type: e.target.value as "school" | "madrasa" | "coaching" | "other",
                          })
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-purple-600"
                      >
                        <option value="school">School</option>
                        <option value="coaching">Coaching Institute</option>
                        <option value="madrasa">Madrasa</option>
                        <option value="other">College / Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Director Name & Phone */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Director / Principal Name
                      </label>
                      <input
                        type="text"
                        value={demoForm.directorName}
                        onChange={(e) => setDemoForm({ ...demoForm, directorName: e.target.value })}
                        placeholder="e.g. Ramesh Kumar"
                        className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-purple-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Client Phone / WhatsApp
                      </label>
                      <input
                        type="tel"
                        value={demoForm.phone}
                        onChange={(e) => setDemoForm({ ...demoForm, phone: e.target.value })}
                        placeholder="e.g. 9876543210 (optional)"
                        className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-purple-600"
                      />
                    </div>
                  </div>

                  {/* Row 3: Password & Email */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Demo Password * (min 8 chars)
                      </label>
                      <input
                        type="text"
                        required
                        minLength={8}
                        value={demoForm.password}
                        onChange={(e) => setDemoForm({ ...demoForm, password: e.target.value })}
                        placeholder="e.g. Demo@2026"
                        className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono font-bold text-purple-700 outline-none focus:border-purple-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Custom Email (Optional)
                      </label>
                      <input
                        type="email"
                        value={demoForm.email}
                        onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                        placeholder="Auto-generated if left blank"
                        className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-purple-600"
                      />
                    </div>
                  </div>

                  {/* Row 4: Trial Days & Student Limit */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Free Trial Period (Days)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={demoForm.trialDays}
                        onChange={(e) =>
                          setDemoForm({ ...demoForm, trialDays: Math.max(1, Number(e.target.value) || 1) })
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-purple-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Student Capacity Limit
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={10000}
                        value={demoForm.studentLimit}
                        onChange={(e) =>
                          setDemoForm({
                            ...demoForm,
                            studentLimit: Math.max(10, Number(e.target.value) || 100),
                          })
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-purple-600"
                      />
                    </div>
                  </div>

                  {/* Info notice */}
                  <div className="rounded-xl bg-purple-50 p-3 text-[11px] leading-relaxed text-purple-800">
                    💡 <strong>Instant Setup:</strong> A unique Institute Login ID (e.g. <code>EDU-MPS2026</code>) and database workspace will be generated immediately. The client can log in from mobile or laptop directly using either the Institute ID or their Email.
                  </div>

                  {/* Modal Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setShowDemoModal(false)}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={demoLoading}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:from-purple-500 hover:to-indigo-500 transition disabled:opacity-50"
                    >
                      {demoLoading ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          Creating Account...
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} />
                          Generate Demo Account Now
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              /* Success Screen */
              <div className="space-y-4">
                <div className="text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-emerald-100 text-emerald-600 shadow-sm">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="mt-3 text-xl font-bold text-slate-900">
                    Demo Account Ready!
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Hand this Login ID &amp; Password directly to the school client for their live demo.
                  </p>
                </div>

                {/* Credentials Highlight Card */}
                <div className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white shadow-inner">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs font-medium text-slate-400">School Name</span>
                    <span className="text-sm font-bold text-emerald-400">{demoSuccess.instituteName}</span>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-800/80 p-3">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Institute Login ID
                      </span>
                      <span className="mt-0.5 block font-mono text-base font-bold text-yellow-300">
                        {demoSuccess.loginId}
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-800/80 p-3">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Password
                      </span>
                      <span className="mt-0.5 block font-mono text-base font-bold text-white">
                        {demoSuccess.password}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-800/80 px-3 py-2 text-xs">
                    <span className="text-slate-400">Login Portal:</span>
                    <span className="font-mono text-purple-300 truncate max-w-[240px]">
                      {demoSuccess.portalUrl}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Trial Validity: <strong className="text-white">{demoSuccess.trialDays} Days Free</strong></span>
                    <span>Student Limit: <strong className="text-white">{demoSuccess.studentLimit} Students</strong></span>
                  </div>
                </div>

                {/* WhatsApp & Copy Action Card */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                    <Smartphone size={16} />
                    <span>Share with School Director</span>
                  </div>
                  <p className="mt-1 text-[11px] text-emerald-800 leading-relaxed">
                    Click the button below to copy a pre-formatted invitation text ready to send over WhatsApp or SMS.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleCopyWhatsAppText}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-sm ${
                        demoCopied
                          ? "bg-emerald-600 text-white"
                          : "bg-emerald-700 text-white hover:bg-emerald-800"
                      }`}
                    >
                      {demoCopied ? (
                        <>
                          <Check size={15} />
                          Copied to Clipboard!
                        </>
                      ) : (
                        <>
                          <Copy size={15} />
                          Copy for WhatsApp / SMS
                        </>
                      )}
                    </button>

                    {demoForm.phone && (
                      <a
                        href={`https://wa.me/91${demoForm.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                          `🌟 *EduTechLab School Management Software - Demo Login* 🌟\n\nNamaste *${demoSuccess.adminName}* ji,\nHere are your login credentials for *${demoSuccess.instituteName}*:\n\n🔗 *Login Portal:* ${demoSuccess.portalUrl}\n🆔 *Institute Login ID:* ${demoSuccess.loginId}\n🔑 *Password:* ${demoSuccess.password}\n⏳ *Free Trial Period:* ${demoSuccess.trialDays} Days (Full Access)\n👥 *Student Capacity:* Up to ${demoSuccess.studentLimit} Students\n\n📱 *How to access from Mobile or Laptop:*\n1. Open the login link above in Chrome or Safari.\n2. Enter your Institute Login ID and Password.\n3. Instantly manage Admissions, Attendance, Fee Collection, Marksheets, and Time Tables!\n\nFor any help, we are always here! 🚀`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3.5 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition shadow-sm"
                      >
                        <Send size={14} />
                        Send directly via WhatsApp
                      </a>
                    )}
                  </div>
                </div>

                {/* Done / Create Another */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <button
                    type="button"
                    onClick={openCreateDemo}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    <Plus size={14} />
                    Create Another Demo
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowDemoModal(false);
                      setDemoSuccess(null);
                    }}
                    className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
                  >
                    Done &amp; Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
