"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Calendar,
  Wallet,
  FileText,
  Bell,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  LogOut,
  AlertCircle,
  Building2,
  Printer,
  ChevronRight,
  QrCode,
  ShieldCheck,
  Phone,
  MapPin,
  CreditCard,
  UserCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type PortalData = {
  student: {
    id: string;
    admission_no: string;
    first_name: string;
    last_name: string | null;
    status: string;
    class_name: string;
    section_name: string;
    photo_url: string | null;
    gender: string | null;
    date_of_birth: string | null;
    father_name: string | null;
    mother_name: string | null;
    guardian_name: string | null;
  };
  institute: {
    name: string;
    logo_url: string | null;
    phone: string | null;
    email: string | null;
    currency: string;
  };
  attendance: Array<{
    date: string;
    status: "present" | "absent" | "late" | "leave";
    note: string | null;
  }>;
  attendance_stats: {
    total_marked: number;
    present: number;
    absent: number;
    late: number;
    percentage: number;
  };
  fees: {
    total_paid: number;
    total_due: number;
    balance: number;
    payments: Array<{
      id: string;
      amount: number;
      paid_on: string;
      method: string;
      reference: string | null;
    }>;
  };
  exam_marks: Array<{
    exam_name: string;
    exam_date: string | null;
    subject: string;
    marks: number;
    max_marks: number;
    status: string;
  }>;
  notices: Array<{
    id: string;
    title: string;
    body: string;
    published_at: string;
  }>;
};

