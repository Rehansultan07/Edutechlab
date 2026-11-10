"use client";

import { useEffect, useState, useMemo, FormEvent, ChangeEvent } from "react";
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
  MessageCircle,
  Globe,
  Phone,
  Mail,
  MapPin,
  Megaphone,
  Youtube,
  Pause,
  Play,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  BarChart3,
  HelpCircle,
  BadgePercent,
  UserPlus,
  UserCheck,
  Banknote,
  Link2,
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
import { compressAvatarPhoto } from "@/lib/imageCompression";
import InstallButton from "@/components/pwa/InstallButton";
import { runSystemCleanup, CleanupResult } from "@/lib/cleanup";

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
  is_paused?: boolean;
  pause_reason?: string | null;
  paused_at?: string | null;
  referred_by_agent_id?: string | null;
  referral_code_used?: string | null;
  subscription?: {
    student_limit: number;
    status: string;
    is_trial: boolean;
    current_period_ends_at: string;
    is_paused?: boolean;
    pause_reason?: string | null;
    paused_at?: string | null;
    monthly_amount?: number;
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
  payment_category?: "joining_fee" | "recurring" | "combined";
  joining_fee_portion?: number;
  notes?: string | null;
  created_at: string;
};

type SalesAgentItem = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  agent_code: string;
  joining_commission_percent: number;
  recurring_commission_percent: number;
  upi_id: string | null;
  bank_details: string | null;
  city: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  total_schools: number;
  active_paid_schools: number;
  trial_schools: number;
  total_revenue_generated: number;
  joining_earned: number;
  recurring_earned: number;
  bonus_earned: number;
  total_earned: number;
  total_paid_out: number;
  pending_balance: number;
};

type AgentCommissionItem = {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_code: string;
  organization_id: string | null;
  organization_name: string;
  commission_type: "joining_fee" | "recurring" | "bonus_adjustment";
  gross_payment_amount: number;
  commission_percent: number;
  commission_amount: number;
  reference_utr: string | null;
  notes: string | null;
  created_at: string;
};

type AgentPayoutItem = {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_code: string;
  amount: number;
  payment_method: string;
  reference_no: string | null;
  paid_for_month: string | null;
  notes: string | null;
  paid_at: string;
};

type OnboardingAgentInfo = {
  id?: string;
  fullName: string;
  phone: string;
  email: string;
  agentCode: string;
  password?: string;
  joiningPercent: number;
  recurringPercent: number;
  city?: string;
  upiId?: string;
  mode: "created" | "password_reset" | "reshare";
};

