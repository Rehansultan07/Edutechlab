"use client";

import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export default function AccessDenied({ moduleName }: { moduleName: string }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center p-6 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-red-50 text-red-600">
        <ShieldAlert size={32} />
      </div>
      <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
        Access Restricted
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Your account does not have permission to view or manage <b>{moduleName}</b>.
        Permissions are assigned by your institute administrator.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/staff-dashboard"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <ArrowLeft size={16} /> Back to Staff Dashboard
        </Link>
      </div>
    </main>
  );
}
