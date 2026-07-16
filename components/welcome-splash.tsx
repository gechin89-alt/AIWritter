"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { SplashScreen } from "./splash-screen";

const STORAGE_KEY = "xhswriter_splash_seen";

function subscribe() {
  return () => {};
}

function getSnapshot() {
  return localStorage.getItem(STORAGE_KEY) === "1";
}

function getServerSnapshot() {
  return false;
}

export function WelcomeSplash() {
  const t = useTranslations("home");
  const tn = useTranslations("nav");
  const alreadySeen = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [closing, setClosing] = useState(false);
  const [forceHidden, setForceHidden] = useState(false);

  if (alreadySeen || forceHidden) return null;

  function handleEnter() {
    localStorage.setItem(STORAGE_KEY, "1");
    setClosing(true);
    setTimeout(() => setForceHidden(true), 500);
  }

  return (
    <SplashScreen
      onEnter={handleEnter}
      closing={closing}
      ctaLabel={t("enterCta")}
      brand={tn("brand")}
      tagline={t("subtitle")}
    />
  );
}
