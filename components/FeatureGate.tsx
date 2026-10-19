"use client";

import Link from "next/link";
import { Lock, ArrowLeft, ShieldAlert } from "lucide-react";
import { PLATFORM_FEATURES, FeatureKey } from "@/lib/features";

interface FeatureGateProps {
  featureKey: FeatureKey;
  instituteName?: string;
}

export default function FeatureGate({ featureKey, instituteName }: FeatureGateProps) {
  const feat = PLATFORM_FEATURES.find((f) => f.key === featureKey);
  const featureTitle = feat?.name || "This Feature";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-5">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-amber-100 text-amber-700 shadow-sm">
          <Lock size={32} />
        </div>
        <div className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-white text-xs">
          <ShieldAlert size={14} />
        </div>
      </div>

      <span className="rounded-full bg-amber-100/80 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-800">
        Module Access Restricted
      </span>

      <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900">
        {featureTitle} is Not Activated
      </h1>

      <p className="mt-2 max-w-md text-sm text-slate-500 leading-relaxed">
        {instituteName ? (
          <>
            <strong>{instituteName}</strong> ke active subscription plan me yeh feature enabled nahi hai.
          </>
        ) : (
          "Aapke institute workspace ke liye yeh feature enabled nahi hai."
        )}{" "}
        Is feature ko activate karwane ke liye kripya administrator ya support se contact karein.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition"
        >
          <ArrowLeft size={14} />
          Return to Dashboard
        </Link>
        <Link
          href="/subscription"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
        >
          View Subscription Details
        </Link>
      </div>
    </div>
  );
}
