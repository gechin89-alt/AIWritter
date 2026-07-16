export const SPLASH_STORAGE_KEY = "xhswriter_splash_seen";

export function markSplashSeen() {
  if (typeof window !== "undefined") {
    localStorage.setItem(SPLASH_STORAGE_KEY, "1");
  }
}
