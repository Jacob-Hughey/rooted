import { registerSW } from "virtual:pwa-register";

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  registerSW({ immediate: true });
}

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  // iPadOS reports as Mac; touch support gives it away
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** True when launched from the home screen (required for push on iPhone/iPad). */
export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