const formatWhatsAppPhone = (rawPhone: string): string => {
  const digits = (rawPhone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
};

type PlatformSettings = {
  base_price: number;
  base_students: number;
  extra_student_rate: number;
  default_trial_days: number;
  upi_id: string;
  upi_name: string;
  upi_qr_url: string | null;
  contact_phone: string;
  contact_email: string;
  whatsapp_number: string;
  brand_name: string;
  brand_tagline: string;
  company_address: string;
  announcement_text: string;
  announcement_active: boolean;
  youtube_demo_url: string;
  standard_rate: number;
  pro_rate: number;
};

const MASTER_ACCESS_CODE = "Edutechlab@#78692";

export default function SuperAdminPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [institutions, setInstitutions] = useState<InstitutionItem[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [pricing, setPricing] = useState<PlatformSettings>({
    base_price: 149,
    base_students: 20,
    extra_student_rate: 7,
    default_trial_days: 0,
    upi_id: "edutechlab@upi",
    upi_name: "EduTechLab Platform",
    upi_qr_url: null,
    contact_phone: "+91 79031 78550",
    contact_email: "edutechlab@gmail.com",
    whatsapp_number: "917903178550",
    brand_name: "EduTechLab",
    brand_tagline: "Bharat Ka Sabse Fast & Aasan School Management Software",
    company_address: "India",
    announcement_text: "NEW v2.0: Bharat Ka Sabse Fast & Aasan School Management Software • Risk-Free Trial!",
    announcement_active: true,
    youtube_demo_url: "",
    standard_rate: 5,
    pro_rate: 7,
  });

  const [activeTab, setActiveTab] = useState<
    "institutions" | "requests" | "revenue" | "agents" | "pricing" | "features"
  >("institutions");
  // Sales Agents & Commission System States
  const [salesAgents, setSalesAgents] = useState<SalesAgentItem[]>([]);
  const [agentCommissions, setAgentCommissions] = useState<AgentCommissionItem[]>([]);
  const [agentPayouts, setAgentPayouts] = useState<AgentPayoutItem[]>([]);
  const [agentsSqlReady, setAgentsSqlReady] = useState(true);
  const [agentSearch, setAgentSearch] = useState("");
  const [agentSubView, setAgentSubView] = useState<"agents" | "commissions" | "payouts">("agents");
  const [copiedAgentKey, setCopiedAgentKey] = useState("");

  // Create / Edit Sales Agent Modal
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<SalesAgentItem | null>(null);
  const [agentForm, setAgentForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    agentCode: "",
    password: "",
    joiningPercent: 50,
    recurringPercent: 20,
    upiId: "",
    bankDetails: "",
    city: "",
    notes: "",
    isActive: true,
  });
  const [savingAgent, setSavingAgent] = useState(false);
  const [agentModalError, setAgentModalError] = useState("");

  // Sales Agent Onboarding & WhatsApp Share Modal
  const [onboardingAgent, setOnboardingAgent] = useState<OnboardingAgentInfo | null>(null);
  const [onboardingMsgLang, setOnboardingMsgLang] = useState<"english" | "hinglish">("english");
  const [onboardingMsgText, setOnboardingMsgText] = useState("");
  const [onboardingCopied, setOnboardingCopied] = useState(false);

  // Record Payout to Agent Modal
  const [payingAgent, setPayingAgent] = useState<SalesAgentItem | null>(null);
  const [payoutForm, setPayoutForm] = useState({
    amount: 0,
    paymentMethod: "upi",
    referenceNo: "",
    paidForMonth: new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
    notes: "",
  });
  const [savingPayout, setSavingPayout] = useState(false);

  // Manual Commission / Bonus Modal
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusForm, setBonusForm] = useState({
    agentId: "",
    orgId: "",
    commissionType: "bonus_adjustment" as "joining_fee" | "recurring" | "bonus_adjustment",
    grossAmount: 0,
    commissionPercent: 50,
    commissionAmount: 0,
    notes: "",
  });
  const [savingBonus, setSavingBonus] = useState(false);

  // Assign Agent to Institution Modal
  const [assigningAgentInst, setAssigningAgentInst] = useState<InstitutionItem | null>(null);
  const [selectedAssignAgentId, setSelectedAssignAgentId] = useState<string>("");
  const [savingAssignAgent, setSavingAssignAgent] = useState(false);

  // Direct Offline/Joining Fee Payment Recorder Modal (on Institution)
  const [recordingDirectPayInst, setRecordingDirectPayInst] = useState<InstitutionItem | null>(null);
  const [directPayForm, setDirectPayForm] = useState({
    paymentCategory: "joining_fee" as "joining_fee" | "recurring" | "combined",
    amount: 1000,
    joiningPortion: 1000,
    durationDays: 0,
    studentLimit: 100,
    utrNumber: "",
    notes: "",
  });
  const [savingDirectPay, setSavingDirectPay] = useState(false);

  // Payment Approval Modal (with Commission Split Preview)
  const [approvingPay, setApprovingPay] = useState<PaymentRequest | null>(null);
  const [approveCategory, setApproveCategory] = useState<"recurring" | "joining_fee" | "combined">("recurring");
  const [approveJoiningPortion, setApproveJoiningPortion] = useState<number>(0);
  const [approveDurationDays, setApproveDurationDays] = useState<number>(30);
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
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);

  // Modals state: Pause Institute
  const [pausingInst, setPausingInst] = useState<InstitutionItem | null>(null);
  const [pauseReasonInput, setPauseReasonInput] = useState<string>("Monthly subscription fee overdue");
  const [pauseDateInput, setPauseDateInput] = useState<string>(new Date().toISOString().slice(0, 10));
  const [isPausing, setIsPausing] = useState(false);

  // Revenue Filter & Search States
  const [revenueFilter, setRevenueFilter] = useState<"all" | "active" | "paused" | "trial" | "expired">("all");
  const [revenueSearch, setRevenueSearch] = useState("");

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
    agentId: "",
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

      // Safely fetch organizations with fallback for schema cache compatibility
      let orgsList: any[] = [];
      try {
        const { data: oData, error: oErr } = await supabase
          .from("organizations")
          .select(
            "id, enabled_features, is_paused, pause_reason, paused_at, referred_by_agent_id, referral_code_used"
          );
        if (!oErr && oData) {
          orgsList = oData;
        } else {
          const { data: midOData, error: midErr } = await supabase
            .from("organizations")
            .select("id, enabled_features, is_paused, pause_reason, paused_at");
          if (!midErr && midOData) {
            orgsList = midOData;
          } else {
            const { data: fallbackOData } = await supabase
              .from("organizations")
              .select("id, enabled_features");
            if (fallbackOData) orgsList = fallbackOData;
          }
        }
      } catch {
        const { data: fallbackOData } = await supabase
          .from("organizations")
          .select("id, enabled_features");
        if (fallbackOData) orgsList = fallbackOData;
      }

      // Safely fetch Sales Agents Dashboard (if migration 0021 is applied)
      try {
        const { data: agentDash, error: agentErr } = await supabase.rpc(
          "admin_list_sales_agents_dashboard",
          { p_master_code: MASTER_ACCESS_CODE }
        );
        if (agentErr) {
          const msg = agentErr.message || "";
          if (agentErr.code === "PGRST202" || msg.includes("admin_list_sales_agents_dashboard") || msg.includes("sales_agents")) {
            setAgentsSqlReady(false);
          }
        } else if (agentDash) {
          setAgentsSqlReady(true);
          setSalesAgents((agentDash.agents || []) as SalesAgentItem[]);
          setAgentCommissions((agentDash.commissions || []) as AgentCommissionItem[]);
          setAgentPayouts((agentDash.payouts || []) as AgentPayoutItem[]);
        }
      } catch {
        // Silently ignore if migration 0021 hasn't been executed yet
      }

      if (statsRes.data) {
        setStats(statsRes.data as PlatformStats);
      }

      const subMap = new Map((subsRes.data || []).map((s: any) => [s.organization_id, s]));
      const orgMap = new Map((orgsList || []).map((o: any) => [o.id, o]));

      if (listRes.data) {
        const enrichedInsts = (listRes.data as InstitutionItem[]).map((inst) => {
          const sub = subMap.get(inst.id);
          const org = orgMap.get(inst.id);
          let rawFeat = org?.enabled_features;
          if (!rawFeat && typeof window !== "undefined") {
            try {
              const local = localStorage.getItem(`edutechlab_features_${inst.id}`);
              if (local) rawFeat = JSON.parse(local);
            } catch {}
          }
          const parsedFeat = parseFeatures(rawFeat);

          // Check pause status from column, subscription, or JSONB enabled_features fallback
          const isPausedFromFeat = Boolean(
            rawFeat && typeof rawFeat === "object" && rawFeat._is_paused === true
          );
          const isPaused = Boolean(
            org?.is_paused === true ||
            sub?.is_paused === true ||
            isPausedFromFeat
          );
          const pauseReason =
            (rawFeat && typeof rawFeat === "object" && rawFeat._pause_reason) ||
            sub?.pause_reason ||
            org?.pause_reason ||
            null;
          const pausedAt =
            (rawFeat && typeof rawFeat === "object" && rawFeat._paused_at) ||
            sub?.paused_at ||
            org?.paused_at ||
            null;

          return {
            ...inst,
            is_paused: isPaused,
            pause_reason: pauseReason,
            paused_at: pausedAt,
            referred_by_agent_id: org?.referred_by_agent_id || null,
            referral_code_used: org?.referral_code_used || null,
            enabled_features: parsedFeat,
            subscription: sub
              ? {
                  student_limit: sub.student_limit,
                  status: sub.status,
                  is_trial: sub.is_trial,
                  current_period_ends_at: sub.current_period_ends_at,
                  is_paused: isPaused,
                  pause_reason: pauseReason,
                  paused_at: pausedAt,
                  monthly_amount: sub.monthly_amount ? Number(sub.monthly_amount) : undefined,
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
          contact_phone: settingsRes.data.contact_phone || "+91 79031 78550",
          contact_email: settingsRes.data.contact_email || "edutechlab@gmail.com",
          whatsapp_number: settingsRes.data.whatsapp_number || "917903178550",
          brand_name: settingsRes.data.brand_name || "EduTechLab",
          brand_tagline: settingsRes.data.brand_tagline || "Bharat Ka Sabse Fast & Aasan School Management Software",
          company_address: settingsRes.data.company_address || "India",
          announcement_text: settingsRes.data.announcement_text || "NEW v2.0: Bharat Ka Sabse Fast & Aasan School Management Software • Risk-Free Trial!",
          announcement_active: settingsRes.data.announcement_active !== false,
          youtube_demo_url: settingsRes.data.youtube_demo_url || "",
          standard_rate: Number(settingsRes.data.standard_rate || 5),
          pro_rate: Number(settingsRes.data.pro_rate || 7),
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

  // Open Pause Modal
  const openPauseModal = (inst: InstitutionItem) => {
    setPausingInst(inst);
    setPauseReasonInput(inst.pause_reason || "Monthly subscription fee overdue");
    setPauseDateInput(
      inst.paused_at
        ? new Date(inst.paused_at).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
  };

  // Confirm Pause Institute
  const handleConfirmPause = async () => {
    if (!pausingInst) return;
    if (!pauseReasonInput.trim()) {
      alert("Please enter a reason for pausing this school.");
      return;
    }

    setIsPausing(true);
    setError("");
    setSuccess("");

    try {
      const pauseDateIso = new Date(pauseDateInput).toISOString();
      const cleanReason = pauseReasonInput.trim();

      // 1. Try dedicated RPC (if migration 0017 is run)
      try {
        await supabase.rpc("pause_institution", {
          p_org_id: pausingInst.id,
          p_reason: cleanReason,
          p_pause_date: pauseDateIso,
          p_master_code: MASTER_ACCESS_CODE,
        });
      } catch {}

      // 2. Direct column updates (if columns exist)
      try {
        await Promise.allSettled([
          supabase.from("organizations").update({
            is_paused: true,
            pause_reason: cleanReason,
            paused_at: pauseDateIso,
          }).eq("id", pausingInst.id),
          supabase.from("institution_subscriptions").update({
            is_paused: true,
            pause_reason: cleanReason,
            paused_at: pauseDateIso,
          }).eq("organization_id", pausingInst.id),
        ]);
      } catch {}

      // 3. 100% Guaranteed Schema-Independent Fallback:
      // Store _is_paused in organizations.enabled_features via update_institution_features RPC
      const currentFeatures = pausingInst.enabled_features ? { ...pausingInst.enabled_features } : {};
      const updatedFeatures = {
        ...currentFeatures,
        _is_paused: true,
        _pause_reason: cleanReason,
        _paused_at: pauseDateIso,
      };

      const { error: rpcFeatErr } = await supabase.rpc("update_institution_features", {
        p_org_id: pausingInst.id,
        p_features: updatedFeatures,
        p_master_code: MASTER_ACCESS_CODE,
      });

      if (rpcFeatErr) {
        await supabase
          .from("organizations")
          .update({ enabled_features: updatedFeatures })
          .eq("id", pausingInst.id);
      }

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            `edutechlab_features_${pausingInst.id}`,
            JSON.stringify(updatedFeatures)
          );
        } catch {}
      }

      setSuccess(`Institution "${pausingInst.name}" has been paused. All operational services are locked with your notice.`);
      setPausingInst(null);
      await checkAndLoad();
    } catch (err: any) {
      setError(err.message || "Failed to pause institution.");
    } finally {
      setIsPausing(false);
    }
  };

  // Resume Institute
  const handleResumeInstitute = async (inst: InstitutionItem) => {
    if (!confirm(`Are you sure you want to resume and reactivate all services for "${inst.name}"?`)) {
      return;
    }

    setBusyId(inst.id);
    setError("");
    setSuccess("");

    try {
      // 1. Try dedicated RPC (if migration 0017 is run)
      try {
        await supabase.rpc("resume_institution", {
          p_org_id: inst.id,
          p_master_code: MASTER_ACCESS_CODE,
        });
      } catch {}

      // 2. Direct column updates (if columns exist)
      try {
        await Promise.allSettled([
          supabase.from("organizations").update({
            is_paused: false,
            pause_reason: null,
            paused_at: null,
          }).eq("id", inst.id),
          supabase.from("institution_subscriptions").update({
            is_paused: false,
            pause_reason: null,
            paused_at: null,
          }).eq("organization_id", inst.id),
        ]);
      } catch {}

      // 3. 100% Guaranteed Schema-Independent Fallback:
      // Clear _is_paused in organizations.enabled_features via update_institution_features RPC
      const currentFeatures = inst.enabled_features ? { ...inst.enabled_features } : {};
      const updatedFeatures = {
        ...currentFeatures,
        _is_paused: false,
        _pause_reason: null,
        _paused_at: null,
      };

      const { error: rpcFeatErr } = await supabase.rpc("update_institution_features", {
        p_org_id: inst.id,
        p_features: updatedFeatures,
        p_master_code: MASTER_ACCESS_CODE,
      });

      if (rpcFeatErr) {
        await supabase
          .from("organizations")
          .update({ enabled_features: updatedFeatures })
          .eq("id", inst.id);
      }

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            `edutechlab_features_${inst.id}`,
            JSON.stringify(updatedFeatures)
          );
        } catch {}
      }

      setSuccess(`Institution "${inst.name}" has been resumed successfully! All services are now active.`);
      await checkAndLoad();
    } catch (err: any) {
      setError(err.message || "Failed to resume institution.");
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
      const featuresPayload = {
        ...currentFeatures,
        ...(managingFeaturesInst.is_paused
          ? {
              _is_paused: true,
              _pause_reason: managingFeaturesInst.pause_reason,
              _paused_at: managingFeaturesInst.paused_at,
            }
          : {
              _is_paused: false,
              _pause_reason: null,
              _paused_at: null,
            }),
      };

      // 1. Try RPC
      const { error: rpcErr } = await supabase.rpc("update_institution_features", {
        p_org_id: managingFeaturesInst.id,
        p_features: featuresPayload,
        p_master_code: MASTER_ACCESS_CODE,
      });

      // 2. Direct table update fallback
      if (rpcErr) {
        await supabase
          .from("organizations")
          .update({ enabled_features: featuresPayload })
          .eq("id", managingFeaturesInst.id);
      }

      // 3. Sync to local storage
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            `edutechlab_features_${managingFeaturesInst.id}`,
            JSON.stringify(featuresPayload)
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

      // 1. Try secure RPC with master code
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

      // 1b. Fallback without master code
      if (!rpcWorked) {
        try {
          const { data, error: err } = await supabase.rpc("delete_institution_permanently", {
            p_org_id: orgId,
          });
          if (!err && data?.success) {
            rpcWorked = true;
            rpcMsg = data.message;
          }
        } catch {}
      }

      // 2. Direct cascade deletion fallback (all related tables)
      if (!rpcWorked) {
        await Promise.allSettled([
          // Subscription & Platform Billing
          supabase.from("subscription_payments").delete().eq("organization_id", orgId),
          supabase.from("institution_subscriptions").delete().eq("organization_id", orgId),
          // Student Fees, Accounts & Expenses
          supabase.from("fee_payments").delete().eq("organization_id", orgId),
          supabase.from("student_fee_months").delete().eq("organization_id", orgId),
          supabase.from("student_fee_plans").delete().eq("organization_id", orgId),
          supabase.from("school_expenses").delete().eq("organization_id", orgId),
          // Exams & Academics
          supabase.from("exam_marks").delete().eq("organization_id", orgId),
          supabase.from("exams").delete().eq("organization_id", orgId),
          supabase.from("student_certificates").delete().eq("organization_id", orgId),
          supabase.from("class_timetables").delete().eq("organization_id", orgId),
          supabase.from("class_homework").delete().eq("organization_id", orgId),
          supabase.from("notices").delete().eq("organization_id", orgId),
          // Attendance
          supabase.from("attendance").delete().eq("organization_id", orgId),
          supabase.from("teacher_attendance").delete().eq("organization_id", orgId),
          // Staff & Teachers
          supabase.from("staff_permissions").delete().eq("organization_id", orgId),
          supabase.from("role_permissions").delete().eq("organization_id", orgId),
          supabase.from("staff_invites").delete().eq("organization_id", orgId),
          supabase.from("teachers").delete().eq("organization_id", orgId),
          // Students & Parents
          supabase.from("students").delete().eq("organization_id", orgId),
          supabase.from("parents").delete().eq("organization_id", orgId),
          // Classes & Sessions
          supabase.from("sections").delete().eq("organization_id", orgId),
          supabase.from("classes").delete().eq("organization_id", orgId),
          supabase.from("academic_sessions").delete().eq("organization_id", orgId),
          supabase.from("organization_settings").delete().eq("organization_id", orgId),
          // Profiles
          supabase.from("profiles").delete().eq("organization_id", orgId),
        ]);

        await supabase.from("organizations").delete().eq("id", orgId);
      }

      // 3. Clear local storage caches
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(`edutechlab_features_${orgId}`);
          localStorage.removeItem(`edutechlab_expenses_${orgId}`);
        } catch {}
      }

      // 4. Remove immediately from memory state (Institutions + Payments + Revenue ledger)
      setInstitutions((prev) => prev.filter((i) => i.id !== orgId));
      setPaymentRequests((prev) => prev.filter((p) => p.organization_id !== orgId));

      setSuccess(
        rpcMsg ||
          `Institution "${orgName}" and all related data (subscription payments, student records, fees, attendance, staff) have been completely wiped.`
      );
      setDeletingInst(null);
      setDeleteConfirmText("");
      await checkAndLoad();
    } catch (err: any) {
      setError(err.message || "Failed to permanently delete institution.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Open Payment Approval Modal with live Agent Commission Preview
  const openApprovePaymentModal = (pay: PaymentRequest) => {
    const initialCat: "recurring" | "joining_fee" | "combined" =
      pay.payment_category === "joining_fee" || pay.payment_category === "combined"
        ? pay.payment_category
        : pay.utr_number?.includes("JOINING + MONTHLY")
        ? "combined"
        : pay.utr_number?.includes("JOINING FEE")
        ? "joining_fee"
        : "recurring";

    setApprovingPay(pay);
    setApproveCategory(initialCat);
    setApproveJoiningPortion(
      initialCat === "joining_fee"
        ? Number(pay.amount) || 0
        : initialCat === "combined"
        ? Number(pay.joining_fee_portion || 1000)
        : 0
    );
    setApproveDurationDays(initialCat === "joining_fee" ? 0 : 30);
  };

  // Confirm Approve Payment Request
  const handleConfirmApprovePayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!approvingPay) return;
    const pay = approvingPay;

    setBusyId(pay.id);
    setError("");
    setSuccess("");

    try {
      const cleanJoin =
        approveCategory === "joining_fee"
          ? Number(pay.amount)
          : approveCategory === "combined"
          ? Math.max(0, Math.min(Number(pay.amount), Number(approveJoiningPortion) || 0))
          : 0;

      let { data, error: err } = await supabase.rpc("approve_subscription_payment", {
        p_payment_id: pay.id,
        p_duration_days: Math.max(0, Number(approveDurationDays) || 0),
        p_master_code: MASTER_ACCESS_CODE,
        p_payment_category: approveCategory,
        p_joining_fee_portion: cleanJoin,
      });

      if (err && (err.code === "PGRST202" || err.message?.includes("p_payment_category"))) {
        const legacyRes = await supabase.rpc("approve_subscription_payment", {
          p_payment_id: pay.id,
          p_duration_days: Math.max(1, Number(approveDurationDays) || 30),
          p_master_code: MASTER_ACCESS_CODE,
        });
        data = legacyRes.data;
        err = legacyRes.error;
      }

      if (err) throw err;

      // If institute was paused, automatically resume it upon payment approval
      try {
        await supabase.rpc("resume_institution", {
          p_org_id: pay.organization_id,
          p_master_code: MASTER_ACCESS_CODE,
        });
      } catch {}
      try {
        await Promise.all([
          supabase.from("organizations").update({
            is_paused: false,
            pause_reason: null,
            paused_at: null,
          }).eq("id", pay.organization_id),
          supabase.from("institution_subscriptions").update({
            is_paused: false,
            pause_reason: null,
            paused_at: null,
          }).eq("organization_id", pay.organization_id),
        ]);
      } catch {}

      const comm = data?.commission;
      const commNote =
        comm?.credited && Number(comm.total_commission) > 0
          ? ` Partner ${comm.agent_name} (${comm.agent_code}) credited +₹${comm.total_commission} commission!`
          : "";

      setSuccess(
        `Payment for ${pay.organization_name} approved!${
          approveDurationDays > 0 ? ` Subscription extended for ${approveDurationDays} days.` : ""
        }${commNote}`
      );
      setApprovingPay(null);
      await checkAndLoad();
    } catch (err: any) {
      setError(err.message || "Failed to approve payment.");
    } finally {
      setBusyId(null);
    }
  };

  // =========================================================================
  // SALES AGENTS, VARIABLE COMMISSIONS, REFERRAL ATTRIBUTION & PAYOUT HANDLERS
  // =========================================================================
  const openCreateAgentModal = () => {
    const suffix = Math.floor(10 + Math.random() * 89);
    setEditingAgent(null);
    setAgentForm({
      fullName: "",
      phone: "",
      email: "",
      agentCode: `AGT-${suffix}`,
      password: "",
      joiningPercent: 50,
      recurringPercent: 20,
      upiId: "",
      bankDetails: "",
      city: "",
      notes: "",
      isActive: true,
    });
    setAgentModalError("");
    setShowAgentModal(true);
  };

  const openEditAgentModal = (agent: SalesAgentItem) => {
    setEditingAgent(agent);
    setAgentForm({
      fullName: agent.full_name,
      phone: agent.phone,
      email: agent.email || "",
      agentCode: agent.agent_code,
      password: "",
      joiningPercent: Number(agent.joining_commission_percent ?? 50),
      recurringPercent: Number(agent.recurring_commission_percent ?? 20),
      upiId: agent.upi_id || "",
      bankDetails: agent.bank_details || "",
      city: agent.city || "",
      notes: agent.notes || "",
      isActive: agent.is_active,
    });
    setAgentModalError("");
    setShowAgentModal(true);
  };

  const buildAgentWhatsAppMessage = (
    agent: OnboardingAgentInfo,
    lang: "english" | "hinglish" = onboardingMsgLang
  ): string => {
    const origin =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : "https://edutechlab-9fz4.vercel.app";
    const brandName = (pricing.brand_name || "EduTechLab").trim();
    const portalUrl = `${origin}/agent-portal`;
    const referralUrl = `${origin}/register?ref=${encodeURIComponent(agent.agentCode)}`;
    const supportPhone = pricing.contact_phone || pricing.whatsapp_number || "+91 79031 78550";

    const altLogins: string[] = [];
    if (agent.phone?.trim()) altLogins.push(agent.phone.trim());
    if (agent.email?.trim()) altLogins.push(agent.email.trim());
    const altLoginDisplay =
      altLogins.length > 0 ? altLogins.join(" / ") : "Registered Mobile Number";

    const cleanPassword = agent.password?.trim() || "";
    const passwordDisplay = cleanPassword
      ? `*${cleanPassword}*`
      : lang === "hinglish"
      ? "_Aapka existing portal password (bhool gaye ho to Admin se reset karwayein)_"
      : "_Your existing portal password (contact Admin if you need a reset)_";

    const extraProfileLinesEng = [
      agent.city?.trim() ? `• *Assigned Territory:* ${agent.city.trim()}` : "",
      agent.upiId?.trim() ? `• *Payout UPI ID:* ${agent.upiId.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const extraProfileLinesHin = [
      agent.city?.trim() ? `• *Assigned Area / City:* ${agent.city.trim()}` : "",
      agent.upiId?.trim() ? `• *Payout UPI ID:* ${agent.upiId.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    if (lang === "hinglish") {
      const introLine =
        agent.mode === "password_reset"
          ? `Aapke *${brandName} Sales Partner Portal* ka password Admin dwara update kar diya gaya hai. Naye login details niche diye gaye hain:`
          : agent.mode === "reshare"
          ? `Aapke *${brandName} Sales Partner Account* ke official portal login aur referral details niche diye gaye hain:`
          : `Aapka *${brandName} Sales Partner Account* safaltapoorvak activate ho gaya hai! Ab aap Schools, Madrasas aur Coaching Institutes ko jood kar har joining aur har mahine recurring commission kama sakte hain.`;

      return `🤝 *${brandName} — Sales Partner Portal Details* 🚀

Namaste *${agent.fullName}* ji,
${introLine}

🔐 *Partner Portal Login Details*
• *Portal Link:* ${portalUrl}
• *Agent Code:* *${agent.agentCode}*
• *Mobile / Email Login:* ${altLoginDisplay}
• *Password:* ${passwordDisplay}

💰 *Aapka Approved Commission Plan*
• *One-Time Joining Fee:* *${agent.joiningPercent}%* Commission
• *Monthly Recurring:* *${agent.recurringPercent}%* (Har mahine jab school renew karega)${extraProfileLinesHin ? `\n${extraProfileLinesHin}` : ""}

🔗 *Aapka Unique School Referral Link*
${referralUrl}
_(Jo bhi school is link se ya Referral Code *${agent.agentCode}* daal kar register karega, uska commission seedhe aapke wallet me credit hoga.)_

🚀 *Kaam Kaise Shuru Karein:*
1. Upar diye *Portal Link* par jaakar Agent Code aur Password se login karein.
2. Apna *Referral Link* interested schools ko bhejein ya unka free trial start karwayein.
3. Portal par apni *Live Schools, Commission Earnings aur Payouts* kabhi bhi check karein.

📞 *Partner Support:* ${supportPhone}
_${cleanPassword ? "Suraksha ke liye pehli baar login karne ke baad apna password zaroor change kar lein." : "Kisi bhi sahayata ya password reset ke liye support par sampark karein."}_

Shubhkamnayein,
*Team ${brandName}* 🌟`;
    }

    const introLineEng =
      agent.mode === "password_reset"
        ? `Your password for the *${brandName} Sales Partner Portal* has been updated by Admin. Please use your refreshed credentials below:`
        : agent.mode === "reshare"
        ? `Here are your official *${brandName} Sales Partner Portal* credentials, commission structure, and school referral link:`
        : `Welcome to the *${brandName} Partner Network*! Your official Sales Partner account is now active. You can start onboarding Schools, Madrasas, and Coaching Institutes immediately.`;

    return `🤝 *${brandName} — Official Sales Partner Onboarding* 🚀

Namaste *${agent.fullName}* ji,
${introLineEng}

🔐 *Partner Portal Login Credentials*
• *Portal URL:* ${portalUrl}
• *Agent Code:* *${agent.agentCode}*
• *Registered Phone / Email:* ${altLoginDisplay}
• *Password:* ${passwordDisplay}

💰 *Approved Commission Structure*
• *One-Time Joining Fee:* *${agent.joiningPercent}%* Commission
• *Monthly Subscription:* *${agent.recurringPercent}%* Recurring (Every month on school renewal)${extraProfileLinesEng ? `\n${extraProfileLinesEng}` : ""}

🔗 *Your Exclusive School Referral Link*
${referralUrl}
_(Any institution registering through this link or entering Referral Code *${agent.agentCode}* is permanently mapped to your commission wallet.)_

🚀 *Quick Start Guide:*
1. Open the Partner Portal link above and sign in with your Agent Code & Password.
2. Share your Referral Link directly with School Directors to start their free trial.
3. Track onboarded schools, monthly renewals, commission ledger & payouts live in your dashboard.

📞 *Partner Support:* ${supportPhone}
_${cleanPassword ? "Security tip: Please change your password from the Profile section after your first login." : "Reach out to Partner Support anytime for demos, pricing sheets, or assistance."}_

Warm regards,
*Team ${brandName}* 🌟`;
  };

  const openAgentOnboardingModal = (
    agentInfo: OnboardingAgentInfo,
    lang: "english" | "hinglish" = onboardingMsgLang
  ) => {
    setOnboardingAgent(agentInfo);
    setOnboardingMsgLang(lang);
    setOnboardingMsgText(buildAgentWhatsAppMessage(agentInfo, lang));
    setOnboardingCopied(false);
  };

  const handleOpenReshareAgentModal = (agent: SalesAgentItem) => {
    openAgentOnboardingModal({
      id: agent.id,
      fullName: agent.full_name,
      phone: agent.phone,
      email: agent.email || "",
      agentCode: agent.agent_code,
      password: "",
      joiningPercent: Number(agent.joining_commission_percent ?? 50),
      recurringPercent: Number(agent.recurring_commission_percent ?? 20),
      city: agent.city || "",
      upiId: agent.upi_id || "",
      mode: "reshare",
    });
  };

  const handleCopyOnboardingText = () => {
    if (!onboardingMsgText) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(onboardingMsgText);
      setOnboardingCopied(true);
      setTimeout(() => setOnboardingCopied(false), 3000);
    }
  };

  const handleSaveAgent = async (e: FormEvent) => {
    e.preventDefault();
    setAgentModalError("");
    if (!agentForm.fullName.trim() || !agentForm.phone.trim()) {
      setAgentModalError("Agent full name and phone number are required.");
      return;
    }
    if (!editingAgent && agentForm.password.trim().length < 6) {
      setAgentModalError("Please set an initial login password (at least 6 characters) for the agent.");
      return;
    }

    setSavingAgent(true);
    setError("");
    setSuccess("");

    try {
      let nextOnboardingPayload: OnboardingAgentInfo | null = null;

      if (editingAgent) {
        const { data, error: rpcErr } = await supabase.rpc("admin_update_sales_agent", {
          p_agent_id: editingAgent.id,
          p_full_name: agentForm.fullName.trim(),
          p_phone: agentForm.phone.trim(),
          p_email: agentForm.email.trim() || null,
          p_joining_percent: Number(agentForm.joiningPercent) || 0,
          p_recurring_percent: Number(agentForm.recurringPercent) || 0,
          p_upi_id: agentForm.upiId.trim() || null,
          p_bank_details: agentForm.bankDetails.trim() || null,
          p_city: agentForm.city.trim() || null,
          p_notes: agentForm.notes.trim() || null,
          p_is_active: agentForm.isActive,
          p_new_password: agentForm.password.trim() || null,
          p_master_code: MASTER_ACCESS_CODE,
        });
        if (rpcErr) throw rpcErr;
        setSuccess(data?.message || `Agent "${agentForm.fullName.trim()}" updated.`);

        if (agentForm.password.trim()) {
          nextOnboardingPayload = {
            id: editingAgent.id,
            fullName: agentForm.fullName.trim(),
            phone: agentForm.phone.trim(),
            email: agentForm.email.trim(),
            agentCode: editingAgent.agent_code,
            password: agentForm.password.trim(),
            joiningPercent: Number(agentForm.joiningPercent) || 0,
            recurringPercent: Number(agentForm.recurringPercent) || 0,
            city: agentForm.city.trim(),
            upiId: agentForm.upiId.trim(),
            mode: "password_reset",
          };
        }
      } else {
        const cleanCode = agentForm.agentCode
          .toUpperCase()
          .replace(/[^A-Z0-9_-]/g, "");
        const { data, error: rpcErr } = await supabase.rpc("admin_create_sales_agent", {
          p_full_name: agentForm.fullName.trim(),
          p_phone: agentForm.phone.trim(),
          p_email: agentForm.email.trim() || null,
          p_agent_code: cleanCode,
          p_password: agentForm.password.trim(),
          p_joining_percent: Number(agentForm.joiningPercent) || 0,
          p_recurring_percent: Number(agentForm.recurringPercent) || 0,
          p_upi_id: agentForm.upiId.trim() || null,
          p_bank_details: agentForm.bankDetails.trim() || null,
          p_city: agentForm.city.trim() || null,
          p_notes: agentForm.notes.trim() || null,
          p_master_code: MASTER_ACCESS_CODE,
        });
        if (rpcErr) throw rpcErr;
        setSuccess(
          data?.message ||
            `Sales Agent "${agentForm.fullName.trim()}" created! Agent Portal Login ready.`
        );

        nextOnboardingPayload = {
          id: data?.agent_id,
          fullName: agentForm.fullName.trim(),
          phone: agentForm.phone.trim(),
          email: agentForm.email.trim(),
          agentCode: data?.agent_code || cleanCode,
          password: agentForm.password.trim(),
          joiningPercent: Number(agentForm.joiningPercent) || 0,
          recurringPercent: Number(agentForm.recurringPercent) || 0,
          city: agentForm.city.trim(),
          upiId: agentForm.upiId.trim(),
          mode: "created",
        };
      }

      setShowAgentModal(false);
      if (nextOnboardingPayload) {
        openAgentOnboardingModal(nextOnboardingPayload);
      }
      await checkAndLoad();
    } catch (err: any) {
      setAgentModalError(err.message || "Failed to save sales agent.");
    } finally {
      setSavingAgent(false);
    }
  };

  const handleDeleteAgent = async (agent: SalesAgentItem) => {
    if (
      !confirm(
        `Delete sales agent "${agent.full_name}" (${agent.agent_code})? Their referral links will stop working and historical commission/payout records for this agent will be removed.`
      )
    ) {
      return;
    }
    setBusyId(agent.id);
    setError("");
    setSuccess("");
    try {
      const { data, error: rpcErr } = await supabase.rpc("admin_delete_sales_agent", {
        p_agent_id: agent.id,
        p_master_code: MASTER_ACCESS_CODE,
      });
      if (rpcErr) throw rpcErr;
      setSuccess(data?.message || `Agent "${agent.full_name}" removed.`);
      await checkAndLoad();
    } catch (err: any) {
      setError(err.message || "Failed to delete sales agent.");
    } finally {
      setBusyId(null);
    }
  };

  const openPayAgentModal = (agent: SalesAgentItem) => {
    setPayingAgent(agent);
    setPayoutForm({
      amount: Math.max(0, Number(agent.pending_balance) || 0),
      paymentMethod: agent.upi_id ? "upi" : "bank_transfer",
      referenceNo: "",
      paidForMonth: new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
      notes: "",
    });
  };

  const handleRecordAgentPayout = async (e: FormEvent) => {
    e.preventDefault();
    if (!payingAgent) return;
    if (Number(payoutForm.amount) <= 0) {
      setError("Payout amount must be greater than ₹0.");
      return;
    }

    setSavingPayout(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: rpcErr } = await supabase.rpc("admin_record_agent_payout", {
        p_agent_id: payingAgent.id,
        p_amount: Number(payoutForm.amount),
        p_payment_method: payoutForm.paymentMethod,
        p_reference_no: payoutForm.referenceNo.trim() || null,
        p_paid_for_month: payoutForm.paidForMonth.trim() || null,
        p_notes: payoutForm.notes.trim() || null,
        p_master_code: MASTER_ACCESS_CODE,
      });
      if (rpcErr) throw rpcErr;

      setSuccess(
        data?.message ||
          `Payout of ₹${payoutForm.amount} recorded for ${payingAgent.full_name}!`
      );
      setPayingAgent(null);
      await checkAndLoad();
    } catch (err: any) {
      setError(err.message || "Failed to record payout.");
    } finally {
      setSavingPayout(false);
    }
  };

  const openManualBonusModal = (agent?: SalesAgentItem) => {
    const targetAgent = agent || salesAgents[0] || null;
    setBonusForm({
      agentId: targetAgent?.id || "",
      orgId: "",
      commissionType: "bonus_adjustment",
      grossAmount: 0,
      commissionPercent: Number(targetAgent?.joining_commission_percent ?? 50),
      commissionAmount: 500,
      notes: "",
    });
    setShowBonusModal(true);
  };

  const handleSaveManualBonus = async (e: FormEvent) => {
    e.preventDefault();
    if (!bonusForm.agentId) {
      setError("Please select a sales agent.");
      return;
    }
    if (!bonusForm.commissionAmount || Number(bonusForm.commissionAmount) === 0) {
      setError("Commission amount cannot be zero.");
      return;
    }

    setSavingBonus(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: rpcErr } = await supabase.rpc("admin_add_manual_commission", {
        p_agent_id: bonusForm.agentId,
        p_org_id: bonusForm.orgId || null,
        p_commission_type: bonusForm.commissionType,
        p_gross_amount: Number(bonusForm.grossAmount) || 0,
        p_commission_percent: Number(bonusForm.commissionPercent) || 0,
        p_commission_amount: Number(bonusForm.commissionAmount),
        p_notes: bonusForm.notes.trim() || null,
        p_master_code: MASTER_ACCESS_CODE,
      });
      if (rpcErr) throw rpcErr;
      setSuccess(data?.message || "Commission entry added successfully.");
      setShowBonusModal(false);
      await checkAndLoad();
    } catch (err: any) {
      setError(err.message || "Failed to add manual commission.");
    } finally {
      setSavingBonus(false);
    }
  };

  const openAssignAgentModal = (inst: InstitutionItem) => {
    setAssigningAgentInst(inst);
    setSelectedAssignAgentId(inst.referred_by_agent_id || "");
  };

  const handleSaveAssignAgent = async (e: FormEvent) => {
    e.preventDefault();
    if (!assigningAgentInst) return;
    setSavingAssignAgent(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: rpcErr } = await supabase.rpc("admin_assign_agent_to_institution", {
        p_org_id: assigningAgentInst.id,
        p_agent_id: selectedAssignAgentId || null,
        p_master_code: MASTER_ACCESS_CODE,
      });
      if (rpcErr) throw rpcErr;
      setSuccess(
        data?.message || `Updated partner attribution for "${assigningAgentInst.name}".`
      );
      setAssigningAgentInst(null);
      await checkAndLoad();
    } catch (err: any) {
      setError(err.message || "Failed to assign partner.");
    } finally {
      setSavingAssignAgent(false);
    }
  };

  const openDirectPaymentModal = (inst: InstitutionItem) => {
    const quota = inst.subscription?.student_limit || Math.max(inst.student_count, 100);
    setRecordingDirectPayInst(inst);
    setDirectPayForm({
      paymentCategory: "joining_fee",
      amount: 1000,
      joiningPortion: 1000,
      durationDays: 0,
      studentLimit: quota,
      utrNumber: "",
      notes: "",
    });
  };

  const handleSaveDirectPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!recordingDirectPayInst) return;
    if (Number(directPayForm.amount) <= 0) {
      setError("Amount must be greater than ₹0.");
      return;
    }

    setSavingDirectPay(true);
    setError("");
    setSuccess("");

    try {
      const joiningPortion =
        directPayForm.paymentCategory === "joining_fee"
          ? Number(directPayForm.amount)
          : directPayForm.paymentCategory === "combined"
          ? Math.max(0, Math.min(Number(directPayForm.amount), Number(directPayForm.joiningPortion) || 0))
          : 0;

      const { data, error: rpcErr } = await supabase.rpc("admin_record_direct_school_payment", {
        p_org_id: recordingDirectPayInst.id,
        p_amount: Number(directPayForm.amount),
        p_payment_category: directPayForm.paymentCategory,
        p_duration_days: Number(directPayForm.durationDays) || 0,
        p_student_limit: Number(directPayForm.studentLimit) || 100,
        p_utr_number: directPayForm.utrNumber.trim() || "DIRECT-CASH-UPI",
        p_joining_fee_portion: joiningPortion,
        p_notes: directPayForm.notes.trim() || null,
        p_master_code: MASTER_ACCESS_CODE,
      });

      if (rpcErr) throw rpcErr;

      const comm = data?.approval?.commission;
      const commText =
        comm?.credited && Number(comm.total_commission) > 0
          ? ` Auto-credited +₹${comm.total_commission} to ${comm.agent_name} (${comm.agent_code})!`
          : "";

      setSuccess(
        `Recorded ₹${directPayForm.amount} payment for "${recordingDirectPayInst.name}".${commText}`
      );
      setRecordingDirectPayInst(null);
      await checkAndLoad();
    } catch (err: any) {
      setError(err.message || "Failed to record school payment.");
    } finally {
      setSavingDirectPay(false);
    }
  };

  const copyAgentShareText = (text: string, key: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedAgentKey(key);
      setTimeout(() => setCopiedAgentKey(""), 2500);
    }
  };

  // Automated System Cleanup Action
  const handleRunCleanup = async () => {
    setCleaningUp(true);
    setError("");
    setSuccess("");
    try {
      const res = await runSystemCleanup(supabase);
      setCleanupResult(res);
      setSuccess(
        `System cleanup finished! Removed ${res.approved_payments_deleted} approved payments (7d+), ${res.storage_files_deleted} screenshots, ${res.homework_deleted} old homework (90d+), and ${res.notices_deleted} notices.`
      );
      await checkAndLoad();
    } catch (err: any) {
      setError(err.message || "Failed to execute automated cleanup.");
    } finally {
      setCleaningUp(false);
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
      const compressedQr = await compressAvatarPhoto(file);
      const ext = compressedQr.name.split(".").pop()?.toLowerCase() || "webp";
      const path = `platform/upi_qr_code_${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("platform-assets")
        .upload(path, compressedQr, { upsert: true, contentType: compressedQr.type });

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

  // Save Pricing & Website Platform Settings
  const handleSavePricing = async (e: FormEvent) => {
    e.preventDefault();
    setSavingPricing(true);
    setError("");
    setSuccess("");

    try {
      let rpcSuccess = false;
      try {
        const { error: rpcErr } = await supabase.rpc("admin_save_platform_settings_v2", {
          p_base_price: pricing.base_price,
          p_base_students: pricing.base_students,
          p_extra_student_rate: pricing.extra_student_rate,
          p_default_trial_days: pricing.default_trial_days,
          p_upi_id: pricing.upi_id.trim(),
          p_upi_name: pricing.upi_name.trim(),
          p_contact_phone: pricing.contact_phone.trim(),
          p_contact_email: pricing.contact_email.trim(),
          p_upi_qr_url: pricing.upi_qr_url,
          p_whatsapp_number: pricing.whatsapp_number.trim(),
          p_brand_name: pricing.brand_name.trim(),
          p_brand_tagline: pricing.brand_tagline.trim(),
          p_company_address: pricing.company_address.trim(),
          p_announcement_text: pricing.announcement_text.trim(),
          p_announcement_active: pricing.announcement_active,
          p_youtube_demo_url: pricing.youtube_demo_url.trim(),
          p_standard_rate: pricing.standard_rate,
          p_pro_rate: pricing.pro_rate,
          p_master_code: MASTER_ACCESS_CODE,
        });
        if (!rpcErr) rpcSuccess = true;
      } catch {}

      if (!rpcSuccess) {
        // Fallback: direct table update
        const { error: directErr } = await supabase
          .from("platform_settings")
          .update({
            base_price: pricing.base_price,
            base_students: pricing.base_students,
            extra_student_rate: pricing.extra_student_rate,
            default_trial_days: pricing.default_trial_days,
            upi_id: pricing.upi_id.trim(),
            upi_name: pricing.upi_name.trim(),
            contact_phone: pricing.contact_phone.trim(),
            contact_email: pricing.contact_email.trim(),
            upi_qr_url: pricing.upi_qr_url,
            whatsapp_number: pricing.whatsapp_number.trim(),
            brand_name: pricing.brand_name.trim(),
            brand_tagline: pricing.brand_tagline.trim(),
            company_address: pricing.company_address.trim(),
            announcement_text: pricing.announcement_text.trim(),
            announcement_active: pricing.announcement_active,
            youtube_demo_url: pricing.youtube_demo_url.trim(),
            standard_rate: pricing.standard_rate,
            pro_rate: pricing.pro_rate,
            updated_at: new Date().toISOString(),
          })
          .eq("id", "global");

        if (directErr) {
          await supabase.rpc("admin_save_platform_settings", {
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
        }
      }

      setSuccess("Website branding, WhatsApp number, contact info, and pricing saved successfully!");
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
      agentId: "",
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

      // Automatically assign the free trial days, student capacity & optional Sales Agent
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

          if (demoForm.agentId) {
            await supabase.rpc("admin_assign_agent_to_institution", {
              p_org_id: profile.organization_id,
              p_agent_id: demoForm.agentId,
              p_master_code: MASTER_ACCESS_CODE,
            });
          }
        }
      } catch (trialErr) {
        console.warn("Could not adjust trial quota:", trialErr);
      }

      const origin =
        typeof window !== "undefined" && window.location.origin
          ? window.location.origin
          : "https://edutechlab-9fz4.vercel.app";
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

  const agentByIdMap = useMemo(
    () => new Map(salesAgents.map((a) => [a.id, a])),
    [salesAgents]
  );

  const instByIdMap = useMemo(
    () => new Map(institutions.map((i) => [i.id, i])),
    [institutions]
  );

  const agentSummaryMetrics = useMemo(() => {
    let activeAgentsCount = 0;
    let totalReferredSchools = 0;
    let totalCommissionsEarned = 0;
    let totalJoiningEarned = 0;
    let totalRecurringEarned = 0;
    let totalPaidOut = 0;
    let totalPendingPayout = 0;

    salesAgents.forEach((a) => {
      if (a.is_active) activeAgentsCount++;
      totalReferredSchools += Number(a.total_schools || 0);
      totalCommissionsEarned += Number(a.total_earned || 0);
      totalJoiningEarned += Number(a.joining_earned || 0);
      totalRecurringEarned += Number(a.recurring_earned || 0);
      totalPaidOut += Number(a.total_paid_out || 0);
      totalPendingPayout += Number(a.pending_balance || 0);
    });

    return {
      activeAgentsCount,
      totalReferredSchools,
      totalCommissionsEarned,
      totalJoiningEarned,
      totalRecurringEarned,
      totalPaidOut,
      totalPendingPayout,
    };
  }, [salesAgents]);

  const filteredSalesAgents = useMemo(() => {
    const q = agentSearch.trim().toLowerCase();
    if (!q) return salesAgents;
    return salesAgents.filter(
      (a) =>
        a.full_name.toLowerCase().includes(q) ||
        a.agent_code.toLowerCase().includes(q) ||
        a.phone.toLowerCase().includes(q) ||
        (a.email && a.email.toLowerCase().includes(q)) ||
        (a.city && a.city.toLowerCase().includes(q))
    );
  }, [salesAgents, agentSearch]);

  const siteOrigin =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://edutechlab-9fz4.vercel.app";

  // Revenue Metrics Calculations
  const revenueMetrics = useMemo(() => {
    let totalProjectedMRR = 0;
    let totalSubscribedCapacity = 0;
    const ratePerStudent = Number(pricing.standard_rate || 5);

    institutions.forEach((inst) => {
      const quota = inst.subscription?.student_limit || inst.student_count || pricing.base_students || 20;
      totalSubscribedCapacity += quota;
      const schoolMRR = inst.subscription?.monthly_amount
        ? Number(inst.subscription.monthly_amount)
        : Math.max(pricing.base_price, quota * ratePerStudent);
      totalProjectedMRR += schoolMRR;
    });

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const todayStr = now.toISOString().slice(0, 10);

    let allTimeApprovedRevenue = 0;
    let thisMonthApprovedRevenue = 0;
    let todayApprovedRevenue = 0;
    let pendingApprovalRevenue = 0;
    let approvedPaymentsCount = 0;
    let thisMonthApprovedCount = 0;

    const approvedLedger: PaymentRequest[] = [];

    paymentRequests.forEach((p) => {
      const amt = Number(p.amount) || 0;
      if (p.status === "approved") {
        allTimeApprovedRevenue += amt;
        approvedPaymentsCount++;
        approvedLedger.push(p);

        const pDate = new Date(p.created_at);
        if (pDate.getFullYear() === currentYear && pDate.getMonth() === currentMonth) {
          thisMonthApprovedRevenue += amt;
          thisMonthApprovedCount++;
        }
        if (p.created_at.slice(0, 10) === todayStr) {
          todayApprovedRevenue += amt;
        }
      } else if (p.status === "pending") {
        pendingApprovalRevenue += amt;
      }
    });

    return {
      totalProjectedMRR,
      totalSubscribedCapacity,
      ratePerStudent,
      allTimeApprovedRevenue,
      thisMonthApprovedRevenue,
      todayApprovedRevenue,
      pendingApprovalRevenue,
      approvedPaymentsCount,
      thisMonthApprovedCount,
      approvedLedger,
    };
  }, [institutions, paymentRequests, pricing]);

  const filteredRevenueInstitutions = institutions.filter((inst) => {
    const q = revenueSearch.toLowerCase();
    const matchesSearch =
      inst.name.toLowerCase().includes(q) ||
      inst.slug.toLowerCase().includes(q) ||
      (inst.owner_login_id && inst.owner_login_id.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (revenueFilter === "active") {
      return !inst.is_paused && inst.is_active && !inst.subscription?.is_trial;
    }
    if (revenueFilter === "paused") {
      return Boolean(inst.is_paused);
    }
    if (revenueFilter === "trial") {
      return Boolean(inst.subscription?.is_trial);
    }
    if (revenueFilter === "expired") {
      const sub = inst.subscription;
      return Boolean(sub?.current_period_ends_at && new Date(sub.current_period_ends_at) < new Date());
    }
    return true;
  });

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
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shrink-0"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-2xl border border-purple-200 bg-white p-0.5 shadow-sm flex items-center justify-center">
            <img
              src="/icons/icon-192.png"
              alt="EduTechLab Logo"
              className="h-full w-full object-contain rounded-xl"
            />
          </div>
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
            <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
              <span className="font-semibold text-emerald-600">
                {stats.active_institutions} active
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-semibold text-amber-700">
                {institutions.filter((i) => i.is_paused).length} paused
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
            <p className="mt-2 text-xs text-slate-500">
              Enrolled across all tenants ({revenueMetrics.totalSubscribedCapacity} capacity quota)
            </p>
          </div>

          <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-5 shadow-sm">
            <div className="flex items-center justify-between text-purple-700">
              <span className="text-sm font-medium">Projected Monthly MRR</span>
              <TrendingUp size={18} className="text-purple-600" />
            </div>
            <p className="mt-3 text-3xl font-bold text-purple-950">
              ₹{revenueMetrics.totalProjectedMRR.toLocaleString("en-IN")}
            </p>
            <p className="mt-2 text-xs text-purple-700">
              Expected monthly calculation ({institutions.length} schools @ ₹{pricing.standard_rate || 5}/child)
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
            <div className="flex items-center justify-between text-emerald-700">
              <span className="text-sm font-medium">Approved Collections</span>
              <Wallet size={18} className="text-emerald-600" />
            </div>
            <p className="mt-3 text-3xl font-bold text-emerald-950">
              ₹{revenueMetrics.allTimeApprovedRevenue.toLocaleString("en-IN")}
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-emerald-800">
              <span className="font-bold">₹{revenueMetrics.thisMonthApprovedRevenue.toLocaleString("en-IN")}</span>
              <span>this month ({revenueMetrics.thisMonthApprovedCount} approved)</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="mt-8 flex border-b border-slate-200 text-sm font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab("institutions")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 whitespace-nowrap transition ${
            activeTab === "institutions"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Building2 size={16} />
          Registered Institutions ({institutions.length})
        </button>

        <button
          onClick={() => setActiveTab("revenue")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 whitespace-nowrap transition ${
            activeTab === "revenue"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Wallet size={16} />
          Revenue &amp; Subscriptions
        </button>

        <button
          onClick={() => setActiveTab("requests")}
          className={`relative flex items-center gap-2 border-b-2 px-5 py-3 whitespace-nowrap transition ${
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
          onClick={() => setActiveTab("agents")}
          className={`relative flex items-center gap-2 border-b-2 px-5 py-3 whitespace-nowrap transition ${
            activeTab === "agents"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <BadgePercent size={16} />
          Sales Agents &amp; Payouts ({salesAgents.length})
          {agentSummaryMetrics.totalPendingPayout > 0 && (
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
              ₹{Math.round(agentSummaryMetrics.totalPendingPayout).toLocaleString("en-IN")}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("pricing")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 whitespace-nowrap transition ${
            activeTab === "pricing"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Globe size={16} />
          Website, Contact &amp; Pricing
        </button>

        <button
          onClick={() => setActiveTab("features")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 whitespace-nowrap transition ${
            activeTab === "features"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Sliders size={16} />
          Feature Controller &amp; Matrix
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
                    const linkedAgent = inst.referred_by_agent_id ? agentByIdMap.get(inst.referred_by_agent_id) : undefined;
                    return (
                      <tr key={inst.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">{inst.name}</div>
                          <div className="text-xs text-slate-400 font-mono">/{inst.slug}</div>
                          <button
                            type="button"
                            onClick={() => openAssignAgentModal(inst)}
                            className={`mt-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold transition ${
                              linkedAgent || inst.referral_code_used
                                ? "bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
                            title="Link or change Sales Partner for commission tracking"
                          >
                            <Link2 size={10} />
                            {linkedAgent
                              ? `Agent: ${linkedAgent.full_name} (${linkedAgent.agent_code})`
                              : inst.referral_code_used
                              ? `Agent Code: ${inst.referral_code_used}`
                              : "Direct (Link Agent)"}
                          </button>
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
                          {inst.is_paused ? (
                            <div className="mt-1">
                              <span
                                className="inline-flex items-center gap-1 rounded-md bg-amber-100 border border-amber-300 px-2 py-0.5 text-[11px] font-bold text-amber-900"
                                title={inst.pause_reason || "Services Paused"}
                              >
                                <Pause size={10} className="fill-amber-700 text-amber-700" />
                                Paused ({inst.paused_at ? new Date(inst.paused_at).toLocaleDateString("en-IN") : "Active"})
                              </span>
                              {inst.pause_reason && (
                                <div
                                  className="mt-0.5 max-w-[170px] truncate text-[10px] font-medium text-amber-800"
                                  title={inst.pause_reason}
                                >
                                  "{inst.pause_reason}"
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="mt-1">
                              {inst.is_active ? (
                                <span className="text-[11px] text-emerald-600 font-medium">● Operational</span>
                              ) : (
                                <span className="text-[11px] text-red-600 font-medium">● Suspended</span>
                              )}
                            </div>
                          )}
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

                            {/* Record Direct Joining Fee / Cash Payment */}
                            <button
                              onClick={() => openDirectPaymentModal(inst)}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                              title="Record direct Joining Fee or Monthly Payment & auto-credit partner commission"
                            >
                              <IndianRupee size={12} />
                              Payment
                            </button>

                            {/* Assign / Link Sales Partner Button */}
                            <button
                              onClick={() => openAssignAgentModal(inst)}
                              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                              title="Assign or change sales partner for this school"
                            >
                              <UserCheck size={12} />
                              Agent
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

                            {/* Pause / Resume Button */}
                            {inst.is_paused ? (
                              <button
                                onClick={() => handleResumeInstitute(inst)}
                                disabled={busyId === inst.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 shadow-xs transition disabled:opacity-50"
                                title="Resume institute services and reactivate portal"
                              >
                                <Play size={12} className="fill-emerald-700 text-emerald-700" />
                                Resume
                              </button>
                            ) : (
                              <button
                                onClick={() => openPauseModal(inst)}
                                disabled={busyId === inst.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 shadow-xs transition disabled:opacity-50"
                                title="Pause institute services with custom reason and date"
                              >
                                <Pause size={12} />
                                Pause
                              </button>
                            )}

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
        <section className="mt-6 space-y-5">
          {/* Auto-Cleanup System Card */}
          <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-5 text-white shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    <Sparkles size={16} />
                  </span>
                  <h3 className="font-bold text-base text-white">Automated Storage & Data Cleanup</h3>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Scheduled Daily (2:00 AM)
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Auto-purges approved subscription payment screenshots & UTRs after <strong>7 days (1 week)</strong>, and deletes homework & notices older than <strong>90 days</strong>.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRunCleanup}
                  disabled={cleaningUp}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs font-bold text-white transition shadow-md disabled:opacity-50 active:scale-95"
                >
                  <RefreshCw size={13} className={cleaningUp ? "animate-spin" : ""} />
                  <span>{cleaningUp ? "Running Cleanup..." : "Run System Cleanup Now"}</span>
                </button>
              </div>
            </div>

            {cleanupResult && (
              <div className="mt-3.5 pt-3 border-t border-slate-800 text-xs text-slate-300 flex flex-wrap gap-4">
                <span>✅ Approved Payments Purged (7d): <strong className="text-emerald-400">{cleanupResult.approved_payments_deleted}</strong></span>
                <span>🗑️ Storage Screenshots Removed: <strong className="text-cyan-400">{cleanupResult.storage_files_deleted}</strong></span>
                <span>📚 Old Homework Cleared (90d): <strong className="text-purple-300">{cleanupResult.homework_deleted}</strong></span>
                <span>📢 Expired Notices Cleared (90d): <strong className="text-amber-300">{cleanupResult.notices_deleted}</strong></span>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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
                  paymentRequests.map((pay) => {
                    const inst = instByIdMap.get(pay.organization_id);
                    const linkedAgent = inst?.referred_by_agent_id
                      ? agentByIdMap.get(inst.referred_by_agent_id)
                      : undefined;
                    const cat =
                      pay.payment_category ||
                      (pay.utr_number?.includes("JOINING + MONTHLY")
                        ? "combined"
                        : pay.utr_number?.includes("JOINING FEE")
                        ? "joining_fee"
                        : "recurring");

                    return (
                    <tr key={pay.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{pay.organization_name}</div>
                        {linkedAgent && (
                          <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                            Partner: {linkedAgent.full_name} ({linkedAgent.agent_code})
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-bold text-slate-900">{pay.student_limit}</span>{" "}
                        <span className="text-xs text-slate-400">students</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-extrabold text-purple-700">₹{pay.amount}</div>
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            cat === "joining_fee"
                              ? "bg-emerald-100 text-emerald-800"
                              : cat === "combined"
                              ? "bg-indigo-100 text-indigo-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {cat === "joining_fee"
                            ? "Joining Fee"
                            : cat === "combined"
                            ? "Joining + Monthly"
                            : "Monthly Recurring"}
                        </span>
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
                              onClick={() => openApprovePaymentModal(pay)}
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
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      )}

      {/* ============================================================== */}
      {/* TAB 2.5: SALES AGENTS, VARIABLE COMMISSIONS & PAYOUT LEDGER    */}
      {/* ============================================================== */}
      {activeTab === "agents" && (
        <section className="mt-6 space-y-6">
          {/* Header Banner */}
          <div className="rounded-3xl border border-indigo-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 p-6 text-white shadow-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                  <BadgePercent size={13} /> Partner Network &amp; Commission Engine
                </div>
                <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
                  Sales Agents, Variable Rates &amp; Payout Ledger
                </h2>
                <p className="text-xs text-indigo-200 max-w-2xl leading-relaxed">
                  Har agent ke liye alag Joining Fee Commission % (e.g. 50% One-Time) aur Monthly Recurring % set karein. Agents apne dedicated{" "}
                  <Link href="/agent-portal" target="_blank" className="underline font-bold text-white hover:text-emerald-300">
                    /agent-portal
                  </Link>{" "}
                  par login karke apni earnings aur referred schools live dekh sakte hain.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => copyAgentShareText(`${siteOrigin}/agent-portal`, "portal_url")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition"
                >
                  {copiedAgentKey === "portal_url" ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
                  {copiedAgentKey === "portal_url" ? "Portal URL Copied!" : "Copy Agent Portal URL"}
                </button>
                <button
                  type="button"
                  onClick={() => openManualBonusModal()}
                  disabled={salesAgents.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/40 bg-amber-500/20 px-3.5 py-2.5 text-xs font-bold text-amber-200 hover:bg-amber-500/30 transition disabled:opacity-40"
                >
                  <Plus size={14} /> Manual Bonus / Entry
                </button>
                <button
                  type="button"
                  onClick={openCreateAgentModal}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-md hover:bg-emerald-400 transition"
                >
                  <UserPlus size={15} />
                  Add New Sales Agent
                </button>
              </div>
            </div>
          </div>

          {!agentsSqlReady && (
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-xs text-amber-950 space-y-1.5">
              <div className="flex items-center gap-2 font-extrabold text-sm text-amber-900">
                <AlertTriangle size={18} className="text-amber-600" />
                Database SQL Migration Required (One-Time Setup)
              </div>
              <p>
                Sales Agent tables &amp; Commission RPCs abhi Supabase database me install nahi hue hain. Kripya Supabase SQL Editor me{" "}
                <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono font-bold">
                  supabase/migrations/0021_sales_agents_commission_system.sql
                </code>{" "}
                ya{" "}
                <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono font-bold">
                  supabase/migrations/APPLY_TO_LIVE_SUPABASE.sql
                </code>{" "}
                paste karke Run karein aur Refresh Data dabayein.
              </p>
            </div>
          )}

          {/* 4 Network KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Sales Partners</span>
                <Users size={18} className="text-indigo-600" />
              </div>
              <p className="mt-2.5 text-3xl font-black text-slate-900">{salesAgents.length}</p>
              <p className="mt-1 text-xs text-slate-500">
                <strong className="text-emerald-600">{agentSummaryMetrics.activeAgentsCount} Active</strong> • {agentSummaryMetrics.totalReferredSchools} Schools Linked
              </p>
            </div>

            <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-5 shadow-sm">
              <div className="flex items-center justify-between text-purple-800">
                <span className="text-xs font-bold uppercase tracking-wider">Total Commissions Credited</span>
                <TrendingUp size={18} className="text-purple-600" />
              </div>
              <p className="mt-2.5 text-3xl font-black text-purple-950 font-mono">
                ₹{agentSummaryMetrics.totalCommissionsEarned.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-[11px] text-purple-800">
                Joining: <strong>₹{agentSummaryMetrics.totalJoiningEarned.toLocaleString("en-IN")}</strong> • Monthly:{" "}
                <strong>₹{agentSummaryMetrics.totalRecurringEarned.toLocaleString("en-IN")}</strong>
              </p>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 shadow-sm">
              <div className="flex items-center justify-between text-blue-800">
                <span className="text-xs font-bold uppercase tracking-wider">Already Paid Out</span>
                <Banknote size={18} className="text-blue-600" />
              </div>
              <p className="mt-2.5 text-3xl font-black text-blue-950 font-mono">
                ₹{agentSummaryMetrics.totalPaidOut.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-xs text-blue-700">
                Across {agentPayouts.length} recorded settlements
              </p>
            </div>

            <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 shadow-sm">
              <div className="flex items-center justify-between text-emerald-800">
                <span className="text-xs font-bold uppercase tracking-wider">Pending Payouts Due</span>
                <Wallet size={18} className="text-emerald-600" />
              </div>
              <p className="mt-2.5 text-3xl font-black text-emerald-950 font-mono">
                ₹{agentSummaryMetrics.totalPendingPayout.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-xs text-emerald-700">Net balance payable to agents</p>
            </div>
          </div>

          {/* Sub-view Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["agents", `Agents & Wallets (${salesAgents.length})`],
                  ["commissions", `Commission Ledger (${agentCommissions.length})`],
                  ["payouts", `Payout History (${agentPayouts.length})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAgentSubView(key)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                    agentSubView === key
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search agent name, code or phone..."
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                className="w-full sm:w-64 rounded-xl border border-slate-200 pl-8 pr-3 py-2 text-xs outline-none focus:border-purple-600"
              />
            </div>
          </div>

          {/* SUB-VIEW 1: AGENTS CARDS / WALLETS */}
          {agentSubView === "agents" && (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredSalesAgents.length === 0 ? (
                <div className="md:col-span-2 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-3">
                  <BadgePercent size={36} className="mx-auto text-slate-300" />
                  <h3 className="text-base font-bold text-slate-800">No Sales Agents Found</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Click &quot;Add New Sales Agent&quot; to onboard your sales team member with custom Joining Fee % (e.g. 50%) and Monthly Recurring % commission slabs.
                  </p>
                  <button
                    type="button"
                    onClick={openCreateAgentModal}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500"
                  >
                    <UserPlus size={14} /> Add First Sales Agent
                  </button>
                </div>
              ) : (
                filteredSalesAgents.map((agent) => {
                  const refLink = `${siteOrigin}/register?ref=${encodeURIComponent(agent.agent_code)}`;
                  const pending = Number(agent.pending_balance || 0);
                  return (
                    <div
                      key={agent.id}
                      className={`rounded-3xl border bg-white p-5 shadow-sm flex flex-col justify-between gap-4 ${
                        agent.is_active ? "border-slate-200" : "border-amber-300 bg-amber-50/30"
                      }`}
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-extrabold text-slate-900">{agent.full_name}</h3>
                              <span className="rounded-lg bg-purple-100 px-2 py-0.5 font-mono text-[11px] font-black text-purple-800">
                                {agent.agent_code}
                              </span>
                              {!agent.is_active && (
                                <span className="rounded-md bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                                  PAUSED
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                <Phone size={11} /> {agent.phone}
                              </span>
                              {agent.email && (
                                <span className="inline-flex items-center gap-1">
                                  <Mail size={11} /> {agent.email}
                                </span>
                              )}
                              {agent.city && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin size={11} /> {agent.city}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Pending Balance Pill */}
                          <div className="text-right shrink-0">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Pending Due
                            </span>
                            <span
                              className={`font-mono text-xl font-black ${
                                pending > 0 ? "text-emerald-700" : "text-slate-600"
                              }`}
                            >
                              ₹{pending.toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>

                        {/* Commission Slab Pills */}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-extrabold text-emerald-800">
                            Joining Fee: {Number(agent.joining_commission_percent)}% One-Time
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-[11px] font-extrabold text-indigo-800">
                            Monthly Plan: {Number(agent.recurring_commission_percent)}% Recurring
                          </span>
                          {agent.upi_id && (
                            <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1 text-[11px] font-mono text-slate-700">
                              UPI: {agent.upi_id}
                            </span>
                          )}
                        </div>

                        {/* Metrics Grid */}
                        <div className="mt-4 grid grid-cols-4 gap-2 rounded-2xl bg-slate-50 p-3 text-center">
                          <div>
                            <div className="text-[10px] font-semibold text-slate-400 uppercase">Schools</div>
                            <div className="text-sm font-black text-slate-900">
                              {agent.total_schools}
                              <span className="text-[10px] font-normal text-emerald-600 block">
                                {agent.active_paid_schools} paid
                              </span>
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] font-semibold text-slate-400 uppercase">Joining Comm</div>
                            <div className="text-sm font-bold text-emerald-700 font-mono">
                              ₹{Number(agent.joining_earned || 0).toLocaleString("en-IN")}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] font-semibold text-slate-400 uppercase">Monthly Comm</div>
                            <div className="text-sm font-bold text-indigo-700 font-mono">
                              ₹{Number(agent.recurring_earned || 0).toLocaleString("en-IN")}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] font-semibold text-slate-400 uppercase">Paid Out</div>
                            <div className="text-sm font-bold text-blue-700 font-mono">
                              ₹{Number(agent.total_paid_out || 0).toLocaleString("en-IN")}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions Footer */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => openPayAgentModal(agent)}
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 transition"
                          >
                            <Banknote size={13} /> Pay / Settle
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditAgentModal(agent)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Edit size={12} /> Edit Rates
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenReshareAgentModal(agent)}
                            className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
                            title="Open complete WhatsApp onboarding & login template"
                          >
                            <MessageCircle size={12} /> WhatsApp Details
                          </button>
                          <button
                            type="button"
                            onClick={() => copyAgentShareText(refLink, `ref_${agent.id}`)}
                            className="inline-flex items-center gap-1 rounded-xl border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100"
                          >
                            {copiedAgentKey === `ref_${agent.id}` ? <Check size={12} /> : <Copy size={12} />}
                            {copiedAgentKey === `ref_${agent.id}` ? "Copied Link!" : "Referral Link"}
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openManualBonusModal(agent)}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-800 hover:bg-amber-100"
                            title="Add manual bonus or adjustment"
                          >
                            + Bonus
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAgent(agent)}
                            disabled={busyId === agent.id}
                            className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100 disabled:opacity-50"
                            title="Delete agent"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* SUB-VIEW 2: ALL COMMISSION LEDGER */}
          {agentSubView === "commissions" && (
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[11px] text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5">Sales Agent</th>
                      <th className="px-5 py-3.5">School</th>
                      <th className="px-5 py-3.5">Type</th>
                      <th className="px-5 py-3.5 text-right">School Paid</th>
                      <th className="px-5 py-3.5 text-center">Rate %</th>
                      <th className="px-5 py-3.5 text-right">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {agentCommissions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-sm text-slate-500">
                          No commission entries yet. Commissions credit automatically when linked school payments are approved.
                        </td>
                      </tr>
                    ) : (
                      agentCommissions
                        .filter((c) => {
                          const q = agentSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            c.agent_name.toLowerCase().includes(q) ||
                            c.agent_code.toLowerCase().includes(q) ||
                            c.organization_name.toLowerCase().includes(q)
                          );
                        })
                        .map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50/50">
                            <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                              {new Date(c.created_at).toLocaleDateString("en-IN")}
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-slate-900">{c.agent_name}</div>
                              <div className="font-mono text-[10px] text-purple-700">{c.agent_code}</div>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="font-semibold text-slate-800">{c.organization_name}</div>
                              {c.reference_utr && (
                                <div className="font-mono text-[10px] text-slate-400">{c.reference_utr}</div>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                  c.commission_type === "joining_fee"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : c.commission_type === "recurring"
                                    ? "bg-indigo-100 text-indigo-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {c.commission_type === "joining_fee"
                                  ? "Joining Fee"
                                  : c.commission_type === "recurring"
                                  ? "Monthly Recurring"
                                  : "Manual Bonus"}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono text-slate-700">
                              ₹{Number(c.gross_payment_amount || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="px-5 py-3.5 text-center font-mono font-bold text-purple-700">
                              {Number(c.commission_percent || 0)}%
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono font-extrabold text-emerald-700">
                              +₹{Number(c.commission_amount || 0).toLocaleString("en-IN")}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-VIEW 3: ALL PAYOUT SETTLEMENTS */}
          {agentSubView === "payouts" && (
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[11px] text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3.5">Paid On</th>
                      <th className="px-5 py-3.5">Sales Agent</th>
                      <th className="px-5 py-3.5">Method &amp; Month</th>
                      <th className="px-5 py-3.5">UTR / Ref</th>
                      <th className="px-5 py-3.5">Notes</th>
                      <th className="px-5 py-3.5 text-right">Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {agentPayouts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-sm text-slate-500">
                          No agent payouts recorded yet. Click &quot;Pay / Settle&quot; on any agent card to settle their balance.
                        </td>
                      </tr>
                    ) : (
                      agentPayouts
                        .filter((p) => {
                          const q = agentSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            p.agent_name.toLowerCase().includes(q) ||
                            p.agent_code.toLowerCase().includes(q)
                          );
                        })
                        .map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/50">
                            <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                              {new Date(p.paid_at).toLocaleDateString("en-IN")}
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-slate-900">{p.agent_name}</div>
                              <div className="font-mono text-[10px] text-purple-700">{p.agent_code}</div>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-800">
                                {p.payment_method}
                              </span>
                              {p.paid_for_month && (
                                <span className="ml-2 text-slate-600 font-medium">{p.paid_for_month}</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 font-mono text-slate-700">{p.reference_no || "—"}</td>
                            <td className="px-5 py-3.5 text-slate-500">{p.notes || "—"}</td>
                            <td className="px-5 py-3.5 text-right font-mono font-extrabold text-blue-700">
                              ₹{Number(p.amount).toLocaleString("en-IN")}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ============================================================== */}
      {/* TAB 3: PLATFORM PRICING, WHATSAPP & WEBSITE BRANDING SETTINGS  */}
      {/* ============================================================== */}
      {activeTab === "pricing" && (
        <form onSubmit={handleSavePricing} className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* CARD 1: PUBLIC CONTACT & WHATSAPP SUPPORT */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="rounded-xl bg-emerald-600 p-2 text-white shadow-xs">
                  <MessageCircle size={18} />
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Website WhatsApp & Contact Info
                  </h2>
                  <p className="text-xs text-slate-500">
                    Ye details public website ke floating button, header aur footer me live update honge.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {/* WhatsApp Number */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Official WhatsApp Number
                    </label>
                    {pricing.whatsapp_number && (
                      <a
                        href={`https://wa.me/${pricing.whatsapp_number.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink size={12} /> Test WhatsApp
                      </a>
                    )}
                  </div>
                  <input
                    type="text"
                    value={pricing.whatsapp_number}
                    onChange={(e) => setPricing({ ...pricing, whatsapp_number: e.target.value })}
                    placeholder="e.g. 917903178550 (without + or spaces)"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                    required
                  />
                  <span className="text-[11px] text-slate-400">
                    Website ke floating WhatsApp button par click karne se seedhe is number par chat khulegi.
                  </span>
                </div>

                {/* Calling Phone */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Calling Phone / Helpline
                  </label>
                  <input
                    type="text"
                    value={pricing.contact_phone}
                    onChange={(e) => setPricing({ ...pricing, contact_phone: e.target.value })}
                    placeholder="e.g. +91 79031 78550"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-purple-500"
                  />
                </div>

                {/* Official Support Email */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Official Support Email
                  </label>
                  <input
                    type="email"
                    value={pricing.contact_email}
                    onChange={(e) => setPricing({ ...pricing, contact_email: e.target.value })}
                    placeholder="e.g. support@edutechlab.com"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-purple-500"
                  />
                </div>

                {/* Head Office / Registered Address */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Office / Headquarters Address
                  </label>
                  <input
                    type="text"
                    value={pricing.company_address}
                    onChange={(e) => setPricing({ ...pricing, company_address: e.target.value })}
                    placeholder="e.g. Patna, Bihar, India"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-purple-500"
                  />
                  <span className="text-[11px] text-slate-400">Website footer aur invoices me dikhta hai.</span>
                </div>
              </div>
            </div>

            {/* CARD 2: WEBSITE BRANDING & ANNOUNCEMENT BAR */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="rounded-xl bg-purple-600 p-2 text-white shadow-xs">
                  <Megaphone size={18} />
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Website Branding & Announcement
                  </h2>
                  <p className="text-xs text-slate-500">
                    Control website brand titles, top announcement banner, and demo video link.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {/* Brand Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Brand / Platform Name
                  </label>
                  <input
                    type="text"
                    value={pricing.brand_name}
                    onChange={(e) => setPricing({ ...pricing, brand_name: e.target.value })}
                    placeholder="e.g. EduTechLab"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-purple-500"
                  />
                </div>

                {/* Brand Tagline */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Brand Tagline / Slogan
                  </label>
                  <input
                    type="text"
                    value={pricing.brand_tagline}
                    onChange={(e) => setPricing({ ...pricing, brand_tagline: e.target.value })}
                    placeholder="e.g. Bharat Ka Sabse Fast & Aasan School Management Software"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-purple-500"
                  />
                </div>

                {/* Top Announcement Bar Text */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Top Announcement Bar Text
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pricing.announcement_active}
                        onChange={(e) => setPricing({ ...pricing, announcement_active: e.target.checked })}
                        className="rounded accent-purple-600"
                      />
                      <span>Active on Website</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={pricing.announcement_text}
                    onChange={(e) => setPricing({ ...pricing, announcement_text: e.target.value })}
                    placeholder="e.g. NEW v2.0: Bharat Ka Sabse Fast & Aasan School Management Software • Risk-Free Trial!"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-purple-500"
                  />
                  <span className="text-[11px] text-slate-400">
                    Ye message public website ke bilkul top me notification banner ki tarah chalta hai.
                  </span>
                </div>

                {/* YouTube Video Demo URL */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Youtube size={14} className="text-red-500" /> YouTube / Video Demo Link
                  </label>
                  <input
                    type="url"
                    value={pricing.youtube_demo_url}
                    onChange={(e) => setPricing({ ...pricing, youtube_demo_url: e.target.value })}
                    placeholder="e.g. https://www.youtube.com/watch?v=..."
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* CARD 3: PER-STUDENT PRICING RATES (STANDARD VS PRO) */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="rounded-xl bg-indigo-600 p-2 text-white shadow-xs">
                  <CreditCard size={18} />
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Per-Student Pricing Rates
                  </h2>
                  <p className="text-xs text-slate-500">
                    Set Standard (₹5) and Pro (₹7) per-child rates and default trial days.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Standard Rate */}
                  <div className="p-3.5 rounded-2xl border border-teal-200 bg-teal-50/40">
                    <label className="block text-xs font-bold uppercase tracking-wider text-teal-800">
                      Standard Rate (₹/Child)
                    </label>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-xl font-bold text-teal-900 font-mono">₹</span>
                      <input
                        type="number"
                        min={1}
                        value={pricing.standard_rate}
                        onChange={(e) => setPricing({ ...pricing, standard_rate: Number(e.target.value) || 1 })}
                        className="w-full rounded-xl border border-teal-300 bg-white px-3 py-1.5 text-base font-black text-slate-900 outline-none focus:border-teal-500"
                      />
                    </div>
                    <span className="text-[10px] text-teal-700 mt-1 block">Default: ₹5/child/month</span>
                  </div>

                  {/* Pro Rate */}
                  <div className="p-3.5 rounded-2xl border border-purple-200 bg-purple-50/40">
                    <label className="block text-xs font-bold uppercase tracking-wider text-purple-800">
                      Pro Rate (₹/Child)
                    </label>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-xl font-bold text-purple-900 font-mono">₹</span>
                      <input
                        type="number"
                        min={1}
                        value={pricing.pro_rate}
                        onChange={(e) => setPricing({ ...pricing, pro_rate: Number(e.target.value) || 1 })}
                        className="w-full rounded-xl border border-purple-300 bg-white px-3 py-1.5 text-base font-black text-slate-900 outline-none focus:border-purple-500"
                      />
                    </div>
                    <span className="text-[10px] text-purple-700 mt-1 block">Default: ₹7/child/month</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Default Free Trial Days
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
                    <span className="text-[11px] text-slate-400">Naye school registration par trial</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Base Plan Starting Price (₹)
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
                    <span className="text-[11px] text-slate-400">Default minimum tier</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 4: PLATFORM UPI & RECEIVING QR CODE */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="rounded-xl bg-emerald-600 p-2 text-white shadow-xs">
                  <QrCode size={18} />
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">Platform UPI & QR Code</h2>
                  <p className="text-xs text-slate-500">
                    Schools jab subscription pay karenge toh ye UPI ID aur QR code dikhega.
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
                      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-1 shadow-xs">
                        <img
                          src={pricing.upi_qr_url}
                          alt="Current UPI QR Code"
                          className="h-full w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                        <QrCode size={28} />
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50">
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
                        {pricing.upi_qr_url && (
                          <button
                            type="button"
                            onClick={() => setPricing({ ...pricing, upi_qr_url: "" })}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100 transition"
                          >
                            <Trash2 size={13} />
                            Remove Static Image
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        ⚡ <strong>Dynamic QR Mode:</strong> Aapke upar diye gaye UPI ID se automatically har school ke liye exact amount wala QR code generate hota hai. Static QR upload karna zaroori nahi hai.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Master Save Button Bar */}
          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs text-slate-500 font-medium">
              💡 Save karte hi website ke floating WhatsApp button, contact email aur rates instantly update ho jayenge.
            </span>
            <button
              type="submit"
              disabled={savingPricing}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-600/25 hover:from-purple-500 hover:to-teal-500 transition active:scale-95 disabled:opacity-50"
            >
              {savingPricing ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Updating Website Settings...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Save All Website & Platform Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
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
      {/* TAB 5: REVENUE & MONTHLY SUBSCRIPTION ANALYTICS               */}
      {/* ============================================================== */}
      {activeTab === "revenue" && (
        <section className="mt-6 space-y-6">
          {/* Top Banner */}
          <div className="rounded-3xl border border-purple-200 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 p-6 text-white shadow-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-purple-200 border border-purple-400/30">
                  <Wallet size={13} />
                  Revenue Analytics Engine
                </div>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
                  Platform Revenue &amp; Monthly Subscriptions
                </h2>
                <p className="mt-1 text-xs text-purple-200 max-w-xl">
                  Live calculation based on student capacity subscribed by each onboarded institution @ ₹{pricing.standard_rate || 5}/child and approved payment receipts reviewed by Super Admin.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={checkAndLoad}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md hover:bg-white/20 transition border border-white/10"
                >
                  <RefreshCw size={14} />
                  Refresh Revenue
                </button>
                <button
                  onClick={() => setActiveTab("requests")}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition shadow-md"
                >
                  <FileCheck size={14} />
                  Review Approvals ({pendingRequestsCount})
                </button>
              </div>
            </div>
          </div>

          {/* 4 Glassmorphic KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Expected MRR */}
            <div className="rounded-3xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-indigo-50/50 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-800">
                  Projected Monthly MRR
                </span>
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-purple-200/60 text-purple-700">
                  <TrendingUp size={16} />
                </div>
              </div>
              <p className="mt-3 text-3xl font-black text-purple-950">
                ₹{revenueMetrics.totalProjectedMRR.toLocaleString("en-IN")}
                <span className="text-xs font-bold text-purple-600"> /mo</span>
              </p>
              <p className="mt-2 text-[11px] text-purple-700">
                From {institutions.length} institutions ({revenueMetrics.totalSubscribedCapacity} total student quota)
              </p>
            </div>

            {/* Card 2: This Month Approved */}
            <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50/50 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Approved This Month
                </span>
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-200/60 text-emerald-700">
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <p className="mt-3 text-3xl font-black text-emerald-950">
                ₹{revenueMetrics.thisMonthApprovedRevenue.toLocaleString("en-IN")}
              </p>
              <p className="mt-2 text-[11px] text-emerald-700">
                {revenueMetrics.thisMonthApprovedCount} verified payments in {new Date().toLocaleString("default", { month: "long" })}
              </p>
            </div>

            {/* Card 3: All-Time Approved */}
            <div className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-cyan-50/50 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
                  Lifetime Approved Revenue
                </span>
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-200/60 text-blue-700">
                  <Wallet size={16} />
                </div>
              </div>
              <p className="mt-3 text-3xl font-black text-blue-950">
                ₹{revenueMetrics.allTimeApprovedRevenue.toLocaleString("en-IN")}
              </p>
              <p className="mt-2 text-[11px] text-blue-700">
                {revenueMetrics.approvedPaymentsCount} total platform payments collected
              </p>
            </div>

            {/* Card 4: Pending Approvals */}
            <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50/50 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  Pending Verification
                </span>
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-200/60 text-amber-700">
                  <Clock size={16} />
                </div>
              </div>
              <p className="mt-3 text-3xl font-black text-amber-950">
                ₹{revenueMetrics.pendingApprovalRevenue.toLocaleString("en-IN")}
              </p>
              <p className="mt-2 text-[11px] text-amber-700">
                {pendingRequestsCount} receipts awaiting your approval
              </p>
            </div>
          </div>

          {/* School-Wise Revenue Breakdown Table */}
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  School-by-School Monthly Billing &amp; Subscriptions
                </h3>
                <p className="text-xs text-slate-500">
                  Subscription capacity, monthly revenue calculation, and pause/resume control.
                </p>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search school name..."
                    value={revenueSearch}
                    onChange={(e) => setRevenueSearch(e.target.value)}
                    className="rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex rounded-xl bg-slate-100 p-0.5 text-xs font-semibold">
                  {(["all", "active", "paused", "trial", "expired"] as const).map((filterKey) => (
                    <button
                      key={filterKey}
                      onClick={() => setRevenueFilter(filterKey)}
                      className={`rounded-lg px-2.5 py-1 capitalize transition ${
                        revenueFilter === filterKey
                          ? "bg-white text-purple-700 shadow-xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {filterKey}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Institution</th>
                    <th className="px-5 py-3.5">Subscribed Capacity</th>
                    <th className="px-5 py-3.5">Rate / Student</th>
                    <th className="px-5 py-3.5">Monthly Expected (MRR)</th>
                    <th className="px-5 py-3.5">Account Status</th>
                    <th className="px-5 py-3.5">Valid Until</th>
                    <th className="px-5 py-3.5 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRevenueInstitutions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-sm text-slate-500">
                        No institutions match the current filter or search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredRevenueInstitutions.map((inst) => {
                      const sub = inst.subscription;
                      const quota = sub?.student_limit || inst.student_count || pricing.base_students || 20;
                      const rate = Number(pricing.standard_rate || 5);
                      const expectedMRR = sub?.monthly_amount
                        ? Number(sub.monthly_amount)
                        : Math.max(pricing.base_price, quota * rate);
                      const isExpired = sub?.current_period_ends_at && new Date(sub.current_period_ends_at) < new Date();

                      return (
                        <tr key={inst.id} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-slate-900">{inst.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">/{inst.slug} • {inst.owner_login_id || "No ID"}</div>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5 font-bold text-slate-900">
                              <span>{inst.student_count}</span>
                              <span className="text-slate-400 font-normal">/ {quota} students</span>
                            </div>
                            <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full bg-purple-600 rounded-full"
                                style={{
                                  width: `${Math.min(100, Math.round((inst.student_count / quota) * 100))}%`,
                                }}
                              />
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">
                              ₹{rate} / student
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-bold text-slate-900">
                            ₹{expectedMRR.toLocaleString("en-IN")}
                            <span className="text-[10px] text-slate-400 font-normal"> /mo</span>
                          </td>
                          <td className="px-5 py-3.5">
                            {inst.is_paused ? (
                              <div>
                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 border border-amber-300 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                                  <Pause size={10} className="fill-amber-700 text-amber-700" />
                                  Paused ({inst.paused_at ? new Date(inst.paused_at).toLocaleDateString("en-IN") : "Active"})
                                </span>
                                {inst.pause_reason && (
                                  <div className="mt-0.5 max-w-[170px] truncate text-[10px] text-amber-800 font-medium" title={inst.pause_reason}>
                                    "{inst.pause_reason}"
                                  </div>
                                )}
                              </div>
                            ) : sub?.is_trial ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">
                                <Sparkles size={11} /> Trial ({Math.max(0, Math.ceil((new Date(sub.current_period_ends_at).getTime() - Date.now()) / 86400000))}d left)
                              </span>
                            ) : isExpired ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                                Expired Plan
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                Active Standard
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-slate-500">
                            {sub?.current_period_ends_at
                              ? new Date(sub.current_period_ends_at).toLocaleDateString("en-IN")
                              : "—"}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {inst.is_paused ? (
                                <button
                                  onClick={() => handleResumeInstitute(inst)}
                                  disabled={busyId === inst.id}
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition disabled:opacity-50"
                                >
                                  <Play size={11} className="fill-emerald-700 text-emerald-700" />
                                  Resume
                                </button>
                              ) : (
                                <button
                                  onClick={() => openPauseModal(inst)}
                                  disabled={busyId === inst.id}
                                  className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition disabled:opacity-50"
                                >
                                  <Pause size={11} />
                                  Pause
                                </button>
                              )}
                              <button
                                onClick={() => openEditQuotaModal(inst)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <Edit size={11} />
                                Quota
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
          </div>

          {/* Approved Payments Ledger */}
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 p-5">
              <h3 className="text-base font-bold text-slate-900">
                Approved Payment Transactions &amp; Receipts Ledger
              </h3>
              <p className="text-xs text-slate-500">
                Permanent log of all subscription payments verified and approved by Platform Super Admin.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Institution</th>
                    <th className="px-5 py-3.5">Amount (₹)</th>
                    <th className="px-5 py-3.5">UTR / Txn ID</th>
                    <th className="px-5 py-3.5">Capacity Allocated</th>
                    <th className="px-5 py-3.5">Approved On</th>
                    <th className="px-5 py-3.5 text-right">Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {revenueMetrics.approvedLedger.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-sm text-slate-500">
                        No approved subscription payments found yet.
                      </td>
                    </tr>
                  ) : (
                    revenueMetrics.approvedLedger.map((pay) => (
                      <tr key={pay.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3.5 font-semibold text-slate-900">
                          {pay.organization_name}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-emerald-700">
                          ₹{Number(pay.amount).toLocaleString("en-IN")}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-purple-700 font-semibold">
                          {pay.utr_number}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700">
                          {pay.student_limit} students quota
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          {new Date(pay.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {pay.screenshot_url ? (
                            <button
                              onClick={() => setViewScreenshotUrl(pay.screenshot_url)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-50"
                            >
                              <Eye size={12} />
                              View Receipt
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px]">No image</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* MODAL: PAUSE INSTITUTION SERVICES WITH REASON & DATE          */}
      {/* ============================================================== */}
      {pausingInst && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl border border-amber-300 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                  <Pause size={10} />
                  Suspend Services
                </div>
                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  Pause Institution: {pausingInst.name}
                </h3>
                <p className="text-xs text-slate-500">
                  School admins can still log in, but all daily functional modules will be locked with your notice.
                </p>
              </div>
              <button
                onClick={() => setPausingInst(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Effective Pause Date */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Effective Pause Date (Monthly Billing Context)
                </label>
                <input
                  type="date"
                  value={pauseDateInput}
                  onChange={(e) => setPauseDateInput(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-semibold"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  This date will be displayed to the school admin on their screen.
                </p>
              </div>

              {/* Pause Reason */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Reason for Pausing (Visible to School Admin)
                </label>
                <textarea
                  rows={3}
                  value={pauseReasonInput}
                  onChange={(e) => setPauseReasonInput(e.target.value)}
                  placeholder="e.g. Monthly subscription fee overdue for November 2026. Please clear dues to resume."
                  className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 leading-relaxed font-sans"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div>
                <span className="text-[11px] font-bold text-slate-500">Quick Reason Presets:</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {[
                    "Monthly subscription fee overdue",
                    "Subscription period expired, renewal pending",
                    "Awaiting monthly fee payment verification",
                    "Institute temporarily paused per management request",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPauseReasonInput(preset)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-amber-50 hover:border-amber-300 transition"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <strong>Notice:</strong> Once paused, all software services remain disabled until you click <strong>Resume</strong> on this school.
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setPausingInst(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPause}
                  disabled={isPausing}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-amber-500 shadow-sm disabled:opacity-50"
                >
                  <Pause size={14} />
                  {isPausing ? "Pausing Institute..." : "Confirm & Pause Institute"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              subscription payments, UTR records, revenue history, students ({deletingInst.student_count}),
              classes, attendance logs, fee records, expenses, marksheets, notices, and all staff accounts from Supabase.
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

                  {/* Row 5: Optional Sales Agent Attribution */}
                  {salesAgents.length > 0 && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                        Referred By Sales Partner (Optional)
                      </label>
                      <select
                        value={demoForm.agentId}
                        onChange={(e) => setDemoForm({ ...demoForm, agentId: e.target.value })}
                        className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-purple-600"
                      >
                        <option value="">-- Direct (No Sales Agent) --</option>
                        {salesAgents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.full_name} ({a.agent_code}) — {Number(a.joining_commission_percent)}% Join / {Number(a.recurring_commission_percent)}% Monthly
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

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

      {/* ============================================================== */}
      {/* MODAL 7: APPROVE PAYMENT & PREVIEW PARTNER COMMISSION          */}
      {/* ============================================================== */}
      {approvingPay && (() => {
        const payInst = instByIdMap.get(approvingPay.organization_id);
        const linkedAgent = payInst?.referred_by_agent_id
          ? agentByIdMap.get(payInst.referred_by_agent_id)
          : undefined;
        const amt = Number(approvingPay.amount) || 0;
        const joinGross =
          approveCategory === "joining_fee"
            ? amt
            : approveCategory === "combined"
            ? Math.max(0, Math.min(amt, Number(approveJoiningPortion) || 0))
            : 0;
        const recGross = Math.max(0, amt - joinGross);
        const joinComm = linkedAgent
          ? Math.round((joinGross * Number(linkedAgent.joining_commission_percent)) / 100)
          : 0;
        const recComm = linkedAgent
          ? Math.round((recGross * Number(linkedAgent.recurring_commission_percent)) / 100)
          : 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-3xl border border-emerald-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Approve School Payment</h3>
                  <p className="text-xs text-slate-500">
                    {approvingPay.organization_name} • Amount: <strong>₹{amt}</strong> • UTR:{" "}
                    <span className="font-mono">{approvingPay.utr_number}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setApprovingPay(null)}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleConfirmApprovePayment} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Payment Classification
                  </label>
                  <select
                    value={approveCategory}
                    onChange={(e) => {
                      const nextCat = e.target.value as "recurring" | "joining_fee" | "combined";
                      setApproveCategory(nextCat);
                      if (nextCat === "joining_fee") {
                        setApproveJoiningPortion(amt);
                        setApproveDurationDays(0);
                      } else if (nextCat === "recurring") {
                        setApproveJoiningPortion(0);
                        setApproveDurationDays(30);
                      } else {
                        setApproveJoiningPortion(Math.min(amt, 1000));
                        setApproveDurationDays(30);
                      }
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-emerald-600"
                  >
                    <option value="recurring">Monthly Recurring Subscription</option>
                    <option value="joining_fee">One-Time Joining / Setup Fee</option>
                    <option value="combined">Combined (Joining Fee + 1st Month Plan)</option>
                  </select>
                </div>

                {approveCategory === "combined" && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Joining Fee Portion out of ₹{amt} (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={amt}
                      value={approveJoiningPortion}
                      onChange={(e) => setApproveJoiningPortion(Math.max(0, Number(e.target.value) || 0))}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-bold outline-none focus:border-emerald-600"
                    />
                    <span className="text-[11px] text-slate-500">
                      Remaining ₹{recGross} is treated as Monthly Subscription.
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Subscription Validity Days to Add
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={approveDurationDays}
                    onChange={(e) => setApproveDurationDays(Math.max(0, Number(e.target.value) || 0))}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-bold outline-none focus:border-emerald-600"
                  />
                  <span className="text-[11px] text-slate-400">
                    Set 30 days for monthly recharge, or 0 if approving only a One-Time Joining Fee.
                  </span>
                </div>

                {linkedAgent ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-950 space-y-1">
                    <div className="font-extrabold flex items-center justify-between">
                      <span>Auto Commission Preview ({linkedAgent.full_name} • {linkedAgent.agent_code})</span>
                      <span className="font-mono text-sm text-emerald-700">
                        +₹{(joinComm + recComm).toLocaleString("en-IN")}
                      </span>
                    </div>
                    {joinGross > 0 && (
                      <div className="text-emerald-800">
                        • Joining Fee: ₹{joinGross} × {Number(linkedAgent.joining_commission_percent)}% = <strong>₹{joinComm}</strong>
                      </div>
                    )}
                    {recGross > 0 && (
                      <div className="text-emerald-800">
                        • Monthly Recurring: ₹{recGross} × {Number(linkedAgent.recurring_commission_percent)}% = <strong>₹{recComm}</strong>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                    No Sales Agent linked to this school (Direct Platform Revenue 100%).
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setApprovingPay(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busyId === approvingPay.id}
                    className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {busyId === approvingPay.id ? "Approving..." : "Confirm & Approve Payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* MODAL 8: CREATE / EDIT SALES AGENT MODAL                       */}
      {/* ============================================================== */}
      {showAgentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl rounded-3xl border border-purple-200 bg-white p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2.5">
                <span className="rounded-xl bg-purple-100 p-2 text-purple-700">
                  <UserPlus size={18} />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingAgent ? `Edit Sales Agent (${editingAgent.agent_code})` : "Add New Sales Agent"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configure agent login credentials and custom commission percentages.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAgentModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {agentModalError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{agentModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAgent} className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={agentForm.fullName}
                    onChange={(e) => setAgentForm({ ...agentForm, fullName: e.target.value })}
                    placeholder="e.g. Rahul Verma"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold outline-none focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={agentForm.phone}
                    onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Agent Referral Code *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingAgent}
                    value={agentForm.agentCode}
                    onChange={(e) =>
                      setAgentForm({
                        ...agentForm,
                        agentCode: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
                      })
                    }
                    placeholder="e.g. AGT-RAHUL"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono font-bold uppercase outline-none focus:border-purple-600 disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    {editingAgent ? "Reset Portal Password (Optional)" : "Portal Password * (min 6 chars)"}
                  </label>
                  <input
                    type="text"
                    required={!editingAgent}
                    minLength={editingAgent ? undefined : 6}
                    value={agentForm.password}
                    onChange={(e) => setAgentForm({ ...agentForm, password: e.target.value })}
                    placeholder={editingAgent ? "Leave blank to keep existing" : "e.g. Rahul@123"}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              {/* Variable Commission Rates */}
              <div className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900">
                    Joining Fee Commission (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    max={100}
                    required
                    value={agentForm.joiningPercent}
                    onChange={(e) => setAgentForm({ ...agentForm, joiningPercent: Number(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-sm font-black text-emerald-900 outline-none focus:border-emerald-600"
                  />
                  <span className="text-[10px] text-emerald-700">One-time joining fee commission (default 50%)</span>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-indigo-900">
                    Monthly Recurring Commission (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    max={100}
                    required
                    value={agentForm.recurringPercent}
                    onChange={(e) => setAgentForm({ ...agentForm, recurringPercent: Number(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-xl border border-indigo-300 bg-white px-3.5 py-2 text-sm font-black text-indigo-900 outline-none focus:border-indigo-600"
                  />
                  <span className="text-[10px] text-indigo-700">Har mahine school recharge par (custom per agent)</span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={agentForm.email}
                    onChange={(e) => setAgentForm({ ...agentForm, email: e.target.value })}
                    placeholder="rahul@example.com"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    City / Territory
                  </label>
                  <input
                    type="text"
                    value={agentForm.city}
                    onChange={(e) => setAgentForm({ ...agentForm, city: e.target.value })}
                    placeholder="e.g. Patna / Gaya"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Agent UPI ID (For Payouts)
                  </label>
                  <input
                    type="text"
                    value={agentForm.upiId}
                    onChange={(e) => setAgentForm({ ...agentForm, upiId: e.target.value })}
                    placeholder="rahul@ybl"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono outline-none focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Bank Details / Account Notes
                  </label>
                  <input
                    type="text"
                    value={agentForm.bankDetails}
                    onChange={(e) => setAgentForm({ ...agentForm, bankDetails: e.target.value })}
                    placeholder="A/C No, IFSC, Bank Name"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              {editingAgent && (
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agentForm.isActive}
                    onChange={(e) => setAgentForm({ ...agentForm, isActive: e.target.checked })}
                    className="rounded accent-emerald-600"
                  />
                  <span>Agent Active (can log in &amp; earn commissions)</span>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAgentModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAgent}
                  className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-500 disabled:opacity-50"
                >
                  {savingAgent ? "Saving..." : editingAgent ? "Update Agent & Rates" : "Create Sales Agent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 8B: SALES AGENT ONBOARDING & WHATSAPP TEMPLATE MODAL     */}
      {/* ============================================================== */}
      {onboardingAgent && (() => {
        const waPhone = formatWhatsAppPhone(onboardingAgent.phone);
        const origin =
          typeof window !== "undefined" && window.location.origin
            ? window.location.origin
            : "https://edutechlab-9fz4.vercel.app";
        const portalUrl = `${origin}/agent-portal`;
        const referralUrl = `${origin}/register?ref=${encodeURIComponent(onboardingAgent.agentCode)}`;
        const matchedExistingAgent = salesAgents.find(
          (a) =>
            a.agent_code === onboardingAgent.agentCode ||
            (onboardingAgent.id && a.id === onboardingAgent.id)
        );

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-2xl rounded-3xl border border-emerald-200 bg-white p-5 sm:p-6 shadow-2xl my-8">
              {/* Top Header */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-xs">
                    {onboardingAgent.mode === "created" ? (
                      <CheckCircle2 size={26} />
                    ) : (
                      <MessageCircle size={24} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
                      {onboardingAgent.mode === "created"
                        ? "Sales Partner Account Ready!"
                        : onboardingAgent.mode === "password_reset"
                        ? "Partner Password Updated — Share on WhatsApp"
                        : "Partner Login & WhatsApp Template"}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Send complete portal credentials, commission terms &amp; referral link directly to{" "}
                      <strong className="text-slate-700">{onboardingAgent.fullName}</strong> ({onboardingAgent.phone}).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOnboardingAgent(null)}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {/* Partner Credential Highlight Card */}
                <div className="rounded-2xl bg-slate-900 p-4 sm:p-5 text-white shadow-inner">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Sales Partner
                      </span>
                      <span className="text-sm font-extrabold text-emerald-400">
                        {onboardingAgent.fullName}
                        {onboardingAgent.city ? ` • ${onboardingAgent.city}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                        Joining {onboardingAgent.joiningPercent}% • Monthly {onboardingAgent.recurringPercent}%
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                    <div className="rounded-xl bg-slate-800/80 p-3">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Agent Code
                      </span>
                      <span className="mt-0.5 block font-mono text-sm font-black text-amber-300">
                        {onboardingAgent.agentCode}
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-800/80 p-3">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Mobile / Alt Login
                      </span>
                      <span className="mt-0.5 block font-mono text-xs font-bold text-slate-100 truncate">
                        {onboardingAgent.phone}
                      </span>
                      {onboardingAgent.email && (
                        <span className="block text-[10px] text-slate-400 truncate">
                          {onboardingAgent.email}
                        </span>
                      )}
                    </div>

                    <div className="rounded-xl bg-slate-800/80 p-3">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Portal Password
                      </span>
                      <span className="mt-0.5 block font-mono text-sm font-bold text-white">
                        {onboardingAgent.password ? (
                          onboardingAgent.password
                        ) : (
                          <span className="text-xs font-medium text-slate-400">Existing Password</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-800/80 px-3 py-2 text-xs">
                      <span className="font-mono text-purple-300 truncate">{portalUrl}</span>
                      <button
                        type="button"
                        onClick={() => copyAgentShareText(portalUrl, "onb_portal")}
                        className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-slate-700 px-2 py-1 text-[10px] font-bold text-white hover:bg-slate-600"
                      >
                        {copiedAgentKey === "onb_portal" ? <Check size={11} /> : <Copy size={11} />}
                        {copiedAgentKey === "onb_portal" ? "Copied" : "Portal"}
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-800/80 px-3 py-2 text-xs">
                      <span className="font-mono text-emerald-300 truncate">{referralUrl}</span>
                      <button
                        type="button"
                        onClick={() => copyAgentShareText(referralUrl, "onb_ref")}
                        className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-slate-700 px-2 py-1 text-[10px] font-bold text-white hover:bg-slate-600"
                      >
                        {copiedAgentKey === "onb_ref" ? <Check size={11} /> : <Copy size={11} />}
                        {copiedAgentKey === "onb_ref" ? "Copied" : "Ref Link"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Template Editor & Direct Send Box */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs">
                      <Smartphone size={16} className="text-emerald-700" />
                      <span>Complete Professional WhatsApp Message (Editable Preview)</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setOnboardingMsgLang("english");
                          setOnboardingMsgText(buildAgentWhatsAppMessage(onboardingAgent, "english"));
                        }}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                          onboardingMsgLang === "english"
                            ? "bg-emerald-700 text-white shadow-xs"
                            : "bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-100"
                        }`}
                      >
                        Formal English
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOnboardingMsgLang("hinglish");
                          setOnboardingMsgText(buildAgentWhatsAppMessage(onboardingAgent, "hinglish"));
                        }}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                          onboardingMsgLang === "hinglish"
                            ? "bg-emerald-700 text-white shadow-xs"
                            : "bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-100"
                        }`}
                      >
                        Hinglish (India)
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={10}
                    value={onboardingMsgText}
                    onChange={(e) => setOnboardingMsgText(e.target.value)}
                    className="w-full rounded-xl border border-emerald-200 bg-white p-3 text-xs leading-relaxed text-slate-800 outline-none focus:border-emerald-600 font-sans"
                  />

                  <div className="flex flex-wrap items-center gap-2.5">
                    {waPhone.length >= 10 ? (
                      <a
                        href={`https://wa.me/${waPhone}?text=${encodeURIComponent(onboardingMsgText)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-[#1ebe5d] active:scale-95 transition"
                      >
                        <Send size={14} />
                        Send Directly on WhatsApp ({onboardingAgent.phone})
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800">
                        <AlertTriangle size={14} /> Valid phone number needed for direct WhatsApp send
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={handleCopyOnboardingText}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-xs ${
                        onboardingCopied
                          ? "bg-emerald-700 text-white"
                          : "border border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100"
                      }`}
                    >
                      {onboardingCopied ? (
                        <>
                          <Check size={14} />
                          Copied Complete Message!
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          Copy Message Template
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    {onboardingAgent.mode === "created" && (
                      <button
                        type="button"
                        onClick={() => {
                          setOnboardingAgent(null);
                          openCreateAgentModal();
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                      >
                        <UserPlus size={14} />
                        Add Another Agent
                      </button>
                    )}
                    {onboardingAgent.mode === "reshare" && matchedExistingAgent && (
                      <button
                        type="button"
                        onClick={() => {
                          setOnboardingAgent(null);
                          openEditAgentModal(matchedExistingAgent);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2 text-xs font-bold text-purple-800 hover:bg-purple-100 transition"
                      >
                        <KeyRound size={14} />
                        Edit / Reset Password
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setOnboardingAgent(null)}
                    className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition"
                  >
                    Done &amp; Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================== */}
      {/* MODAL 9: RECORD AGENT PAYOUT SETTLEMENT                        */}
      {/* ============================================================== */}
      {payingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-emerald-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Pay Out Commission</h3>
                <p className="text-xs text-slate-500">
                  {payingAgent.full_name} ({payingAgent.agent_code}) • Pending: ₹{Number(payingAgent.pending_balance || 0).toLocaleString("en-IN")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayingAgent(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {(payingAgent.upi_id || payingAgent.bank_details) && (
              <div className="mt-4 rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900 space-y-1">
                {payingAgent.upi_id && (
                  <div>
                    <strong>Agent UPI:</strong> <span className="font-mono">{payingAgent.upi_id}</span>
                  </div>
                )}
                {payingAgent.bank_details && (
                  <div>
                    <strong>Bank:</strong> {payingAgent.bank_details}
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleRecordAgentPayout} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Payout Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    required
                    value={payoutForm.amount}
                    onChange={(e) => setPayoutForm({ ...payoutForm, amount: Number(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-black text-emerald-700 outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Payment Method
                  </label>
                  <select
                    value={payoutForm.paymentMethod}
                    onChange={(e) => setPayoutForm({ ...payoutForm, paymentMethod: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold outline-none focus:border-emerald-600"
                  >
                    <option value="upi">UPI (PhonePe/GPay)</option>
                    <option value="bank_transfer">Bank Transfer (IMPS/NEFT)</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    UTR / Transaction Ref
                  </label>
                  <input
                    type="text"
                    value={payoutForm.referenceNo}
                    onChange={(e) => setPayoutForm({ ...payoutForm, referenceNo: e.target.value })}
                    placeholder="e.g. 4231987654"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-mono outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Settlement Period / Month
                  </label>
                  <input
                    type="text"
                    value={payoutForm.paidForMonth}
                    onChange={(e) => setPayoutForm({ ...payoutForm, paidForMonth: e.target.value })}
                    placeholder="e.g. Nov 2026"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={payoutForm.notes}
                  onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                  placeholder="Monthly commission settlement"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setPayingAgent(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPayout}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {savingPayout ? "Recording..." : "Record Payout Settlement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 10: MANUAL COMMISSION / BONUS ENTRY                      */}
      {/* ============================================================== */}
      {showBonusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-amber-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Add Manual Commission / Bonus</h3>
                <p className="text-xs text-slate-500">Credit bonus or special adjustment directly to an agent wallet.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowBonusModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveManualBonus} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Select Sales Agent *
                </label>
                <select
                  required
                  value={bonusForm.agentId}
                  onChange={(e) => setBonusForm({ ...bonusForm, agentId: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold outline-none focus:border-purple-600"
                >
                  {salesAgents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name} ({a.agent_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Entry Type
                  </label>
                  <select
                    value={bonusForm.commissionType}
                    onChange={(e) =>
                      setBonusForm({
                        ...bonusForm,
                        commissionType: e.target.value as "joining_fee" | "recurring" | "bonus_adjustment",
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold outline-none"
                  >
                    <option value="bonus_adjustment">Bonus / Adjustment</option>
                    <option value="joining_fee">Joining Fee Comm</option>
                    <option value="recurring">Monthly Comm</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    School (Optional)
                  </label>
                  <select
                    value={bonusForm.orgId}
                    onChange={(e) => setBonusForm({ ...bonusForm, orgId: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none"
                  >
                    <option value="">Platform Bonus</option>
                    {institutions.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Commission Amount to Credit (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={bonusForm.commissionAmount}
                  onChange={(e) => setBonusForm({ ...bonusForm, commissionAmount: Number(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-black text-emerald-700 outline-none focus:border-purple-600"
                />
                <span className="text-[10px] text-slate-400">
                  Use positive amount for bonus/credit (or negative to reverse an entry).
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Reason / Note
                </label>
                <input
                  type="text"
                  value={bonusForm.notes}
                  onChange={(e) => setBonusForm({ ...bonusForm, notes: e.target.value })}
                  placeholder="e.g. Monthly target achieved bonus"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs outline-none focus:border-purple-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowBonusModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBonus}
                  className="rounded-xl bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  {savingBonus ? "Adding..." : "Credit Commission"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 11: ASSIGN / CHANGE SALES AGENT FOR INSTITUTION          */}
      {/* ============================================================== */}
      {assigningAgentInst && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-blue-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Link School to Sales Agent</h3>
                <p className="text-xs text-slate-500">{assigningAgentInst.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setAssigningAgentInst(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAssignAgent} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Assigned Sales Partner
                </label>
                <select
                  value={selectedAssignAgentId}
                  onChange={(e) => setSelectedAssignAgentId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-blue-600"
                >
                  <option value="">-- Direct Platform (No Sales Agent) --</option>
                  {salesAgents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name} ({a.agent_code}) — {Number(a.joining_commission_percent)}% Join / {Number(a.recurring_commission_percent)}% Monthly
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Future approved Joining Fees &amp; Monthly Subscriptions from this school will credit commission to the selected agent automatically.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setAssigningAgentInst(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAssignAgent}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {savingAssignAgent ? "Saving..." : "Save Attribution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 12: DIRECT OFFLINE / CASH PAYMENT & JOINING FEE RECORDER */}
      {/* ============================================================== */}
      {recordingDirectPayInst && (() => {
        const linkedAgent = recordingDirectPayInst.referred_by_agent_id
          ? agentByIdMap.get(recordingDirectPayInst.referred_by_agent_id)
          : undefined;
        const amt = Number(directPayForm.amount) || 0;
        const joinAmt =
          directPayForm.paymentCategory === "joining_fee"
            ? amt
            : directPayForm.paymentCategory === "combined"
            ? Math.max(0, Math.min(amt, Number(directPayForm.joiningPortion) || 0))
            : 0;
        const recAmt = Math.max(0, amt - joinAmt);
        const estJoinComm = linkedAgent
          ? Math.round((joinAmt * Number(linkedAgent.joining_commission_percent)) / 100)
          : 0;
        const estRecComm = linkedAgent
          ? Math.round((recAmt * Number(linkedAgent.recurring_commission_percent)) / 100)
          : 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-3xl border border-emerald-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Record Direct School Payment</h3>
                  <p className="text-xs text-slate-500">{recordingDirectPayInst.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRecordingDirectPayInst(null)}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveDirectPayment} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Payment Purpose
                  </label>
                  <select
                    value={directPayForm.paymentCategory}
                    onChange={(e) => {
                      const nextCat = e.target.value as "joining_fee" | "recurring" | "combined";
                      setDirectPayForm({
                        ...directPayForm,
                        paymentCategory: nextCat,
                        durationDays: nextCat === "joining_fee" ? 0 : 30,
                      });
                    }}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold outline-none focus:border-emerald-600"
                  >
                    <option value="joining_fee">One-Time Joining / Setup Fee</option>
                    <option value="recurring">Monthly Recurring Subscription</option>
                    <option value="combined">Combined (Joining Fee + 1st Month)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Total Amount Received (₹) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={directPayForm.amount}
                      onChange={(e) => setDirectPayForm({ ...directPayForm, amount: Number(e.target.value) || 0 })}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-black text-emerald-700 outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Extend Validity (Days)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={directPayForm.durationDays}
                      onChange={(e) => setDirectPayForm({ ...directPayForm, durationDays: Number(e.target.value) || 0 })}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-bold outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                {directPayForm.paymentCategory === "combined" && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Joining Fee Portion (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={amt}
                      value={directPayForm.joiningPortion}
                      onChange={(e) =>
                        setDirectPayForm({ ...directPayForm, joiningPortion: Number(e.target.value) || 0 })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-bold outline-none focus:border-emerald-600"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Student Quota
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={directPayForm.studentLimit}
                      onChange={(e) =>
                        setDirectPayForm({ ...directPayForm, studentLimit: Number(e.target.value) || 100 })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      UTR / Receipt Ref
                    </label>
                    <input
                      type="text"
                      value={directPayForm.utrNumber}
                      onChange={(e) => setDirectPayForm({ ...directPayForm, utrNumber: e.target.value })}
                      placeholder="Cash / UPI UTR"
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-mono outline-none"
                    />
                  </div>
                </div>

                {linkedAgent ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-950">
                    <div className="flex items-center justify-between font-bold">
                      <span>Partner Commission ({linkedAgent.full_name}):</span>
                      <span className="font-mono text-sm text-emerald-700">
                        +₹{(estJoinComm + estRecComm).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-emerald-800">
                      {joinAmt > 0 && `Joining ₹${joinAmt} × ${Number(linkedAgent.joining_commission_percent)}% = ₹${estJoinComm}  `}
                      {recAmt > 0 && `Monthly ₹${recAmt} × ${Number(linkedAgent.recurring_commission_percent)}% = ₹${estRecComm}`}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                    No Sales Partner assigned to this school yet.
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setRecordingDirectPayInst(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingDirectPay}
                    className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {savingDirectPay ? "Recording..." : "Approve & Record Payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </main>
  );
}
