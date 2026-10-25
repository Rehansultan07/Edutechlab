"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Search, Trash2, Download, TrendingUp, TrendingDown, DollarSign, WalletCards, Receipt, Filter, Calendar, X, CheckCircle2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUserAccess } from "@/lib/auth/permissions";
import AccessDenied from "@/components/auth/AccessDenied";
import FeatureGate from "@/components/FeatureGate";
import { fetchInstitutionFeatures } from "@/lib/features";

type Expense = {
  id: string;
  organization_id: string;
  title: string;
  category: string;
  amount: number;
  expense_date: string;
  payment_mode: string;
  paid_to: string | null;
  voucher_no: string | null;
  notes: string | null;
  created_at: string;
};

const CATEGORIES = [
  { id: "salary", label: "Faculty & Staff Salary", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "utility", label: "Electricity & Water Bills", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "rent", label: "Building / Campus Rent", color: "bg-rose-50 text-rose-700 border-rose-200" },
  { id: "stationery", label: "Stationery & Printing", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { id: "maintenance", label: "Repairs & Maintenance", color: "bg-teal-50 text-teal-700 border-teal-200" },
  { id: "transport", label: "Fuel & Bus Transport", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { id: "events", label: "Events, Sports & Function", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { id: "other", label: "Miscellaneous / Other", color: "bg-slate-50 text-slate-700 border-slate-200" },
];

export default function ExpensesPage() {
  const supabase = createClient();
  const { loading: authLoading, orgId, hasAccess, can, isAdmin } = useUserAccess([
    "expenses.view",
    "expenses.manage",
    "fees.manage",
    "settings.manage",
  ]);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [feeIncome, setFeeIncome] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [featureActive, setFeatureActive] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Modal State
  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "salary",
    amount: "",
    expense_date: new Date().toISOString().slice(0, 10),
    payment_mode: "cash",
    paid_to: "",
    voucher_no: "",
    notes: "",
  });

  const canManage = isAdmin || can("settings.manage");

  const loadData = async () => {
    if (!orgId) return;
    setLoading(true);
      const feat = await fetchInstitutionFeatures(supabase, orgId);
      if (feat && feat.expenses === false) { setFeatureActive(false); setLoading(false); return; }
    setError("");

    try {
      // 1. Load Fee Collection Income for current month
      const monthStart = `${selectedMonth}-01`;
      const { data: feesData } = await supabase
        .from("fee_payments")
        .select("amount")
        .eq("organization_id", orgId)
        .gte("paid_on", monthStart);

      const totalFees = (feesData || []).reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);
      setFeeIncome(totalFees);

      // 2. Load Expenses from Supabase (with localStorage fallback if table is not yet created)
      const { data: expData, error: expError } = await supabase
        .from("school_expenses")
        .select("*")
        .eq("organization_id", orgId)
        .order("expense_date", { ascending: false });

      if (expError) {
        // Fallback to local storage
        const local = localStorage.getItem(`edutechlab_expenses_${orgId}`);
        if (local) {
          try {
            setExpenses(JSON.parse(local));
          } catch {
            setExpenses([]);
          }
        }
      } else {
        setExpenses(expData || []);
        localStorage.setItem(`edutechlab_expenses_${orgId}`, JSON.stringify(expData || []));
      }
    } catch (err: any) {
      setError(err.message || "Failed to load expenses.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orgId && hasAccess) {
      loadData();
    }
  }, [orgId, hasAccess, selectedMonth]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.amount || Number(form.amount) <= 0) {
      setError("Please provide a valid title and amount.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const newExpense: Expense = {
      id: crypto.randomUUID(),
      organization_id: orgId!,
      title: form.title.trim(),
      category: form.category,
      amount: Number(form.amount),
      expense_date: form.expense_date,
      payment_mode: form.payment_mode,
      paid_to: form.paid_to.trim() || null,
      voucher_no: form.voucher_no.trim() || null,
      notes: form.notes.trim() || null,
      created_at: new Date().toISOString(),
    };

    try {
      // Try Supabase insert
      const { error: insErr } = await supabase.from("school_expenses").insert(newExpense);
      if (insErr) {
        // Fallback: save to local storage
        const updated = [newExpense, ...expenses];
        setExpenses(updated);
        localStorage.setItem(`edutechlab_expenses_${orgId}`, JSON.stringify(updated));
      } else {
        setExpenses((prev) => [newExpense, ...prev]);
        localStorage.setItem(`edutechlab_expenses_${orgId}`, JSON.stringify([newExpense, ...expenses]));
      }

      setSuccess("Expense voucher recorded successfully!");
      setOpenModal(false);
      setForm({
        title: "",
        category: "salary",
        amount: "",
        expense_date: new Date().toISOString().slice(0, 10),
        payment_mode: "cash",
        paid_to: "",
        voucher_no: "",
        notes: "",
      });
    } catch (err: any) {
      setError(err.message || "Could not save expense.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense record?")) return;
    try {
      await supabase.from("school_expenses").delete().eq("id", id).eq("organization_id", orgId);
      const updated = expenses.filter((x) => x.id !== id);
      setExpenses(updated);
      localStorage.setItem(`edutechlab_expenses_${orgId}`, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  // Filtered List
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const matchCat = selectedCategory === "all" || exp.category === selectedCategory;
      const matchMonth = !selectedMonth || exp.expense_date.startsWith(selectedMonth);
      const searchTarget = `${exp.title} ${exp.paid_to || ""} ${exp.voucher_no || ""}`.toLowerCase();
      const matchSearch = !search || searchTarget.includes(search.toLowerCase());
      return matchCat && matchMonth && matchSearch;
    });
  }, [expenses, selectedCategory, selectedMonth, search]);

  // Totals for selected month
  const totalMonthExpense = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [filteredExpenses]);

  const netSurplus = feeIncome - totalMonthExpense;

  const exportCSV = () => {
    if (filteredExpenses.length === 0) return;
    const headers = ["Date", "Title", "Category", "Amount (INR)", "Payment Mode", "Paid To", "Voucher No", "Notes"];
    const rows = filteredExpenses.map((e) => [
      e.expense_date,
      `"${e.title.replace(/"/g, '""')}"`,
      e.category,
      e.amount,
      e.payment_mode,
      `"${(e.paid_to || "").replace(/"/g, '""')}"`,
      `"${(e.voucher_no || "").replace(/"/g, '""')}"`,
      `"${(e.notes || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `School_Expenses_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!featureActive) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <FeatureGate featureKey="expenses" instituteName={"Your School"} />
      </div>
    );
  }

  if (authLoading) {
    return (
      <main className="mx-auto max-w-7xl p-8 text-center text-sm text-slate-500">
        Loading Expense Tracker...
      </main>
    );
  }

  if (!hasAccess) {
    return <AccessDenied moduleName="Expense Management" />;
  }

  return (
    <main className="mx-auto max-w-7xl p-5 sm:p-8">
      {/* Top Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Link
            href="/dashboard"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            School Expense & Kharcha Tracker
          </h1>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            Track daily institution outflows, salaries, maintenance, bills, and monthly net profit/loss.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={filteredExpenses.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:opacity-40"
          >
            <Download size={14} /> Export CSV
          </button>
          {canManage && (
            <button
              onClick={() => {
                setError("");
                setSuccess("");
                setOpenModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-600/25 hover:bg-purple-700 transition active:scale-95"
            >
              <Plus size={16} />
              <span>Record Expense</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Financial Pulse Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Total Fee Income */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Fee Collections ({selectedMonth})
            </span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-950 sm:text-3xl">
            ₹{feeIncome.toLocaleString("en-IN")}
          </div>
          <p className="mt-1 text-[11px] font-medium text-emerald-700">
            Recorded student fee receipts
          </p>
        </div>

        {/* Total Expenses */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
              Total Expenses ({selectedMonth})
            </span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-rose-100 text-rose-700">
              <TrendingDown size={16} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-rose-950 sm:text-3xl">
            ₹{totalMonthExpense.toLocaleString("en-IN")}
          </div>
          <p className="mt-1 text-[11px] font-medium text-rose-700">
            {filteredExpenses.length} expense vouchers recorded
          </p>
        </div>

        {/* Net Operating Surplus / Deficit */}
        <div className={`rounded-2xl border p-5 shadow-sm ${
          netSurplus >= 0 ? "border-indigo-200 bg-indigo-50/50" : "border-amber-200 bg-amber-50/50"
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${
              netSurplus >= 0 ? "text-indigo-800" : "text-amber-800"
            }`}>
              Net Operating Margin
            </span>
            <div className={`grid h-8 w-8 place-items-center rounded-xl ${
              netSurplus >= 0 ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"
            }`}>
              <DollarSign size={16} />
            </div>
          </div>
          <div className={`mt-2 text-2xl font-black sm:text-3xl ${
            netSurplus >= 0 ? "text-indigo-950" : "text-amber-950"
          }`}>
            ₹{netSurplus.toLocaleString("en-IN")}
          </div>
          <p className={`mt-1 text-[11px] font-medium ${
            netSurplus >= 0 ? "text-indigo-700" : "text-amber-700"
          }`}>
            {netSurplus >= 0 ? "Positive Cashflow Surplus 🎉" : "Operating Deficit for Period"}
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search expenses by title, vendor, or voucher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-purple-600 focus:outline-none"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-purple-600 focus:outline-none"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          {/* Month Picker */}
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:border-purple-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Expenses Table */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading expense vouchers...</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt size={32} className="mx-auto text-slate-300" />
            <h4 className="mt-3 text-sm font-bold text-slate-800">No expenses recorded for this filter</h4>
            <p className="mt-1 text-xs text-slate-500">
              Click "Record Expense" to log faculty salaries, electricity, stationery, or maintenance.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Expense Title</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Paid To / Vendor</th>
                  <th className="px-5 py-3.5">Payment Mode</th>
                  <th className="px-5 py-3.5 text-right">Amount</th>
                  {canManage && <th className="px-5 py-3.5 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredExpenses.map((exp) => {
                  const cat = CATEGORIES.find((c) => c.id === exp.category) || CATEGORIES[CATEGORIES.length - 1];
                  return (
                    <tr key={exp.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-500 font-mono">
                        {exp.expense_date}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900">{exp.title}</div>
                        {exp.voucher_no && (
                          <span className="text-[10px] text-slate-400">Voucher: {exp.voucher_no}</span>
                        )}
                        {exp.notes && (
                          <p className="text-[10px] text-slate-400 line-clamp-1">{exp.notes}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold ${cat.color}`}>
                          {cat.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-600">
                        {exp.paid_to || "—"}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap capitalize text-slate-600">
                        {exp.payment_mode.replace("_", " ")}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right font-black text-slate-900 font-mono text-sm">
                        ₹{Number(exp.amount).toLocaleString("en-IN")}
                      </td>
                      {canManage && (
                        <td className="px-5 py-3.5 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleDelete(exp.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                            title="Delete Expense Record"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECORD EXPENSE MODAL */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setOpenModal(false)}
              className="absolute right-4 top-4 rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-purple-50 text-purple-600">
                <Receipt size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Record School Expense</h3>
                <p className="text-xs text-slate-500">Log an outflow with category, amount, and receipt.</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Expense Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. October Faculty Salary - Imran Sir"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 focus:border-purple-600 focus:outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Amount (INR ₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    placeholder="e.g. 15000"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:border-purple-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.expense_date}
                    onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-purple-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Payment Mode *
                  </label>
                  <select
                    value={form.payment_mode}
                    onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-purple-600 focus:outline-none"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI / Online</option>
                    <option value="bank_transfer">Bank Transfer / NEFT</option>
                    <option value="cheque">Cheque</option>
                    <option value="card">Debit/Credit Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Paid To / Receiver
                  </label>
                  <input
                    type="text"
                    placeholder="Staff name or vendor"
                    value={form.paid_to}
                    onChange={(e) => setForm({ ...form, paid_to: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-800 focus:border-purple-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Voucher / Bill No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. VCH-0042"
                    value={form.voucher_no}
                    onChange={(e) => setForm({ ...form, voucher_no: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-800 focus:border-purple-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Additional Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional details or description..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs font-medium text-slate-800 focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setOpenModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-purple-600/25 hover:bg-purple-700 transition disabled:opacity-50"
                >
                  {saving ? "Saving Voucher..." : "Save Expense Voucher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
