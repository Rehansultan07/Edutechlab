"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, X, Share, PlusSquare, Sparkles, MoreVertical, CheckCircle2 } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Check if already installed & running in standalone app mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://");

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Detect Device Type
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
    const isAndroidDevice = /android/.test(ua);
    setIsIos(isIosDevice);
    setIsAndroid(isAndroidDevice);

    // 3. Register service worker safely
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {})
        .catch(() => {});
    }

    // 4. Capture native browser beforeinstallprompt (Android Chrome, Edge, Chromium)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);

      const dismissed = sessionStorage.getItem("edutechlab_pwa_dismissed");
      if (!dismissed) {
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 800);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 5. On Mobile (iOS or Android), show popup if not dismissed
    const dismissed = sessionStorage.getItem("edutechlab_pwa_dismissed");
    if (!dismissed && !isStandalone) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }

    // 6. Manual open trigger from header button
    const handleManualOpen = () => {
      setShowGuide(false);
      setIsOpen(true);
    };
    window.addEventListener("open-install-prompt", handleManualOpen);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("open-install-prompt", handleManualOpen);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          setIsInstalled(true);
          setIsOpen(false);
        }
        setDeferredPrompt(null);
      } catch {
        setShowGuide(true);
      }
    } else {
      // If native prompt is not yet ready or iOS
      setShowGuide(true);
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
    <div className="fixed inset-x-3 bottom-3 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="overflow-hidden rounded-3xl border border-purple-300/80 bg-white/95 p-4 sm:p-5 shadow-[0_20px_60px_rgba(102,87,232,0.25)] backdrop-blur-md">
        {/* Glow decoration */}
        <div className="absolute -top-12 -right-12 h-28 w-28 rounded-full bg-purple-500/20 blur-2xl pointer-events-none" />

        {/* Top bar with icon and title */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-tr from-[#171625] via-[#4338ca] to-[#6657e8] p-1.5 shadow-md shadow-purple-500/30 flex items-center justify-center">
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
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                  EduTechLab App
                </span>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                  <Sparkles size={10} /> {isAndroid ? "Android App" : isIos ? "iOS App" : "PWA App"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Apne Mobile ki Home Screen par install karein
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

        {/* Pitch text */}
        <p className="mt-3 text-xs leading-5 text-slate-600">
          Ab browser khole bina direct <strong>Home Screen icon</strong> se 1-click me open karein. Fast, full-screen native mobile app jaisa work karega!
        </p>

        {/* Step-by-Step Guide if native prompt didn't fire */}
        {showGuide && (
          <div className="mt-3.5 rounded-2xl bg-purple-50 p-3.5 text-xs text-purple-900 border border-purple-200/70 space-y-2">
            <p className="font-bold flex items-center gap-1.5 text-purple-950">
              <CheckCircle2 size={14} className="text-purple-600" />
              {isIos
                ? "iPhone / Safari par install kaise karein:"
                : isAndroid
                ? "Android / Chrome par install kaise karein:"
                : "Apne Device par install kaise karein:"}
            </p>

            {isIos ? (
              <ol className="list-decimal pl-4 space-y-1 text-[11px] leading-5 text-purple-900">
                <li>Neeche Safari bar me <strong>Share button</strong> <Share size={13} className="inline mx-0.5 text-purple-700" /> par tap karein.</li>
                <li>Menu me scroll karke <strong>Add to Home Screen</strong> <PlusSquare size={13} className="inline mx-0.5 text-purple-700" /> (होम स्क्रीन में जोड़ें) select karein.</li>
                <li>Upar <strong>Add</strong> par tap karein — aapke phone par app add ho jayegi!</li>
              </ol>
            ) : isAndroid ? (
              <ol className="list-decimal pl-4 space-y-1 text-[11px] leading-5 text-purple-900">
                <li>Chrome browser ke top-right corner me <strong>3 Dots</strong> <MoreVertical size={13} className="inline mx-0.5 text-purple-700" /> par tap karein.</li>
                <li>Menu me <strong>"Install app"</strong> ya <strong>"Add to Home screen"</strong> (होम स्क्रीन में जोड़ें) par tap karein.</li>
                <li>Confirm karein — aapke mobile ki home screen par app ban jayegi!</li>
              </ol>
            ) : (
              <p className="text-[11px] leading-5 text-purple-900">
                Browser address bar ke right side me <strong>Install Icon (⊕)</strong> par click karein, ya browser menu me jakar <strong>"Install EduTechLab"</strong> par click karein.
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-4 flex items-center justify-end gap-2.5">
          <button
            onClick={handleDismiss}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            Baad Me / Later
          </button>
          <button
            onClick={handleInstallClick}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-[#6657e8] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-600/25 hover:from-purple-500 hover:to-purple-600 transition hover:-translate-y-0.5 active:translate-y-0"
          >
            <Download size={14} />
            {deferredPrompt ? "Install App Now" : "📲 Mobile Me Install Karein"}
          </button>
        </div>
      </div>
    </div>
  );
}
