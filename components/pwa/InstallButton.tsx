"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";

export default function InstallButton({ className = "" }: { className?: string }) {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
  }, []);

  if (isStandalone) {
    return null; // Don't show if already in standalone app
  }

  const triggerInstall = () => {
    window.dispatchEvent(new CustomEvent("open-install-prompt"));
  };

  return (
    <button
      onClick={triggerInstall}
      className={
        className ||
        "inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 shadow-sm hover:bg-purple-100 transition"
      }
      title="Install EduTechLab on your home screen or desktop"
    >
      <Smartphone size={14} className="text-purple-600" />
      <span>Install App</span>
    </button>
  );
}
