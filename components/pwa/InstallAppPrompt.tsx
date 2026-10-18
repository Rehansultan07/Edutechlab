"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, X, Share, PlusSquare, Sparkles } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Check if already running in standalone app mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice =
      /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIos(isIosDevice);

    // 3. Register service worker safely
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {
          // SW registered
        })
        .catch(() => {
          // SW registration ignored in non-https local environments
        });
    }

    // 4. Listen for Chrome/Edge/Android beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);

      // Check if user dismissed it in this session
      const dismissed = sessionStorage.getItem("edutechlab_pwa_dismissed");
      if (!dismissed) {
        // Slight delay for smooth entrance after dashboard loads
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Also trigger popup on iOS if not dismissed
    if (isIosDevice) {
      const dismissed = sessionStorage.getItem("edutechlab_pwa_dismissed");
      if (!dismissed) {
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }

    // Fallback: If not fired after 3 seconds on desktop/mobile and not dismissed, show install helper
    const fallbackTimer = setTimeout(() => {
      const dismissed = sessionStorage.getItem("edutechlab_pwa_dismissed");
      if (!isStandalone && !dismissed) {
        setIsOpen(true);
      }
    }, 2500);

    // Listen to manual open trigger from header button
    const handleManualOpen = () => {
      setIsOpen(true);
    };
    window.addEventListener("open-install-prompt", handleManualOpen);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("open-install-prompt", handleManualOpen);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Trigger native browser installation modal
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          setIsInstalled(true);
          setIsOpen(false);
        }
        setDeferredPrompt(null);
      } catch {
        // If prompt fails, fallback
      }
    } else if (isIos) {
      setShowIosGuide(true);
    } else {
      // Browser doesn't support deferred prompt or desktop without prompt
      setShowIosGuide(true);
    }
  };

  const handleDismiss = () => {
    setIsOpen(false);
    sessionStorage.setItem("edutechlab_pwa_dismissed", "true");
  };

  if (isInstalled || !isOpen) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm sm:max-w-md animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="overflow-hidden rounded-3xl border border-purple-300/80 bg-white/95 p-5 shadow-[0_20px_60px_rgba(102,87,232,0.22)] backdrop-blur-md">
        {/* Glow accent */}
        <div className="absolute -top-12 -right-12 h-28 w-28 rounded-full bg-purple-400/20 blur-2xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-tr from-[#171625] via-[#4338ca] to-[#6657e8] p-1.5 shadow-md shadow-purple-500/20 flex items-center justify-center">
              <img
                src="/icons/icon-192.png"
                alt="EduTechLab App"
                className="h-full w-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              <Smartphone className="text-white" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                  Install EduTechLab
                </span>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                  <Sparkles size={10} /> App
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Install directly to your Home Screen / Desktop
              </p>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Description */}
        <p className="mt-3 text-xs leading-5 text-slate-600">
          Ab browser me baar-baar URL type karne ki zaroorat nahi. Direct <strong>Home Screen</strong> par install karein aur 1-click me poora <strong>native mobile app</strong> jaisa fast experience payein!
        </p>

        {/* iOS Step Guide if needed */}
        {showIosGuide && (
          <div className="mt-3 rounded-2xl bg-purple-50 p-3.5 text-xs text-purple-900 border border-purple-100 space-y-1.5">
            <p className="font-bold flex items-center gap-1">
              {isIos ? "iPhone / Safari par install kaise karein:" : "Desktop / Browser par install kaise karein:"}
            </p>
            {isIos ? (
              <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                <li>Neeche Safari bar me <strong>Share</strong> button <Share size={12} className="inline mx-0.5" /> par tap karein.</li>
                <li>Neeche scroll karke <strong>Add to Home Screen</strong> <PlusSquare size={12} className="inline mx-0.5" /> select karein.</li>
              </ol>
            ) : (
              <p className="text-[11px]">
                Browser address bar ke right side me <strong>Install Icon (⊕)</strong> par click karein, ya browser menu (⋮) me jakar <strong>"Install EduTechLab"</strong> par click karein.
              </p>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="mt-4 flex items-center justify-end gap-2.5">
          <button
            onClick={handleDismiss}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Baad Me / Later
          </button>
          <button
            onClick={handleInstallClick}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-[#6657e8] px-4 py-2 text-xs font-bold text-white shadow-md shadow-purple-600/25 hover:from-purple-500 hover:to-purple-600 transition hover:-translate-y-0.5 active:translate-y-0"
          >
            <Download size={14} />
            Install App Now
          </button>
        </div>
      </div>
    </div>
  );
}
