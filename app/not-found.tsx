import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f7f7f4] px-4 text-center">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          <AlertCircle size={28} />
        </div>
        <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900">404</h1>
        <h2 className="mt-2 text-lg font-bold text-slate-800">Page Not Found</h2>
        <p className="mt-2 text-sm text-slate-500">
          The page you are looking for does not exist, has been removed, or is inaccessible.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#171625] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Institute Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
