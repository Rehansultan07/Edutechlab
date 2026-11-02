"use client";

import { AlertOctagon, MessageCircle, Phone, LogOut, CreditCard } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface InstitutePausedModalProps {
  organizationName?: string;
  pauseReason?: string | null;
  pausedAt?: string | null;
  supportPhone?: string;
  supportWhatsapp?: string;
}

export default function InstitutePausedModal({
  organizationName = "Your Institution",
  pauseReason,
  pausedAt,
  supportPhone = "+91 79031 78550",
  supportWhatsapp = "917903178550",
}: InstitutePausedModalProps) {
  const supabase = createClient();

  const formattedDate = pausedAt
    ? new Date(pausedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Recently";

  const cleanReason = pauseReason && pauseReason.trim().length > 0
    ? pauseReason.trim()
    : "Monthly subscription dues pending or account verification in progress.";

  const cleanWhatsapp = (supportWhatsapp || "917903178550").replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(
    `Hello EduTechLab Platform Support,\n\nOur school "${organizationName}" portal has been paused.\nDate: ${formattedDate}\nReason: ${cleanReason}\n\nPlease help us reactivate our portal services.`
  )}`;

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    window.location.href = "/login";
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-amber-300/60 bg-white p-6 sm:p-8 shadow-2xl">
        {/* Glow decorative banner */}
        <div className="absolute -left-12 -top-12 h-36 w-36 rounded-full bg-amber-400/20 blur-2xl pointer-events-none" />
        <div className="absolute -right-12 -bottom-12 h-36 w-36 rounded-full bg-rose-400/20 blur-2xl pointer-events-none" />

        <div className="relative text-center">
          {/* Pulsing Icon */}
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-50 text-amber-600 ring-8 ring-amber-100 shadow-sm animate-pulse">
            <AlertOctagon size={42} strokeWidth={2.2} />
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-amber-800">
            <span className="h-2 w-2 rounded-full bg-amber-600 animate-ping" />
            Services Temporarily Paused
          </div>

          <h2 className="mt-3 text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">
            {organizationName}
          </h2>

          <p className="mt-1.5 text-xs font-semibold text-slate-500">
            Effective Pause Date: <span className="font-bold text-slate-800">{formattedDate}</span>
          </p>

          {/* Super Admin Reason Box */}
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-left shadow-inner">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-amber-800">
              <span>Reason Given by Super Admin</span>
              <span className="rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px]">Official Notice</span>
            </div>
            <p className="mt-2 text-sm font-medium leading-relaxed text-amber-950 font-sans">
              "{cleanReason}"
            </p>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-slate-600">
            Aapka login access open hai, lekin Super Admin dwara sabhi operational modules (Students, Attendance, Fees, Exams) ko temporarily freeze kiya gaya hai. Jab tak Super Admin resume nahi karta, tab tak services locked rahengi.
          </p>

          {/* Action CTAs */}
          <div className="mt-6 flex flex-col gap-2.5">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-[0.98]"
            >
              <MessageCircle size={18} />
              Resume Karwane Ke Liye WhatsApp Karein
            </a>

            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href="/subscription"
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-purple-200 bg-purple-50 px-3 py-2.5 text-xs font-bold text-purple-700 hover:bg-purple-100 transition"
              >
                <CreditCard size={15} />
                Pay / Submit UTR
              </Link>

              {supportPhone && (
                <a
                  href={`tel:${supportPhone}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  <Phone size={15} />
                  Call Support
                </a>
              )}
            </div>

            <button
              onClick={handleSignOut}
              className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
            >
              <LogOut size={14} />
              Sign Out of Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