export default function ParentPortalPage() {
  const supabase = createClient();
  const [admissionNo, setAdmissionNo] = useState("");
  const [phoneOrDob, setPhoneOrDob] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<PortalData | null>(null);
  const [activeTab, setActiveTab] = useState<"attendance" | "fees" | "exams" | "notices">("attendance");
  const [qrProfile, setQrProfile] = useState<any>(null);
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("id") || params.get("adm");
    if (idParam) {
      setAdmissionNo(idParam);
      setQrLoading(true);
      (async () => {
        try {
          const { data: res, error: rpcErr } = await supabase.rpc("get_student_qr_profile", {
            p_admission_no: idParam.trim(),
          });
          if (!rpcErr && res?.success) {
            setQrProfile(res);
          }
        } catch {}
        setQrLoading(false);
      })();
    }
  }, []);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admissionNo.trim() || !phoneOrDob.trim()) {
      setError("Please enter both Admission No. and registered Phone or Date of Birth.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data: res, error: rpcErr } = await supabase.rpc("get_student_parent_portal", {
        p_admission_no: admissionNo.trim(),
        p_phone_or_dob: phoneOrDob.trim(),
      });

      if (rpcErr) throw rpcErr;
      if (!res || !res.success) {
        throw new Error(
          res?.error || "Could not find a student record with those credentials. Please contact the school."
        );
      }

      setData(res as PortalData);
    } catch (err: any) {
      setError(err.message || "Failed to look up student record.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setData(null);
    setAdmissionNo("");
    setPhoneOrDob("");
    setError("");
  };

  // If not verified, show lookup card or QR Scan Live Verification Card
  if (!data) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-lg">
          {/* If scanned via QR code and profile verified */}
          {qrProfile && qrProfile.success ? (
            <div className="mb-6 space-y-4">
              {/* Verified Digital Card */}
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
                {/* Header with School Branding */}
                <div
                  className="p-4 text-white relative"
                  style={{ backgroundColor: qrProfile.institution.primary_color || "#1e293b" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-white/20 text-white font-bold text-xs backdrop-blur-sm">
                        <GraduationCap size={18} />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm uppercase tracking-wide leading-tight">
                          {qrProfile.institution.name}
                        </h3>
                        <p className="text-[10px] text-white/80 line-clamp-1">
                          {qrProfile.institution.address || "Verified Educational Institution"}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                      <ShieldCheck size={11} /> Verified ID
                    </span>
                  </div>
                </div>

                {/* Student Bio */}
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="relative h-18 w-18 rounded-2xl border-2 border-slate-100 bg-slate-100 shadow-sm overflow-hidden grid place-items-center shrink-0">
                      {qrProfile.student.photo_url ? (
                        <img
                          src={qrProfile.student.photo_url}
                          alt={qrProfile.student.full_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xl font-black text-slate-400 uppercase">
                          {qrProfile.student.full_name.slice(0, 2)}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                        Class: {qrProfile.student.class_name} {qrProfile.student.section_name ? `(${qrProfile.student.section_name})` : ""}
                      </div>
                      <h2 className="mt-1 text-lg font-black text-slate-900 leading-tight">
                        {qrProfile.student.full_name}
                      </h2>
                      <p className="text-xs font-mono text-slate-500">
                        Adm No: <strong className="text-slate-800">{qrProfile.student.admission_no}</strong>
                      </p>
                    </div>
                  </div>

                  {/* LIVE ATTENDANCE BADGE */}
                  <div className="mt-4 rounded-2xl border p-3.5 flex items-center justify-between text-xs transition bg-slate-50 border-slate-200">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-slate-500" />
                      <div>
                        <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          Today&apos;s Attendance
                        </span>
                        <strong className="text-slate-800 capitalize">
                          {qrProfile.attendance_today.status === "present"
                            ? `Present ${qrProfile.attendance_today.time ? `(${qrProfile.attendance_today.time})` : ""} ✓`
                            : qrProfile.attendance_today.status === "absent"
                            ? "Marked Absent ✕"
                            : "Not marked yet today"}
                        </strong>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        qrProfile.attendance_today.status === "present"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : qrProfile.attendance_today.status === "absent"
                          ? "bg-rose-100 text-rose-800 border border-rose-300"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {qrProfile.attendance_today.status}
                    </span>
                  </div>

                  {/* LIVE FEE DUES STATUS ALERT */}
                  <div
                    className={`mt-3 rounded-2xl border p-4 text-xs ${
                      qrProfile.fees.has_dues
                        ? "border-amber-200 bg-amber-50 text-amber-950"
                        : "border-emerald-200 bg-emerald-50 text-emerald-950"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet
                          size={18}
                          className={qrProfile.fees.has_dues ? "text-amber-600" : "text-emerald-600"}
                        />
                        <span className="font-extrabold text-sm">
                          {qrProfile.fees.has_dues ? "Fee Dues Notice" : "Fee Status"}
                        </span>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          qrProfile.fees.has_dues
                            ? "bg-amber-200 text-amber-900"
                            : "bg-emerald-200 text-emerald-900"
                        }`}
                      >
                        {qrProfile.fees.has_dues ? "Pending Dues" : "Paid ✓"}
                      </span>
                    </div>

                    <p className="mt-2 text-xs font-semibold leading-relaxed">
                      {qrProfile.fees.status_message}
                    </p>

                    {qrProfile.fees.has_dues && (
                      <p className="mt-1 text-[11px] text-amber-800">
                        Please deposit the pending fees at the school accounts desk or online via the school&apos;s UPI QR.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mb-6 text-center">
            {!qrProfile && (
              <>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-md">
                  <GraduationCap size={24} />
                </div>
                <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Parent &amp; Guardian Portal
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Access live attendance, fee receipts, marksheets, and school notices.
                </p>
              </>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              {qrProfile ? "Unlock Full Academic Records & Receipts" : "Student Verification"}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter registered phone number or Date of Birth to view all term marksheets and receipts.
            </p>

            <form onSubmit={handleLookup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Student Admission No.
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ADM-2026-001"
                  value={admissionNo}
                  onChange={(e) => setAdmissionNo(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Registered Phone or Date of Birth
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9876543210 or 2012-05-15"
                  value={phoneOrDob}
                  onChange={(e) => setPhoneOrDob(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Use the primary contact phone or date of birth registered with the school.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? "Verifying..." : "View Complete Portal"}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>

            <div className="mt-6 border-t border-slate-100 pt-5 text-center text-xs text-slate-400">
              Are you school staff or administrator?{" "}
              <Link href="/login" className="font-semibold text-indigo-600 hover:underline">
                Sign in here
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const { student, institute, attendance, attendance_stats, fees, exam_marks, notices } = data;
  const fullName = `${student.first_name} ${student.last_name || ""}`.trim();
  const currency = institute.currency || "INR";

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      {/* Top Banner */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
              <GraduationCap size={16} />
            </span>
            <div>
              <div className="text-xs font-bold text-slate-900">{institute.name}</div>
              <div className="text-[10px] text-slate-400">Parent Portal</div>
            </div>
          </div>

          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <LogOut size={13} />
            Switch Child
          </button>
        </div>
      </header>

      {/* Student Profile Card */}
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 font-bold text-indigo-700 text-xl border border-indigo-100">
                {student.first_name[0]}
                {student.last_name ? student.last_name[0] : ""}
              </div>
              <div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                  {student.status}
                </span>
                <h1 className="mt-1 text-2xl font-bold text-slate-900">{fullName}</h1>
                <p className="text-xs text-slate-500">
                  Admission No: <span className="font-mono font-bold text-slate-700">{student.admission_no}</span> · Class:{" "}
                  <span className="font-semibold text-slate-700">{student.class_name}</span> (Section {student.section_name})
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-500 sm:text-right">
              {student.father_name && <div>Father: <span className="font-medium text-slate-700">{student.father_name}</span></div>}
              {student.mother_name && <div>Mother: <span className="font-medium text-slate-700">{student.mother_name}</span></div>}
              {student.guardian_name && <div>Guardian: <span className="font-medium text-slate-700">{student.guardian_name}</span></div>}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-[11px] font-medium text-slate-500">Attendance Rate</div>
              <div className="mt-1 text-xl font-bold text-slate-900">{attendance_stats.percentage}%</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-[11px] font-medium text-slate-500">Days Present</div>
              <div className="mt-1 text-xl font-bold text-emerald-600">{attendance_stats.present}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-[11px] font-medium text-slate-500">Days Absent</div>
              <div className="mt-1 text-xl font-bold text-red-600">{attendance_stats.absent}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-[11px] font-medium text-slate-500">Fee Balance</div>
              <div className={`mt-1 text-xl font-bold ${fees.balance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                {fees.balance.toLocaleString("en-IN", { style: "currency", currency, maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 flex border-b border-slate-200">
          {[
            ["attendance", "Attendance", Calendar],
            ["fees", "Fees & Receipts", Wallet],
            ["exams", "Exam Results", FileText],
            ["notices", "Notices", Bell],
          ].map(([tabKey, label, Icon]: any) => (
            <button
              key={tabKey}
              onClick={() => setActiveTab(tabKey)}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition sm:px-6 ${
                activeTab === tabKey
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: Attendance */}
        {activeTab === "attendance" && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5">
                <h3 className="font-bold text-slate-900">Attendance Log</h3>
                <p className="text-xs text-slate-500">Daily presence and absence recorded by the school.</p>
              </div>

              {attendance.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">No attendance marked yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {attendance.map((att, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3.5 font-medium text-slate-900">{att.date}</td>
                          <td className="px-5 py-3.5">
                            {att.status === "present" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                <CheckCircle2 size={12} /> Present
                              </span>
                            ) : att.status === "absent" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                                <XCircle size={12} /> Absent
                              </span>
                            ) : att.status === "late" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                                <Clock size={12} /> Late
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                                {att.status}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-500">{att.note || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Fees & Receipts */}
        {activeTab === "fees" && (
          <div className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs text-slate-500">Total Dues</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {fees.total_due.toLocaleString("en-IN", { style: "currency", currency, maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs text-slate-500">Total Paid</div>
                <div className="mt-1 text-2xl font-bold text-emerald-600">
                  {fees.total_paid.toLocaleString("en-IN", { style: "currency", currency, maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs text-slate-500">Outstanding Balance</div>
                <div className={`mt-1 text-2xl font-bold ${fees.balance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {fees.balance.toLocaleString("en-IN", { style: "currency", currency, maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5">
                <h3 className="font-bold text-slate-900">Payment Transactions & Receipts</h3>
                <p className="text-xs text-slate-500">Official fee receipts recorded for your child.</p>
              </div>

              {fees.payments.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">No payment receipts found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Receipt / Date</th>
                        <th className="px-5 py-3">Amount</th>
                        <th className="px-5 py-3">Payment Method</th>
                        <th className="px-5 py-3">Reference</th>
                        <th className="px-5 py-3 text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fees.payments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-slate-900">{p.paid_on}</div>
                            <div className="text-xs font-mono text-slate-400">ID: {p.id.slice(0, 8)}</div>
                          </td>
                          <td className="px-5 py-3.5 font-bold text-emerald-700">
                            {Number(p.amount).toLocaleString("en-IN", { style: "currency", currency, maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-5 py-3.5 uppercase text-xs font-medium text-slate-600">{p.method}</td>
                          <td className="px-5 py-3.5 text-xs text-slate-500">{p.reference || "—"}</td>
                          <td className="px-5 py-3.5 text-right">
                            <Link
                              href={`/fees/receipt/${p.id}`}
                              target="_blank"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Printer size={13} />
                              View Receipt
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Exam Results */}
        {activeTab === "exams" && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5">
                <h3 className="font-bold text-slate-900">Examination Results & Scorecards</h3>
                <p className="text-xs text-slate-500">Subject-wise marks and assessment evaluations.</p>
              </div>

              {exam_marks.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">No examination results recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                      <tr>
                        <th className="px-5 py-3">Exam</th>
                        <th className="px-5 py-3">Subject</th>
                        <th className="px-5 py-3">Marks</th>
                        <th className="px-5 py-3">Percentage</th>
                        <th className="px-5 py-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {exam_marks.map((m, i) => {
                        const pct = m.max_marks > 0 ? Math.round((Number(m.marks) / Number(m.max_marks)) * 100) : 0;
                        return (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="px-5 py-3.5 font-medium text-slate-900">{m.exam_name}</td>
                            <td className="px-5 py-3.5 font-semibold text-slate-800">{m.subject}</td>
                            <td className="px-5 py-3.5">
                              <span className="font-bold text-slate-900">{m.marks}</span>
                              <span className="text-xs text-slate-400"> / {m.max_marks}</span>
                            </td>
                            <td className="px-5 py-3.5 font-medium text-slate-700">{pct}%</td>
                            <td className="px-5 py-3.5 text-right">
                              {pct >= 33 ? (
                                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                  Pass
                                </span>
                              ) : (
                                <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                                  Needs Attention
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: Notices */}
        {activeTab === "notices" && (
          <div className="mt-6 space-y-4">
            {notices.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                No announcements or notices at this time.
              </div>
            ) : (
              notices.map((n) => (
                <div key={n.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Published Announcement</span>
                    <span>{new Date(n.published_at).toLocaleDateString()}</span>
                  </div>
                  <h3 className="mt-2 text-lg font-bold text-slate-900">{n.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">{n.body}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
}
