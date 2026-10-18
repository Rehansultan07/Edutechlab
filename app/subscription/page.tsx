"use client";

import { useEffect, useState, useMemo, ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  Copy,
  Check,
  CreditCard,
  Users,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  QrCode,
  FileCheck,
  HelpCircle,
  Phone,
  Mail,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUserAccess } from "@/lib/auth/permissions";
import AccessDenied from "@/components/auth/AccessDenied";

type PricingConfig = {
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

type SubscriptionData = {
  id: string;
  organization_id: string;
  plan_type: string;
  status: string;
  student_limit: number;
  current_student_count: number;
  monthly_amount: number;
  is_trial: boolean;
  trial_ends_at: string | null;
  current_period_starts_at: string;
  current_period_ends_at: string;
  days_remaining: number;
  is_expired: boolean;
  can_admit_students: boolean;
  pricing: PricingConfig;
  latest_payment: {
    id: string;
    student_limit: number;
    amount: number;
    utr_number: string;
    screenshot_url: string | null;
    status: string;
    rejection_reason: string | null;
    created_at: string;
  } | null;
};

export default function SubscriptionPage() {
  const supabase = createClient();
  const { loading: authLoading, orgId, hasAccess, can, isAdmin } = useUserAccess([
    "settings.manage",
  ]);

  const [loading, setLoading] = useState(true);
  const [subData, setSubData] = useState<SubscriptionData | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Plan Selection & Calculation
  const [targetStudents, setTargetStudents] = useState<number>(20);
  const [utrNumber, setUtrNumber] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  const loadSubscription = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      setError("");

      const { data, error: rpcErr } = await supabase.rpc("get_institution_subscription", {
        p_org_id: orgId,
      });

      if (rpcErr) throw rpcErr;
      setSubData(data as SubscriptionData);
      if (data?.student_limit) {
        setTargetStudents(data.student_limit);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load subscription details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orgId) {
      loadSubscription();
    }
  }, [orgId]);

  // Pricing calculation
  const calculatedPrice = useMemo(() => {
    const baseStudents = subData?.pricing.base_students || 20;
    const basePrice = Number(subData?.pricing.base_price || 149);
    const extraRate = Number(subData?.pricing.extra_student_rate || 7);

    const count = Math.max(1, targetStudents);
    if (count <= baseStudents) {
      return basePrice;
    }
    return basePrice + (count - baseStudents) * extraRate;
  }, [targetStudents, subData]);

  // Copy UPI ID helper
  const handleCopyUpi = () => {
    if (!subData?.pricing.upi_id) return;
    navigator.clipboard.writeText(subData.pricing.upi_id);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  // Submit Payment Proof
  const handleSubmitPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!orgId) return;

    if (!utrNumber.trim()) {
      setError("Please enter the UTR or Transaction Reference Number from your payment app.");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      let screenshotUrl = "";

      // Upload screenshot if provided
      if (proofFile) {
        const ext = proofFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${orgId}/${Date.now()}_payment_proof.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("subscription-proofs")
          .upload(path, proofFile, { upsert: true });

        if (uploadErr) throw uploadErr;

        const { data: publicUrlData } = supabase.storage
          .from("subscription-proofs")
          .getPublicUrl(path);

        screenshotUrl = publicUrlData.publicUrl;
      }

      // Invoke RPC
      const { data, error: submitErr } = await supabase.rpc("submit_subscription_payment", {
        p_org_id: orgId,
        p_student_limit: targetStudents,
        p_amount: calculatedPrice,
        p_utr_number: utrNumber.trim(),
        p_screenshot_url: screenshotUrl || null,
      });

      if (submitErr) throw submitErr;

      setSuccess("Payment details submitted successfully! Super Admin will review and activate your subscription shortly.");
      setUtrNumber("");
      setProofFile(null);
      await loadSubscription();
    } catch (err: any) {
      setError(err.message || "Failed to submit payment proof.");
    } finally {
      setUploading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <main className="mx-auto max-w-5xl p-8 text-center text-sm text-slate-500">
        Loading subscription and plan details...
      </main>
    );
  }

  if (!hasAccess && !isAdmin) {
    return <AccessDenied moduleName="Subscription & Billing" />;
  }

  const usagePercent = subData
    ? Math.min(100, Math.round((subData.current_student_count / subData.student_limit) * 100))
    : 0;

  const dynamicQrCodeUrl = subData?.pricing.upi_qr_url
    ? subData.pricing.upi_qr_url
    : `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
        `upi://pay?pa=${subData?.pricing.upi_id || "edutechlab@upi"}&pn=${encodeURIComponent(
          subData?.pricing.upi_name || "EduTechLab"
        )}&am=${calculatedPrice}&cu=INR&tn=${encodeURIComponent(
          `EduTechLab Subscription for ${targetStudents} Students`
        )}`
      )}`;

  return (
    <main className="mx-auto max-w-5xl p-5 sm:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <button
            onClick={() => window.history.back()}
            className="mb-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-purple-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-purple-700">
              SaaS Billing
            </span>
            <p className="text-xs text-slate-400">EduTechLab Institution Workspace</p>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Subscription & Capacity
          </h1>
        </div>

        <button
          onClick={loadSubscription}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <RefreshCw size={14} /> Refresh Status
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Rejection Notification if any */}
      {subData?.latest_payment?.status === "rejected" && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 text-amber-600 shrink-0" size={20} />
            <div>
              <h3 className="text-sm font-bold text-amber-900">
                Previous Payment Proof Rejected by Platform Admin
              </h3>
              <p className="mt-1 text-xs text-amber-800">
                Reason:{" "}
                <span className="font-semibold">
                  {subData.latest_payment.rejection_reason || "Could not verify UTR number or payment."}
                </span>
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Please verify your transaction reference number and re-submit the payment details below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pending Approval Notice */}
      {subData?.status === "pending_approval" && (
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 text-blue-600 shrink-0" size={20} />
            <div>
              <h3 className="text-sm font-bold text-blue-900">
                Payment Verification in Progress
              </h3>
              <p className="mt-1 text-xs text-blue-700">
                Your payment of{" "}
                <span className="font-bold">₹{subData.latest_payment?.amount}</span> (UTR:{" "}
                <span className="font-mono font-semibold">{subData.latest_payment?.utr_number}</span>)
                has been received and is awaiting Super Admin verification. Your workspace features
                remain active.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current Subscription Status Card */}
      <section className="grid gap-5 md:grid-cols-3">
        {/* Status & Plan */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Current Plan</p>
          <div className="mt-2 flex items-center gap-2">
            <h2 className="text-2xl font-extrabold text-slate-900">
              {subData?.is_trial
                ? `Free Trial (${subData.days_remaining}d remaining)`
                : subData?.status === "active"
                ? "Active Standard Plan"
                : "No Active Subscription"}
            </h2>
          </div>

          <div className="mt-4">
            {subData?.status === "active" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                <CheckCircle2 size={13} /> Active Subscription
              </span>
            ) : subData?.status === "trial" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">
                <Sparkles size={13} /> Free Trial Active
              </span>
            ) : subData?.status === "pending_approval" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                <Clock size={13} /> Under Verification
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                <AlertTriangle size={13} /> Plan Inactive / Expired
              </span>
            )}
          </div>

          <p className="mt-4 text-xs text-slate-500">
            {subData?.days_remaining !== undefined && subData.days_remaining > 0 ? (
              <span>
                <strong className="text-slate-900">{subData.days_remaining} days</strong> remaining in
                current period.
              </span>
            ) : (
              <span className="font-semibold text-red-600">
                No active plan or trial - Please select a plan and subscribe below.
              </span>
            )}
          </p>
        </div>

        {/* Student Quota Meter */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Student Capacity
            </p>
            <Users size={16} className="text-purple-600" />
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {subData?.current_student_count || 0}
            </span>
            <span className="text-sm font-semibold text-slate-400">
              / {subData?.student_limit || 20} max
            </span>
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Quota Used</span>
              <span>{usagePercent}%</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  usagePercent >= 100
                    ? "bg-red-500"
                    : usagePercent >= 80
                    ? "bg-amber-500"
                    : "bg-purple-600"
                }`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {subData && subData.student_limit - subData.current_student_count > 0
              ? `${subData.student_limit - subData.current_student_count} enrollment slots remaining.`
              : "Capacity limit reached. Upgrade to admit more students."}
          </p>
        </div>

        {/* Validity & Monthly Amount */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Plan Rate</p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-slate-900">
              ₹{subData?.monthly_amount || 149}
            </span>
            <span className="text-xs text-slate-500">/ month</span>
          </div>

          <div className="mt-4 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Valid Until:</span>
              <span className="font-semibold text-slate-800">
                {subData?.current_period_ends_at
                  ? new Date(subData.current_period_ends_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Model:</span>
              <span className="font-medium">Per Student SaaS</span>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-purple-50 p-2.5 text-[11px] text-purple-900">
            Base: ₹149 (up to 20 students) + ₹7 per additional student.
          </div>
        </div>
      </section>

      {/* Plan Selection & UPI Payment Section */}
      <section className="mt-8 grid gap-8 lg:grid-cols-12">
        {/* Left Column: Plan Calculator & Quota Selector (7 cols) */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:col-span-7">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-slate-900 p-2 text-white">
              <CreditCard size={18} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Select Student Capacity</h2>
              <p className="text-xs text-slate-500">
                Choose your institute's required student enrollment quota for the next cycle.
              </p>
            </div>
          </div>

          {/* Quick preset buttons */}
          <div className="mt-6">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Quick Selection
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {[20, 50, 100, 200, 300, 500].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTargetStudents(preset)}
                  className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                    targetStudents === preset
                      ? "border-purple-600 bg-purple-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {preset} Students
                </button>
              ))}
            </div>
          </div>

          {/* Custom Student Counter Input */}
          <div className="mt-6">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Exact Student Capacity Required
            </label>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={10000}
                value={targetStudents}
                onChange={(e) => setTargetStudents(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-48 rounded-xl border border-slate-300 px-4 py-3 text-base font-bold text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
              />
              <span className="text-xs text-slate-500">students in school</span>
            </div>
          </div>

          {/* Transparent Price Breakdown */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Monthly Pricing Breakdown
            </h3>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Base Tier (up to 20 students):</span>
                <span className="font-semibold text-slate-900">₹149</span>
              </div>
              {targetStudents > 20 && (
                <div className="flex justify-between text-slate-600">
                  <span>
                    Additional {targetStudents - 20} students @ ₹7/student:
                  </span>
                  <span className="font-semibold text-slate-900">
                    ₹{(targetStudents - 20) * 7}
                  </span>
                </div>
              )}
              <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-sm">
                <span className="font-bold text-slate-900">Total Monthly Subscription:</span>
                <span className="text-2xl font-black text-purple-700">
                  ₹{calculatedPrice}
                </span>
              </div>
            </div>
          </div>

          {/* Mid-Month Contact Support Note */}
          <div className="mt-6 rounded-2xl border border-purple-100 bg-purple-50/60 p-4 text-xs text-purple-900">
            <div className="flex items-start gap-2.5">
              <HelpCircle size={16} className="mt-0.5 text-purple-600 shrink-0" />
              <div>
                <strong>Need a mid-month quota upgrade or custom plan?</strong>
                <p className="mt-0.5 text-purple-700">
                  You can change your plan monthly directly here. If you need to immediately increase
                  student capacity in the middle of a month, please contact the developer / Super
                  Admin:
                </p>
                <div className="mt-2 flex flex-wrap gap-4 font-semibold text-purple-900">
                  {subData?.pricing.contact_phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone size={13} /> {subData.pricing.contact_phone}
                    </span>
                  )}
                  {subData?.pricing.contact_email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail size={13} /> {subData.pricing.contact_email}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: UPI QR Code & Payment Submission (5 cols) */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:col-span-5">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-purple-600 p-2 text-white">
              <QrCode size={18} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Scan & Pay via UPI</h2>
              <p className="text-xs text-slate-500">Pay using GPay, PhonePe, Paytm, or any UPI app.</p>
            </div>
          </div>

          {/* QR Code Card */}
          <div className="mt-5 flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="overflow-hidden rounded-xl border border-white bg-white p-2 shadow-sm">
              <img
                src={dynamicQrCodeUrl}
                alt="UPI Payment QR Code"
                className="h-44 w-44 object-contain"
              />
            </div>
            <p className="mt-3 text-xs font-medium text-slate-500">
              Scan with any UPI App • Exact Amount:{" "}
              <strong className="text-slate-900">₹{calculatedPrice}</strong>
            </p>

            {/* UPI ID with 1-click copy */}
            <div className="mt-3 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
              <span className="font-mono text-slate-700 truncate">
                {subData?.pricing.upi_id || "edutechlab@upi"}
              </span>
              <button
                type="button"
                onClick={handleCopyUpi}
                className="ml-2 inline-flex items-center gap-1 font-semibold text-purple-600 hover:text-purple-700"
              >
                {copiedUpi ? <Check size={14} /> : <Copy size={14} />}
                {copiedUpi ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Payment Proof Form */}
          <form onSubmit={handleSubmitPayment} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                UTR / Transaction Reference No. <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="12-digit UPI UTR No. (e.g. 423456789012)"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-mono outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Payment Screenshot
              </label>
              <div className="mt-1.5 flex items-center gap-3">
                <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs font-medium text-slate-600 hover:bg-slate-100">
                  <Upload size={14} />
                  <span>{proofFile ? proofFile.name : "Upload Payment Slip / Screenshot"}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      if (e.target.files && e.target.files[0]) {
                        setProofFile(e.target.files[0]);
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#171625] py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-50"
            >
              {uploading ? "Submitting Proof..." : `Submit Payment Proof (₹${calculatedPrice})`}
              {!uploading && <FileCheck size={16} />}
            </button>
          </form>

          <p className="mt-4 text-center text-[11px] text-slate-400">
            Super Admin typically approves payments within 1-2 hours during business hours.
          </p>
        </div>
      </section>
    </main>
  );
}
